import { describe, expect, it, vi } from 'vitest';

import { WebSerialTransport } from '@/platform/serial/transports';

function createFakeWebSerialPort() {
  let readChunks: Uint8Array[] = [];
  let readResolver: ((value: ReadableStreamReadResult<Uint8Array>) => void) | null = null;
  const written: Uint8Array[] = [];

  const readable = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (readChunks.length > 0) {
        controller.enqueue(readChunks.shift()!);
        return;
      }
      return new Promise<void>((resolve) => {
        readResolver = (res) => {
          if (res.done) {
            controller.close();
          } else if (res.value) {
            controller.enqueue(res.value);
          }
          resolve();
        };
      });
    },
  });

  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      written.push(new Uint8Array(chunk));
    },
  });

  const port = {
    readable,
    writable,
    setSignals: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as SerialPort;

  const pushInput = (bytes: Uint8Array) => {
    if (readResolver) {
      const resolve = readResolver;
      readResolver = null;
      resolve({ done: false, value: bytes });
    } else {
      readChunks.push(bytes);
    }
  };

  return { port, written, pushInput, clearInput: () => { readChunks = []; } };
}

describe('WebSerialTransport atomic sendAndReceive', () => {
  it('flushes stray input inside the mutex before allowing the next sendAndReceive', async () => {
    const { port, pushInput } = createFakeWebSerialPort();
    const transport = new WebSerialTransport(port);
    const events: string[] = [];

    const origFlush = transport.flushInput.bind(transport);
    vi.spyOn(transport, 'flushInput').mockImplementation(async () => {
      events.push('flush-start');
      await Promise.resolve();
      await origFlush();
      events.push('flush-end');
    });

    const origSend = transport.send.bind(transport);
    let sendCount = 0;
    vi.spyOn(transport, 'send').mockImplementation(async (payload, timeoutMs) => {
      sendCount += 1;
      events.push(`send-${sendCount}`);
      const ok = await origSend(payload, timeoutMs);
      if (sendCount === 1) {
        // Simulate ACK byte followed by stray trailing byte in the same packet
        pushInput(new Uint8Array([0xaa, 0xee]));
      } else {
        pushInput(new Uint8Array([0x55]));
      }
      return ok;
    });

    const first = transport.sendAndReceive(new Uint8Array([0x01]), 1, 200, 200, { flushAfterRead: true });
    const second = transport.sendAndReceive(new Uint8Array([0x02]), 1, 200, 200);

    const [res1, res2] = await Promise.all([first, second]);

    expect(Array.from(res1.data)).toEqual([0xaa]);
    expect(Array.from(res2.data)).toEqual([0x55]);
    expect(events).toEqual(['send-1', 'flush-start', 'flush-end', 'send-2']);
  });
});
