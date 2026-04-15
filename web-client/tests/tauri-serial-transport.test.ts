import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TauriSerialTransport } from '@/platform/serial/tauri/tauri-serial-transport';

const serialPortState = vi.hoisted(() => ({
  readBinary: vi.fn(),
  writeBinary: vi.fn(),
  writeDataTerminalReady: vi.fn(),
  writeRequestToSend: vi.fn(),
  clearBuffer: vi.fn(),
  close: vi.fn(),
}));

vi.mock('tauri-plugin-serialplugin-api', () => ({
  SerialPort: class {},
  ClearBuffer: { Input: 'Input' },
}));

function createMockPort() {
  return {
    readBinary: serialPortState.readBinary,
    writeBinary: serialPortState.writeBinary,
    writeDataTerminalReady: serialPortState.writeDataTerminalReady,
    writeRequestToSend: serialPortState.writeRequestToSend,
    clearBuffer: serialPortState.clearBuffer,
    close: serialPortState.close,
  };
}

describe('TauriSerialTransport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    serialPortState.readBinary.mockResolvedValue(new Uint8Array([0xaa]));
    serialPortState.writeBinary.mockResolvedValue(1);
    serialPortState.writeDataTerminalReady.mockResolvedValue(undefined);
    serialPortState.writeRequestToSend.mockResolvedValue(undefined);
    serialPortState.clearBuffer.mockResolvedValue(undefined);
    serialPortState.close.mockResolvedValue(undefined);
  });

  it('supports send and exact direct reads', async () => {
    const port = createMockPort();
    const transport = new TauriSerialTransport(port as never);
    await transport.attachListener();

    await expect(transport.send(new Uint8Array([1, 2, 3]), 20)).resolves.toBe(true);
    serialPortState.readBinary.mockResolvedValueOnce(new Uint8Array([0xaa, 0xbb]));
    serialPortState.readBinary.mockResolvedValueOnce(new Uint8Array([0xcc]));
    await expect(transport.read(2, 20)).resolves.toEqual({ data: new Uint8Array([0xaa, 0xbb]) });
    await expect(transport.read(1, 20)).resolves.toEqual({ data: new Uint8Array([0xcc]) });
  });

  it('times out when insufficient data arrives', async () => {
    const port = createMockPort();
    const transport = new TauriSerialTransport(port as never);
    await transport.attachListener();

    serialPortState.readBinary.mockResolvedValueOnce(new Uint8Array([0xaa]));
    serialPortState.readBinary.mockRejectedValueOnce(new Error('Read package timeout in 5ms'));
    await expect(transport.read(2, 5)).rejects.toThrow('Read package timeout in 5ms');
  });

  it('serializes sendAndReceive with a mutex', async () => {
    const port = createMockPort();
    const transport = new TauriSerialTransport(port as never);
    await transport.attachListener();

    const writes: number[] = [];
    serialPortState.writeBinary.mockImplementation((payload: Uint8Array) => {
      writes.push(payload[0] ?? 0);
      return Promise.resolve(payload.length);
    });
    serialPortState.readBinary
      .mockResolvedValueOnce(new Uint8Array([0x01]))
      .mockResolvedValueOnce(new Uint8Array([0x02]));

    const first = transport.sendAndReceive(new Uint8Array([0x01]), 1, 20, 20);
    const second = transport.sendAndReceive(new Uint8Array([0x02]), 1, 20, 20);

    await expect(first).resolves.toEqual({ data: new Uint8Array([0x01]) });
    await expect(second).resolves.toEqual({ data: new Uint8Array([0x02]) });
    expect(writes).toEqual([0x01, 0x02]);
  });

  it('sets control signals and closes predictably', async () => {
    const port = createMockPort();
    const transport = new TauriSerialTransport(port as never);
    await transport.attachListener();

    await transport.setSignals({ dataTerminalReady: false, requestToSend: true });
    expect(serialPortState.writeDataTerminalReady).toHaveBeenCalledWith(false);
    expect(serialPortState.writeRequestToSend).toHaveBeenCalledWith(true);

    await transport.close();
    expect(serialPortState.close).toHaveBeenCalled();
    await expect(transport.send(new Uint8Array([0x01]), 20)).rejects.toThrow('Serial transport is closed');
  });

  it('flushInput clears the native input buffer before a retry', async () => {
    const port = createMockPort();
    const transport = new TauriSerialTransport(port as never);
    await transport.attachListener();

    await transport.flushInput();
    expect(serialPortState.clearBuffer).toHaveBeenCalledWith('Input');

    serialPortState.readBinary.mockResolvedValueOnce(new Uint8Array([0xdd]));
    await expect(transport.read(1, 20)).resolves.toEqual({ data: new Uint8Array([0xdd]) });
  });
});
