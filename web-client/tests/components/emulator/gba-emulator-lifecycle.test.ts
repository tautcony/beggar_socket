import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import GBAEmulator from '@/components/emulator/GBAEmulator.vue';
import type { GbaPreviewSavePayload } from '@/features/gba-save/types';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

const emulatorHarness = vi.hoisted(() => ({ instances: [] as any[], keypad: null as any }));
const platformHarness = vi.hoisted(() => ({ save: vi.fn(), isTauri: false, toast: vi.fn() }));

vi.mock('@/platform/native', () => ({ saveBinaryFile: platformHarness.save }));
vi.mock('@/platform/runtime', () => ({ isTauriRuntime: () => platformHarness.isTauri }));
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ showToast: platformHarness.toast }) }));

vi.mock('gbats', () => ({
  Wrapper: class MockWrapper {
    emulator: any;
    screenImageFormat = 'webp';
    constructor(options: { rom: ArrayBuffer }) {
      const rom = new Uint8Array(options.rom);
      const saveSignature = Array.from(rom.slice(0xe4, 0x100), byte => String.fromCharCode(byte)).join('');
      const saveType = ['SRAM_V', 'FLASH1M_V', 'FLASH512_V', 'FLASH_V', 'EEPROM_V'].find(signature => saveSignature.startsWith(signature)) ?? '';
      const events: string[] = [];
      const save = { buffer: new ArrayBuffer(32768), writePending: false };
      let cpuPrivMask = 0xcf;
      const cpu = {
        get PRIV_MASK() { return cpuPrivMask; },
        set PRIV_MASK(value: number) {
          cpuPrivMask = value;
          events.push(`compat:${value.toString(16)}`);
        },
      };
      const keypad = emulatorHarness.keypad ?? { currentDown: 0x03ff };
      const core = {
        LOG_ERROR: 1,
        LOG_WARN: 2,
        LOG_STUB: 4,
        LOG_INFO: 8,
        LOG_DEBUG: 16,
        cpu,
        keypad,
        rom: { saveType },
        mmu: { cart: { saveType }, save: saveType ? save : { ...save } },
        audio: { pause: vi.fn() },
        seenSave: false,
        paused: false,
        storeSavedata: vi.fn(),
        setSavedata: vi.fn((data: ArrayBuffer) => {
          events.push(`import:${new Uint8Array(data)[0]}`);
          core.mmu.save.buffer = data.slice(0);
        }),
        pause: vi.fn(() => {
          events.push('pause');
          core.paused = true;
        }),
        runStable: vi.fn(() => {
          events.push('run');
          core.paused = false;
        }),
        setLogger: vi.fn((handler: (level: number, error: string) => void) => { core.logger = handler; }),
        logger: undefined as ((level: number, error: string) => void) | undefined,
      };
      const originalStore = core.storeSavedata;
      this.emulator = core;
      emulatorHarness.instances.push({ core, events, originalStore });
      // Model Wrapper's scheduled auto run; component must pause it before import.
      core.runStable();
    }
    press = vi.fn();
  },
}));

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string, params?: { error?: string }) => params?.error ? `${key}: ${params.error}` : key }) }));
vi.mock('@ionic/vue', () => ({ IonIcon: { template: '<span />' } }));

function makeRom(saveSignature = 'SRAM_V123'): Uint8Array {
  const rom = new Uint8Array(1024);
  for (let index = 0; index < saveSignature.length; index += 1) rom[0xe4 + index] = saveSignature.charCodeAt(index);
  return rom;
}

function launch(saveData?: Uint8Array) {
  return {
    sessionId: 'session-1',
    romData: makeRom(),
    romName: 'game.gba',
    romRevision: 1,
    ramRevision: 1,
    saveData,
    saveName: saveData ? 'game.sav' : undefined,
    usesSelectedSave: Boolean(saveData),
    ramWasEmptyAtLaunch: !saveData,
  };
}

function mountEmulator(selectedSave?: Uint8Array) {
  return mount(GBAEmulator, {
    props: { isVisible: true, romData: makeRom(), romName: 'game.gba', launch: launch(selectedSave) },
  });
}

