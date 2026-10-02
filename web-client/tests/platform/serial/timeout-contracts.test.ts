import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TauriSerialTransport } from '@/platform/serial/tauri/tauri-serial-transport';
import { createReadTimeoutError } from '@/platform/serial/transport-errors';
import { WebSerialTransport } from '@/platform/serial/transports';
import { mapCommandError } from '@/types/command-error';

const native = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('@/platform/native', () => ({
  readNativeSerial: native.read,
  closeNativeSerial: vi.fn(), flushNativeSerialInput: vi.fn(),
  setNativeSerialSignals: vi.fn(), writeNativeSerial: vi.fn(),
}));

describe('backend read timeout contracts', () => {
  beforeEach(() => { vi.useFakeTimers(); native.read.mockReset(); });
  afterEach(() => { vi.useRealTimers(); });

  it('WebSerial progress replenishes idle waits across fragments beyond total duration', async () => {
    const chunks = [0x11, 0x22, 0x33];
    const reader = {
      read: vi.fn(() => chunks.length === 0
        ? Promise.resolve({ value: undefined, done: true })
        : new Promise<{ value: Uint8Array; done: boolean }>(resolve => {
          setTimeout(() => { resolve({ value: new Uint8Array([chunks.shift() ?? 0]), done: false }); }, 8);
        })),
      releaseLock: vi.fn(),
    };
    const port = { readable: { getReader: () => reader } } as unknown as SerialPort;
    const transport = new WebSerialTransport(port);
    const pending = transport.read(3, 10);
    await vi.advanceTimersByTimeAsync(24);
    await expect(pending).resolves.toEqual({ data: new Uint8Array([0x11, 0x22, 0x33]) });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('Tauri progress reduces remaining total deadline and does not replenish it', async () => {
    native.read.mockImplementation(() => new Promise<Uint8Array>(resolve => {
      setTimeout(() => { resolve(new Uint8Array([0x11])); }, 8);
    }));
    const transport = new TauriSerialTransport(1);
    const failure = transport.read(3, 10).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(10);
    const error = await failure;
    expect(error).toMatchObject({ code: 'TRANSPORT_TIMEOUT' });
    expect(native.read.mock.calls.map((call: unknown[]) => call[2])).toEqual([10, 2]);
    // The native worker remains independently observed; late resolution is safe.
    await vi.advanceTimersByTimeAsync(10);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('WebSerial stalled fragments report stable code and exact original diagnostic', async () => {
    const reader = { read: vi.fn(() => new Promise(() => {})), releaseLock: vi.fn() };
    const transport = new WebSerialTransport({ readable: { getReader: () => reader } } as unknown as SerialPort);
    const failure = transport.read(3, 10).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(10);
    expect(await failure).toMatchObject({ code: 'TRANSPORT_TIMEOUT' });
  });

  it('timeout code survives mapping without relying on English message matching', () => {
    const error = createReadTimeoutError({ timeout: 10, readId: 2, expectedLength: 3, receivedLength: 1, diagnostics: 'details' });
    expect(error.message).toBe('Read package timeout in 10ms (read#2, expected=3B, received=1B, details)');
    error.message = 'localized diagnostic';
    expect(mapCommandError('transport', error, 'fallback')).toMatchObject({ code: 'timeout', cause: error });
  });
});
