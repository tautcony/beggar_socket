import { describe, expect, it, vi } from 'vitest';

import { CartridgeProtocolPortAdapter } from '@/features/burner/adapters';
import { BurnerFacadeImpl, BurnerUseCaseImpl } from '@/features/burner/application/burner-use-case';
import type { BurnerProtocolSession } from '@/features/burner/application/domain/ports';
import type { CommandResult } from '@/types/command-result';
import type { CFIInfo } from '@/utils/parsers/cfi-parser';

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('Missing test value');
  return value;
}

function cfi(): CFIInfo {
  return { flashId: new Uint8Array([1, 2]), dataSwap: [[0, 1]], deviceSize: 4,
    magicValues: { q: 1, r: 2, y: 3 },
    eraseSectorBlocks: [{ sectorSize: 4, sectorCount: 1, totalSize: 4, startAddress: 0, endAddress: 3 }],
  } as CFIInfo;
}
function setup() {
  const ok = { success: true, message: 'legacy message' };
  const session = {
    id: 'command-session', isActive: () => true,
    writeROM: vi.fn(() => Promise.resolve(ok)), readROM: vi.fn(() => Promise.resolve({ ...ok, data: new Uint8Array([1, 2]) })),
    verifyROM: vi.fn(() => Promise.resolve(ok)), eraseSectors: vi.fn(() => Promise.resolve(ok)),
    writeRAM: vi.fn(() => Promise.resolve(ok)), readRAM: vi.fn(() => Promise.resolve({ ...ok, data: new Uint8Array([3]) })),
    verifyRAM: vi.fn(() => Promise.resolve(ok)), getCartInfo: vi.fn(() => Promise.resolve(cfi())), resetCommandBuffer: vi.fn(() => Promise.resolve()),
  } satisfies BurnerProtocolSession;
  const facade = new BurnerFacadeImpl(new BurnerUseCaseImpl(new CartridgeProtocolPortAdapter(), key => key, value => value.toString(16)));
  const selection = { cfiInfo: cfi(), size: '4', baseAddress: '10', mbcType: 'MBC5' as const, enable5V: false };
  return { facade, session, selection };
}

