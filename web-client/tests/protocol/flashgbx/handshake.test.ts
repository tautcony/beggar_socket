import { describe, expect, it } from 'vitest';

import type { Transport } from '@/platform/serial';
import {
  FLASHGBX_CMD,
  FlashgbxHandshakeError,
  performFlashgbxDisconnect,
  performFlashgbxHandshake,
  performFlashgbxTeardown,
} from '@/protocol/flashgbx';

interface ScriptStep {
  expectedTx?: number[];
  rx?: number[];
  rxAvailable?: number[];
  errorOnRead?: Error;
}

function createReplayTransport(steps: ScriptStep[]): {
  transport: Transport;
  sent: number[][];
  flushedInput: number;
  flushedOutput: number;
} {
  const sent: number[][] = [];
  let rxQueue: number[] = [];
  let stepIndex = 0;
  let flushedInput = 0;
  let flushedOutput = 0;

  const transport: Transport = {
    send: (payload: Uint8Array) => {
      const bytes = Array.from(payload);
      sent.push(bytes);
      const step = steps[stepIndex];
      if (step?.expectedTx) {
        expect(bytes).toEqual(step.expectedTx);
        if (step.rx) {
          rxQueue.push(...step.rx);
        }
        stepIndex += 1;
      }
      return Promise.resolve(true);
    },
    read: (length: number) => {
      const current = steps[stepIndex - 1];
      if (current?.errorOnRead) {
        return Promise.reject(current.errorOnRead);
      }
      if (rxQueue.length === 0) {
        return Promise.resolve({ data: new Uint8Array(0) });
      }
      const chunk = rxQueue.slice(0, length);
      rxQueue = rxQueue.slice(length);
      return Promise.resolve({ data: new Uint8Array(chunk) });
    },
    readAvailable: () => {
      const current = steps[stepIndex - 1];
      if (current?.errorOnRead) {
        return Promise.reject(current.errorOnRead);
      }
      if (current?.rxAvailable) {
        return Promise.resolve({ data: new Uint8Array(current.rxAvailable) });
      }
      const chunk = rxQueue.slice();
      rxQueue = [];
      return Promise.resolve({ data: new Uint8Array(chunk) });
    },
    sendAndReceive: () => Promise.resolve({ data: new Uint8Array(0) }),
    setSignals: () => Promise.reject(new Error('DTR/RTS setSignals must never be called during FlashGBX handshake')),
    flushInput: () => {
      flushedInput += 1;
      return Promise.resolve();
    },
    flushOutput: () => {
      flushedOutput += 1;
      return Promise.resolve();
    },
  };

  return {
    transport,
    sent,
    get flushedInput() {
      return flushedInput;
    },
    get flushedOutput() {
      return flushedOutput;
    },
  };
}

function buildFwInfoBytes(options: {
  cfwId?: string;
  fwVer: number;
  pcbVer: number;
  fwTs?: number;
  pcbName?: string;
  flags1?: number;
  flags2?: number;
}): number[] {
  const cfw = (options.cfwId ?? 'L').charCodeAt(0);
  const fwHi = (options.fwVer >> 8) & 0xff;
  const fwLo = options.fwVer & 0xff;
  const ts = options.fwTs ?? 0x68303d4c;
  const bytes = [
    8,
    cfw,
    fwHi,
    fwLo,
    options.pcbVer & 0xff,
    (ts >>> 24) & 0xff,
    (ts >>> 16) & 0xff,
    (ts >>> 8) & 0xff,
    ts & 0xff,
  ];
  if ((options.cfwId ?? 'L') === 'L' && options.fwVer >= 12) {
    const nameBytes = Array.from(new TextEncoder().encode(options.pcbName ?? 'TestDevice'));
    bytes.push(nameBytes.length, ...nameBytes, options.flags1 ?? 0x01, options.flags2 ?? 0x01);
  }
  return bytes;
}

