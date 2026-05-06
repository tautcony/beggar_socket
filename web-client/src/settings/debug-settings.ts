import { timeout } from '@/utils/async-utils';

export const SIMULATED_MEMORY_SLOTS = ['gbaRom', 'gbaRam', 'gbcRom', 'gbcRam'] as const;
export type SimulatedMemorySlot = typeof SIMULATED_MEMORY_SLOTS[number];

export interface SimulatedMemoryDefinition {
  capacity: number;
  defaultFillByte: number;
  labelKey: string;
}

export interface SimulatedMemoryImage {
  slot: SimulatedMemorySlot;
  fileName: string;
  size: number;
  updatedAt: number;
  data: Uint8Array;
}

const SIMULATED_MEMORY_DEFINITIONS: Record<SimulatedMemorySlot, SimulatedMemoryDefinition> = {
  gbaRom: {
    capacity: 32 * 1024 * 1024,
    defaultFillByte: 0xff,
    labelKey: 'ui.debug.memory.gbaRom',
  },
  gbaRam: {
    capacity: 128 * 1024,
    defaultFillByte: 0x00,
    labelKey: 'ui.debug.memory.gbaRam',
  },
  gbcRom: {
    capacity: 8 * 1024 * 1024,
    defaultFillByte: 0xff,
    labelKey: 'ui.debug.memory.gbcRom',
  },
  gbcRam: {
    capacity: 128 * 1024,
    defaultFillByte: 0x00,
    labelKey: 'ui.debug.memory.gbcRam',
  },
};

/**
 * 调试配置类
 * 用于在开发模式下模拟设备行为
 */
export class DebugSettings {
  // 是否启用调试模式（功能开关）
  private static _debugMode = false;

  // 是否显示调试面板（UI入口开关）
  private static _showDebugPanel = false;

  // 模拟延迟时间（毫秒）
  private static _simulatedDelay = 100;

  // 模拟进度更新间隔（毫秒）
  private static _progressUpdateInterval = 100;

  // 是否模拟错误
  private static _simulateErrors = false;

  // 错误模拟概率 (0-1)
  private static _errorProbability = 0.1;

  // 模拟读取速度（字节/秒）
  private static _simulatedReadSpeed = 512 * 1024;

  // 模拟写入速度（字节/秒）
  private static _simulatedWriteSpeed = 512 * 1024;

  // 会话级模拟内存镜像配置，不写入 localStorage
  private static _simulatedMemoryImages: Partial<Record<SimulatedMemorySlot, SimulatedMemoryImage>> = {};

  static get debugMode(): boolean {
    return this._debugMode;
  }
  static set debugMode(value: boolean) {
    this._debugMode = value;
    localStorage.setItem('debug_mode', value.toString());
  }

  static get showDebugPanel(): boolean {
    return this._showDebugPanel;
  }
  static set showDebugPanel(value: boolean) {
    this._showDebugPanel = value;
    localStorage.setItem('show_debug_panel', value.toString());
  }

  static get simulatedDelay(): number {
    return this._simulatedDelay;
  }
  static set simulatedDelay(value: number) {
    this._simulatedDelay = Math.max(0, value);
  }

  static get progressUpdateInterval(): number {
    return this._progressUpdateInterval;
  }
  static set progressUpdateInterval(value: number) {
    this._progressUpdateInterval = Math.max(50, value);
  }

  static get simulateErrors(): boolean {
    return this._simulateErrors;
  }
  static set simulateErrors(value: boolean) {
    this._simulateErrors = value;
  }

  static get errorProbability(): number {
    return this._errorProbability;
  }
  static set errorProbability(value: number) {
    this._errorProbability = Math.max(0, Math.min(1, value));
  }

  static get simulatedReadSpeed(): number {
    return this._simulatedReadSpeed;
  }
  static set simulatedReadSpeed(value: number) {
    this._simulatedReadSpeed = Math.max(1024, Math.floor(value));
    localStorage.setItem('simulated_read_speed', this._simulatedReadSpeed.toString());
  }

  static get simulatedWriteSpeed(): number {
    return this._simulatedWriteSpeed;
  }
  static set simulatedWriteSpeed(value: number) {
    this._simulatedWriteSpeed = Math.max(1024, Math.floor(value));
    localStorage.setItem('simulated_write_speed', this._simulatedWriteSpeed.toString());
  }