describe('application command preparation and cleanup', () => {
  it.each([null, new Uint8Array([1, 2, 3]), new Uint8Array()])('reads RAM using loaded length before selected size: %j', async (loaded) => {
    const { facade, session, selection } = setup();
    const prepared = facade.prepareCommand({ ...selection, ramType: 'FLASH' }, loaded, 'read-ram');
    const result = await facade.runCommand(session, () => facade.readRam(session, prepared.size, prepared.options), vi.fn());
    expect(prepared.size).toBe(loaded ? loaded.length : 4);
    expect(prepared.options).toMatchObject({ ramType: 'FLASH', baseAddress: 16 });
    expect(prepared.options.size).toBeUndefined();
    expect(session.readRAM).toHaveBeenCalledWith(prepared.size, prepared.options);
    expect([...required(result.data)]).toEqual([3]);
  });

  it.each(['writeRam', 'verifyRam'] as const)('prepares %s without modifying the source data', async (method) => {
    const { facade, session, selection } = setup();
    const loaded = new Uint8Array([1, 2, 3]);
    const prepared = facade.prepareCommand({ ...selection, ramType: 'SRAM' }, loaded);
    const result = await facade.runCommand(session, () => facade[method](session, prepared.data, prepared.options), vi.fn());
    expect(result.message).toBe('legacy message');
    expect(prepared.data).toBe(loaded);
    expect([...loaded]).toEqual([1, 2, 3]);
    expect(session[method === 'writeRam' ? 'writeRAM' : 'verifyRAM']).toHaveBeenCalledWith(loaded, prepared.options);
    expect(session.resetCommandBuffer).toHaveBeenCalledOnce();
  });

  it.each([0xff, 0])('verifies RAM blank %i', async (fill) => {
    const { facade, session, selection } = setup();
    const prepared = facade.prepareCommand({ ...selection, ramType: 'SRAM' }, undefined, fill);
    await facade.runCommand(session, () => facade.verifyRam(session, prepared.data, prepared.options), vi.fn());
    expect([...prepared.data]).toEqual([fill, fill, fill, fill]);
    expect(session.verifyRAM).toHaveBeenCalledWith(prepared.data, prepared.options);
    expect(session.resetCommandBuffer).toHaveBeenCalledOnce();
  });
  it('erases with snapshotted geometry and selected cartridge options', async () => {
    const { facade, session, selection } = setup();
    const prepared = facade.prepareCommand({ cfiInfo: selection.cfiInfo, mbcType: 'MBC3', enable5V: true });
    selection.cfiInfo.eraseSectorBlocks[0].sectorSize = 99;
    const signal = new AbortController().signal;
    const result = await facade.runCommand(session, () => facade.eraseChip(session, prepared.options.cfiInfo, prepared.options.mbcType ?? 'MBC5', prepared.options.enable5V ?? false, signal), vi.fn());
    expect(result.message).toBe('legacy message');
    expect(session.eraseSectors.mock.calls[0]).toEqual([expect.anything(), { cfiInfo: prepared.options.cfiInfo, mbcType: 'MBC3', enable5V: true }, signal]);
    expect(session.resetCommandBuffer).toHaveBeenCalledOnce();
  });
  it('captures imported buffer identity when the file state is replaced', async () => {
    const { facade, session, selection } = setup();
    let loaded = new Uint8Array([1, 2, 3, 4]);
    const original = loaded;
    const prepared = facade.prepareCommand(selection, loaded);
    loaded = new Uint8Array([9, 9]);
    await facade.runCommand(session, () => facade.verifyRom(session, prepared.data, prepared.options, new AbortController().signal), vi.fn());
    expect(prepared.data).toBe(original);
    expect(prepared.data).not.toBe(loaded);
    expect([...original]).toEqual([1, 2, 3, 4]);
  });

  it.each([0xff, 0])('prepares and verifies ROM blank %i using the selected length and signal', async (fill) => {
    const { facade, session, selection } = setup();
    const signal = new AbortController().signal;
    const prepared = facade.prepareCommand(selection, undefined, fill);
    const result = await facade.runCommand(session, () => facade.verifyRom(session, prepared.data, prepared.options, signal), vi.fn());
    expect([...prepared.data]).toEqual([fill, fill, fill, fill]);
    expect(session.verifyROM).toHaveBeenCalledWith(prepared.data, prepared.options, signal);
    expect(result.message).toBe('legacy message');
    expect(session.resetCommandBuffer).toHaveBeenCalledOnce();
  });

  it('reads ROM with selected size and signal while retaining result bytes', async () => {
    const { facade, session, selection } = setup();
    const prepared = facade.prepareCommand(selection, undefined, 'read-rom');
    const signal = new AbortController().signal;
    const result = await facade.runCommand(session, () => facade.readRom(session, prepared.size, prepared.options, signal), vi.fn());
    expect(session.readROM).toHaveBeenCalledWith(4, prepared.options, signal, true);
    expect([...required(result.data)]).toEqual([1, 2]);
    expect(session.resetCommandBuffer).toHaveBeenCalledOnce();
  });
  it.each([[1, 2], [1, 2, 3, 4], [1, 2, 3, 4, 5]])('pads only shorter ROM input %j without changing its bytes', async (...bytes) => {
    const { facade, session, selection } = setup();
    const input = new Uint8Array(bytes);
    const prepared = facade.prepareCommand(selection, input, 'pad-rom');
    const before = [...input];
    const result = await facade.runCommand(session, () => facade.writeRom(session, prepared.data, prepared.options), vi.fn());
    expect([...prepared.data]).toEqual(before.length < 4 ? [...before, ...new Array(4 - before.length).fill(0xff)] : before);
    expect([...input]).toEqual(before);
    if (input.length < 4) expect(prepared.data).not.toBe(input);
    else expect(prepared.data).toBe(input);
    expect(result.message).toBe('legacy message');
    expect(session.writeROM).toHaveBeenCalledWith(prepared.data, prepared.options, undefined);
    expect(session.resetCommandBuffer).toHaveBeenCalledTimes(1);
  });

  it('copies mutable CFI fields and options and pads command bytes before deferred I/O', async () => {
    const { facade, session, selection } = setup();
    const input = new Uint8Array([1, 2]);
    const prepared = facade.prepareCommand(selection, input, 'pad-rom');
    selection.baseAddress = '20'; selection.enable5V = true;
    selection.cfiInfo.flashId[0] = 9; selection.cfiInfo.eraseSectorBlocks[0].sectorSize = 99;
    required(selection.cfiInfo.dataSwap)[0][0] = 8; required(selection.cfiInfo.magicValues).q = 9;
    await facade.runCommand(session, () => facade.writeRom(session, prepared.data, prepared.options), vi.fn());
    expect(prepared.options).toMatchObject({ baseAddress: 16, enable5V: false, size: 4,
      cfiInfo: { magicValues: { q: 1 }, dataSwap: [[0, 1]], eraseSectorBlocks: [{ sectorSize: 4 }] } });
    expect([...prepared.options.cfiInfo.flashId]).toEqual([1, 2]);
    expect([...prepared.data]).toEqual([1, 2, 255, 255]);
  });

  it.each([true, false])('awaits cleanup and preserves CommandResult success=%s with reset diagnostics', async (success) => {
    const { facade, session } = setup();
    let rejectReset!: (error: unknown) => void;
    session.resetCommandBuffer.mockImplementation(() => new Promise<void>((_resolve, reject) => { rejectReset = reject; }));
    const diagnostic = { stage: 'transport' as const, code: 'transport_failure' as const, message: 'reset detail', recoverable: true, cause: { io: 'reset' } };
    const report = vi.fn<(error: unknown) => void>();
    const result: CommandResult = { success, message: 'primary legacy failure', error: diagnostic, data: new Uint8Array([3]) };
    let complete = false;
    const pending = facade.runCommand(session, () => Promise.resolve(result), report).then(value => { complete = true; return value; });
    await Promise.resolve(); await Promise.resolve();
    expect(complete).toBe(false);
    rejectReset(diagnostic);
    expect(await pending).toBe(result);
    expect(report).toHaveBeenCalledWith(expect.objectContaining(diagnostic));
    expect((report.mock.calls[0][0] as { cause: unknown }).cause).toBe(diagnostic.cause);
    expect(session.resetCommandBuffer).toHaveBeenCalledTimes(1);
  });

  it('retains the exact primary thrown cause even when reset and its reporter fail', async () => {
    const { facade, session } = setup();
    const primary = new Error('primary');
    session.resetCommandBuffer.mockRejectedValue(new Error('cleanup'));
    await expect(facade.runCommand(session, () => Promise.reject(primary), () => { throw new Error('reporter'); })).rejects.toBe(primary);
    expect(session.resetCommandBuffer).toHaveBeenCalledTimes(1);
  });
});
