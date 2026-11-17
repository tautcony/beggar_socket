import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BinjgbRunner,
  getBinjgbModule,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
} from '@/components/emulator/binjgb/binjgb-runner';
import GBCEmulator from '@/components/emulator/GBCEmulator.vue';
import { GB_NINTENDO_LOGO } from '@/utils/parsers/rom-parser';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

const toastMock = vi.hoisted(() => ({
  showToast: vi.fn(),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => toastMock,
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: { error?: string }) =>
      params?.error ? `${key}: ${params.error}` : key,
  }),
}));

function makeValidGbRom(): Uint8Array {
  const rom = new Uint8Array(0x8000);
  rom.set(GB_NINTENDO_LOGO, 0x104);
  rom.set(new TextEncoder().encode('TEST COLOR'), 0x134);
  rom[0x143] = 0x80; // CGB mode
  rom[0x147] = 0x19; // MBC5
  rom[0x148] = 0x00; // ROM size: 32KB
  rom[0x149] = 0x00; // RAM size: none

  let checksum = 0;
  for (let index = 0x134; index <= 0x14c; index += 1) {
    checksum = (checksum - rom[index] - 1) & 0xff;
  }
  rom[0x14d] = checksum;
  return rom;
}

function dispatchKey(type: 'keydown' | 'keyup', code: string): KeyboardEvent {
  const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, code });
  document.dispatchEvent(event);
  return event;
}

function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SCREEN_WIDTH;
  canvas.height = SCREEN_HEIGHT;

  const mockContext = {
    createImageData: vi.fn((w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
    })),
    putImageData: vi.fn(),
  };

  vi.spyOn(canvas, 'getContext').mockReturnValue(mockContext as any);
  return canvas;
}

describe('BinjgbRunner', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    toastMock.showToast.mockReset();
  });

  it('initializes successfully with a valid GB ROM and renders frames', async () => {
    const rom = makeValidGbRom();
    const canvas = createMockCanvas();
    const runner = await BinjgbRunner.create({
      canvas,
      romData: rom,
    });

    expect(runner.isPlaying).toBe(false);
    expect(runner.isPaused).toBe(true);

    runner.play();
    expect(runner.isPlaying).toBe(true);
    expect(runner.isPaused).toBe(false);

    // Step enough frames to complete boot sequence and trigger frame rendering
    runner.stepFrame(6);
    const ctx = canvas.getContext('2d') as any;
    expect(ctx.putImageData).toHaveBeenCalled();

    runner.pause();
    expect(runner.isPlaying).toBe(false);
    expect(runner.isPaused).toBe(true);

    runner.destroy();
    expect(runner.disposed).toBe(true);
  });

  it('rejects an invalid ROM smaller than header size', async () => {
    const invalidRom = new Uint8Array(100);
    const canvas = createMockCanvas();

    await expect(
      BinjgbRunner.create({
        canvas,
        romData: invalidRom,
      }),
    ).rejects.toThrow(RangeError);
  });

  it('handles joypad button inputs', async () => {
    const rom = makeValidGbRom();
    const canvas = createMockCanvas();
    const runner = await BinjgbRunner.create({
      canvas,
      romData: rom,
    });

    const setJoypUpSpy = vi.spyOn(runner.module, '_set_joyp_up');
    const setJoypASpy = vi.spyOn(runner.module, '_set_joyp_A');

    runner.setJoypadButton('up', true);
    expect(setJoypUpSpy).toHaveBeenCalledWith(expect.any(Number), 1);

    runner.setJoypadButton('up', false);
    expect(setJoypUpSpy).toHaveBeenCalledWith(expect.any(Number), 0);

    runner.setJoypadButton('a', true);
    expect(setJoypASpy).toHaveBeenCalledWith(expect.any(Number), 1);

    runner.destroy();
  });

  it('delivers joypad button state to the emulated Game Boy JOYP register (0xFF00)', async () => {
    const rom = makeValidGbRom();
    // 0x0100: nop; jp 0x0150
    rom.set([0x00, 0xc3, 0x50, 0x01], 0x100);
    // 0x0150: poll D-pad (0x20 -> 0xFF00 -> 0xC000) and buttons (0x10 -> 0xFF00 -> 0xC001) in a loop
    rom.set(
      [
        0x3e, 0x20, 0xe0, 0x00, 0xf0, 0x00, 0xf0, 0x00, 0xea, 0x00, 0xc0,
        0x3e, 0x10, 0xe0, 0x00, 0xf0, 0x00, 0xf0, 0x00, 0xea, 0x01, 0xc0,
        0x18, 0xe8,
      ],
      0x150,
    );
    let checksum = 0;
    for (let index = 0x134; index <= 0x14c; index += 1) {
      checksum = (checksum - rom[index] - 1) & 0xff;
    }
    rom[0x14d] = checksum;

    const canvas = createMockCanvas();
    const runner = await BinjgbRunner.create({
      canvas,
      romData: rom,
    });

    const emuPtr = (runner as any).emuPtr as number;
    runner.stepFrame(1);
    expect(runner.module._emulator_read_mem(emuPtr, 0xc000) & 0x0f).toBe(0x0f);
    expect(runner.module._emulator_read_mem(emuPtr, 0xc001) & 0x0f).toBe(0x0f);

    runner.setJoypadButton('up', true);
    runner.setJoypadButton('a', true);
    runner.stepFrame(1);
    // Active-low: up = bit 2 (0b1011 = 0xB), A = bit 0 (0b1110 = 0xE)
    expect(runner.module._emulator_read_mem(emuPtr, 0xc000) & 0x0f).toBe(0x0b);
    expect(runner.module._emulator_read_mem(emuPtr, 0xc001) & 0x0f).toBe(0x0e);

    runner.setJoypadButton('up', false);
    runner.setJoypadButton('a', false);
    runner.stepFrame(1);
    expect(runner.module._emulator_read_mem(emuPtr, 0xc000) & 0x0f).toBe(0x0f);
    expect(runner.module._emulator_read_mem(emuPtr, 0xc001) & 0x0f).toBe(0x0f);

    // Joypad callback must remain attached after reset()
    runner.reset();
    const resetEmuPtr = (runner as any).emuPtr as number;
    runner.setJoypadButton('start', true);
    runner.stepFrame(1);
    // Active-low: start = bit 3 (0b0111 = 0x7)
    expect(runner.module._emulator_read_mem(resetEmuPtr, 0xc001) & 0x0f).toBe(0x07);

    runner.destroy();
  });

  it('resets emulator state and restarts if previously playing', async () => {
    const rom = makeValidGbRom();
    const canvas = createMockCanvas();
    const runner = await BinjgbRunner.create({
      canvas,
      romData: rom,
    });

    runner.play();
    expect(runner.isPlaying).toBe(true);

    runner.reset();
    expect(runner.isPlaying).toBe(true);

    runner.pause();
    runner.reset();
    expect(runner.isPlaying).toBe(false);

    runner.destroy();
  });

  it('handles serial transfer (SC=0x81) without throwing ReferenceError for emulator', async () => {
    delete (globalThis as { emulator?: unknown }).emulator;

    const rom = makeValidGbRom();
    // 0x0100: nop; jp 0x0150
    rom.set([0x00, 0xc3, 0x50, 0x01], 0x100);
    // 0x0150: ld a, 0x42; ldh (0x01), a; ld a, 0x81; ldh (0x02), a; jr -2
    rom.set([0x3e, 0x42, 0xe0, 0x01, 0x3e, 0x81, 0xe0, 0x02, 0x18, 0xfe], 0x150);

    const canvas = createMockCanvas();
    const runner = await BinjgbRunner.create({
      canvas,
      romData: rom,
    });

    expect(() => {
      runner.stepFrame(2);
    }).not.toThrow();
    runner.destroy();
  });
});

