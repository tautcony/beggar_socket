import Binjgb, { type BinjgbModule } from './binjgb.js';
import wasmUrl from './binjgb.wasm?url';

export const SCREEN_WIDTH = 160;
export const SCREEN_HEIGHT = 144;
export const AUDIO_FRAMES = 4096;
export const AUDIO_LATENCY_SEC = 0.1;
export const MAX_UPDATE_SEC = 5 / 60;
export const CPU_TICKS_PER_SECOND = 4194304;
export const CPU_TICKS_PER_60HZ = 70224;
export const EVENT_NEW_FRAME = 1;
export const EVENT_AUDIO_BUFFER_FULL = 2;
export const EVENT_UNTIL_TICKS = 4;
export const CGB_COLOR_CURVE = 2; // SameBoy / GBC true color correction curve

export type JoypadButton = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'start' | 'select';

export interface JoypadState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  a: boolean;
  b: boolean;
  start: boolean;
  select: boolean;
}

export interface BinjgbRunnerOptions {
  canvas: HTMLCanvasElement;
  romData: Uint8Array;
  module?: BinjgbModule;
  audioEnabled?: boolean;
}

let cachedModulePromise: Promise<BinjgbModule> | null = null;

export async function getBinjgbModule(): Promise<BinjgbModule> {
  cachedModulePromise ??= Binjgb({
    locateFile: (path: string) => (path.endsWith('.wasm') ? wasmUrl : path),
  }).catch((err: unknown) => {
    cachedModulePromise = null;
    throw err;
  });
  return cachedModulePromise;
}

export class BinjgbRunner {
  readonly module: BinjgbModule;
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private imageData: ImageData | null = null;
  private audioContext: AudioContext | null = null;

  private emuPtr = 0;
  private joypadPtr = 0;
  private romPtr = 0;
  private romSize = 0;
  private readonly originalRomData: Uint8Array;
  private readonly audioEnabled: boolean;

  private joypadState: JoypadState = {
    up: false,
    down: false,
    left: false,
    right: false,
    a: false,
    b: false,
    start: false,
    select: false,
  };

  private isRunning = false;
  private isDestroyed = false;
  private rafId: number | null = null;
  private lastRafMs = 0;
  private leftoverTicks = 0;
  private audioStartSec = 0;

  constructor(module: BinjgbModule, options: BinjgbRunnerOptions) {
    this.module = module;
    this.canvas = options.canvas;
    this.originalRomData = options.romData;
    this.audioEnabled = options.audioEnabled !== false;

    this.ctx = this.canvas.getContext('2d');
    if (this.ctx) {
      this.imageData = this.ctx.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);
    }

    if (this.audioEnabled) {
      this.initAudio();
    }

