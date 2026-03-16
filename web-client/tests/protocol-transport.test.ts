import { describe, expect, it, vi } from 'vitest';

import { resolveTransport } from '@/platform/serial';
import { ConnectionTransport, WebSerialTransport } from '@/platform/serial/transports';
import type { Transport } from '@/platform/serial/types';
import { gbc_read, getResult, ProtocolAdapter, ram_read, rom_erase_sector, rom_read, sendPackage, setSignals } from '@/protocol';
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
      sendAndReceive: vi.fn().mockImplementation(async (payload: Uint8Array, readLen: number) => {
        await send(payload);
        return read(readLen) as Promise<{ data: Uint8Array }>;
      }),
      setSignals: setSignal,
    };
    await expect(ProtocolAdapter.sendPackage(transport, new Uint8Array([1, 2, 3]), 10)).resolves.toBe(true);
    await expect(ProtocolAdapter.getResult(transport, 20)).resolves.toBe(true);
    await expect(ProtocolAdapter.setSignals(transport, { dataTerminalReady: true })).resolves.toBeUndefined();

    expect(send).toHaveBeenCalled();
    expect(read).toHaveBeenCalledWith(1, 20, 'byob');
    expect(setSignal).toHaveBeenCalledWith({ dataTerminalReady: true });
  });

  it('ProtocolAdapter normalizes packet result semantics', async () => {
    const transport: Transport = {
      send: vi.fn().mockResolvedValue(true),
      read: vi.fn().mockResolvedValue({ data: new Uint8Array([0x00]) }),
      sendAndReceive: vi.fn().mockResolvedValue({ data: new Uint8Array([0x00]) }),
      setSignals: vi.fn().mockResolvedValue(undefined),
    };
    await expect(ProtocolAdapter.getPackage(transport, 2, 30, 'default')).resolves.toEqual({ data: new Uint8Array([0x00]) });
    await expect(ProtocolAdapter.getResult(transport, 30)).resolves.toBe(false);
    expect(transport.read).toHaveBeenNthCalledWith(1, 2, 30, 'default');
    expect(transport.read).toHaveBeenNthCalledWith(2, 1, 30, 'byob');
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
        sendAndReceive: vi.fn().mockImplementation(async (payload: Uint8Array, readLen: number) => {
          await send(payload);
          return read(readLen) as Promise<{ data: Uint8Array }>;
        }),
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

  it('ConnectionTransport resets timeout when data continues arriving', async () => {
    const dataCallbacks: ((data: Uint8Array) => void)[] = [];

    const connection: SerialConnection = {
      id: 'conn-4',
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

    const transport = new ConnectionTransport(connection);
    const readPromise = transport.read(3, 20);

    await new Promise(resolve => setTimeout(resolve, 10));
    dataCallbacks[0]?.(new Uint8Array([0xaa]));
    await new Promise(resolve => setTimeout(resolve, 10));
    dataCallbacks[0]?.(new Uint8Array([0xbb]));
    await new Promise(resolve => setTimeout(resolve, 10));
    dataCallbacks[0]?.(new Uint8Array([0xcc]));

    await expect(readPromise).resolves.toEqual({ data: new Uint8Array([0xaa, 0xbb, 0xcc]) });
  });

  it('ConnectionTransport rejects incomplete packets instead of returning short data', async () => {
    const dataCallbacks: ((data: Uint8Array) => void)[] = [];

    const connection: SerialConnection = {
      id: 'conn-5',
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

    const transport = new ConnectionTransport(connection);
    const readPromise = transport.read(3, 15);
    dataCallbacks[0]?.(new Uint8Array([0xaa]));

    await expect(readPromise).rejects.toThrow('Read package timeout in 15ms');
  });

  it('ConnectionTransport propagates send timeout and signal errors', async () => {
    const connection: SerialConnection = {
      id: 'conn-3',
      isOpen: true,
      write: vi.fn().mockImplementation(() => new Promise(() => {})),
      close: vi.fn().mockResolvedValue(undefined),
      setSignals: vi.fn().mockRejectedValue(new Error('signal failed')),
      onData: vi.fn(),
      onError: vi.fn(),
      onClose: vi.fn(),
      removeDataListener: vi.fn(),
      removeErrorListener: vi.fn(),
      removeCloseListener: vi.fn(),
    };

    const transport = new ConnectionTransport(connection);
    await expect(transport.send(new Uint8Array([0x01]), 1)).rejects.toThrow('Send package timeout in 1ms');
    await expect(transport.setSignals({ dataTerminalReady: true })).rejects.toThrow('signal failed');
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

  it('canonical packet-read timeout mapping stays consistent across operations', async () => {
    const timeoutError = new Error('Read package timeout in 30ms');
    const transport: Transport = {
      send: vi.fn().mockResolvedValue(true),
      read: vi.fn().mockRejectedValue(timeoutError),
      sendAndReceive: vi.fn().mockRejectedValue(timeoutError),
      setSignals: vi.fn().mockResolvedValue(undefined),
    };
    await expect(ram_read({ transport }, 4, 0x20)).rejects.toThrow('Reason: packet read timeout');
    await expect(gbc_read({ transport }, 4, 0x30)).rejects.toThrow('Reason: packet read timeout');
  });

  it('canonical packet-read invalid-length mapping stays consistent across operations', async () => {
    const transport: Transport = {
      send: vi.fn().mockResolvedValue(true),
      read: vi.fn().mockResolvedValue({ data: new Uint8Array([0xaa, 0xbb, 0xcc]) }),
      sendAndReceive: vi.fn().mockResolvedValue({ data: new Uint8Array([0xaa, 0xbb, 0xcc]) }),
      setSignals: vi.fn().mockResolvedValue(undefined),
    };
    await expect(ram_read({ transport }, 4, 0x20)).rejects.toThrow('Reason: invalid packet length');
    await expect(gbc_read({ transport }, 4, 0x30)).rejects.toThrow('Reason: invalid packet length');
  });

  it('rom_erase_sector uses direct write/read sequence instead of 0xf3', async () => {
    vi.useFakeTimers();

    const send = vi.fn().mockResolvedValue(true);
    const read = vi.fn()
      .mockResolvedValueOnce({ data: new Uint8Array([0xaa]) })
      .mockResolvedValueOnce({ data: new Uint8Array([0xaa]) })
      .mockResolvedValueOnce({ data: new Uint8Array([0xaa]) })
      .mockResolvedValueOnce({ data: new Uint8Array([0xaa]) })
      .mockResolvedValueOnce({ data: new Uint8Array([0xaa]) })
      .mockResolvedValueOnce({ data: new Uint8Array([0xaa]) })
      .mockResolvedValueOnce({ data: new Uint8Array([0x00, 0x00, 0x00, 0x00]) })
      .mockResolvedValueOnce({ data: new Uint8Array([0x00, 0x00, 0xff, 0xff]) });

    const transport: Transport = {
      send,
      read,
      sendAndReceive: vi.fn().mockImplementation(async (payload: Uint8Array, readLen: number) => {
        await send(payload);
        return read(readLen) as Promise<{ data: Uint8Array }>;
      }),
      setSignals: vi.fn().mockResolvedValue(undefined),
    };

    try {
      const erasePromise = rom_erase_sector({ transport }, 0x20000);
      await vi.runAllTimersAsync();
      await expect(erasePromise).resolves.toBe(true);
    } finally {
      vi.useRealTimers();
    }

    expect(send).toHaveBeenCalledTimes(8);
    expect(read).toHaveBeenCalledTimes(8);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    const sentCommands = send.mock.calls.map(([payload]) => payload[2]);
    expect(sentCommands).toEqual([0xf5, 0xf5, 0xf5, 0xf5, 0xf5, 0xf5, 0xf6, 0xf6]);
    expect(sentCommands).not.toContain(0xf3);

    const eraseCommand = send.mock.calls[5]?.[0] as Uint8Array;
    expect(Array.from(eraseCommand.slice(3, 7))).toEqual([0x00, 0x00, 0x01, 0x00]);
    expect(Array.from(eraseCommand.slice(7, 9))).toEqual([0x30, 0x00]);

    const pollCommand = send.mock.calls[6]?.[0] as Uint8Array;
    expect(Array.from(pollCommand.slice(3, 7))).toEqual([0x00, 0x00, 0x02, 0x00]);
  });

  it('WebSerialTransport BYOB reads full packet across multiple chunks', async () => {
    const releaseLock = vi.fn();
    const read = vi.fn()
      .mockResolvedValueOnce({ value: new Uint8Array([0xaa, 0xbb]), done: false })
      .mockResolvedValueOnce({ value: new Uint8Array([0xcc]), done: false })
      .mockResolvedValueOnce({ value: undefined, done: true });

    const port = {
      readable: {
        getReader: vi.fn().mockReturnValue({
          read,
          releaseLock,
        }),
      },
    } as unknown as SerialPort;

    const transport = new WebSerialTransport(port);
    await expect(transport.read(3, 20, 'byob')).resolves.toEqual({ data: new Uint8Array([0xaa, 0xbb, 0xcc]) });
    expect(releaseLock).toHaveBeenCalled();
  });

  it('clears transport timers after successful operations', async () => {
    vi.useFakeTimers();

    try {
      const connection: SerialConnection = {
        id: 'conn-timer',
        isOpen: true,
        write: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        setSignals: vi.fn().mockResolvedValue(undefined),
        onData: vi.fn(),
        onError: vi.fn(),
        onClose: vi.fn(),
        removeDataListener: vi.fn(),
        removeErrorListener: vi.fn(),
        removeCloseListener: vi.fn(),
      };

      const sendTransport = new ConnectionTransport(connection);
      await expect(sendTransport.send(new Uint8Array([0x01]), 50)).resolves.toBe(true);

      const releaseLock = vi.fn();
      const read = vi.fn()
        .mockResolvedValueOnce({ value: new Uint8Array([0xaa]), done: false })
        .mockResolvedValueOnce({ value: undefined, done: true });
      const port = {
        readable: {
          getReader: vi.fn().mockReturnValue({
            read,
            releaseLock,
          }),
        },
      } as unknown as SerialPort;

      const readTransport = new WebSerialTransport(port);
      await expect(readTransport.read(1, 50, 'default')).resolves.toEqual({ data: new Uint8Array([0xaa]) });

      expect(vi.getTimerCount()).toBe(0);
      expect(releaseLock).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
