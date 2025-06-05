// TypeScript definitions for WasmBoy
// Project: https://github.com/torch2424/wasmBoy
// Definitions by: GitHub Copilot

declare module 'wasmboy' {

  export interface WasmBoyConfig {
    headless?: boolean;
    useGbcWhenOptional?: boolean;
    audioBatchProcessing?: boolean;
    audioBufferSize?: number;
    timersBatchProcessing?: boolean;
    tilesBatchProcessing?: boolean;
    tilesCaching?: boolean;
    audioCaching?: boolean;
    isAudioEnabled?: boolean;
    frameSkip?: number;
    gameboyFPS?: number;
    updateGraphicsCallback?: (imageDataArray: Uint8ClampedArray) => void;
    updateAudioCallback?: (audioBufferFloat32: Float32Array) => void;
    saveStateCallback?: (saveStateObject: SaveState) => void;
  }

  export interface JoypadState {
    up: boolean;
    right: boolean;
    down: boolean;
    left: boolean;
    a: boolean;
    b: boolean;
    select: boolean;
    start: boolean;
  }

  export interface CartridgeInfo {
    title: string;
    type: number;
    romSize: number;
    ramSize: number;
    cgbFlag: number;
    sgbFlag: number;
    destinationCode: number;
    oldLicenseeCode: number;
    maskROMVersionNumber: number;
    headerChecksum: number;
    globalChecksum: number;
    logoCheckBytes: number[];
  }

  export interface SaveState {
    wasmBoyMemory: ArrayBuffer;
    gbcMemory: ArrayBuffer;
    currentRom: Uint8Array;
    cartridgeRam: Uint8Array | null;
    cartridgeInfo: CartridgeInfo;
    createdDate: number;
    saveStateSlot: number;
  }

  export interface AudioChannel {
    enabled: boolean;
    dacEnabled: boolean;
    duty?: number;
    frequency?: number;
    volume?: number;
    volumeEnvelope?: number;
    length?: number;
    lengthEnabled?: boolean;
    sweep?: number;
    nr30?: number;
    nr31?: number;
    nr32?: number;
    nr33?: number;
    nr34?: number;
  }

  export interface BootROM {
    name: string;
    data: Uint8Array;
  }

  export interface ResponsiveGamepadOptions {
    element?: HTMLElement;
    touchElementId?: string;
    buttonElementIds?: {
      up?: string;
      down?: string;
      left?: string;
      right?: string;
      a?: string;
      b?: string;
      start?: string;
      select?: string;
    };
  }

  export interface ResponsiveGamepad {
    element?: HTMLElement;
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    a: boolean;
    b: boolean;
    start: boolean;
    select: boolean;
    initialize(options?: ResponsiveGamepadOptions): void;
    destroy(): void;
    getJoypadState(): JoypadState;
  }

  export interface WasmBoyPlugin {
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

  export interface WasmBoyStatic {
    // Core functionality
    config(wasmBoyConfig: WasmBoyConfig): Promise<void>;
    getCoreType(): string;
    getConfig(): WasmBoyConfig;

    // Canvas management
    setCanvas(canvas: HTMLCanvasElement): void;
    getCanvas(): HTMLCanvasElement | null;

    // Boot ROM management
    addBootROM(bootROM: BootROM): void;
    getBootROMs(): BootROM[];

    // ROM loading and control
    loadROM(romArrayBuffer: ArrayBuffer, enableDebugger?: boolean): Promise<void>;
    play(): Promise<void>;
    pause(): Promise<void>;
    reset(): Promise<void>;

    // Plugin system
    addPlugin(plugin: WasmBoyPlugin): void;

    // State queries
    isPlaying(): boolean;
    isPaused(): boolean;
    isReady(): boolean;
    isLoadedAndStarted(): boolean;
    getVersion(): string;

    // Save management
    getSavedMemory(): Promise<Uint8Array | null>;
    saveLoadedCartridge(): Promise<void>;
    deleteSavedCartridge(): Promise<void>;

    // Save states
    saveState(saveStateSlot?: number): Promise<SaveState>;
    getSaveStates(): Promise<SaveState[]>;
    loadState(saveStateSlot: number): Promise<void>;
    deleteState(saveStateSlot: number): Promise<void>;

    // Performance
    getFPS(): number;
    setSpeed(speed: number): void;

    // Game Boy Color detection
    isGBC(): boolean;

    // Controller
    ResponsiveGamepad: new (options?: ResponsiveGamepadOptions) => ResponsiveGamepad;
    enableDefaultJoypad(): void;
    disableDefaultJoypad(): void;
    setJoypadState(joypadState: JoypadState): void;

    // Audio
    resumeAudioContext(): Promise<void>;

    // Debug functions (prefixed with _)
    _getAudioChannels(): AudioChannel[];
    _getCartridgeInfo(): CartridgeInfo;
    _runNumberOfFrames(numberOfFrames: number): void;
    _runWasmExport(exportName: string, ...args: number[]): number;
    _getWasmMemorySection(startLocation: number, endLocation: number): Uint8Array;
    _getWasmConstant(constantName: string): number;
    _getStepsAsString(): string;
    _getCyclesAsString(): string;
  }

  declare const WasmBoy: WasmBoyStatic;

  export { WasmBoy };
  export default WasmBoy;
}
