import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SimulatedTransport } from '@/platform/serial/simulated/transport';
import { createCommandPayload, GBCCommand } from '@/protocol';
import { DebugSettings } from '@/settings/debug-settings';

const timeoutMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@/utils/async-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/async-utils')>();

  return {
    ...actual,
    timeout: timeoutMock,
  };
});

describe('SimulatedTransport speed control', () => {
  beforeEach(() => {
    timeoutMock.mockClear();
    DebugSettings.debugMode = true;
    DebugSettings.simulatedDelay = 100;
    DebugSettings.simulatedReadSpeed = 2 * 1024;
    DebugSettings.simulatedWriteSpeed = 1 * 1024;
  });

  it('applies base delay plus configured write and read throughput delays', async () => {
    const payload = createCommandPayload(GBCCommand.DIRECT_WRITE)
      .addAddress(0)
      .addBytes(new Uint8Array([0x12]))
      .build();

    const transport = new SimulatedTransport();

    await transport.send(payload);
    await transport.read(1);

    expect(timeoutMock).toHaveBeenNthCalledWith(1, 100 + Math.ceil((payload.byteLength / 1024) * 1000));
    expect(timeoutMock).toHaveBeenNthCalledWith(2, 100 + Math.ceil((1 / (2 * 1024)) * 1000));
  });

  it('executes post-read flushInput inside the same mutex acquisition when flushAfterRead is true', async () => {
    const transport = new SimulatedTransport();
    const events: string[] = [];

    const origSend = transport.send.bind(transport);
    let sendCount = 0;
    vi.spyOn(transport, 'send').mockImplementation(async (p, t) => {
      sendCount += 1;
      events.push(`send-${sendCount}`);
      return origSend(p, t);
    });
    const origFlush = transport.flushInput.bind(transport);
    vi.spyOn(transport, 'flushInput').mockImplementation(async () => {
      events.push('flush-start');
      await Promise.resolve();
      await origFlush();
      events.push('flush-end');
    });

    const payload = createCommandPayload(GBCCommand.DIRECT_WRITE)
      .addAddress(0)
      .addBytes(new Uint8Array([0x12]))
      .build();

    const first = transport.sendAndReceive(payload, 1, 200, 200, { flushAfterRead: true });
    const second = transport.sendAndReceive(payload, 1, 200, 200);

    await Promise.all([first, second]);
    expect(events).toEqual(['send-1', 'flush-start', 'flush-end', 'send-2']);
  });
});
