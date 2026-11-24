import { describe, expect, it } from 'vitest';

import { VARIANT_IDS } from '@/device/definitions';
import type { ActiveSession, PendingSession } from '@/device/session';
import { isSessionStageError } from '@/device-runtime/diagnostics';
import { createGbflashDriver } from '@/device-runtime/drivers/gbflash-driver';
import { getDeviceRuntime } from '@/device-runtime/runtime-instance';
import { GBFLASH_CMD, HANDSHAKE_TIMEOUT_MS } from '@/protocol/gbflash';

import { captureStageError } from '../../helpers/rejection';
import { buildTestSession, TEST_GBFLASH_INFO } from '../../helpers/session-profile';

interface ScriptedStep {
  readonly expectTx?: readonly number[];
  readonly rx?: readonly number[];
}

interface FakeTransport {
  readonly transport: PendingSession['transport'];
  readonly sent: { bytes: number[]; timeoutMs?: number }[];
  readonly readTimeouts: (number | undefined)[];
  readonly signals: unknown[];
  readonly flushed: () => number;
  readonly closed: () => number;
}

/**
 * Replays the `0xA1` handshake byte-for-byte and records every lifecycle parameter.
 * `rejectCommands` models a device that refuses a specific command (send returns `false`).
 */
function createTransport(steps: readonly ScriptedStep[] = [], rejectCommands: readonly number[] = []): FakeTransport {
  const sent: { bytes: number[]; timeoutMs?: number }[] = [];
  const readTimeouts: (number | undefined)[] = [];
  const signals: unknown[] = [];
  let queue: number[] = [];
  let stepIndex = 0;
  let flushed = 0;
  let closed = 0;

  const transport: PendingSession['transport'] = {
    send: (payload, timeoutMs) => {
      const bytes = Array.from(payload);
      sent.push({ bytes, ...(timeoutMs !== undefined ? { timeoutMs } : {}) });
      if (rejectCommands.includes(bytes[0])) {
        return Promise.resolve(false);
      }
      const step = steps[stepIndex];
      if (step) {
        if (step.expectTx) {
          expect(bytes).toEqual([...step.expectTx]);
        }
        if (step.rx) {
          queue.push(...step.rx);
        }
        stepIndex += 1;
      }
      return Promise.resolve(true);
    },
    read: (length, timeoutMs) => {
      readTimeouts.push(timeoutMs);
      const chunk = queue.slice(0, length);
      queue = queue.slice(length);
      return Promise.resolve({ data: new Uint8Array(chunk) });
    },
    sendAndReceive: () => Promise.resolve({ data: new Uint8Array(0) }),
    close: () => {
      closed += 1;
      return Promise.resolve();
    },
  };

  Object.assign(transport, {
    setSignals: (value: unknown) => {
      signals.push(value);
      return Promise.resolve();
    },
    flushInput: () => {
      flushed += 1;
      return Promise.resolve();
    },
    flushOutput: () => Promise.resolve(),
  });

  return {
    transport,
    sent,
    readTimeouts,
    signals,
    flushed: () => flushed,
    closed: () => closed,
  };
}

/** `0xA1` reply: size=8, L, fw=14, pcb=13, ts, nameLen=8, "GBFlash\0", flags1, flags2. */
const FW_INFO_RX: readonly number[] = [
  0x08, 0x4c, 0x00, 0x0e, 0x0d, 0x68, 0x30, 0x3d, 0x4c,
  0x08, 0x47, 0x42, 0x46, 0x6c, 0x61, 0x73, 0x68, 0x00,
  0x01, 0x01,
];

function pending(
  fake: FakeTransport,
  options: { backend?: 'serial' | 'simulated'; portInfo?: PendingSession['portInfo'] } = {},
): PendingSession {
  const portInfo = options.portInfo ?? { path: '/dev/cu.usbserial-110', vendorId: '1a86', productId: '7523' };
  return {
    transport: fake.transport,
    selection: getDeviceRuntime().registry.selectVariant(VARIANT_IDS.gbflash),
    portInfo,
    transportFacts: {
      backend: options.backend ?? 'serial',
      usb: { vendorId: portInfo?.vendorId, productId: portInfo?.productId },
    },
  };
}