  /**
   * 初始化调试配置
   */
  static init(): void {
    // 从localStorage恢复设置
    const saved = localStorage.getItem('debug_mode');
    if (saved !== null) {
      this._debugMode = saved === 'true';
    }
    const showPanel = localStorage.getItem('show_debug_panel');
    if (showPanel !== null) {
      this._showDebugPanel = showPanel === 'true';
    }
    const readSpeed = localStorage.getItem('simulated_read_speed');
    if (readSpeed !== null) {
      const parsed = Number.parseInt(readSpeed, 10);
      if (!Number.isNaN(parsed)) {
        this._simulatedReadSpeed = Math.max(1024, parsed);
      }
    }
    const writeSpeed = localStorage.getItem('simulated_write_speed');
    if (writeSpeed !== null) {
      const parsed = Number.parseInt(writeSpeed, 10);
      if (!Number.isNaN(parsed)) {
        this._simulatedWriteSpeed = Math.max(1024, parsed);
      }
    }
  }

  /**
   * 切换调试模式
   */
  static toggleDebugMode(): boolean {
    this.debugMode = !this.debugMode;
    return this.debugMode;
  }

  /**
   * 切换调试面板显示
   */
  static toggleDebugPanel(): boolean {
    this.showDebugPanel = !this.showDebugPanel;
    return this.showDebugPanel;
  }

  /**
   * 模拟异步延迟
   */
  static async delay(customDelay?: number): Promise<void> {
    if (!this.debugMode) return;
    const delay = customDelay ?? this._simulatedDelay;
    return timeout(delay);
  }

  /**
   * 检查是否应该模拟错误
   */
  static shouldSimulateError(): boolean {
    if (!this.debugMode || !this._simulateErrors) return false;
    return Math.random() < this._errorProbability;
  }

  /**
   * 模拟进度更新
   */
  static async simulateProgress(
    callback: (progress: number, detail?: string) => void,
    totalTime = 3000,
    detail?: string,
  ): Promise<void> {
    if (!this.debugMode) return;
    const steps = Math.floor(totalTime / this._progressUpdateInterval);
    for (let i = 0; i <= steps; i++) {
      const progress = Math.min(100, (i / steps) * 100);
      callback(progress, detail);
      if (i < steps) {
        await timeout(this._progressUpdateInterval);
      }
    }
  }

  /**
   * 生成随机数据
   */
  static generateRandomData(size: number): Uint8Array {
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = Math.floor(Math.random() * 256);
    }
    return data;
  }

  static get simulatedDeviceEnabled(): boolean {
    return this._debugMode;
  }

  static get simulatedMemoryDefinitions(): Record<SimulatedMemorySlot, SimulatedMemoryDefinition> {
    return SIMULATED_MEMORY_DEFINITIONS;
  }

  static getSimulatedMemorySlots(): SimulatedMemorySlot[] {
    return [...SIMULATED_MEMORY_SLOTS];
  }

  static getSimulatedMemoryDefinition(slot: SimulatedMemorySlot): SimulatedMemoryDefinition {
    return this.simulatedMemoryDefinitions[slot];
  }

  static setSimulatedMemoryImage(slot: SimulatedMemorySlot, data: Uint8Array, fileName: string): void {
    this._simulatedMemoryImages[slot] = {
      slot,
      fileName,
      size: data.byteLength,
      updatedAt: Date.now(),
      data: new Uint8Array(data),
    };
  }

  static getSimulatedMemoryImage(slot: SimulatedMemorySlot): SimulatedMemoryImage | null {
    const image = this._simulatedMemoryImages[slot];
    if (!image) {
      return null;
    }

    return {
      ...image,
      data: new Uint8Array(image.data),
    };
  }

  static getSimulatedMemoryImageSummary(slot: SimulatedMemorySlot): Omit<SimulatedMemoryImage, 'data'> | null {
    const image = this._simulatedMemoryImages[slot];
    if (!image) {
      return null;
    }

    return {
      slot: image.slot,
      fileName: image.fileName,
      size: image.size,
      updatedAt: image.updatedAt,
    };
  }

  static clearSimulatedMemoryImage(slot: SimulatedMemorySlot): void {
    this._simulatedMemoryImages[slot] = undefined;
  }

  static clearAllSimulatedMemoryImages(): void {
    this._simulatedMemoryImages = {};
  }

  static countConfiguredSimulatedMemoryImages(): number {
    return this.getSimulatedMemorySlots().filter(slot => Boolean(this._simulatedMemoryImages[slot])).length;
  }
}

// 注意：DebugSettings.init() 由应用引导代码（main.ts）显式调用，不在模块加载时自动执行