    this.initEmulatorCore();
  }

  static async create(options: BinjgbRunnerOptions): Promise<BinjgbRunner> {
    const module = options.module ?? (await getBinjgbModule());
    return new BinjgbRunner(module, options);
  }

  private initAudio(): void {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      this.audioContext = new AudioContextClass();
      this.audioStartSec = 0;
    } catch (e) {
      console.warn('AudioContext initialization failed:', e);
      this.audioContext = null;
    }
  }

  private initEmulatorCore(): void {
    if (!this.originalRomData || this.originalRomData.byteLength < 0x150) {
      throw new RangeError('Invalid ROM size: minimum 336 bytes required for Game Boy header');
    }

    // 32KB alignment (2^15)
    const alignedSize = Math.max(0x8000, Math.ceil(this.originalRomData.byteLength / 0x8000) * 0x8000);
    this.romSize = alignedSize;
    this.romPtr = this.module._malloc(alignedSize);
    if (!this.romPtr) {
      throw new Error('Failed to allocate WASM memory for ROM');
    }

    this.module.HEAPU8.fill(0, this.romPtr, this.romPtr + alignedSize);
    this.module.HEAPU8.set(this.originalRomData, this.romPtr);

    const sampleRate = this.audioContext?.sampleRate ?? 44100;
    this.emuPtr = this.module._emulator_new_simple(
      this.romPtr,
      this.romSize,
      sampleRate,
      AUDIO_FRAMES,
      CGB_COLOR_CURVE,
    );

    if (this.emuPtr === 0) {
      this.module._free(this.romPtr);
      this.romPtr = 0;
      throw new RangeError('Failed to initialize binjgb emulator: invalid ROM');
    }

    this.attachJoypad();
  }

  private attachJoypad(): void {
    if (this.joypadPtr) {
      this.module._joypad_delete(this.joypadPtr);
      this.joypadPtr = 0;
    }

    this.joypadPtr = this.module._joypad_new();
    if (!this.joypadPtr) {
      throw new Error('Failed to initialize binjgb joypad state');
    }

    this.module._emulator_set_default_joypad_callback(this.emuPtr, this.joypadPtr);
    this.resetJoypadState();
    this.setJoypadState(this.joypadState);
  }

  private resetJoypadState(): void {
    this.joypadState = {
      up: false,
      down: false,
      left: false,
      right: false,
      a: false,
      b: false,
      start: false,
      select: false,
    };
  }

  play(): void {
    if (this.isDestroyed) return;

    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    if (!this.isRunning) {
      this.isRunning = true;
      this.lastRafMs = 0;
      this.leftoverTicks = 0;
      this.audioStartSec = 0;
      if (this.rafId === null && typeof requestAnimationFrame === 'function') {
        this.rafId = requestAnimationFrame(this.rafCallback);
      }
    }
  }

  pause(): void {
    if (this.isDestroyed || !this.isRunning) return;
    this.isRunning = false;

    if (this.rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.audioContext?.state === 'running') {
      this.audioContext.suspend().catch(() => {});
    }
  }

  reset(): void {
    if (this.isDestroyed) return;

    const wasRunning = this.isRunning;
    this.pause();

    if (this.joypadPtr) {
      this.module._joypad_delete(this.joypadPtr);
      this.joypadPtr = 0;
    }

    if (this.emuPtr) {
      this.module._emulator_delete(this.emuPtr);
      this.emuPtr = 0;
    }

    if (this.romPtr) {
      this.module._free(this.romPtr);
      this.romPtr = 0;
    }

    this.romPtr = this.module._malloc(this.romSize);
    if (!this.romPtr) {
      throw new Error('Failed to allocate WASM memory for ROM');
    }

    // Restore original ROM in memory
    this.module.HEAPU8.fill(0, this.romPtr, this.romPtr + this.romSize);
    this.module.HEAPU8.set(this.originalRomData, this.romPtr);

    const sampleRate = this.audioContext?.sampleRate ?? 44100;
    this.emuPtr = this.module._emulator_new_simple(
      this.romPtr,
      this.romSize,
      sampleRate,
      AUDIO_FRAMES,
      CGB_COLOR_CURVE,
    );

    if (this.emuPtr === 0) {
      throw new Error('Failed to reinitialize emulator on reset');
    }

    this.attachJoypad();
    this.lastRafMs = 0;
    this.leftoverTicks = 0;
    this.audioStartSec = 0;

    if (wasRunning) {
      this.play();
    }
  }

  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.isRunning = false;

    if (this.rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    if (this.joypadPtr) {
      this.module._joypad_delete(this.joypadPtr);
      this.joypadPtr = 0;
    }

    if (this.emuPtr) {
      this.module._emulator_delete(this.emuPtr);
      this.emuPtr = 0;
    }

    if (this.romPtr) {
      this.module._free(this.romPtr);
      this.romPtr = 0;
    }
  }

  stepFrame(count = 1): void {
    if (!this.emuPtr) return;
    for (let i = 0; i < count; i++) {
      const currentTicks = this.module._emulator_get_ticks_f64(this.emuPtr);
      this.runUntil(currentTicks + CPU_TICKS_PER_60HZ);
    }
  }

  private rafCallback = (nowMs: number): void => {
    if (!this.isRunning || this.isDestroyed) {
      this.rafId = null;
      return;
    }

    this.rafId = requestAnimationFrame(this.rafCallback);

    if (this.lastRafMs === 0) {
      this.lastRafMs = nowMs;
      const currentTicks = this.module._emulator_get_ticks_f64(this.emuPtr);
      this.runUntil(currentTicks + CPU_TICKS_PER_60HZ);
      return;
    }

    const deltaSec = Math.max(0, (nowMs - this.lastRafMs) / 1000);
    this.lastRafMs = nowMs;

    const clampedDeltaSec = Math.min(deltaSec, MAX_UPDATE_SEC);
    const startTicks = this.module._emulator_get_ticks_f64(this.emuPtr);
    const deltaTicks = clampedDeltaSec * CPU_TICKS_PER_SECOND;
    const runUntilTicks = startTicks + deltaTicks - this.leftoverTicks;

    this.runUntil(runUntilTicks);

    const endTicks = this.module._emulator_get_ticks_f64(this.emuPtr);
    this.leftoverTicks = Math.max(0, Math.floor(endTicks - runUntilTicks));
  };

  private runUntil(untilTicks: number): void {
    if (!this.emuPtr) return;

    let iterations = 0;
    while (!this.isDestroyed && iterations < 1000) {
      iterations++;
      const event = this.module._emulator_run_until_f64(this.emuPtr, untilTicks);
      if (event & EVENT_NEW_FRAME) {
        this.renderFrame();
      }
      if (event & EVENT_AUDIO_BUFFER_FULL) {
        this.pushAudioBuffer();
      }
      if (event & EVENT_UNTIL_TICKS) {
        break;
      }
    }
  }

  private renderFrame(): void {
    if (!this.ctx || !this.emuPtr) return;

    const frameBufferPtr = this.module._get_frame_buffer_ptr(this.emuPtr);
    const frameBufferSize = this.module._get_frame_buffer_size(this.emuPtr);
    if (!frameBufferPtr || !frameBufferSize) return;

    const frameData = new Uint8Array(this.module.HEAPU8.buffer, frameBufferPtr, frameBufferSize);

    this.imageData ??= this.ctx.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);
    this.imageData.data.set(frameData);
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  private pushAudioBuffer(): void {
    if (!this.audioContext || this.audioContext.state === 'closed' || !this.emuPtr) return;

    const audioPtr = this.module._get_audio_buffer_ptr(this.emuPtr);
    const capacity = this.module._get_audio_buffer_capacity(this.emuPtr);
    if (!audioPtr || capacity < AUDIO_FRAMES * 2) return;

    const audioData = new Uint8Array(this.module.HEAPU8.buffer, audioPtr, AUDIO_FRAMES * 2);
    const nowSec = this.audioContext.currentTime;
    const nowPlusLatency = nowSec + AUDIO_LATENCY_SEC;

    if (!this.audioStartSec) {
      this.audioStartSec = nowPlusLatency;
    }

    if (this.audioStartSec >= nowSec) {
      const buffer = this.audioContext.createBuffer(2, AUDIO_FRAMES, this.audioContext.sampleRate);
      const channel0 = buffer.getChannelData(0);
      const channel1 = buffer.getChannelData(1);

      for (let i = 0; i < AUDIO_FRAMES; i++) {
        channel0[i] = (audioData[2 * i] - 128) / 128;
        channel1[i] = (audioData[2 * i + 1] - 128) / 128;
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start(this.audioStartSec);

      const bufferDuration = AUDIO_FRAMES / this.audioContext.sampleRate;
      this.audioStartSec += bufferDuration;
    } else {
      this.audioStartSec = nowPlusLatency;
    }
  }

  setJoypadButton(button: JoypadButton, down: boolean): void {
    if (!this.joypadPtr) return;
    this.joypadState[button] = down;
    const val = down ? 1 : 0;
    switch (button) {
      case 'up':
        this.module._set_joyp_up(this.joypadPtr, val);
        break;
      case 'down':
        this.module._set_joyp_down(this.joypadPtr, val);
        break;
      case 'left':
        this.module._set_joyp_left(this.joypadPtr, val);
        break;
      case 'right':
        this.module._set_joyp_right(this.joypadPtr, val);
        break;
      case 'a':
        this.module._set_joyp_A(this.joypadPtr, val);
        break;
      case 'b':
        this.module._set_joyp_B(this.joypadPtr, val);
        break;
      case 'start':
        this.module._set_joyp_start(this.joypadPtr, val);
        break;
      case 'select':
        this.module._set_joyp_select(this.joypadPtr, val);
        break;
    }
  }

  setJoypadState(state: JoypadState): void {
    this.setJoypadButton('up', state.up);
    this.setJoypadButton('down', state.down);
    this.setJoypadButton('left', state.left);
    this.setJoypadButton('right', state.right);
    this.setJoypadButton('a', state.a);
    this.setJoypadButton('b', state.b);
    this.setJoypadButton('start', state.start);
    this.setJoypadButton('select', state.select);
  }

  getJoypadState(): JoypadState {
    return { ...this.joypadState };
  }

  get isPlaying(): boolean {
    return this.isRunning;
  }

  get isPaused(): boolean {
    return !this.isRunning;
  }

  get disposed(): boolean {
    return this.isDestroyed;
  }
}
export default BinjgbRunner;
