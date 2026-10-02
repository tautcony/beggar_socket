import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TauriSerialTransport } from '@/platform/serial/tauri/tauri-serial-transport';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

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
    vi.clearAllMocks();
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

  it('shares an in-flight close and rejects all new I/O until it completes', async () => {
    const closing = deferred<undefined>();
    nativeState.closeNativeSerial.mockReturnValueOnce(closing.promise);
    const transport = new TauriSerialTransport(42);
    const first = transport.close();
    const second = transport.close();
    expect(second).toBe(first);
    await expect(transport.send(new Uint8Array([1]))).rejects.toThrow('Serial transport is closing');
    await expect(transport.read(1)).rejects.toThrow('Serial transport is closing');
    await expect(transport.sendAndReceive(new Uint8Array([1]), 1)).rejects.toThrow('Serial transport is closing');
    await expect(transport.setSignals({ dataTerminalReady: true })).rejects.toThrow('Serial transport is closing');
    await expect(transport.flushInput()).rejects.toThrow('Serial transport is closing');
    await expect(transport.drainInput()).rejects.toThrow('Serial transport is closing');
    expect(nativeState.writeNativeSerial).not.toHaveBeenCalled();
    expect(nativeState.readNativeSerial).not.toHaveBeenCalled();
    expect(nativeState.setNativeSerialSignals).not.toHaveBeenCalled();
    expect(nativeState.flushNativeSerialInput).not.toHaveBeenCalled();
    expect(nativeState.closeNativeSerial).toHaveBeenCalledExactlyOnceWith(42);

    closing.resolve(undefined);
    await Promise.all([first, second]);
    await transport.close();
    expect(nativeState.closeNativeSerial).toHaveBeenCalledTimes(1);
    await expect(transport.flushInput()).rejects.toThrow('Serial transport is closed');
  });

  it.each([false, true])('retries close after a shared failure (synchronous=%s)', async (synchronous) => {
    const failure = new Error('native close failed');
    const closing = deferred<undefined>();
    if (synchronous) {
      nativeState.closeNativeSerial.mockImplementationOnce(() => { throw failure; });
    } else {
      nativeState.closeNativeSerial.mockReturnValueOnce(closing.promise);
    }
    const transport = new TauriSerialTransport(43);
    const first = transport.close();
    const second = transport.close();
    expect(second).toBe(first);
    const rejected = expect(first).rejects.toBe(failure);
    if (!synchronous) {
      await Promise.resolve();
      closing.reject(failure);
    }
    await rejected;
    await expect(second).rejects.toBe(failure);

    await expect(transport.send(new Uint8Array([1]))).resolves.toBe(true);
    await expect(transport.close()).resolves.toBeUndefined();
    expect(nativeState.closeNativeSerial).toHaveBeenNthCalledWith(2, 43);
    await expect(transport.read(1)).rejects.toThrow('Serial transport is closed');
    await transport.close();
    expect(nativeState.closeNativeSerial).toHaveBeenCalledTimes(2);
  });

  it('stops the second signal write when close starts during the first', async () => {
    const signal = deferred<undefined>();
    const closing = deferred<undefined>();
    nativeState.setNativeSerialSignals.mockReturnValueOnce(signal.promise);
    nativeState.closeNativeSerial.mockReturnValueOnce(closing.promise);
    const transport = new TauriSerialTransport(44);
    const signals = transport.setSignals({ dataTerminalReady: true, requestToSend: true });
    const rejected = expect(signals).rejects.toThrow('Serial transport is closing');
    const close = transport.close();
    signal.resolve(undefined);
    await rejected;
    expect(nativeState.setNativeSerialSignals).toHaveBeenCalledExactlyOnceWith(44, { dataTerminalReady: true });
    closing.resolve(undefined);
    await close;
  });

  it('stops draining if close starts during the quiet period', async () => {
    vi.useFakeTimers();
    try {
      const closing = deferred<undefined>();
      nativeState.closeNativeSerial.mockReturnValueOnce(closing.promise);
      const transport = new TauriSerialTransport(45);
      const drain = transport.drainInput(50);
      const rejected = expect(drain).rejects.toThrow('Serial transport is closing');
      await vi.advanceTimersByTimeAsync(0);
      const close = transport.close();
      await vi.advanceTimersByTimeAsync(50);
      await rejected;
      expect(nativeState.flushNativeSerialInput).toHaveBeenCalledExactlyOnceWith(45);
      closing.resolve(undefined);
      await close;
    } finally {
      vi.useRealTimers();
    }
  });

  it('preserves best-effort flush behavior while open', async () => {
    nativeState.flushNativeSerialInput.mockRejectedValueOnce(new Error('flush failed'));
    await expect(new TauriSerialTransport(1).flushInput()).resolves.toBeUndefined();
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
