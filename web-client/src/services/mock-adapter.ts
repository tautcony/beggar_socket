import { CartridgeAdapter, LogCallback, ProgressCallback, TranslateFunction } from '@/services/cartridge-adapter';
import { DebugSettings } from '@/settings/debug-settings';
import { CommandOptions } from '@/types/command-options';
import { CommandResult } from '@/types/command-result';
import { DeviceInfo } from '@/types/device-info';
import { CFIInfo } from '@/utils/cfi-parser';
import { formatHex } from '@/utils/formatter-utils';
import { SpeedCalculator } from '@/utils/speed-calculator';

/**
 * 模拟适配器类
 * 用于调试模式下模拟设备操作
 */
export class MockAdapter extends CartridgeAdapter {
  private mockRomData: Uint8Array | null = null;
  private mockRamData: Uint8Array | null = null;

  /**
   * 构造函数
   * @param device - 设备对象（可选，如果不提供会创建模拟设备）
   * @param logCallback - 日志回调函数
   * @param progressCallback - 进度回调函数
   * @param translateFunc - 国际化翻译函数
   */
  constructor(
    device?: DeviceInfo,
    logCallback: LogCallback | null = null,
    progressCallback: ProgressCallback | null = null,
    translateFunc: TranslateFunction | null = null,
  ) {
    // 如果没有提供设备，创建模拟设备
    const mockDeviceInfo = device ?? DebugSettings.createMockDeviceInfo();
    super(mockDeviceInfo, logCallback, progressCallback, translateFunc);

    this.log(this.t('messages.debug.mockModeEnabled'));
  }