describe('FlashGBX protocol handshake replay', () => {
  it('handshakes CH340 GBFlash (1A86:7523) using live /dev/cu.usbserial-110 probe bytes', async () => {
    const liveQueryFwResponse = [
      0x08, 0x4c, 0x00, 0x0e, 0x0d, 0x68, 0x30, 0x3d, 0x4c,
      0x08, 0x47, 0x42, 0x46, 0x6c, 0x61, 0x73, 0x68, 0x00,
      0x01, 0x01,
    ];
    const replay = createReplayTransport([
      { expectedTx: [FLASHGBX_CMD.QUERY_FW_INFO], rx: liveQueryFwResponse },
    ]);

    const info = await performFlashgbxHandshake(replay.transport, {
      portInfo: { path: '/dev/cu.usbserial-110', vendorId: '1a86', productId: '7523' },
      baudRate: 2_000_000,
    });

    expect(replay.sent).toEqual([[FLASHGBX_CMD.QUERY_FW_INFO]]);
    expect(info).toMatchObject({
      family: 'gbflash',
      cfwId: 'L',
      fwVer: 14,
      pcbVer: 13,
      pcbName: 'GBFlash',
      cartPowerCtrl: true,
      bootloaderReset: true,
      hasDeviceSerial: false,
      audioWePin: true,
      isCdc: false,
    });
  });

  it('sets audioWePin to false for GBFlash pcbVer < 13 with cartPowerCtrl', async () => {
    const replay = createReplayTransport([
      { expectedTx: [FLASHGBX_CMD.QUERY_FW_INFO], rx: buildFwInfoBytes({ fwVer: 12, pcbVer: 12, pcbName: 'GBFlash', flags1: 0x01 }) },
    ]);

    const info = await performFlashgbxHandshake(replay.transport, {
      portInfo: { path: '/dev/cu.usbserial-110', vendorId: '1a86', productId: '7523' },
    });

    expect(info.family).toBe('gbflash');
    expect(info.pcbVer).toBe(12);
    expect(info.cartPowerCtrl).toBe(true);
    expect(info.audioWePin).toBe(false);
  });

  it('handshakes CDC GBFlash (16C0:27DD) with isCdc = true', async () => {
    const replay = createReplayTransport([
      {
        expectedTx: [FLASHGBX_CMD.QUERY_FW_INFO],
        rx: buildFwInfoBytes({ fwVer: 16, pcbVer: 13, pcbName: 'GBFlash', flags1: 0x01, flags2: 0x03 }),
      },
    ]);

    const info = await performFlashgbxHandshake(replay.transport, {
      portInfo: { path: '/dev/cu.usbmodem1', vendorId: '16c0', productId: '27dd' },
    });

    expect(replay.sent).toEqual([[FLASHGBX_CMD.QUERY_FW_INFO]]);
    expect(info).toMatchObject({
      family: 'gbflash',
      fwVer: 16,
      pcbVer: 13,
      isCdc: true,
      cartPowerCtrl: true,
      audioWePin: true,
    });
  });

  it('rejects fw_ver === 0 in 0xA1 as unsupported', async () => {
    const replay = createReplayTransport([
      { expectedTx: [FLASHGBX_CMD.QUERY_FW_INFO], rx: buildFwInfoBytes({ fwVer: 0, pcbVer: 13 }) },
    ]);

    await expect(
      performFlashgbxHandshake(replay.transport, {
        portInfo: { path: '/dev/cu.usbmodem1', vendorId: '16c0', productId: '27dd' },
      }),
    ).rejects.toMatchObject({
      stage: 'unsupported',
      code: 'unsupported',
    });
  });

  it('reports exact stage on invalid 0xA1 header size', async () => {
    const replay = createReplayTransport([
      { expectedTx: [FLASHGBX_CMD.QUERY_FW_INFO], rx: [4] },
    ]);

    await expect(
      performFlashgbxHandshake(replay.transport, {
        portInfo: { path: '/dev/cu.usbmodem1', vendorId: '16c0', productId: '27dd' },
      }),
    ).rejects.toBeInstanceOf(FlashgbxHandshakeError);

    try {
      const replay2 = createReplayTransport([
        { expectedTx: [FLASHGBX_CMD.QUERY_FW_INFO], rx: [4] },
      ]);
      await performFlashgbxHandshake(replay2.transport, {
        portInfo: { path: '/dev/cu.usbmodem1', vendorId: '16c0', productId: '27dd' },
      });
    } catch (error) {
      expect(error).toBeInstanceOf(FlashgbxHandshakeError);
      expect((error as FlashgbxHandshakeError).stage).toBe('fw_info_header');
      expect((error as FlashgbxHandshakeError).code).toBe('invalid_response');
    }
  });

  it('executes the canonical disconnect sequence (CART_PWR_OFF then SET_VOLTAGE_3_3V, voltage only without power control)', async () => {
    const pwrReplay = createReplayTransport([
      { expectedTx: [FLASHGBX_CMD.CART_PWR_OFF], rx: [0x01] },
      { expectedTx: [FLASHGBX_CMD.SET_VOLTAGE_3_3V], rx: [0x01] },
    ]);

    const pwrResult = await performFlashgbxTeardown(pwrReplay.transport, {
      family: 'gbflash',
      cfwId: 'L',
      fwVer: 14,
      pcbVer: 13,
      fwTs: 0,
      ofwVer: null,
      pcbName: 'GBFlash',
      cartPowerCtrl: true,
      cartPresenceSwitch: false,
      cartModeSwitch: false,
      bootloaderReset: true,
      hasDeviceSerial: false,
      unregistered: false,
      audioWePin: true,
      isCdc: false,
    });
    expect(pwrReplay.sent).toEqual([[0xf3], [0xa4]]);
    expect(pwrResult.failures).toEqual([]);

    const noPwrReplay = createReplayTransport([
      { expectedTx: [FLASHGBX_CMD.SET_VOLTAGE_3_3V] },
    ]);
    await performFlashgbxDisconnect(noPwrReplay.transport, {
      family: 'gbflash',
      cfwId: 'L',
      fwVer: 10,
      pcbVer: 10,
      fwTs: 0,
      ofwVer: null,
      pcbName: 'GBFlash',
      cartPowerCtrl: false,
      cartPresenceSwitch: false,
      cartModeSwitch: false,
      bootloaderReset: false,
      hasDeviceSerial: false,
      unregistered: false,
      audioWePin: true,
      isCdc: false,
    });
    expect(noPwrReplay.sent).toEqual([[0xa4]]);
  });

  it('keeps the voltage command when CART_PWR_OFF fails and reports the failure', async () => {
    const sent: number[][] = [];
    const transport: Transport = {
      send: (payload: Uint8Array) => {
        const bytes = Array.from(payload);
        sent.push(bytes);
        // The cartridge power-off command is rejected, the voltage command still goes out.
        return Promise.resolve(bytes[0] !== FLASHGBX_CMD.CART_PWR_OFF);
      },
      read: () => Promise.resolve({ data: new Uint8Array([0x01]) }),
      readAvailable: () => Promise.resolve({ data: new Uint8Array(0) }),
      sendAndReceive: () => Promise.resolve({ data: new Uint8Array(0) }),
      setSignals: () => Promise.resolve(),
      flushInput: () => Promise.resolve(),
      flushOutput: () => Promise.resolve(),
    };

    const result = await performFlashgbxTeardown(transport, {
      family: 'gbflash',
      cfwId: 'L',
      fwVer: 14,
      pcbVer: 13,
      fwTs: 0,
      ofwVer: null,
      pcbName: 'GBFlash',
      cartPowerCtrl: true,
      cartPresenceSwitch: false,
      cartModeSwitch: false,
      bootloaderReset: true,
      hasDeviceSerial: false,
      unregistered: false,
      audioWePin: true,
      isCdc: false,
    });

    expect(sent).toEqual([[0xf3], [0xa4]]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].command).toBe('cart-power-off');
  });

  it('does nothing when no handshake result is available', async () => {
    const replay = createReplayTransport([]);
    const result = await performFlashgbxTeardown(replay.transport, null);
    expect(replay.sent).toEqual([]);
    expect(result.failures).toEqual([]);
  });
});
