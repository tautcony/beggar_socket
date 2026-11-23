import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VARIANT_IDS } from '@/device/definitions';
import type { ActiveSession, PendingSession } from '@/device/session';
import { isSessionStageError } from '@/device-runtime/diagnostics';
import { BEGGAR_BOOST_PROBE_TIMEOUT_MS, createBeggarDriver } from '@/device-runtime/drivers/beggar-driver';
import { getDeviceRuntime } from '@/device-runtime/runtime-instance';
import { BOOST_PROBE_REQUEST } from '@/protocol/beggar_socket/boost-constants';

import { captureStageError } from '../../helpers/rejection';
import { buildTestSession } from '../../helpers/session-profile';

interface FakeTransport {
  readonly transport: PendingSession['transport'];
  readonly sent: { bytes: number[]; timeoutMs?: number }[];
  readonly signals: unknown[];
  readonly flushed: () => number;
  readonly closed: () => number;
}

/**
 * Boost-aware transport double: answers `[0x55, 0xAA]` with `ACK + banner + LF`.
 * `banner: null` models a device running standard (non-Boost) firmware.
 */
function createTransport(options: { banner?: string | null } = {}): FakeTransport {
  const banner = options.banner === undefined ? 'ChisFlash-Beggar-Boost v2' : options.banner;
  const sent: { bytes: number[]; timeoutMs?: number }[] = [];
  const signals: unknown[] = [];
  let queue: number[] = [];
  let flushed = 0;
  let closed = 0;

  const transport: PendingSession['transport'] = {
    send: (payload, timeoutMs) => {
      const bytes = Array.from(payload);
      sent.push({ bytes, ...(timeoutMs !== undefined ? { timeoutMs } : {}) });
      if (bytes[0] === BOOST_PROBE_REQUEST[0] && bytes[1] === BOOST_PROBE_REQUEST[1]) {
        queue = banner === null
          ? []
          : [0x01, ...Array.from(new TextEncoder().encode(banner)), 0x0a];
      }
      return Promise.resolve(true);
    },
    read: (length) => {
      const chunk = queue.slice(0, length);
      queue = queue.slice(length);
      return Promise.resolve({ data: new Uint8Array(chunk) });
    },
    sendAndReceive: () => Promise.resolve({ data: new Uint8Array([0x01]) }),
    close: () => {
      closed += 1;
      return Promise.resolve();
    },
  };

  // `setSignals`/`flushInput` live outside the structural session type; the driver narrows
  // through `asPlatformTransport`, so the double must provide them at runtime.
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
    signals,
    flushed: () => flushed,
    closed: () => closed,
  };
}

function pending(variantId: string, fake: FakeTransport, backend: 'serial' | 'simulated' = 'serial'): PendingSession {
  return {
    transport: fake.transport,
    selection: getDeviceRuntime().registry.selectVariant(variantId),
    portInfo: { path: '/dev/cu.usbmodem1', vendorId: '0483', productId: '0721' },
    transportFacts: { backend, usb: { vendorId: '0483', productId: '0721' } },
  };
}

function activeSession(variantId: string, fake: FakeTransport): ActiveSession {
  return {
    profile: buildTestSession(variantId),
    transport: fake.transport,
    connectionId: 'test-session',
  };
}

describe('BeggarDriver', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('skips probing entirely for standard STM firmware and reports `assumed`', async () => {
    const fake = createTransport();
    const driver = createBeggarDriver();

    const result = await driver.probe({ pending: pending(VARIANT_IDS.stm, fake) });

    expect(result).toMatchObject({ verification: 'assumed', facts: {} });
    expect(fake.sent).toEqual([]);
    expect(fake.signals).toEqual([]);
  });

  it('never sends FlashGBX bytes for a Beggar selection on a GBFlash-looking port', async () => {
    const fake = createTransport();
    const driver = createBeggarDriver();
    const flashgbxPort = { path: '/dev/cu.usbserial-110', vendorId: '1a86', productId: '7523' };

    const result = await driver.probe({
      pending: { ...pending(VARIANT_IDS.stm, fake), portInfo: flashgbxPort },
    });

    expect(result.verification).toBe('assumed');
    expect(fake.sent).toEqual([]);
  });

  it('keeps the simulated backend on its implemented capabilities instead of probing', async () => {
    const fake = createTransport();
    const driver = createBeggarDriver();

    const result = await driver.probe({ pending: pending(VARIANT_IDS.stmBoost, fake, 'simulated') });

    expect(result.verification).toBe('not-applicable');
    expect(fake.sent).toEqual([]);
  });

  it('verifies a Boost handshake with the fixed 250 ms budget and publishes the banner', async () => {
    const fake = createTransport({ banner: 'ChisFlash-Beggar-Boost v2' });
    const driver = createBeggarDriver();

    const result = await driver.probe({ pending: pending(VARIANT_IDS.stmBoost, fake) });

    expect(BEGGAR_BOOST_PROBE_TIMEOUT_MS).toBe(250);
    expect(fake.sent).toEqual([{ bytes: [0x55, 0xaa], timeoutMs: 250 }]);
    expect(result).toMatchObject({
      verification: 'verified',
      firmwareVersion: 'ChisFlash-Beggar-Boost v2',
      facts: { boostSupported: true, boostBanner: 'ChisFlash-Beggar-Boost v2' },
    });
  });

  it('fails a Boost selection that answers nothing, resets it and keeps the port closable', async () => {
    const fake = createTransport({ banner: null });
    const driver = createBeggarDriver();

    const error = await captureStageError(driver.probe({ pending: pending(VARIANT_IDS.stmBoost, fake) }));

    expect(isSessionStageError(error)).toBe(true);
    expect(error).toMatchObject({ stage: 'probe', code: 'boost-unsupported' });
    expect(error.diagnostics.map((diagnostic: { code: string }) => diagnostic.code)).toEqual(['boost-probe-failed']);
    // The reset pulse runs so the next attempt does not inherit Boost mode.
    expect(fake.signals.length).toBeGreaterThan(0);
    expect(fake.closed()).toBe(0);
  });

  it('tears down Boost state on disconnect but leaves standard firmware untouched', async () => {
    const boosted = createTransport();
    const driver = createBeggarDriver();
    await driver.probe({ pending: pending(VARIANT_IDS.stmBoost, boosted) });

    await driver.teardown(activeSession(VARIANT_IDS.stmBoost, boosted));
    expect(boosted.signals.length).toBeGreaterThan(0);

    const standard = createTransport();
    await driver.teardown(activeSession(VARIANT_IDS.stm, standard));
    expect(standard.signals).toEqual([]);
    expect(standard.sent).toEqual([]);
  });

  it('cleans protocol state without closing the transport that the orchestration owns', async () => {
    const fake = createTransport({ banner: null });
    const driver = createBeggarDriver();
    const session = pending(VARIANT_IDS.stmBoost, fake);

    await driver.cleanupPending(session, 'probe');

    expect(fake.flushed()).toBeGreaterThan(0);
    expect(fake.closed()).toBe(0);
  });

  it('has no extra initialisation step', async () => {
    const driver = createBeggarDriver();
    await expect(driver.initialize?.(pending(VARIANT_IDS.stm, createTransport()))).resolves.toBeUndefined();
  });
});