describe('GBCEmulator.vue Lifecycle & UI', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    toastMock.showToast.mockReset();
  });

  it('mounts and initializes emulator on visible with valid ROM', async () => {
    const rom = makeValidGbRom();
    const wrapper = mount(GBCEmulator, {
      props: {
        isVisible: true,
        romData: rom,
        romName: 'test-game.gbc',
      },
    });

    await flushPromises();

    expect(wrapper.find('.emulator-overlay').exists()).toBe(true);
    expect(wrapper.text()).toContain('test-game.gbc');
    expect(toastMock.showToast).toHaveBeenCalledWith('ui.emulator.initSuccess', 'success');

    // Canvas exists and has 160x144 dimensions
    const canvas = wrapper.find('canvas');
    expect(canvas.exists()).toBe(true);
    expect(canvas.attributes('width')).toBe('160');
    expect(canvas.attributes('height')).toBe('144');

    wrapper.unmount();
  });

  it('handles pause and resume toggle with toasts', async () => {
    const rom = makeValidGbRom();
    const wrapper = mount(GBCEmulator, {
      props: {
        isVisible: true,
        romData: rom,
        romName: 'test-game.gbc',
      },
    });

    await flushPromises();

    const pauseBtn = wrapper.find('button[title="ui.emulator.pause"]');
    expect(pauseBtn.exists()).toBe(true);

    // Pause
    await pauseBtn.trigger('click');
    expect(toastMock.showToast).toHaveBeenCalledWith('ui.emulator.paused', 'success');

    // Resume
    await pauseBtn.trigger('click');
    expect(toastMock.showToast).toHaveBeenCalledWith('ui.emulator.running', 'success');

    wrapper.unmount();
  });

  it('handles reset game with toast', async () => {
    const rom = makeValidGbRom();
    const wrapper = mount(GBCEmulator, {
      props: {
        isVisible: true,
        romData: rom,
        romName: 'test-game.gbc',
      },
    });

    await flushPromises();

    const resetBtn = wrapper.find('button[title="ui.emulator.reset"]');
    expect(resetBtn.exists()).toBe(true);

    await resetBtn.trigger('click');
    expect(toastMock.showToast).toHaveBeenCalledWith('ui.emulator.reset - ui.emulator.running', 'success');

    wrapper.unmount();
  });

  it('maps keyboard WASD and JKCV inputs correctly', async () => {
    const rom = makeValidGbRom();
    const wrapper = mount(GBCEmulator, {
      props: {
        isVisible: true,
        romData: rom,
        romName: 'test-game.gbc',
      },
    });

    await flushPromises();

    const module = await getBinjgbModule();
    const setJoypUpSpy = vi.spyOn(module, '_set_joyp_up');
    const setJoypASpy = vi.spyOn(module, '_set_joyp_A');
    const setJoypBSpy = vi.spyOn(module, '_set_joyp_B');
    const setJoypStartSpy = vi.spyOn(module, '_set_joyp_start');
    const setJoypSelectSpy = vi.spyOn(module, '_set_joyp_select');

    // KeyW -> Up
    dispatchKey('keydown', 'KeyW');
    expect(setJoypUpSpy).toHaveBeenCalledWith(expect.any(Number), 1);
    dispatchKey('keyup', 'KeyW');
    expect(setJoypUpSpy).toHaveBeenCalledWith(expect.any(Number), 0);

    // KeyJ -> A
    dispatchKey('keydown', 'KeyJ');
    expect(setJoypASpy).toHaveBeenCalledWith(expect.any(Number), 1);
    dispatchKey('keyup', 'KeyJ');
    expect(setJoypASpy).toHaveBeenCalledWith(expect.any(Number), 0);

    // KeyK -> B
    dispatchKey('keydown', 'KeyK');
    expect(setJoypBSpy).toHaveBeenCalledWith(expect.any(Number), 1);
    dispatchKey('keyup', 'KeyK');
    expect(setJoypBSpy).toHaveBeenCalledWith(expect.any(Number), 0);

    // KeyC -> Start
    dispatchKey('keydown', 'KeyC');
    expect(setJoypStartSpy).toHaveBeenCalledWith(expect.any(Number), 1);
    dispatchKey('keyup', 'KeyC');
    expect(setJoypStartSpy).toHaveBeenCalledWith(expect.any(Number), 0);

    // KeyV -> Select
    dispatchKey('keydown', 'KeyV');
    expect(setJoypSelectSpy).toHaveBeenCalledWith(expect.any(Number), 1);
    dispatchKey('keyup', 'KeyV');
    expect(setJoypSelectSpy).toHaveBeenCalledWith(expect.any(Number), 0);

    // Irrelevant keys are ignored
    dispatchKey('keydown', 'KeyQ');

    wrapper.unmount();
  });

  it('shows error toast when ROM data is invalid', async () => {
    const invalidRom = new Uint8Array(10);
    const wrapper = mount(GBCEmulator, {
      props: {
        isVisible: true,
        romData: invalidRom,
        romName: 'invalid.gbc',
      },
    });

    await flushPromises();

    expect(toastMock.showToast).toHaveBeenCalledWith('ui.emulator.errors.invalidRom', 'error');

    wrapper.unmount();
  });

  it('cleans up and emits close on close button click and overlay click', async () => {
    const rom = makeValidGbRom();
    const wrapper = mount(GBCEmulator, {
      props: {
        isVisible: true,
        romData: rom,
        romName: 'test-game.gbc',
      },
    });

    await flushPromises();

    const closeBtn = wrapper.find('button[title="ui.emulator.close"]');
    await closeBtn.trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(1);

    wrapper.unmount();
  });

  it('cleans up on unmount and responds to isVisible property changes', async () => {
    const rom = makeValidGbRom();
    const wrapper = mount(GBCEmulator, {
      props: {
        isVisible: false,
        romData: rom,
        romName: 'test-game.gbc',
      },
    });

    await flushPromises();
    expect(wrapper.find('.emulator-overlay').exists()).toBe(false);

    // Toggle visible
    await wrapper.setProps({ isVisible: true });
    await flushPromises();
    expect(wrapper.find('.emulator-overlay').exists()).toBe(true);
    expect(toastMock.showToast).toHaveBeenCalledWith('ui.emulator.initSuccess', 'success');

    // Toggle hide
    await wrapper.setProps({ isVisible: false });
    await flushPromises();
    expect(wrapper.find('.emulator-overlay').exists()).toBe(false);

    wrapper.unmount();
  });
});