function expectCoreCompatibilityInstalledBeforeResume(instance: (typeof emulatorHarness.instances)[number]) {
  expect(instance.core.cpu.PRIV_MASK).toBe(0xdf);
  expect(instance.events.indexOf('pause')).toBeLessThan(instance.events.indexOf('compat:df'));
  expect(instance.events.indexOf('compat:df')).toBeLessThan(instance.events.lastIndexOf('run'));
}

function dispatchKey(type: 'keydown' | 'keyup', code: string, repeat = false): KeyboardEvent {
  const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, code, repeat });
  document.dispatchEvent(event);
  return event;
}

describe('GBA emulator save lifecycle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    emulatorHarness.instances.length = 0;
    emulatorHarness.keypad = null;
    platformHarness.save.mockReset().mockResolvedValue({ saved: true });
    platformHarness.isTauri = false;
    platformHarness.toast.mockReset();
  });

  it('pauses the scheduled core before importing and resumes only after setup', async () => {
    const source = new Uint8Array(32768).fill(0x5a);
    const wrapper = mountEmulator(source);
    await wrapper.vm.$nextTick();
    const { core, events } = emulatorHarness.instances[0];
    expectCoreCompatibilityInstalledBeforeResume(emulatorHarness.instances[0]);
    expect(events.indexOf('pause')).toBeLessThan(events.findIndex((event: string) => event.startsWith('import:')));
    expect(events.indexOf('compat:df')).toBeLessThan(events.findIndex((event: string) => event.startsWith('import:')));
    expect(events.findIndex((event: string) => event.startsWith('import:'))).toBeLessThan(events.lastIndexOf('run'));
    expect(new Uint8Array(core.mmu.save.buffer)[0]).toBe(0x5a);
    expect(source[0]).toBe(0x5a);
    wrapper.unmount();
  });

  it('disposes a paused partial core when the selected SAV is empty', async () => {
    const source = new Uint8Array();
    const invalidLaunch = { ...launch(source), saveData: source };
    const wrapper = mount(GBAEmulator, {
      props: { isVisible: true, romData: makeRom(), romName: 'game.gba', launch: invalidLaunch },
    });
    await wrapper.vm.$nextTick();
    const { core, events } = emulatorHarness.instances[0];
    expect(events.some((event: string) => event.startsWith('import:'))).toBe(false);
    expect(core.setSavedata).not.toHaveBeenCalled();
    expect(source).toHaveLength(0);
    expect(core.paused).toBe(true);
    expect(wrapper.find('canvas').exists()).toBe(false);
    wrapper.unmount();
  });

  it('keeps an unknown ROM runnable and lets the user close it without a SAV', async () => {
    const wrapper = mount(GBAEmulator, {
      props: { isVisible: true, romData: makeRom('NO_SAVE_TAG'), romName: 'unknown.gba', launch: { ...launch(), romData: makeRom('NO_SAVE_TAG') } },
    });
    await wrapper.vm.$nextTick();
    expect(emulatorHarness.instances).toHaveLength(1);
    expect(wrapper.find('canvas').exists()).toBe(true);
    await wrapper.get('button[title="ui.emulator.close"]').trigger('click');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(wrapper.emitted('close')).toHaveLength(1);
    expect(wrapper.emitted('save-result')).toBeUndefined();
    wrapper.unmount();
  });

  it('keeps a paused core open while a save write is pending, then closes with a stable snapshot', async () => {
    const wrapper = mountEmulator(new Uint8Array(32768).fill(0x5a));
    await wrapper.vm.$nextTick();
    const core = emulatorHarness.instances[0].core;
    await wrapper.get('button[title="ui.emulator.pause"]').trigger('click');
    core.seenSave = true;
    await wrapper.get('button[title="ui.emulator.close"]').trigger('click');
    expect(wrapper.emitted('close')).toBeUndefined();
    expect(wrapper.emitted('save-result')).toBeUndefined();

    core.seenSave = false;
    await wrapper.get('button[title="ui.emulator.close"]').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
    expect(wrapper.emitted('save-result')).toHaveLength(1);
    wrapper.unmount();
  });

  it('closes after a runtime failure with the last valid checkpoint', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const wrapper = mountEmulator(new Uint8Array(32768).fill(0x5a));
    await wrapper.vm.$nextTick();
    const core = emulatorHarness.instances[0].core;
    new Uint8Array(core.mmu.save.buffer)[0] = 0x42;
    core.seenSave = true;
    core.storeSavedata();
    core.seenSave = false;
    core.logger?.(1, 'synthetic failure');
    core.logger?.(-1, 'stack trace line');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('canvas').exists()).toBe(false);
    expect(wrapper.text()).toContain('synthetic failure');
    expect(wrapper.text()).not.toContain('stack trace line');
    await wrapper.get('button[title="ui.emulator.close"]').trigger('click');
    const result = wrapper.emitted('save-result')?.[0][0] as GbaPreviewSavePayload;
    expect(result.data[0]).toBe(0x42);
    expect(result.reason).toBe('ui.emulator.errors.lastCheckpointOnly');
    expect(wrapper.emitted('close')).toHaveLength(1);
    wrapper.unmount();
    debug.mockRestore();
  });

  it('keeps a warning about I/O register 0x2 nonfatal and continues saving/exporting', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const wrapper = mountEmulator(new Uint8Array(32768).fill(0x5a));
    await wrapper.vm.$nextTick();
    const { core } = emulatorHarness.instances[0];
    const runCount = Number(core.runStable.mock.calls.length);
    core.logger?.(core.LOG_WARN, 'Bad I/O register read: 0x2');
    core.logger?.(core.LOG_INFO, 'informational log');
    core.logger?.(core.LOG_DEBUG, 'debug log');
    core.logger?.(-1, 'stack trace line');
    await wrapper.vm.$nextTick();

    expect(warn).toHaveBeenCalledWith('GBA emulator warning:', 'Bad I/O register read: 0x2');
    expect(debug).toHaveBeenCalledWith('GBA emulator log:', 'stack trace line');
    expect(wrapper.find('canvas').exists()).toBe(true);
    expect(core.paused).toBe(false);
    expect(core.runStable).toHaveBeenCalledTimes(runCount);

    new Uint8Array(core.mmu.save.buffer)[0] = 0x42;
    core.seenSave = true;
    core.storeSavedata();
    core.seenSave = false;
    expect(wrapper.emitted('save-checkpoint')).toHaveLength(1);
    expect((wrapper.emitted('save-checkpoint')?.[0][0] as GbaPreviewSavePayload).data[0]).toBe(0x42);

    await wrapper.findAll('button').find(button => button.text() === 'ui.emulator.exportSave')?.trigger('click');
    await flushPromises();
    expect(platformHarness.save).toHaveBeenCalledWith(expect.objectContaining({ 0: 0x42 }), 'game.sav');
    expect(wrapper.find('canvas').exists()).toBe(true);
    wrapper.unmount();
    warn.mockRestore();
    debug.mockRestore();
  });

  it('reinjects the latest checkpoint on reset and on same-session retry', async () => {
    const wrapper = mountEmulator(new Uint8Array(32768).fill(0x5a));
    await wrapper.vm.$nextTick();
    let first = emulatorHarness.instances[0];
    const oldLogger = first.core.logger;
    new Uint8Array(first.core.mmu.save.buffer)[0] = 0x42;
    await wrapper.get('button[title="ui.emulator.reset"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(emulatorHarness.instances).toHaveLength(2);
    expectCoreCompatibilityInstalledBeforeResume(emulatorHarness.instances[1]);
    expect(new Uint8Array(emulatorHarness.instances[1].core.mmu.save.buffer)[0]).toBe(0x42);
    oldLogger?.(1, 'stale old-core failure');
    expect(wrapper.find('canvas').exists()).toBe(true);

    first = emulatorHarness.instances[1];
    new Uint8Array(first.core.mmu.save.buffer)[0] = 0x43;
    first.core.seenSave = true;
    first.core.storeSavedata();
    first.core.seenSave = false;
    first.core.logger?.(1, 'synthetic failure');
    await wrapper.vm.$nextTick();
    const retryButton = wrapper.findAll('button').find(button => button.text() === 'ui.emulator.retry');
    expect(retryButton).toBeDefined();
    await retryButton?.trigger('click');
    await wrapper.vm.$nextTick();
    expect(emulatorHarness.instances).toHaveLength(3);
    expectCoreCompatibilityInstalledBeforeResume(emulatorHarness.instances[2]);
    expect(new Uint8Array(emulatorHarness.instances[2].core.mmu.save.buffer)[0]).toBe(0x43);
    wrapper.unmount();
  });

  it('keeps a full oversized SAV image through core-window checkpoint, reset, result, and export', async () => {
    const source = new Uint8Array(131072);
    for (let index = 0; index < source.length; index += 1) source[index] = (index * 13 + 7) & 0xff;
    const originalTail = source.slice(32768);
    const wrapper = mountEmulator(source);
    await wrapper.vm.$nextTick();
    const firstCore = emulatorHarness.instances[0].core;
    expect(firstCore.mmu.save.buffer.byteLength).toBe(32768);
    new Uint8Array(firstCore.mmu.save.buffer)[0x12] = 0x42;
    firstCore.storeSavedata();
    const checkpoint = wrapper.emitted('save-checkpoint')?.[0][0] as GbaPreviewSavePayload;
    expect(checkpoint.capacity).toBe(32768);
    expect(checkpoint.data).toHaveLength(131072);
    expect(checkpoint.data[0x12]).toBe(0x42);
    expect(checkpoint.data.slice(32768)).toEqual(originalTail);

    await wrapper.get('button[title="ui.emulator.reset"]').trigger('click');
    const resetCore = emulatorHarness.instances[1].core;
    expect(resetCore.mmu.save.buffer.byteLength).toBe(32768);
    expect(new Uint8Array(resetCore.mmu.save.buffer)[0x12]).toBe(0x42);
    await wrapper.get('button[title="ui.emulator.close"]').trigger('click');
    const result = wrapper.emitted('save-result')?.[0][0] as GbaPreviewSavePayload;
    expect(result.capacity).toBe(32768);
    expect(result.data).toHaveLength(131072);
    expect(result.data[0x12]).toBe(0x42);
    expect(result.data.slice(32768)).toEqual(originalTail);
    expect(result.changed).toBe(true);
    wrapper.unmount();
  });

  it('normalizes short input once and reports unchanged when the core writes nothing', async () => {
    const source = new Uint8Array([0x11, 0x22, 0x33]);
    const wrapper = mountEmulator(source);
    await wrapper.vm.$nextTick();
    await wrapper.get('button[title="ui.emulator.close"]').trigger('click');
    const result = wrapper.emitted('save-result')?.[0][0] as GbaPreviewSavePayload;
    expect(result.data).toHaveLength(32768);
    expect(result.data.slice(0, 3)).toEqual(source);
    expect(result.changed).toBe(false);
    wrapper.unmount();
  });

  it('holds a physical key beyond gbats’ auto-release interval and ignores repeats', async () => {
    const gbats = await vi.importActual<typeof import('gbats')>('gbats');
    const actualCore = new gbats.GameBoyAdvance(undefined);
    actualCore.reset();
    emulatorHarness.keypad = actualCore.keypad;
    const wrapper = mountEmulator(new Uint8Array(32768).fill(0x5a));
    await wrapper.vm.$nextTick();

    dispatchKey('keydown', 'KeyD');
    expect(actualCore.io.loadU16(actualCore.io.KEYINPUT)).toBe(0x03ef);
    dispatchKey('keydown', 'KeyD', true);
    await new Promise(resolve => setTimeout(resolve, 130));
    expect(actualCore.io.loadU16(actualCore.io.KEYINPUT)).toBe(0x03ef);

    dispatchKey('keyup', 'KeyD');
    expect(actualCore.io.loadU16(actualCore.io.KEYINPUT)).toBe(0x03ff);
    expect(actualCore.keypad.inputTimeoutIds).toHaveLength(0);
    wrapper.unmount();
    actualCore.pause();
  });

  it('releases combo keys independently and requires a fresh press after focus loss or pause', async () => {
    const wrapper = mountEmulator(new Uint8Array(32768).fill(0x5a));
    await wrapper.vm.$nextTick();
    const keypad = emulatorHarness.instances[0].core.keypad;

    dispatchKey('keydown', 'KeyJ');
    dispatchKey('keydown', 'KeyK');
    expect(keypad.currentDown).toBe(0x03fc);
    dispatchKey('keyup', 'KeyJ');
    expect(keypad.currentDown).toBe(0x03fd);
    dispatchKey('keyup', 'KeyK');
    expect(keypad.currentDown).toBe(0x03ff);

    dispatchKey('keydown', 'KeyJ');
    window.dispatchEvent(new Event('blur'));
    expect(keypad.currentDown).toBe(0x03ff);
    dispatchKey('keydown', 'KeyJ', true);
    expect(keypad.currentDown).toBe(0x03ff);
    dispatchKey('keydown', 'KeyJ');
    expect(keypad.currentDown).toBe(0x03fe);

    await wrapper.get('button[title="ui.emulator.pause"]').trigger('click');
    expect(keypad.currentDown).toBe(0x03ff);
    dispatchKey('keydown', 'KeyK');
    expect(keypad.currentDown).toBe(0x03ff);
    await wrapper.get('button[title="ui.emulator.pause"]').trigger('click');
    dispatchKey('keydown', 'KeyK', true);
    expect(keypad.currentDown).toBe(0x03ff);
    dispatchKey('keydown', 'KeyK');
    expect(keypad.currentDown).toBe(0x03fd);
    wrapper.unmount();
    expect(keypad.currentDown).toBe(0x03ff);
  });

  it('clears held inputs for hidden, reset, export, and save-conflict transitions', async () => {
    let resolveSave!: (value: { saved: boolean }) => void;
    platformHarness.save.mockImplementation(() => new Promise(resolve => { resolveSave = resolve; }));
    const wrapper = mountEmulator(new Uint8Array(32768).fill(0x5a));
    await wrapper.vm.$nextTick();
    const first = emulatorHarness.instances[0].core;
    dispatchKey('keydown', 'KeyJ');
    await wrapper.get('button[title="ui.emulator.reset"]').trigger('click');
    expect(first.keypad.currentDown).toBe(0x03ff);
    const afterReset = emulatorHarness.instances[1].core;
    dispatchKey('keydown', 'KeyJ', true);
    expect(afterReset.keypad.currentDown).toBe(0x03ff);
    dispatchKey('keydown', 'KeyJ');
    expect(afterReset.keypad.currentDown).toBe(0x03fe);

    const exportButton = wrapper.findAll('button').find(button => button.text() === 'ui.emulator.exportSave');
    await exportButton?.trigger('click');
    expect(afterReset.keypad.currentDown).toBe(0x03ff);
    dispatchKey('keydown', 'KeyK');
    expect(afterReset.keypad.currentDown).toBe(0x03ff);
    resolveSave({ saved: true });
    await flushPromises();
    dispatchKey('keydown', 'KeyK', true);
    expect(afterReset.keypad.currentDown).toBe(0x03ff);
    dispatchKey('keydown', 'KeyK');
    expect(afterReset.keypad.currentDown).toBe(0x03fd);

    afterReset.mmu.save.writePending = true;
    afterReset.storeSavedata();
    expect(afterReset.keypad.currentDown).toBe(0x03ff);
    dispatchKey('keydown', 'KeyJ');
    expect(afterReset.keypad.currentDown).toBe(0x03ff);
    wrapper.unmount();

    const hiddenWrapper = mountEmulator(new Uint8Array(32768).fill(0x5a));
    await hiddenWrapper.vm.$nextTick();
    const hiddenCore = emulatorHarness.instances[emulatorHarness.instances.length - 1].core;
    dispatchKey('keydown', 'KeyJ');
    await hiddenWrapper.setProps({ isVisible: false });
    await flushPromises();
    expect(hiddenCore.keypad.currentDown).toBe(0x03ff);
    hiddenWrapper.unmount();

    const closeWrapper = mountEmulator(new Uint8Array(32768).fill(0x5a));
    await closeWrapper.vm.$nextTick();
    const closeCore = emulatorHarness.instances[emulatorHarness.instances.length - 1].core;
    dispatchKey('keydown', 'KeyJ');
    await closeWrapper.get('button[title="ui.emulator.close"]').trigger('click');
    expect(closeCore.keypad.currentDown).toBe(0x03ff);
    dispatchKey('keydown', 'KeyK');
    expect(closeCore.keypad.currentDown).toBe(0x03ff);
    closeWrapper.unmount();

    const visibilityWrapper = mountEmulator(new Uint8Array(32768).fill(0x5a));
    await visibilityWrapper.vm.$nextTick();
    const visibilityCore = emulatorHarness.instances[emulatorHarness.instances.length - 1].core;
    dispatchKey('keydown', 'KeyJ');
    const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(visibilityCore.keypad.currentDown).toBe(0x03ff);
    dispatchKey('keydown', 'KeyK', true);
    expect(visibilityCore.keypad.currentDown).toBe(0x03ff);
    if (visibilityDescriptor) Object.defineProperty(document, 'visibilityState', visibilityDescriptor);
    else Reflect.deleteProperty(document, 'visibilityState');
    visibilityWrapper.unmount();
  });

  it('releases held input on a fatal runtime error and blocks input while retaining the checkpoint', async () => {
    const wrapper = mountEmulator(new Uint8Array(32768).fill(0x5a));
    await wrapper.vm.$nextTick();
    const core = emulatorHarness.instances[0].core;
    core.storeSavedata();
    expect(wrapper.emitted('save-checkpoint')).toHaveLength(1);
    dispatchKey('keydown', 'KeyJ');
    expect(core.keypad.currentDown).toBe(0x03fe);

    core.logger?.(core.LOG_ERROR, 'synthetic fatal failure');
    expect(core.keypad.currentDown).toBe(0x03ff);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('synthetic fatal failure');
    dispatchKey('keydown', 'KeyK');
    expect(core.keypad.currentDown).toBe(0x03ff);
    expect(wrapper.emitted('save-checkpoint')).toHaveLength(1);
    const retryButton = wrapper.findAll('button').find(button => button.text() === 'ui.emulator.retry');
    await retryButton?.trigger('click');
    await wrapper.vm.$nextTick();
    const retriedCore = emulatorHarness.instances[1].core;
    dispatchKey('keydown', 'KeyK', true);
    expect(retriedCore.keypad.currentDown).toBe(0x03ff);
    dispatchKey('keydown', 'KeyK');
    expect(retriedCore.keypad.currentDown).toBe(0x03fd);
    wrapper.unmount();
  });

  it('finishes the old launch before importing save data for a replacement session', async () => {
    const oldSave = new Uint8Array(32768).fill(0x5a);
    const wrapper = mountEmulator(oldSave);
    await wrapper.vm.$nextTick();
    const oldCore = emulatorHarness.instances[0].core;
    new Uint8Array(oldCore.mmu.save.buffer)[0] = 0x42;

    const replacementRom = makeRom();
    const replacementSave = new Uint8Array(32768).fill(0x6b);
    await wrapper.setProps({
      romData: replacementRom,
      romName: 'replacement.gba',
      launch: {
        ...launch(replacementSave),
        sessionId: 'session-2',
        romData: replacementRom,
        romName: 'replacement.gba',
        saveName: 'replacement.sav',
      },
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('save-result')).toHaveLength(1);
    const oldResult = wrapper.emitted('save-result')?.[0][0] as GbaPreviewSavePayload;
    expect(oldResult.launch.sessionId).toBe('session-1');
    expect(new Uint8Array(oldResult.data)[0]).toBe(0x42);
    expect(emulatorHarness.instances).toHaveLength(2);
    expect(new Uint8Array(emulatorHarness.instances[1].core.mmu.save.buffer)[0]).toBe(0x6b);
    wrapper.unmount();
  });

  it('delivers the last checkpoint on unmount and restores the core save hook once', async () => {
    const wrapper = mountEmulator(new Uint8Array(32768).fill(0x5a));
    await wrapper.vm.$nextTick();
    const { core, originalStore } = emulatorHarness.instances[0];
    new Uint8Array(core.mmu.save.buffer)[0] = 0x42;
    wrapper.unmount();
    expect(wrapper.emitted('save-result')).toHaveLength(1);
    expect(new Uint8Array((wrapper.emitted('save-result')?.[0][0] as GbaPreviewSavePayload).data)[0]).toBe(0x42);
    expect(core.storeSavedata).toBe(originalStore);
    expect(core.paused).toBe(true);
  });

  it('blocks reset and close during export and never resumes a disposed core', async () => {
    let resolveSave!: (value: { saved: boolean }) => void;
    platformHarness.save.mockImplementation(() => new Promise(resolve => { resolveSave = resolve; }));
    const wrapper = mountEmulator(new Uint8Array(32768).fill(0x5a));
    await wrapper.vm.$nextTick();
    const { core } = emulatorHarness.instances[0];
    const runCount = Number(core.runStable.mock.calls.length);
    const exportButton = wrapper.findAll('button').find(button => button.text() === 'ui.emulator.exportSave');
    expect(exportButton).toBeDefined();
    await exportButton?.trigger('click');
    const resetButton = wrapper.get('button[title="ui.emulator.reset"]');
    const closeButton = wrapper.get('button[title="ui.emulator.close"]');
    expect((resetButton.element as HTMLButtonElement).disabled).toBe(true);
    expect((closeButton.element as HTMLButtonElement).disabled).toBe(true);
    await resetButton.trigger('click');
    await closeButton.trigger('click');
    expect(emulatorHarness.instances).toHaveLength(1);

    wrapper.unmount();
    resolveSave({ saved: true });
    await flushPromises();
    expect(core.runStable).toHaveBeenCalledTimes(runCount);
    expect(core.paused).toBe(true);
  });

  it('exports a stable current snapshot and restores the prior play state', async () => {
    platformHarness.save.mockResolvedValue({ saved: true, path: 'game.sav' });
    const wrapper = mountEmulator(new Uint8Array(32768).fill(0x5a));
    await wrapper.vm.$nextTick();
    const core = emulatorHarness.instances[0].core;
    new Uint8Array(core.mmu.save.buffer)[0] = 0x42;
    const runCount = Number(core.runStable.mock.calls.length);

    await wrapper.findAll('button').find(button => button.text() === 'ui.emulator.exportSave')?.trigger('click');
    await flushPromises();
    expect(platformHarness.save).toHaveBeenCalledWith(expect.objectContaining({ 0: 0x42 }), 'game.sav');
    expect(core.runStable).toHaveBeenCalledTimes(runCount + 1);
    expect(platformHarness.toast).toHaveBeenCalledWith('ui.emulator.exportStarted', 'success');

    await wrapper.get('button[title="ui.emulator.pause"]').trigger('click');
    const pausedRunCount = Number(core.runStable.mock.calls.length);
    await wrapper.findAll('button').find(button => button.text() === 'ui.emulator.exportSave')?.trigger('click');
    await flushPromises();
    expect(core.runStable).toHaveBeenCalledTimes(pausedRunCount);
    expect(core.paused).toBe(true);
    wrapper.unmount();
  });

  it('reports a desktop save path after a successful native export', async () => {
    platformHarness.isTauri = true;
    platformHarness.save.mockResolvedValue({ saved: true, path: '/saves/game.sav' });
    const wrapper = mountEmulator(new Uint8Array(32768).fill(0x5a));
    await wrapper.vm.$nextTick();
    await wrapper.findAll('button').find(button => button.text() === 'ui.emulator.exportSave')?.trigger('click');
    await flushPromises();
    expect(platformHarness.toast).toHaveBeenCalledWith('ui.emulator.exportSaved', 'success');
    wrapper.unmount();
  });
});
