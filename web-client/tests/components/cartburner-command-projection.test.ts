import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CartBurner from '@/components/CartBurner.vue';
import type { BurnerProtocolSession } from '@/features/burner/application/domain/ports';
import type { Transport } from '@/platform/serial';
import { useRecentFileNamesStore } from '@/stores/recent-file-names-store';
import type { CommandResult } from '@/types/command-result';
import type { DeviceInfo } from '@/types/device-info';
import type { CFIInfo } from '@/utils/parsers/cfi-parser';

const mocks = vi.hoisted(() => ({ toast: vi.fn(), save: vi.fn(), session: null as BurnerProtocolSession | null, valid: false, type: 'GBA' }));
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ showToast: mocks.toast }) }));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('@/platform/native', () => ({ saveBinaryFile: mocks.save }));
vi.mock('@/services', () => ({ GBAAdapter: class {}, MBC5Adapter: class {} }));
vi.mock('@/features/burner/adapters', async original => ({
  ...await original<typeof import('@/features/burner/adapters')>(),
  createCartridgeProtocolSession: () => mocks.session,
}));
vi.mock('@/utils/parsers/rom-parser.ts', () => ({
  parseRom: () => ({ isValid: mocks.valid, type: mocks.type, fileName: 'Detected Game.gba' }),
  detectMbcTypeFromRom: () => ({ mbcType: 'MBC5' }),
}));