  /**
   * 模拟读取芯片ID
   */
  override async readID(): Promise<CommandResult & { idStr?: string }> {
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
   * @param signal - 取消信号，用于中止操作
   */
  override async eraseChip(signal?: AbortSignal): Promise<CommandResult> {
    this.log(this.t('messages.operation.eraseChip'));

    const startTime = Date.now();
    let cancelled = false;

    try {
      // 模拟进度，并检查取消信号
      await DebugSettings.simulateProgress(
        (progress) => {
          // 检查是否已被取消
          if (signal?.aborted) {
            cancelled = true;
            this.updateProgress(this.createErrorProgressInfo(this.t('messages.operation.cancelled')));
            return;
          }

          const elapsedSeconds = Date.now() - startTime;
          const erasedSectors = Math.floor(128 * progress / 100); // 假设128个扇区
          const speed = elapsedSeconds > 0 ? (erasedSectors * 1000 / elapsedSeconds) : 0;
          this.updateProgress(this.createProgressInfo(
            progress,
            this.t('messages.progress.eraseSpeed', { speed: speed.toFixed(1) }),
            128,
            erasedSectors,
            startTime,
            speed,
            true, // 允许取消
          ));
        },
        2000,
      );

      // 检查是否已被取消
      if (signal?.aborted || cancelled) {
        this.log(this.t('messages.operation.cancelled'));
        return {
          success: false,
          message: this.t('messages.operation.cancelled'),
        };
      }

      if (DebugSettings.shouldSimulateError()) {
        this.updateProgress(this.createErrorProgressInfo(this.t('messages.operation.eraseFailed')));
        this.log(`${this.t('messages.operation.eraseFailed')}: 模拟错误`);
        return {
          success: false,
          message: this.t('messages.operation.eraseFailed'),
        };
      }

      // 清空模拟数据
      this.mockRomData = null;
      this.mockRamData = null;

      const elapsedSeconds = Date.now() - startTime;
      this.log(`${this.t('messages.operation.eraseComplete')} (${(elapsedSeconds / 1000).toFixed(1)}s)`);
      this.updateProgress(this.createProgressInfo(
        100,
        this.t('messages.operation.eraseComplete'),
        128,
        128,
        startTime,
        0,
        false, // 完成后禁用取消
        'completed',
      ));

      return {
        success: true,
        message: this.t('messages.operation.eraseComplete'),
      };
    } catch (error) {
      if (signal?.aborted) {
        this.log(this.t('messages.operation.cancelled'));
        return {
          success: false,
          message: this.t('messages.operation.cancelled'),
        };
      }
      throw error;
    }
  }

  /**
   * 模拟擦除ROM扇区
   * @param startAddress - 起始地址
   * @param endAddress - 结束地址
   * @param sectorSize - 扇区大小（默认64KB）
   * @param signal - 取消信号，用于中止操作
   * @returns - 操作结果
   */
  override async eraseSectors(startAddress = 0, endAddress: number, sectorSize = 0x10000, signal?: AbortSignal): Promise<CommandResult> {
    this.log(`擦除扇区 ${formatHex(startAddress, 4)} - ${formatHex(endAddress, 4)}`);

    const totalSectors = Math.floor((endAddress - startAddress) / sectorSize) + 1;
    const totalBytes = endAddress - startAddress;
    const startTime = Date.now();
    let cancelled = false;

    // 使用速度计算器模拟
    const speedCalculator = new SpeedCalculator();

    try {
      await DebugSettings.simulateProgress(
        (progress) => {
          // 检查是否已被取消
          if (signal?.aborted) {
            cancelled = true;
            this.updateProgress(this.createErrorProgressInfo(this.t('messages.operation.cancelled')));
            return;
          }

          const erasedSectors = Math.floor(totalSectors * progress / 100);
          const erasedBytes = erasedSectors * sectorSize;

          // 模拟速度
          const currentSpeed = 5000 + Math.random() * 3000; // 5-8 KB/s
          speedCalculator.addDataPoint(sectorSize, Date.now());

          this.updateProgress(this.createProgressInfo(
            progress,
            this.t('messages.progress.eraseSpeed', { speed: currentSpeed.toFixed(1) }),
            totalBytes,
            erasedBytes,
            startTime,
            currentSpeed,
            true, // 允许取消
          ));
        },
        2500,
      );

      if (signal?.aborted || cancelled) {
        this.updateProgress(this.createErrorProgressInfo(this.t('messages.operation.cancelled')));
        return {
          success: false,
          message: this.t('messages.operation.cancelled'),
        };
      }

      if (DebugSettings.shouldSimulateError()) {
        this.updateProgress(this.createErrorProgressInfo(this.t('messages.operation.eraseSectorFailed')));
        this.log(`${this.t('messages.operation.eraseSectorFailed')}: 模拟错误`);
        return {
          success: false,
          message: this.t('messages.operation.eraseSectorFailed'),
        };
      }

      const totalTime = (Date.now() - startTime) / 1000;
      const avgSpeed = SpeedCalculator.calculateAverageSpeed(totalBytes, totalTime);
      const maxSpeed = speedCalculator.getMaxSpeed();

      this.log(this.t('messages.operation.eraseSuccess'));
      this.log(this.t('messages.operation.eraseSummary', {
        totalTime: totalTime.toFixed(1),
        avgSpeed: avgSpeed.toFixed(1),
        maxSpeed: maxSpeed.toFixed(1),
        totalSectors: totalSectors,
      }));

      // 报告完成状态
      this.updateProgress(this.createProgressInfo(
        100,
        this.t('messages.operation.eraseSuccess'),
        totalBytes,
        totalBytes,
        startTime,
        avgSpeed,
        false, // 完成后禁用取消
        'completed',
      ));

      return {
        success: true,
        message: this.t('messages.operation.eraseSuccess'),
      };
    } catch (e) {
      if (signal?.aborted) {
        this.log(this.t('messages.operation.cancelled'));
        return {
          success: false,
          message: this.t('messages.operation.cancelled'),
        };
      }
      this.updateProgress(this.createErrorProgressInfo(this.t('messages.operation.eraseSectorFailed')));
      this.log(`${this.t('messages.operation.eraseSectorFailed')}: ${e instanceof Error ? e.message : String(e)}`);
      return {
        success: false,
        message: this.t('messages.operation.eraseSectorFailed'),
      };
    }
  }

  /**
   * 模拟写入ROM
   * @param fileData - 文件数据
   * @param options - 写入选项
   * @param signal - 取消信号，用于中止操作
   * @returns - 操作结果
   */
  override async writeROM(fileData: Uint8Array, options: CommandOptions, signal?: AbortSignal): Promise<CommandResult> {
    this.log(this.t('messages.rom.writing', { size: fileData.length }));

    const startTime = Date.now();
    const total = fileData.length;
    let cancelled = false;

    // 使用速度计算器模拟
    const speedCalculator = new SpeedCalculator();

    try {
      // 模拟检查空白区域和擦除
      if (!this.mockRomData || this.mockRomData.length === 0) {
        this.log(this.t('messages.rom.checkingIfBlank'));
        await new Promise(resolve => setTimeout(resolve, 100));

        // 模拟擦除
        this.log(this.t('messages.operation.eraseChip'));
        const eraseResult = await this.eraseChip(signal);
        if (!eraseResult.success) {
          return eraseResult;
        }
      }

      // 模拟进度
      await DebugSettings.simulateProgress(
        (progress) => {
          // 检查是否已被取消
          if (signal?.aborted) {
            cancelled = true;
            this.updateProgress(this.createErrorProgressInfo(this.t('messages.operation.cancelled')));
            return;
          }

          const written = Math.floor(total * progress / 100);

          // 模拟速度
          const currentSpeed = 15000 + Math.random() * 10000; // 15-25 KB/s
          speedCalculator.addDataPoint(1024, Date.now());

          this.updateProgress(this.createProgressInfo(
            progress,
            this.t('messages.progress.writeSpeed', { speed: currentSpeed.toFixed(1) }),
            total,
            written,
            startTime,
            currentSpeed,
            true, // 允许取消
          ));
        },
        3000,
      );

      if (signal?.aborted || cancelled) {
        this.updateProgress(this.createErrorProgressInfo(this.t('messages.operation.cancelled')));
        return {
          success: false,
          message: this.t('messages.operation.cancelled'),
        };
      }

      if (DebugSettings.shouldSimulateError()) {
        this.updateProgress(this.createErrorProgressInfo(this.t('messages.rom.writeFailed')));
        this.log(`${this.t('messages.rom.writeFailed')}: 模拟错误`);
        return {
          success: false,
          message: this.t('messages.rom.writeFailed'),
        };
      }

      // 保存模拟数据
      this.mockRomData = new Uint8Array(fileData);

      const totalTime = (Date.now() - startTime) / 1000;
      const avgSpeed = SpeedCalculator.calculateAverageSpeed(total, totalTime);
      const maxSpeed = speedCalculator.getMaxSpeed();

      this.log(this.t('messages.rom.writeComplete'));
      this.log(this.t('messages.rom.writeSummary', {
        totalTime: totalTime.toFixed(1),
        avgSpeed: avgSpeed.toFixed(1),
        maxSpeed: maxSpeed.toFixed(1),
        totalSize: (total / 1024).toFixed(1),
      }));

      // 报告完成状态
      this.updateProgress(this.createProgressInfo(
        100,
        this.t('messages.rom.writeComplete'),
        total,
        total,
        startTime,
        avgSpeed,
        false, // 完成后禁用取消
        'completed',
      ));

      return {
        success: true,
        message: this.t('messages.rom.writeSuccess'),
      };
    } catch (e) {
      this.updateProgress(this.createErrorProgressInfo(this.t('messages.rom.writeFailed')));
      this.log(`${this.t('messages.rom.writeFailed')}: ${e instanceof Error ? e.message : String(e)}`);
      return {
        success: false,
        message: this.t('messages.rom.writeFailed'),
      };
    }
  }

  /**
   * 获取卡带信息 - 模拟CFI查询
   * @returns 卡带容量相关信息
   */
  override async getCartInfo(): Promise<CFIInfo | false> {
    this.log(this.t('messages.operation.queryingRomSize'));

    await DebugSettings.delay();

    if (DebugSettings.shouldSimulateError()) {
      this.log(this.t('messages.operation.cfiParseFailed'));
      return false;
    }

    // 模拟CFI信息
    const deviceSize = 134217728; // 128MB
    const sectorSize = 0x10000; // 64KB
    const sectorCount = deviceSize / sectorSize; // 32个扇区
    const bufferWriteBytes = 512;

    const mockCfiInfo: CFIInfo = {
      flashId: new Uint8Array([0x01, 0x00, 0x7e, 0x22, 0x22, 0x22, 0x01, 0x22]),
      magic: 'QRY',
      dataSwap: null,
      vddMin: 2.7,
      vddMax: 3.6,
      singleWrite: true,
      singleWriteTimeAvg: 10,
      singleWriteTimeMax: 50,
      bufferWrite: true,
      bufferSize: bufferWriteBytes,
      bufferWriteTimeAvg: 100,
      bufferWriteTimeMax: 1000,
      sectorErase: true,
      sectorEraseTimeAvg: 700,
      sectorEraseTimeMax: 2000,
      chipErase: true,
      chipEraseTimeAvg: 10000,
      chipEraseTimeMax: 30000,
      tbBootSector: false,
      tbBootSectorRaw: 0,
      deviceSize,
      eraseSectorRegions: 1,
      eraseSectorBlocks: [[sectorSize, sectorCount, deviceSize]], // [扇区大小, 扇区数量, 总大小]
      info: `模拟CFI信息: 设备大小=${deviceSize}字节, 扇区大小=${sectorSize}字节, 扇区数量=${sectorCount}`,
    };

    this.log(this.t('messages.operation.cfiParseSuccess'));
    this.log(mockCfiInfo.info);

    return mockCfiInfo;
  }
  /**
   * 模拟读取ROM
   * @param size - 读取大小
   * @param baseAddress - 基础地址
   * @param signal - 取消信号，用于中止操作
   * @returns - 操作结果，包含读取的数据
   */
  override async readROM(size = 0x200000, options: CommandOptions, signal?: AbortSignal): Promise<CommandResult> {
    const baseAddress = options.baseAddress ?? 0x00;
    this.log(this.t('messages.rom.reading'));

    const startTime = Date.now();
    let cancelled = false;

    // 使用速度计算器模拟
    const speedCalculator = new SpeedCalculator();

    try {
      // 模拟进度
      await DebugSettings.simulateProgress(
        (progress) => {
          // 检查是否已被取消
          if (signal?.aborted) {
            cancelled = true;
            this.updateProgress(this.createErrorProgressInfo(this.t('messages.operation.cancelled')));
            return;
          }

          const readBytes = Math.floor(size * progress / 100);

          // 模拟速度
          const currentSpeed = 20000 + Math.random() * 15000; // 20-35 KB/s
          speedCalculator.addDataPoint(1024, Date.now());

          this.updateProgress(this.createProgressInfo(
            progress,
            this.t('messages.progress.readSpeed', { speed: currentSpeed.toFixed(1) }),
            size,
            readBytes,
            startTime,
            currentSpeed,
            true, // 允许取消
          ));
        },
        2500,
      );

      if (signal?.aborted || cancelled) {
        this.updateProgress(this.createErrorProgressInfo(this.t('messages.operation.cancelled')));
        return {
          success: false,
          message: this.t('messages.operation.cancelled'),
        };
      }

      if (DebugSettings.shouldSimulateError()) {
        this.updateProgress(this.createErrorProgressInfo(this.t('messages.rom.readFailed')));
        this.log(`${this.t('messages.rom.readFailed')}: 模拟错误`);
        return {
          success: false,
          message: this.t('messages.rom.readFailed'),
        };
      }

      // 返回之前写入的数据或生成随机数据
      const data = this.mockRomData?.slice(baseAddress, baseAddress + size) ?? DebugSettings.generateRandomData(size);

      const totalTime = (Date.now() - startTime) / 1000;
      const avgSpeed = SpeedCalculator.calculateAverageSpeed(size, totalTime);
      const maxSpeed = speedCalculator.getMaxSpeed();

      this.log(this.t('messages.rom.readSuccess', { size: data.length }));
      this.log(this.t('messages.rom.readSummary', {
        totalTime: totalTime.toFixed(1),
        avgSpeed: avgSpeed.toFixed(1),
        maxSpeed: maxSpeed.toFixed(1),
        totalSize: (size / 1024).toFixed(1),
      }));

      this.updateProgress(this.createProgressInfo(
        100,
        this.t('messages.rom.readSuccess', { size: data.length }),
        size,
        size,
        startTime,
        avgSpeed,
        false,
        'completed',
      ));

      return {
        success: true,
        data: data,
        message: this.t('messages.rom.readSuccess', { size: data.length }),
      };
    } catch (e) {
      this.updateProgress(this.createErrorProgressInfo(this.t('messages.rom.readFailed')));
      this.log(`${this.t('messages.rom.readFailed')}: ${e instanceof Error ? e.message : String(e)}`);
      return {
        success: false,
        message: this.t('messages.rom.readFailed'),
      };
    }
  }

  /**
   * 模拟校验ROM
   * @param fileData - 文件数据
   * @param baseAddress - 基础地址
   * @param signal - 取消信号，用于中止操作
   * @returns - 操作结果
   */
  override async verifyROM(fileData: Uint8Array, options: CommandOptions, signal?: AbortSignal): Promise<CommandResult> {
    const baseAddress = options.baseAddress ?? 0x00;
    this.log(this.t('messages.rom.verifying'));

    const startTime = Date.now();
    let cancelled = false;

    // 使用速度计算器模拟
    const speedCalculator = new SpeedCalculator();

    try {
      // 模拟进度
      await DebugSettings.simulateProgress(
        (progress) => {
          // 检查是否已被取消
          if (signal?.aborted) {
            cancelled = true;
            this.updateProgress(this.createErrorProgressInfo(this.t('messages.operation.cancelled')));
            return;
          }

          const verifiedBytes = Math.floor(fileData.length * progress / 100);

          // 模拟速度
          const currentSpeed = 18000 + Math.random() * 12000; // 18-30 KB/s
          speedCalculator.addDataPoint(1024, Date.now());

          this.updateProgress(this.createProgressInfo(
            progress,
            this.t('messages.progress.verifySpeed', { speed: currentSpeed.toFixed(1) }),
            fileData.length,
            verifiedBytes,
            startTime,
            currentSpeed,
            true, // 允许取消
          ));
        },
        2000,
      );

      if (signal?.aborted || cancelled) {
        this.updateProgress(this.createErrorProgressInfo(this.t('messages.operation.cancelled')));
        return {
          success: false,
          message: this.t('messages.operation.cancelled'),
        };
      }

      if (DebugSettings.shouldSimulateError()) {
        this.log(`${this.t('messages.rom.verifyFailed')}: 模拟错误`);
        this.updateProgress(this.createErrorProgressInfo(this.t('messages.rom.verifyFailed')));
        return {
          success: false,
          message: this.t('messages.rom.verifyFailed'),
        };
      }

      // 模拟校验结果
      const isMatch = this.mockRomData && this.compareData(fileData, this.mockRomData.slice(baseAddress, baseAddress + fileData.length));

      const totalTime = (Date.now() - startTime) / 1000;
      const avgSpeed = SpeedCalculator.calculateAverageSpeed(fileData.length, totalTime);
      const maxSpeed = speedCalculator.getMaxSpeed();

      if (isMatch !== false) {
        this.log(this.t('messages.rom.verifySuccess'));
        this.log(this.t('messages.rom.verifySummary', {
          totalTime: totalTime.toFixed(1),
          avgSpeed: avgSpeed.toFixed(1),
          maxSpeed: maxSpeed.toFixed(1),
          totalSize: (fileData.length / 1024).toFixed(1),
        }));
        this.updateProgress(this.createProgressInfo(
          100,
          this.t('messages.rom.verifySuccess'),
          fileData.length,
          fileData.length,
          startTime,
          avgSpeed,
          false,
          'completed',
        ));
      } else {
        this.log(this.t('messages.rom.verifyFailed'));
        this.updateProgress(this.createErrorProgressInfo(this.t('messages.rom.verifyFailed')));
      }

      const message = isMatch !== false ? this.t('messages.rom.verifySuccess') : this.t('messages.rom.verifyFailed');
      return {
        success: isMatch !== false,
        message,
      };
    } catch (e) {
      this.updateProgress(this.createErrorProgressInfo(this.t('messages.rom.verifyFailed')));
      this.log(`${this.t('messages.rom.verifyFailed')}: ${e instanceof Error ? e.message : String(e)}`);
      return {
        success: false,
        message: this.t('messages.rom.verifyFailed'),
      };
    }
  }

  /**
   * 模拟写入RAM
   * @param fileData - 文件数据
   * @param options - 写入选项
   * @returns - 操作结果
   */
  override async writeRAM(fileData: Uint8Array, options: CommandOptions): Promise<CommandResult> {
    this.log(this.t('messages.ram.writing', { size: fileData.length }));

    const startTime = Date.now();
    const total = fileData.length;

    // 使用速度计算器模拟
    const speedCalculator = new SpeedCalculator();

    try {
      // 如果是FLASH类型，模拟擦除过程
      if (options.ramType === 'FLASH') {
        this.log(this.t('messages.gba.erasingFlash'));
        await DebugSettings.delay(1000);
        this.log(this.t('messages.gba.eraseComplete'));
      }

      // 模拟进度
      await DebugSettings.simulateProgress(
        (progress) => {
          const writtenBytes = Math.floor(total * progress / 100);
          speedCalculator.addDataPoint(writtenBytes, Date.now());
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

      this.mockRamData = new Uint8Array(fileData);

      const totalTime = (Date.now() - startTime) / 1000;
      const avgSpeed = SpeedCalculator.calculateAverageSpeed(total, totalTime);
      const maxSpeed = speedCalculator.getMaxSpeed();

      this.log(this.t('messages.ram.writeComplete'));
      this.log(this.t('messages.ram.writeSummary', {
        totalTime: totalTime.toFixed(1),
        avgSpeed: avgSpeed.toFixed(1),
        maxSpeed: maxSpeed.toFixed(1),
        totalSize: (total / 1024).toFixed(1),
      }));

      return {
        success: true,
        message: this.t('messages.ram.writeSuccess'),
      };
    } catch (e) {
      this.log(`${this.t('messages.ram.writeFailed')}: ${e instanceof Error ? e.message : String(e)}`);
      return {
        success: false,
        message: this.t('messages.ram.writeFailed'),
      };
    }
  }

  /**
   * 模拟读取RAM
   * @param size - 读取大小
   * @param options - 读取参数
   * @returns - 操作结果，包含读取的数据
   */
  override async readRAM(size = 0x8000, options: CommandOptions) {
    this.log(this.t('messages.ram.reading'));

    const startTime = Date.now();

    // 使用速度计算器模拟
    const speedCalculator = new SpeedCalculator();

    try {
      // 模拟进度
      await DebugSettings.simulateProgress(
        (progress) => {
          const readBytes = Math.floor(size * progress / 100);
          speedCalculator.addDataPoint(readBytes, Date.now());
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

      const data = this.mockRamData?.slice(0, size) ?? DebugSettings.generateRandomData(size);

      const totalTime = (Date.now() - startTime) / 1000;
      const avgSpeed = SpeedCalculator.calculateAverageSpeed(size, totalTime);
      const maxSpeed = speedCalculator.getMaxSpeed();

      this.log(this.t('messages.ram.readSuccess', { size: data.length }));
      this.log(this.t('messages.ram.readSummary', {
        totalTime: totalTime.toFixed(1),
        avgSpeed: avgSpeed.toFixed(1),
        maxSpeed: maxSpeed.toFixed(1),
        totalSize: (size / 1024).toFixed(1),
      }));

      return {
        success: true,
        data: data,
        message: this.t('messages.ram.readSuccess', { size: data.length }),
      };
    } catch (e) {
      this.log(`${this.t('messages.ram.readFailed')}: ${e instanceof Error ? e.message : String(e)}`);
      return {
        success: false,
        message: this.t('messages.ram.readFailed'),
      };
    }
  }

  /**
   * 模拟校验RAM
   * @param fileData - 文件数据
   * @param options - 选项对象
   * @returns - 操作结果
   */
  override async verifyRAM(fileData: Uint8Array, options: CommandOptions) {
    this.log(this.t('messages.ram.verifying'));

    const startTime = Date.now();

    try {
      // 模拟进度
      await DebugSettings.simulateProgress(
        (progress) => { },
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
      const isMatch = this.mockRamData && this.compareData(fileData, this.mockRamData);
      const message = isMatch !== false ? this.t('messages.ram.verifySuccess') : this.t('messages.ram.verifyFailed');

      this.log(`${this.t('messages.ram.verify')}: ${message}`);
      return {
        success: isMatch !== false,
        message: message,
      };
    } catch (e) {
      this.log(`${this.t('messages.ram.verifyFailed')}: ${e instanceof Error ? e.message : String(e)}`);
      return {
        success: false,
        message: this.t('messages.ram.verifyFailed'),
      };
    }
  }

  /**
   * 模拟ROM Bank 切换
   * @param bank - Bank编号
   */
  async switchROMBank(bank: number): Promise<void> {
    if (bank < 0) return;

    await DebugSettings.delay(50); // 短暂延迟模拟操作
    this.log(`模拟ROM Bank切换到 ${bank}`);
  }

  /**
   * 模拟切换SRAM的Bank
   * @param bank - Bank编号 (0或1)
   */
  async switchSRAMBank(bank: number): Promise<void> {
    bank = bank === 0 ? 0 : 1;
    await DebugSettings.delay(50);
    this.log(this.t('messages.gba.bankSwitchSram', { bank }) || `切换SRAM Bank到 ${bank}`);
  }

  /**
   * 模拟切换Flash的Bank
   * @param bank - Bank编号 (0或1)
   */
  async switchFlashBank(bank: number): Promise<void> {
    bank = bank === 0 ? 0 : 1;
    await DebugSettings.delay(50);
    this.log(this.t('messages.gba.bankSwitchFlash', { bank }));
  }

  /**
   * 模拟检查区域是否为空
   * @param address - 检查地址
   * @param size - 检查大小
   * @returns 是否为空白区域
   */
  async isBlank(address: number, size = 0x100): Promise<boolean> {
    this.log(this.t('messages.rom.checkingIfBlank'));
    await DebugSettings.delay(100);

    // 如果没有写入过数据，认为是空白的
    const blank = !this.mockRomData || this.mockRomData.length === 0;

    if (blank) {
      this.log(this.t('messages.rom.areaIsBlank'));
    } else {
      this.log(this.t('messages.rom.areaNotBlank'));
    }

    return blank;
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

export default MockAdapter;
