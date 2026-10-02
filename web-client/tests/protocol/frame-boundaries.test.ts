import { describe, expect, it, vi } from 'vitest';

import type { Transport } from '@/platform/serial/types';
import {
  createCommandPayload,
  GBACommand,
  gbc_rom_program,
  gbc_write,
  gbc_write_fram,
  ram_program_flash,
  ram_write,
  ram_write_fram,
  rom_program,
  rom_write,
} from '@/protocol';
import { PayloadBuilder } from '@/protocol/beggar_socket/payload-builder';

describe('Protocol frame boundaries', () => {
  const writes = [
    ['GBA direct', 9, rom_write],
    ['GBA RAM', 9, ram_write],
    ['GBA flash RAM', 9, ram_program_flash],
    ['GBC direct', 9, gbc_write],
    ['GBA FRAM', 10, ram_write_fram],
    ['GBC FRAM', 10, gbc_write_fram],
    ['GBA program', 11, (t: Transport, d: Uint8Array, a: number) => rom_program(t, d, a, 256)],
    ['GBC program', 11, (t: Transport, d: Uint8Array, a: number) => gbc_rom_program(t, d, a, 256)],
  ] as const;

  it.each(writes)('accepts the maximum %s frame and rejects one more data byte', async (_name, overhead, write) => {
    const transport: Transport = {
      send: vi.fn(),
      read: vi.fn(),
      setSignals: vi.fn(),
      sendAndReceive: vi.fn().mockResolvedValue({ data: new Uint8Array([0xaa]) }),
    };
    await write(transport, new Uint8Array(0xffff - overhead), 0);
    const frame = vi.mocked(transport.sendAndReceive).mock.calls[0]?.[0];
    expect(frame?.byteLength).toBe(0xffff);
    expect(frame?.subarray(0, 2)).toEqual(new Uint8Array([0xff, 0xff]));
    expect(frame?.subarray(-2)).toEqual(new Uint8Array([0, 0]));
    await expect(write(transport, new Uint8Array(0x10000 - overhead), 0)).rejects.toThrow(RangeError);
    expect(transport.sendAndReceive).toHaveBeenCalledTimes(1);
  });

  it('rejects overflow without modifying the existing frame', () => {
    const builder = new PayloadBuilder().addBytes(new Uint8Array(0xffff - 4));
    expect(builder.build().byteLength).toBe(0xffff);
    expect(() => builder.addByte(1)).toThrow(RangeError);
    expect(builder.build().byteLength).toBe(0xffff);
  });

  it.each([-1, 0x10000, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid unsigned length %s', (length) => {
    expect(() => new PayloadBuilder().addLength(length)).toThrow(RangeError);
  });

  it('preserves golden bytes and zero CRC placeholders after reuse', () => {
    const builder = createCommandPayload(GBACommand.DIRECT_WRITE).addAddress(0x12345678).addBytes(new Uint8Array([0x42]));
    expect(builder.build()).toEqual(new Uint8Array([10, 0, 0xf5, 0x78, 0x56, 0x34, 0x12, 0x42, 0, 0]));
    expect(builder.build(true)).toEqual(new Uint8Array([10, 0, 0xf5, 0x78, 0x56, 0x34, 0x12, 0x42, 0xa8, 0x0c]));
    expect(builder.build().subarray(-2)).toEqual(new Uint8Array([0, 0]));
    expect(builder.reset().addCommand(GBACommand.ERASE_CHIP).build()).toEqual(new Uint8Array([5, 0, 0xf1, 0, 0]));
    expect(new PayloadBuilder().addLength(0xffff).build().subarray(2, 4)).toEqual(new Uint8Array([0xff, 0xff]));
  });
});
