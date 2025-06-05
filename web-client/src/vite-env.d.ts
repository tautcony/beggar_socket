/// <reference types="vite/client" />

/* eslint-disable */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'wasmboy' {
  interface WasmBoyConfig {
    headless?: boolean;
    useBootRom?: boolean;
    isAudioEnabled?: boolean;
    frameSkip?: number;
    audioBatchProcessing?: boolean;
    timersBatchProcessing?: boolean;
    audioAccumulatorSamples?: number;
    audioAccumulateSamples?: boolean;
    audioBufferSize?: number;
    graphicsBatchProcessing?: boolean;
    graphicsDisableScanlineRendering?: boolean;
    tileRendering?: boolean;
    tileCaching?: boolean;
    gameboyFPSCap?: number;
    updateGraphicsCallback?: boolean;
    updateAudioCallback?: boolean;
    saveStateCallback?: boolean;
    useGbcWhenOptional?: boolean;
  }

  interface WasmBoyPlugin {
    name: string;
    graphics?: (rgbaArray: Uint8ClampedArray) => void;
    audio?: (audioContext: AudioContext, headAudioNode: AudioNode, channelId: number) => AudioNode | void;
    saveState?: (saveStateObject: Record<string, unknown>) => void;
    canvas?: (canvasElement: HTMLCanvasElement, canvasContext: CanvasRenderingContext2D, canvasImageData: ImageData) => void;
    breakpoint?: () => void;
    ready?: () => void;
    play?: () => void;
    pause?: () => void;
    loadedAndStarted?: () => void;
  }

  interface WasmBoyStatic {
    config(config: WasmBoyConfig): Promise<void>;
    getCoreType(): string;
    getConfig(): WasmBoyConfig;
    setCanvas(canvas: HTMLCanvasElement): void;
    getCanvas(): HTMLCanvasElement | null;
    addBootROM(bootRom: Uint8Array): Promise<void>;
    getBootROMs(): any;
    loadROM(rom: Uint8Array): Promise<void>;
    play(): Promise<void>;
    pause(): Promise<void>;
    reset(): Promise<void>;
    addPlugin(plugin: WasmBoyPlugin): void;
    isPlaying(): boolean;
    isPaused(): boolean;
    isReady(): boolean;
    isLoadedAndStarted(): boolean;
    getVersion(): string;
    getSavedMemory(): Uint8Array;
    saveLoadedCartridge(): Promise<void>;
    deleteSavedCartridge(cartridgeKey: string): Promise<void>;
    saveState(saveStateSlot: number): Promise<void>;
    getSaveStates(): any;
    loadState(saveStateSlot: number): Promise<void>;
    deleteState(saveStateSlot: number): Promise<void>;
    getFPS(): number;
    setSpeed(speed: number): void;
    isGBC(): boolean;
    enableDefaultJoypad(): void;
    disableDefaultJoypad(): void;
    setJoypadState(joypadKey: string, pressed: boolean): void;
    resumeAudioContext(): Promise<void>;
  }

  export const WasmBoy: WasmBoyStatic;
  export type { WasmBoyConfig, WasmBoyPlugin, WasmBoyStatic };
}
