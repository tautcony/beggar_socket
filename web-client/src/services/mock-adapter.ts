import { CartridgeAdapter, EnhancedProgressCallback, LogCallback, ProgressCallback, TranslateFunction } from './cartridge-adapter';
import { CommandResult } from '@/types/command-result';
import { CommandOptions } from '@/types/command-options';
import { DebugSettings } from '../settings/debug-settings';

/**
 * 模拟适配器类
 * 用于调试模式下模拟设备操作
 */
export class MockAdapter extends CartridgeAdapter {
  private mockRomData: Uint8Array | null = null;
  private mockRamData: Uint8Array | null = null;

  constructor(
    logCallback: LogCallback | null = null,
    progressCallback: ProgressCallback | null = null,
    translateFunc: TranslateFunction | null = null,
    enhancedProgressCallback: EnhancedProgressCallback | null = null,
  ) {
    // 创建模拟设备
    const mockDeviceInfo = DebugSettings.createMockDeviceInfo();
    super(mockDeviceInfo, logCallback, progressCallback, translateFunc, enhancedProgressCallback);

    this.log(this.t('messages.debug.mockModeEnabled') || '调试模式已启用 - 使用模拟设备');
  }

  /**
   * 模拟读取芯片ID
   */
  async readID(): Promise<CommandResult & { idStr?: string }> {
    this.log(this.t('messages.operation.readId'));

    await DebugSettings.delay();

    if (DebugSettings.shouldSimulateError()) {
      this.log(`${this.t('messages.operation.readIdFailed')}: 模拟错误`);
      return {
        success: false,
        message: this.t('messages.operation.readIdFailed'),
      };
    }

    const mockId = '01 00 7e 22 22 22 01 22';
    this.log(`${this.t('messages.operation.readIdSuccess')}: ${mockId}`);

    return {
      success: true,
      message: this.t('messages.operation.readIdSuccess'),
      idStr: mockId,
    };
  }

  /**
   * 模拟擦除芯片
   */
  async eraseChip(): Promise<CommandResult> {
    this.log(this.t('messages.operation.eraseChip'));

    // 模拟进度
    const startTime = Date.now();
    await DebugSettings.simulateProgress(
      (progress) => {
        const elapsed = (Date.now() - startTime) / 1000;
        const erasedSectors = Math.floor(10 * progress / 100); // 假设10个扇区
        const speed = elapsed > 0 ? (erasedSectors / elapsed) : 0;
        this.sendEnhancedProgress(this.createProgressInfo(
          progress,
          this.t('messages.progress.eraseSpeed', { speed: speed.toFixed(1) }),
          10,
          erasedSectors,
          startTime,
          speed,
          true,
        ));
      },
      2000,
    );

    if (DebugSettings.shouldSimulateError()) {
      this.log(`${this.t('messages.operation.eraseFailed')}: 模拟错误`);
      return {
        success: false,
        message: this.t('messages.operation.eraseFailed'),
      };
    }

    // 清空模拟数据
    this.mockRomData = null;
    this.mockRamData = null;

    this.log(this.t('messages.operation.eraseSuccess'));
    return {
      success: true,
      message: this.t('messages.operation.eraseSuccess'),
    };
  }

  /**
   * 模拟写入ROM
   */
  async writeROM(data: Uint8Array, options?: CommandOptions): Promise<CommandResult> {
    this.log(this.t('messages.rom.writing', { size: data.length }));

    // 模拟进度
    const startTime = Date.now();
    await DebugSettings.simulateProgress(
      (progress) => {
        const elapsed = (Date.now() - startTime) / 1000;
        const writtenBytes = Math.floor(data.length * progress / 100);
        const speed = elapsed > 0 ? (writtenBytes / 1024) / elapsed : 0;

        // 使用增强的进度回调
        this.sendEnhancedProgress(this.createProgressInfo(
          progress,
          this.t('messages.progress.writeSpeed', { speed: speed.toFixed(1) }),
          data.length,
          writtenBytes,
          startTime,
          speed,
          true,
        ));
      },
      3000,
    );

    if (DebugSettings.shouldSimulateError()) {
      this.log(`${this.t('messages.rom.writeFailed')}: 模拟错误`);
      return {
        success: false,
        message: this.t('messages.rom.writeFailed'),
      };
    }

    // 保存模拟数据
    this.mockRomData = new Uint8Array(data);

    this.log(this.t('messages.rom.writeComplete'));
    return {
      success: true,
      message: this.t('messages.rom.writeSuccess'),
    };
  }

  /**
   * 模拟读取ROM
   */
  async readROM(size: number): Promise<CommandResult & { data?: Uint8Array }> {
    this.log(this.t('messages.rom.reading'));

    // 模拟进度
    const startTime = Date.now();
    await DebugSettings.simulateProgress(
      (progress) => {
        const elapsed = (Date.now() - startTime) / 1000;
        const readBytes = Math.floor(size * progress / 100);
        const speed = elapsed > 0 ? (readBytes / 1024) / elapsed : 0;
        this.sendEnhancedProgress(this.createProgressInfo(
          progress,
          this.t('messages.progress.readSpeed', { speed: speed.toFixed(1) }),
          size,
          readBytes,
          startTime,
          speed,
          true,
        ));
      },
      2500,
    );

    if (DebugSettings.shouldSimulateError()) {
      this.log(`${this.t('messages.rom.readFailed')}: 模拟错误`);
      return {
        success: false,
        message: this.t('messages.rom.readFailed'),
      };
    }

    // 返回之前写入的数据或生成随机数据
    const data = this.mockRomData?.slice(0, size) || DebugSettings.generateRandomData(size);

    this.log(this.t('messages.rom.readSuccess', { size: data.length }));
    return {
      success: true,
      message: this.t('messages.rom.readSuccess', { size: data.length }),
      data,
    };
  }