function cfi(): CFIInfo {
  return { flashId: new Uint8Array([1, 2]), dataSwap: null, deviceSize: 4,
    eraseSectorBlocks: [{ sectorSize: 4, sectorCount: 1, totalSize: 4, startAddress: 0, endAddress: 3 }],
  } as CFIInfo;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
interface View {
  cfiInfo: CFIInfo | null;
  selectedRomSize: string;
  readCart(): Promise<void>;
  readRom(): Promise<void>;
  readRam(): Promise<void>;
  readRomInfo(): Promise<void>;
  verifyRom(): Promise<void>;
  handleProgressStop(): void;
  pendingRamData: Uint8Array | null;
  showFileNameSelector: boolean;
  showMultiCartResultModal: boolean;
}
function setup() {
  const session = {
    id: 'projection-session', isActive: () => true, getCartInfo: () => Promise.resolve(cfi()),
    readROM: vi.fn(() => Promise.resolve<CommandResult>({ success: true, message: 'read legacy message', data: new Uint8Array([1, 2]) })),
    readRAM: vi.fn(() => Promise.resolve<CommandResult>({ success: true, message: 'ram legacy message', data: new Uint8Array([3, 4]) })),
    resetCommandBuffer: vi.fn(() => Promise.resolve()),
  } as unknown as BurnerProtocolSession;
  mocks.session = session;
  const pinia = createPinia();
  const device: DeviceInfo = { port: null, transport: {} as Transport };
  const wrapper = mount(CartBurner, { props: { device, deviceReady: true },
    global: { plugins: [pinia], mocks: { $t: (key: string) => key }, stubs: {
      BaseButton: true, ChipOperations: true, RomOperations: true, RamOperations: true,
      ProgressDisplayModal: true, FileNameSelectorModal: true, MultiCartResultModal: true, LogViewer: true,
    } } });
  const vm = wrapper.vm as unknown as View;
  vm.cfiInfo = cfi(); vm.selectedRomSize = '4';
  return { wrapper, vm, session: session as BurnerProtocolSession & { readROM: ReturnType<typeof vi.fn<BurnerProtocolSession['readROM']>>; resetCommandBuffer: ReturnType<typeof vi.fn<BurnerProtocolSession['resetCommandBuffer']>> }, recent: useRecentFileNamesStore(pinia) };
}

describe('CartBurner result and export presentation', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mocks.valid = false; mocks.type = 'GBA'; mocks.save.mockResolvedValue({ saved: true }); });
  afterEach(() => { vi.useRealTimers(); });

  it.each(['GBA', 'GBC', 'GB', 'unknown'])('keeps timestamp and extension for invalid %s ROM exports', async (type) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 2, 12, 34, 56)); mocks.type = type;
    const { wrapper, vm, session } = setup(); await vm.readRom();
    const extension = type === 'GBA' ? 'gba' : type === 'GBC' ? 'gbc' : type === 'GB' ? 'gb' : 'rom';
    expect(mocks.save).toHaveBeenCalledWith(new Uint8Array([1, 2]), `exported_20261002-123456.${extension}`);
    expect(mocks.toast).toHaveBeenCalledWith('read legacy message', 'success');
    expect(session.resetCommandBuffer.mock.calls).toHaveLength(1); wrapper.unmount();
  });

  it('exports valid parser names and records recent names', async () => {
    mocks.valid = true; const { wrapper, vm, recent } = setup(); await vm.readRom();
    expect(mocks.save).toHaveBeenCalledWith(new Uint8Array([1, 2]), 'Detected Game.gba');
    expect(recent.fileNames).toEqual(['Detected Game.gba']); wrapper.unmount();
  });

  it('retains RAM pending bytes and filename selection when recent names exist', async () => {
    const { wrapper, vm, recent } = setup(); recent.addFileName('Existing.gba'); await vm.readRam();
    expect([...vm.pendingRamData ?? []]).toEqual([3, 4]); expect(vm.showFileNameSelector).toBe(true);
    expect(mocks.save).not.toHaveBeenCalled(); wrapper.unmount();
  });

  it('keeps the default RAM export timestamp and cancelled-save feedback', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 2, 12, 34, 56));
    mocks.save.mockResolvedValue({ saved: false });
    const { wrapper, vm } = setup(); await vm.readRam();
    expect(mocks.save).toHaveBeenCalledWith(new Uint8Array([3, 4]), 'exported_20261002-123456.sav');
    expect(mocks.toast).toHaveBeenCalledWith('messages.operation.cancelled', 'info');
    wrapper.unmount();
  });

  it('projects admitted readCart metadata and resets exactly once', async () => {
    const { wrapper, vm, session } = setup(); await vm.readCart();
    expect(vm.cfiInfo?.deviceSize).toBe(4);
    expect([...vm.cfiInfo?.flashId ?? []]).toEqual([1, 2]);
    expect(vm.selectedRomSize).toBe('0x00000004');
    expect(mocks.toast).toHaveBeenCalledWith('messages.operation.readCartSuccess', 'success');
    expect(session.resetCommandBuffer.mock.calls).toHaveLength(1); wrapper.unmount();
  });

  it('projects scan results through the admitted flow and resets exactly once', async () => {
    const { wrapper, vm, session } = setup(); await vm.readRomInfo();
    expect(vm.showMultiCartResultModal).toBe(true);
    expect(mocks.toast).toHaveBeenCalledWith('ui.operation.readMultiCartSuccess', 'success');
    expect(session.resetCommandBuffer.mock.calls).toHaveLength(1); wrapper.unmount();
  });

  it('does not replace the new device chip metadata when readCart resolves late', async () => {
    const { wrapper, vm, session } = setup(); const worker = deferred<CFIInfo>();
    session.getCartInfo = () => worker.promise;
    const reading = vm.readCart();
    await wrapper.setProps({ device: { port: null, transport: {} as Transport } });
    const newCfi = { ...cfi(), deviceSize: 8 }; vm.cfiInfo = newCfi;
    mocks.toast.mockClear(); worker.resolve(cfi()); await reading;
    expect(vm.cfiInfo?.deviceSize).toBe(8);
    expect(mocks.toast).not.toHaveBeenCalled(); wrapper.unmount();
  });

  it('rejects readCart reentry without clearing the current chip state', async () => {
    const { wrapper, vm, session } = setup(); const worker = deferred<CommandResult>();
    session.readROM.mockReturnValue(worker.promise); const current = vm.cfiInfo;
    const reading = vm.readRom(); await expect(vm.readCart()).rejects.toThrow('already running');
    expect(vm.cfiInfo).toBe(current); worker.resolve({ success: false, message: 'read failed' }); await reading; wrapper.unmount();
  });

  it('does not begin export or emit a success toast for a cancelled late read', async () => {
    const { wrapper, vm, session } = setup(); const worker = deferred<CommandResult>();
    session.readROM.mockReturnValue(worker.promise); const reading = vm.readRom(); vm.handleProgressStop();
    worker.resolve({ success: true, message: 'late success', data: new Uint8Array([1]) }); await reading;
    expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.toast).not.toHaveBeenCalledWith('late success', 'success');
    expect(session.resetCommandBuffer.mock.calls).toHaveLength(1); wrapper.unmount();
  });

  it('keeps owner busy through the save dialog and suppresses post-dialog projection after unmount', async () => {
    const { wrapper, vm } = setup(); const save = deferred<{ saved: boolean }>(); mocks.save.mockReturnValue(save.promise);
    const reading = vm.readRom(); await flushPromises();
    await expect(vm.readCart()).rejects.toThrow('already running'); wrapper.unmount(); mocks.toast.mockClear();
    save.resolve({ saved: false }); await reading; expect(mocks.toast).not.toHaveBeenCalled();
  });
});
