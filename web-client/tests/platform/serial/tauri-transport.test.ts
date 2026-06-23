import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TauriSerialTransport } from '@/platform/serial/tauri/tauri-serial-transport';

const nativeState = vi.hoisted(() => ({
  readNativeSerial: vi.fn(),
  writeNativeSerial: vi.fn(),
  setNativeSerialSignals: vi.fn(),
  flushNativeSerialInput: vi.fn(),
  closeNativeSerial: vi.fn(),
}));

vi.mock('@/platform/native', () => ({
  readNativeSerial: nativeState.readNativeSerial,
  writeNativeSerial: nativeState.writeNativeSerial,
  setNativeSerialSignals: nativeState.setNativeSerialSignals,
  flushNativeSerialInput: nativeState.flushNativeSerialInput,
  closeNativeSerial: nativeState.closeNativeSerial,
}));

describe('TauriSerialTransport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    nativeState.readNativeSerial.mockResolvedValue(new Uint8Array([0xaa]));
    nativeState.writeNativeSerial.mockResolvedValue(undefined);
    nativeState.setNativeSerialSignals.mockResolvedValue(undefined);
    nativeState.flushNativeSerialInput.mockResolvedValue(undefined);
    nativeState.closeNativeSerial.mockResolvedValue(undefined);
  });

  it('supports send and exact direct reads', async () => {
    const transport = new TauriSerialTransport(1);
    await transport.attachListener();

    await expect(transport.send(new Uint8Array([1, 2, 3]), 20)).resolves.toBe(true);
    nativeState.readNativeSerial.mockResolvedValueOnce(new Uint8Array([0xaa, 0xbb]));
    nativeState.readNativeSerial.mockResolvedValueOnce(new Uint8Array([0xcc]));
    await expect(transport.read(2, 20)).resolves.toEqual({ data: new Uint8Array([0xaa, 0xbb]) });
    await expect(transport.read(1, 20)).resolves.toEqual({ data: new Uint8Array([0xcc]) });
  });

  it('times out when insufficient data arrives', async () => {
    const transport = new TauriSerialTransport(1);
    await transport.attachListener();

    nativeState.readNativeSerial.mockResolvedValueOnce(new Uint8Array([0xaa]));
    nativeState.readNativeSerial.mockRejectedValueOnce(new Error('Read package timeout in 5ms'));
    await expect(transport.read(2, 5)).rejects.toThrow('Read package timeout in 5ms');
  });

  it('serializes sendAndReceive with a mutex', async () => {
    const transport = new TauriSerialTransport(1);
    await transport.attachListener();

    const writes: number[] = [];
    nativeState.writeNativeSerial.mockImplementation((_sessionId: number, payload: Uint8Array) => {
      writes.push(payload[0] ?? 0);
      return Promise.resolve();
    });
    nativeState.readNativeSerial
      .mockResolvedValueOnce(new Uint8Array([0x01]))
      .mockResolvedValueOnce(new Uint8Array([0x02]));

    const first = transport.sendAndReceive(new Uint8Array([0x01]), 1, 20, 20);
    const second = transport.sendAndReceive(new Uint8Array([0x02]), 1, 20, 20);

    await expect(first).resolves.toEqual({ data: new Uint8Array([0x01]) });
    await expect(second).resolves.toEqual({ data: new Uint8Array([0x02]) });
    expect(writes).toEqual([0x01, 0x02]);
  });

  it('sets control signals and closes predictably', async () => {
    const transport = new TauriSerialTransport(1);
    await transport.attachListener();

    await transport.setSignals({ dataTerminalReady: false, requestToSend: true });
    expect(nativeState.setNativeSerialSignals).toHaveBeenNthCalledWith(1, 1, { dataTerminalReady: false });
    expect(nativeState.setNativeSerialSignals).toHaveBeenNthCalledWith(2, 1, { requestToSend: true });

    await transport.close();
    expect(nativeState.closeNativeSerial).toHaveBeenCalledWith(1);
    await expect(transport.send(new Uint8Array([0x01]), 20)).rejects.toThrow('Serial transport is closed');
  });

  it('flushInput clears the native input buffer before a retry', async () => {
    const transport = new TauriSerialTransport(1);
    await transport.attachListener();

    await transport.flushInput();
    expect(nativeState.flushNativeSerialInput).toHaveBeenCalledWith(1);

    nativeState.readNativeSerial.mockResolvedValueOnce(new Uint8Array([0xdd]));
    await expect(transport.read(1, 20)).resolves.toEqual({ data: new Uint8Array([0xdd]) });
  });
});