function activeSession(fake: FakeTransport): ActiveSession {
  return {
    profile: buildTestSession(VARIANT_IDS.gbflash, { firmwareVersion: 'L14' }),
    transport: fake.transport,
    connectionId: 'gbflash-session',
  };
}

describe('GbflashDriver', () => {
  it('skips the handshake on the simulated backend', async () => {
    const fake = createTransport();
    const driver = createGbflashDriver();

    const result = await driver.probe({ pending: pending(fake, { backend: 'simulated' }) });

    expect(result.verification).toBe('not-applicable');
    expect(fake.sent).toEqual([]);
  });

  it('runs the 0xA1 handshake with the unified 250 ms budget and never pulses DTR/RTS', async () => {
    const fake = createTransport([{ expectTx: [GBFLASH_CMD.QUERY_FW_INFO], rx: FW_INFO_RX }]);
    const driver = createGbflashDriver();

    const result = await driver.probe({ pending: pending(fake) });

    expect(HANDSHAKE_TIMEOUT_MS).toBe(250);
    expect(fake.sent).toEqual([{ bytes: [0xa1], timeoutMs: 250 }]);
    expect(fake.readTimeouts.every(timeout => timeout === 250)).toBe(true);
    expect(fake.signals).toEqual([]);
    expect(result).toMatchObject({
      verification: 'verified',
      firmwareVersion: 'L14',
      facts: { firmwareInfo: expect.objectContaining({ pcbName: 'GBFlash', cartPowerCtrl: true }) },
    });
  });

  it('recognises the CDC identity (16c0:27dd) as opposed to CH340', async () => {
    const cdc = createTransport([{ expectTx: [GBFLASH_CMD.QUERY_FW_INFO], rx: FW_INFO_RX }]);
    const driver = createGbflashDriver();

    const cdcResult = await driver.probe({
      pending: pending(cdc, { portInfo: { path: '/dev/cu.usbmodem1', vendorId: '16c0', productId: '27dd' } }),
    });
    expect((cdcResult.facts as { firmwareInfo?: { isCdc: boolean } }).firmwareInfo?.isCdc).toBe(true);

    const ch340 = createTransport([{ expectTx: [GBFLASH_CMD.QUERY_FW_INFO], rx: FW_INFO_RX }]);
    const ch340Result = await driver.probe({ pending: pending(ch340) });
    expect((ch340Result.facts as { firmwareInfo?: { isCdc: boolean } }).firmwareInfo?.isCdc).toBe(false);
  });

  it('keeps the GBFlash protocol when the port looks like a Beggar device', async () => {
    const fake = createTransport([{ expectTx: [GBFLASH_CMD.QUERY_FW_INFO], rx: FW_INFO_RX }]);
    const driver = createGbflashDriver();

    const result = await driver.probe({
      pending: pending(fake, { portInfo: { path: '/dev/tty.usbmodem6D83538A48851', vendorId: '0483', productId: '0721' } }),
    });

    // The selected firmware decides the bytes: only the 0xA1 query leaves the host.
    expect(fake.sent.map(entry => entry.bytes)).toEqual([[0xa1]]);
    expect(result.verification).toBe('verified');
  });

  it('rejects firmware below DEVICE_MIN_FW with an actionable unsupported diagnostic', async () => {
    // fw=0 is below DEVICE_MIN_FW.
    const belowMinimum = [0x08, 0x4c, 0x00, 0x00, 0x0d, 0x68, 0x30, 0x3d, 0x4c];
    const fake = createTransport([{ expectTx: [GBFLASH_CMD.QUERY_FW_INFO], rx: belowMinimum }]);
    const driver = createGbflashDriver();

    const error = await captureStageError(driver.probe({ pending: pending(fake) }));

    expect(isSessionStageError(error)).toBe(true);
    expect(error).toMatchObject({ stage: 'probe', code: 'unsupported' });
    expect(error.diagnostics.map((diagnostic: { code: string }) => diagnostic.code)).toEqual(['unsupported-firmware']);
  });

  it('reports an invalid header as a handshake failure instead of a bare connect error', async () => {
    const fake = createTransport([{ expectTx: [GBFLASH_CMD.QUERY_FW_INFO], rx: [0x04] }]);
    const driver = createGbflashDriver();

    const error = await captureStageError(driver.probe({ pending: pending(fake) }));

    expect(error).toMatchObject({ stage: 'probe', code: 'invalid_response' });
    expect(error.diagnostics[0]).toMatchObject({ code: 'handshake-failed', stage: 'probe' });
  });

  it('tears down with the unique safety sequence and reports a disconnect diagnostic when it fails', async () => {
    const ok = createTransport([
      { expectTx: [GBFLASH_CMD.QUERY_FW_INFO], rx: FW_INFO_RX },
      { expectTx: [GBFLASH_CMD.CART_PWR_OFF], rx: [0x01] },
      { expectTx: [GBFLASH_CMD.SET_VOLTAGE_3_3V], rx: [0x01] },
    ]);
    const driver = createGbflashDriver();
    await driver.probe({ pending: pending(ok) });

    await driver.teardown(activeSession(ok));
    expect(ok.sent.map(entry => entry.bytes)).toEqual([[0xa1], [0xf3], [0xa4]]);

    // A device whose power-off command is rejected still gets the voltage command, and the
    // failure surfaces as a `disconnect` diagnostic instead of blocking the close.
    const failing = createTransport(
      [
        { expectTx: [GBFLASH_CMD.QUERY_FW_INFO], rx: FW_INFO_RX },
        { expectTx: [GBFLASH_CMD.SET_VOLTAGE_3_3V], rx: [0x01] },
      ],
      [GBFLASH_CMD.CART_PWR_OFF],
    );
    const driver2 = createGbflashDriver();
    await driver2.probe({ pending: pending(failing) });

    const error = await captureStageError(driver2.teardown(activeSession(failing)));

    expect(isSessionStageError(error)).toBe(true);
    expect(error).toMatchObject({ stage: 'disconnect', code: 'teardown-failed' });
    expect(error.diagnostics[0]).toMatchObject({ code: 'teardown-failed', stage: 'disconnect' });
    expect(failing.sent.map(entry => entry.bytes)).toEqual([[0xa1], [0xf3], [0xa4]]);
  });

  it('does not invent teardown commands for a session that never completed a handshake', async () => {
    const fake = createTransport();
    const driver = createGbflashDriver();

    await driver.teardown(activeSession(fake));

    expect(fake.sent).toEqual([]);
  });

  it('flushes the transport and drops the probe facts after a failed handshake', async () => {
    const fake = createTransport([{ expectTx: [GBFLASH_CMD.QUERY_FW_INFO], rx: FW_INFO_RX }]);
    const driver = createGbflashDriver();
    const session = pending(fake);

    await driver.probe({ pending: session });
    await driver.cleanupPending(session, 'probe');

    expect(fake.flushed()).toBeGreaterThan(0);
    expect(fake.closed()).toBe(0);
    // Facts were dropped, so a later teardown sends nothing for this transport.
    fake.sent.length = 0;
    await driver.teardown({ profile: activeSession(fake).profile, transport: fake.transport, connectionId: 'x' });
    expect(fake.sent).toEqual([]);
  });

  it('exposes the per-PCB facts through capability signals', async () => {
    const { gbflashCapabilitySignals } = await import('@/device-runtime/drivers/gbflash-driver');

    expect(gbflashCapabilitySignals({ firmwareInfo: TEST_GBFLASH_INFO })).toEqual({
      powerControlPresent: true,
      audioWriteEnabled: true,
      presenceDetectPresent: false,
    });
    expect(gbflashCapabilitySignals({})).toEqual({
      powerControlPresent: false,
      audioWriteEnabled: false,
      presenceDetectPresent: false,
    });
  });
});
