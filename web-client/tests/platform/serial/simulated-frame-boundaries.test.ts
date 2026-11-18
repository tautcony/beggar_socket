import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSimulatedDeviceState, executeSimulatedCommand } from '@/platform/serial/simulated/runtime';
import { SimulatedTransport } from '@/platform/serial/simulated/transport';
import { createCommandPayload, GBACommand, GBCCommand } from '@/protocol';
import { DebugSettings } from '@/settings/debug-settings';

vi.mock('@/utils/async-utils', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/utils/async-utils')>(),
  timeout: vi.fn().mockResolvedValue(undefined),
}));

describe('Simulated frame boundaries', () => {
  beforeEach(() => {
    DebugSettings.debugMode = true;
    DebugSettings.simulateErrors = false;
    DebugSettings.clearAllSimulatedMemoryImages();
  });

  it.each([
    new Uint8Array(),
    new Uint8Array([4, 0, 0xf1, 0]),
    new Uint8Array([6, 0, 0xf1, 0, 0]),
    new Uint8Array([5, 0, 0x00, 0, 0]),
    new Uint8Array([5, 0, 0xf5, 0, 0]),
    new Uint8Array([5, 0, 0xf6, 0, 0]),
    new Uint8Array(0x10000),
  ])('rejects malformed frames without mutation or queued ACK', async (frame) => {
    const state = createSimulatedDeviceState();
    state.gba.rom[0] = 0x31;
    const transport = new SimulatedTransport(state);
    expect(() => executeSimulatedCommand(state, frame)).toThrow();
    await expect(transport.send(frame)).rejects.toThrow();
    expect(state.gba.rom[0]).toBe(0x31);
    await expect(transport.read(1)).rejects.toThrow('No simulated response queued');
  });

  it.each([
    [GBACommand.DIRECT_WRITE, 'gbaRom', 0x100],
    [GBACommand.PROGRAM, 'gbaRom', 0x100],
    [GBACommand.RAM_WRITE, 'gbaRam', 0x100],
    [GBACommand.RAM_WRITE_TO_FLASH, 'gbaRam', 0x100],
    [GBACommand.FRAM_WRITE, 'gbaRam', 0x100],
    [GBCCommand.DIRECT_WRITE, 'gbcRom', 0x6000],
    [GBCCommand.ROM_PROGRAM, 'gbcRom', 0x4000],
    [GBCCommand.FRAM_WRITE, 'gbcRam', 0xa000],
  ] as const)('writes only data for command %s and preserves the trailer sentinel', (command, memory, address) => {
    const state = createSimulatedDeviceState();
    const bank = memory.startsWith('gba') ? state.gba : state.gbc;
    const target = memory.endsWith('Rom') ? bank.rom : bank.ram;
    const offset = memory === 'gbcRam' ? 0 : address;
    target.fill(0x7d, offset, offset + 5);
    const builder = createCommandPayload(command).addAddress(address);
    if (command === GBACommand.PROGRAM || command === GBCCommand.ROM_PROGRAM) builder.addLength(256);
    if (command === GBACommand.FRAM_WRITE || command === GBCCommand.FRAM_WRITE) builder.addByte(25);
    const frame = builder.addBytes(new Uint8Array([0x12, 0x34, 0x56])).build();
    frame.set([0xab, 0xcd], frame.byteLength - 2);
    executeSimulatedCommand(state, frame);
    expect(target.subarray(offset, offset + 5)).toEqual(new Uint8Array([0x12, 0x34, 0x56, 0x7d, 0x7d]));
  });
});
