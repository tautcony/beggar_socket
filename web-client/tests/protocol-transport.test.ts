import { describe, expect, it, vi } from 'vitest';

import { resolveTransport } from '@/platform/serial';
import { ConnectionTransport } from '@/platform/serial/transports';
import type { Transport } from '@/platform/serial/types';
import { ProtocolAdapter } from '@/protocol/beggar_socket/protocol-adapter';
import { getResult, sendPackage, setSignals } from '@/protocol/beggar_socket/protocol-utils';
import type { DeviceInfo } from '@/types/device-info';
import type { SerialConnection } from '@/types/serial';

describe('Protocol transport abstraction', () => {
  it('ProtocolAdapter sends and reads through Transport', async () => {
    const send = vi.fn().mockResolvedValue(true);
    const read = vi.fn().mockResolvedValue({ data: new Uint8Array([0xaa]) });
    const setSignal = vi.fn().mockResolvedValue(undefined);

    const transport: Transport = {
      send,
      read,
      setSignals: setSignal,
    };

    await expect(ProtocolAdapter.sendPackage(transport, new Uint8Array([1, 2, 3]), 10)).resolves.toBe(true);
    await expect(ProtocolAdapter.getResult(transport, 20)).resolves.toBe(true);
    await expect(ProtocolAdapter.setSignals(transport, { dataTerminalReady: true })).resolves.toBeUndefined();

    expect(send).toHaveBeenCalled();
    expect(read).toHaveBeenCalledWith(1, 20, 'byob');
    expect(setSignal).toHaveBeenCalledWith({ dataTerminalReady: true });
  });

  it('protocol-utils resolves transport from legacy device shape', async () => {
    const send = vi.fn().mockResolvedValue(true);
    const read = vi.fn().mockResolvedValue({ data: new Uint8Array([0xaa]) });
    const setSignal = vi.fn().mockResolvedValue(undefined);

    const device: DeviceInfo = {
      port: null,
      transport: {
        send,
        read,
        setSignals: setSignal,
      },
    };

    await sendPackage(device, new Uint8Array([0x01]));
    await expect(getResult(device)).resolves.toBe(true);
    await setSignals(device, { requestToSend: true });

    expect(send).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(1);
    expect(setSignal).toHaveBeenCalledWith({ requestToSend: true });
  });

  it('ConnectionTransport handles send/read/setSignals and timeout', async () => {
    const dataCallbacks: ((data: Uint8Array) => void)[] = [];
    const write = vi.fn().mockResolvedValue(undefined);
    const setSignal = vi.fn().mockResolvedValue(undefined);

    const connection: SerialConnection = {
      id: 'conn-1',
      isOpen: true,
      write,
      close: vi.fn().mockResolvedValue(undefined),
      setSignals: setSignal,
      onData: (callback: (data: Uint8Array) => void) => {
        dataCallbacks.push(callback);
      },
      onError: vi.fn(),
      onClose: vi.fn(),
      removeDataListener: vi.fn(),
      removeErrorListener: vi.fn(),
      removeCloseListener: vi.fn(),
    };

    const transport = new ConnectionTransport(connection);

    await expect(transport.send(new Uint8Array([1]), 20)).resolves.toBe(true);
    const readPromise = transport.read(1, 20);
    if (dataCallbacks[0]) {
      dataCallbacks[0](new Uint8Array([0xaa]));
    }
    await expect(readPromise).resolves.toEqual({ data: new Uint8Array([0xaa]) });
    await expect(transport.setSignals({ dataTerminalReady: false })).resolves.toBeUndefined();

    await expect(transport.read(1, 1)).rejects.toThrow('Read package timeout in 1ms');
  });

  it('resolveTransport falls back to connection transport', async () => {
    const dataCallbacks: ((data: Uint8Array) => void)[] = [];
    const connection: SerialConnection = {
      id: 'conn-2',
      isOpen: true,
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      setSignals: vi.fn().mockResolvedValue(undefined),
      onData: (callback: (data: Uint8Array) => void) => {
        dataCallbacks.push(callback);
      },
      onError: vi.fn(),
      onClose: vi.fn(),
      removeDataListener: vi.fn(),
      removeErrorListener: vi.fn(),
      removeCloseListener: vi.fn(),
    };

    const transport = resolveTransport({
      port: null,
      connection,
    });

    const readPromise = transport.read(1, 20);
    if (dataCallbacks[0]) {
      dataCallbacks[0](new Uint8Array([0xaa]));
    }
    await expect(readPromise).resolves.toEqual({ data: new Uint8Array([0xaa]) });
  });
});
