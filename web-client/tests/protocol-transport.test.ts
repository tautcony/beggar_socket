import { describe, expect, it, vi } from 'vitest';

import { resolveTransport } from '@/platform/serial';
import { WebSerialTransport } from '@/platform/serial/transports';
import type { Transport } from '@/platform/serial/types';
import { gbc_read, gbc_write, getResult, ProtocolAdapter, ram_read, rom_erase_sector, rom_read, sendPackage, setSignals } from '@/protocol';
import { readProtocolPayload } from '@/protocol/beggar_socket/packet-read';
import type { DeviceInfo } from '@/types/device-info';

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

  it('resolveTransport rejects legacy device shapes without a transport or port', () => {
    expect(() => resolveTransport({
      port: null,
      connection: null,
    })).toThrow('Serial port not properly initialized');
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

  it('canonical packet-read failures expose stable protocol error codes', async () => {
    const timeoutTransport: Transport = {
      send: vi.fn().mockResolvedValue(true),
      read: vi.fn().mockRejectedValue(new Error('Read package timeout in 30ms')),
      sendAndReceive: vi.fn().mockRejectedValue(new Error('Read package timeout in 30ms')),
      setSignals: vi.fn().mockResolvedValue(undefined),
    };

    await expect(ram_read({ transport: timeoutTransport }, 4, 0x20)).rejects.toMatchObject({
      code: 'PACKET_TIMEOUT',
    });

    const shortTransport: Transport = {
      send: vi.fn().mockResolvedValue(true),
      read: vi.fn().mockResolvedValue({ data: new Uint8Array([0xaa]) }),
      sendAndReceive: vi.fn().mockResolvedValue({ data: new Uint8Array([0xaa]) }),
      setSignals: vi.fn().mockResolvedValue(undefined),
    };

    await expect(readProtocolPayload({ transport: shortTransport }, 'GBC read', 2, 0x10)).rejects.toMatchObject({
      code: 'LENGTH_MISMATCH',
    });
  });

  it('protocol commands use atomic sendAndReceive for ack and payload responses', async () => {
    const send = vi.fn().mockRejectedValue(new Error('legacy send should not be used'));
    const read = vi.fn().mockRejectedValue(new Error('legacy read should not be used'));
    const sendAndReceive = vi.fn()
      .mockResolvedValueOnce({ data: new Uint8Array([0xaa]) })
      .mockResolvedValueOnce({ data: new Uint8Array([0x00, 0x00, 0x42, 0x24]) });

    const transport: Transport = {
      send,
      read,
      sendAndReceive,
      setSignals: vi.fn().mockResolvedValue(undefined),
    };

    await expect(gbc_write({ transport }, new Uint8Array([0x99]), 0x1234)).resolves.toBeUndefined();
    await expect(ram_read({ transport }, 2, 0x20)).resolves.toEqual(new Uint8Array([0x42, 0x24]));

    expect(send).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    expect(sendAndReceive).toHaveBeenCalledTimes(2);
    expect(sendAndReceive.mock.calls[0]?.[1]).toBe(1);
    expect(sendAndReceive.mock.calls[1]?.[1]).toBe(4);
  });

  it('concurrent protocol reads keep request-response pairs aligned', async () => {
    let queue = Promise.resolve();
    const send = vi.fn().mockRejectedValue(new Error('legacy send should not be used'));
    const read = vi.fn().mockRejectedValue(new Error('legacy read should not be used'));
    const sendAndReceive = vi.fn().mockImplementation(async (payload: Uint8Array, readLength: number) => {
      const previous = queue;
      let release: (() => void) | undefined;
      queue = new Promise<void>((resolve) => {
        release = resolve;
      });

      await previous;
      try {
        await Promise.resolve();
        const response = new Uint8Array(readLength);
        response[2] = payload[3] ?? 0;
        return { data: response };
      } finally {
        release?.();
      }
    });

    const transport: Transport = {
      send,
      read,
      sendAndReceive,
      setSignals: vi.fn().mockResolvedValue(undefined),
    };

    const [first, second] = await Promise.all([
      ram_read({ transport }, 1, 0x10),
      ram_read({ transport }, 1, 0x20),
    ]);

    expect(first).toEqual(new Uint8Array([0x10]));
    expect(second).toEqual(new Uint8Array([0x20]));
    expect(send).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    expect(sendAndReceive).toHaveBeenCalledTimes(2);
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

  it('WebSerialTransport timeout diagnostics include partial-read context', async () => {
    const releaseLock = vi.fn();
    const read = vi.fn()
      .mockResolvedValueOnce({ value: new Uint8Array([0xaa]), done: false })
      .mockImplementationOnce(() => new Promise(() => {}));

    const port = {
      readable: {
        getReader: vi.fn().mockReturnValue({
          read,
          releaseLock,
        }),
      },
    } as unknown as SerialPort;

    const transport = new WebSerialTransport(port);
    await expect(transport.read(3, 5, 'byob')).rejects.toThrow('expected=3B, received=1B');
  });

  it('WebSerialTransport waits for timed-out writer recovery before next send', async () => {
    vi.useFakeTimers();

    try {
      let resolveAbort: (() => void) | undefined;
      const firstWriter = {
        write: vi.fn().mockImplementation(() => new Promise(() => {})),
        abort: vi.fn().mockImplementation(() => new Promise<void>((resolve) => {
          resolveAbort = resolve;
        })),
        releaseLock: vi.fn(),
      };
      const secondWriter = {
        write: vi.fn().mockResolvedValue(undefined),
        abort: vi.fn().mockResolvedValue(undefined),
        releaseLock: vi.fn(),
      };
      const getWriter = vi.fn()
        .mockReturnValueOnce(firstWriter)
        .mockReturnValueOnce(secondWriter);

      const port = {
        writable: {
          getWriter,
        },
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as SerialPort;

      const transport = new WebSerialTransport(port);
      const firstSend = transport.send(new Uint8Array([0x01]), 5);
      const firstSendExpectation = expect(firstSend).rejects.toThrow('Send package timeout in 5ms');

      await vi.advanceTimersByTimeAsync(5);
      await firstSendExpectation;

      const secondSend = transport.send(new Uint8Array([0x02]), 20);
      await Promise.resolve();

      expect(getWriter).toHaveBeenCalledTimes(1);
      expect(secondWriter.write).not.toHaveBeenCalled();

      resolveAbort?.();
      await expect(secondSend).resolves.toBe(true);

      expect(firstWriter.abort).toHaveBeenCalledTimes(1);
      expect(firstWriter.releaseLock).toHaveBeenCalledTimes(1);
      expect(getWriter).toHaveBeenCalledTimes(2);
      expect(secondWriter.write).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('WebSerialTransport close waits for timed-out writer recovery', async () => {
    vi.useFakeTimers();

    try {
      let resolveAbort: (() => void) | undefined;
      const writer = {
        write: vi.fn().mockImplementation(() => new Promise(() => {})),
        abort: vi.fn().mockImplementation(() => new Promise<void>((resolve) => {
          resolveAbort = resolve;
        })),
        releaseLock: vi.fn(),
      };
      const close = vi.fn().mockResolvedValue(undefined);

      const port = {
        writable: {
          getWriter: vi.fn().mockReturnValue(writer),
        },
        close,
      } as unknown as SerialPort;

      const transport = new WebSerialTransport(port);
      const send = transport.send(new Uint8Array([0x01]), 5);
      const sendExpectation = expect(send).rejects.toThrow('Send package timeout in 5ms');

      await vi.advanceTimersByTimeAsync(5);
      await sendExpectation;

      const closePromise = transport.close();
      await Promise.resolve();
      expect(close).not.toHaveBeenCalled();

      resolveAbort?.();
      await closePromise;

      expect(writer.abort).toHaveBeenCalledTimes(1);
      expect(writer.releaseLock).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