  /**
   * 模拟校验ROM
   */
  async verifyROM(data: Uint8Array): Promise<CommandResult> {
    this.log(this.t('messages.rom.verifying'));

    // 模拟进度
    const startTime = Date.now();
    await DebugSettings.simulateProgress(
      (progress) => {
        const elapsed = (Date.now() - startTime) / 1000;
        const verifiedBytes = Math.floor(data.length * progress / 100);
        const speed = elapsed > 0 ? (verifiedBytes / 1024) / elapsed : 0;
        this.sendEnhancedProgress(this.createProgressInfo(
          progress,
          this.t('messages.progress.verifySpeed', { speed: speed.toFixed(1) }),
          data.length,
          verifiedBytes,
          startTime,
          speed,
          true,
        ));
      },
      2000,
    );

    if (DebugSettings.shouldSimulateError()) {
      this.log(`${this.t('messages.rom.verifyFailed')}: 模拟错误`);
      return {
        success: false,
        message: this.t('messages.rom.verifyFailed'),
      };
    }

    // 模拟校验结果
    const isMatch = this.mockRomData && this.compareData(data, this.mockRomData);
    const message = isMatch !== false ? this.t('messages.rom.verifySuccess') : this.t('messages.rom.verifyFailed');
    this.log(message);
    return {
      success: isMatch !== false,
      message,
    };
  }

  /**
   * 模拟写入RAM
   */
  async writeRAM(data: Uint8Array, options?: CommandOptions): Promise<CommandResult> {
    this.log(this.t('messages.ram.writing', { size: data.length }));

    // 模拟进度
    const startTime = Date.now();
    await DebugSettings.simulateProgress(
      (progress) => {
        const elapsed = (Date.now() - startTime) / 1000;
        const writtenBytes = Math.floor(data.length * progress / 100);
        const speed = elapsed > 0 ? (writtenBytes / 1024) / elapsed : 0;
        this.sendEnhancedProgress(this.createProgressInfo(
          progress,
          this.t('messages.progress.writeSpeed', { speed: speed.toFixed(1) }),
          data.length,
          writtenBytes,
          startTime,
          speed,
          true,
        ));
      },
      2000,
    );

    if (DebugSettings.shouldSimulateError()) {
      this.log(`${this.t('messages.ram.writeFailed')}: 模拟错误`);
      return {
        success: false,
        message: this.t('messages.ram.writeFailed'),
      };
    }

    this.mockRamData = new Uint8Array(data);
    this.log(this.t('messages.ram.writeComplete'));
    return {
      success: true,
      message: this.t('messages.ram.writeSuccess'),
    };
  }

  /**
   * 模拟读取RAM
   */
  async readRAM(size: number, options?: CommandOptions): Promise<CommandResult & { data?: Uint8Array }> {
    this.log(this.t('messages.ram.reading'));

    // 模拟进度
    const startTime = Date.now();
    await DebugSettings.simulateProgress(
      (progress) => {
        const elapsed = (Date.now() - startTime) / 1000;
        const readBytes = Math.floor(size * progress / 100);
        const speed = elapsed > 0 ? (readBytes / 1024) / elapsed : 0;
        this.sendEnhancedProgress(this.createProgressInfo(
          progress,
          this.t('messages.progress.readSpeed', { speed: speed.toFixed(1) }),
          size,
          readBytes,
          startTime,
          speed,
          true,
        ));
      },
      2000,
    );

    if (DebugSettings.shouldSimulateError()) {
      this.log(`${this.t('messages.ram.readFailed')}: 模拟错误`);
      return {
        success: false,
        message: this.t('messages.ram.readFailed'),
      };
    }

    const data = this.mockRamData?.slice(0, size) || DebugSettings.generateRandomData(size);
    this.log(this.t('messages.ram.readSuccess', { size: data.length }));
    return {
      success: true,
      message: this.t('messages.ram.readSuccess', { size: data.length }),
      data,
    };
  }

  /**
   * 模拟校验RAM
   */
  async verifyRAM(data: Uint8Array, options?: CommandOptions): Promise<CommandResult> {
    this.log(this.t('messages.ram.verifying'));

    // 模拟进度
    const startTime = Date.now();
    await DebugSettings.simulateProgress(
      (progress) => {
        const elapsed = (Date.now() - startTime) / 1000;
        const verifiedBytes = Math.floor(data.length * progress / 100);
        const speed = elapsed > 0 ? (verifiedBytes / 1024) / elapsed : 0;
        this.sendEnhancedProgress(this.createProgressInfo(
          progress,
          this.t('messages.progress.verifySpeed', { speed: speed.toFixed(1) }),
          data.length,
          verifiedBytes,
          startTime,
          speed,
          true,
        ));
      },
      1500,
    );

    if (DebugSettings.shouldSimulateError()) {
      this.log(`${this.t('messages.ram.verifyFailed')}: 模拟错误`);
      return {
        success: false,
        message: this.t('messages.ram.verifyFailed'),
      };
    }

    // 模拟校验结果
    const isMatch = this.mockRamData && this.compareData(data, this.mockRamData);
    const message = isMatch !== false ? this.t('messages.ram.verifySuccess') : this.t('messages.ram.verifyFailed');

    this.log(`${this.t('messages.ram.verify')}: ${message}`);
    return {
      success: isMatch !== false,
      message: message,
    };
  }

  /**
   * 比较两个数据数组
   */
  private compareData(data1: Uint8Array, data2: Uint8Array): boolean {
    if (data1.length !== data2.length) return false;

    const compareLength = Math.min(data1.length, data2.length);
    for (let i = 0; i < compareLength; i++) {
      if (data1[i] !== data2[i]) return false;
    }

    return true;
  }
}
