import { CartridgeAdapter, LogCallback, ProgressCallback, TranslateFunction } from '@/services/cartridge-adapter';
import { DebugSettings } from '@/settings/debug-settings';
import { CommandOptions } from '@/types/command-options';
import { CommandResult } from '@/types/command-result';
import { DeviceInfo } from '@/types/device-info';
import { timeout } from '@/utils/async-utils';
import { formatBytes, formatSpeed, formatTimeDuration } from '@/utils/formatter-utils';
import { CFIInfo } from '@/utils/parsers/cfi-parser';
import { ProgressInfoBuilder } from '@/utils/progress/progress-builder';
import { ProgressReporter } from '@/utils/progress/progress-reporter';
import { SpeedCalculator } from '@/utils/progress/speed-calculator';

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

    this.log(this.t('messages.debug.mockModeEnabled'), 'info');
  }

  /**
   * 模拟擦除芯片
   * @param signal - 取消信号，用于中止操作
   */
  override async eraseChip(signal?: AbortSignal): Promise<CommandResult> {
    this.log(this.t('messages.operation.eraseChip'), 'info');

    const startTime = Date.now();
    let cancelled = false;

    const deviceSize = 33554432; // 32MB
    const sectorSize = 0x10000; // 64KB

    try {

      // 模拟进度，并检查取消信号
      await DebugSettings.simulateProgress(
        (progress) => {
          // 检查是否已被取消
          if (signal?.aborted) {
            cancelled = true;
            this.updateProgress(ProgressInfoBuilder.error('erase', this.t('messages.operation.cancelled')).build());
            return;
          }

          const erasedBytes = Math.floor(deviceSize * progress / 100);

          const speed = 5000 + Math.random() * 3000; // 5-8 KB/s
          this.updateProgress(ProgressInfoBuilder.running('erase')
            .progress(progress)
            .detail(this.t('messages.progress.eraseSpeed', { speed: formatSpeed(speed) }))
            .bytes(erasedBytes, deviceSize)
            .startTime(startTime)
            .speed(speed)
            .build());
        },
        2000,
      );

      // 检查是否已被取消
      if (signal?.aborted || cancelled) {
        this.log(this.t('messages.operation.cancelled'), 'warn');
        return {
          success: false,
          message: this.t('messages.operation.cancelled'),
        };
      }

      if (DebugSettings.shouldSimulateError()) {
        this.updateProgress(ProgressInfoBuilder.error('erase', this.t('messages.operation.eraseFailed')).build());
        this.log(`${this.t('messages.operation.eraseFailed')}: 模拟错误`, 'error');
        return {
          success: false,
          message: this.t('messages.operation.eraseFailed'),
        };
      }

      // 清空模拟数据
      this.mockRomData = null;
      this.mockRamData = null;

      const elapsedSeconds = Date.now() - startTime;
      this.log(`${this.t('messages.operation.eraseComplete')} (${(elapsedSeconds / 1000).toFixed(1)}s)`, 'success');
      this.updateProgress(ProgressInfoBuilder.completed('erase')
        .detail(this.t('messages.operation.eraseComplete'))
        .bytes(deviceSize, deviceSize)
        .startTime(startTime)
        .build());

      return {
        success: true,
        message: this.t('messages.operation.eraseComplete'),
      };
    } catch (error) {
      if (signal?.aborted) {
        this.log(this.t('messages.operation.cancelled'), 'warn');
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
   * @param sectorInfo - 扇区信息数组
   * @param signal - 取消信号，用于中止操作
   * @returns - 操作结果
   */
  override async eraseSectors(
    sectorInfo: { startAddress: number; endAddress: number; sectorSize: number; sectorCount: number }[],
    signal?: AbortSignal,
  ): Promise<CommandResult> {
    this.log('模拟擦除扇区', 'info');

    // 计算总字节数
    const totalBytes = sectorInfo.reduce((sum, info) => sum + (info.endAddress - info.startAddress), 0);
    const totalSectors = sectorInfo.reduce((sum, info) => sum + info.sectorCount, 0);

    // 使用速度计算器模拟
    const speedCalculator = new SpeedCalculator();

    // 初始化扇区进度信息
    const sectorInfoWithTotalSize = sectorInfo.map(info => ({
      ...info,
      totalSize: info.endAddress - info.startAddress,
    }));
    const sectors = this.initializeSectorProgress(sectorInfoWithTotalSize);

    // 创建进度报告器
    const progressReporter = new ProgressReporter(
      'erase',
      totalBytes,
      (progressInfo) => { this.updateProgress(progressInfo); },
      (key, params) => this.t(key, params),
    );
    progressReporter.setSectors(this.currentSectorProgress);

    try {
      // 报告开始状态
      progressReporter.reportStart(this.t('messages.operation.startEraseSectors'));

      let eraseCount = 0;

      // 模拟逐个扇区擦除进度
      for (const [i, sector] of sectors.entries()) {
        // 检查是否已被取消
        if (signal?.aborted) {
          progressReporter.reportError(this.t('messages.operation.cancelled'));
          return {
            success: false,
            message: this.t('messages.operation.cancelled'),
          };
        }

        // 更新当前扇区状态为"正在处理"
        const sectorIndex = progressReporter.updateSectorProgress(sector.address, 'processing');

        // 模拟扇区擦除延迟
        await DebugSettings.delay(100 + Math.random() * 200); // 100-300ms 每个扇区

        // 模拟速度
        const currentSpeed = 5000 + Math.random() * 3000; // 5-8 KB/s
        speedCalculator.addDataPoint(sector.size, Date.now());

        // 更新当前扇区状态为"已完成"
        progressReporter.updateSectorProgress(sector.address, 'completed');
        eraseCount++;

        const erasedBytes = (eraseCount * totalBytes) / sectors.length;

        // 报告进度
        progressReporter.reportProgress(
          erasedBytes,
          currentSpeed,
          this.t('messages.progress.eraseSpeed', { speed: formatSpeed(currentSpeed) }),
          eraseCount,
          sectorIndex,
        );
      }

      if (DebugSettings.shouldSimulateError()) {
        progressReporter.reportError(this.t('messages.operation.eraseSectorFailed'));
        this.log(`${this.t('messages.operation.eraseSectorFailed')}: 模拟错误`, 'error');
        return {
          success: false,
          message: this.t('messages.operation.eraseSectorFailed'),
        };
      }

      const avgSpeed = speedCalculator.getAverageSpeed();
      const maxSpeed = speedCalculator.getMaxSpeed();
      const totalTime = speedCalculator.getTotalTime();

      this.log(this.t('messages.operation.eraseSuccess'), 'success');
      this.log(this.t('messages.operation.eraseSummary', {
        totalTime: formatTimeDuration(totalTime),
        avgSpeed: formatSpeed(avgSpeed),
        maxSpeed: formatSpeed(maxSpeed),
        totalSectors: totalSectors,
      }), 'info');

      // 报告完成状态
      progressReporter.reportCompleted(this.t('messages.operation.eraseSuccess'), avgSpeed);

      return {
        success: true,
        message: this.t('messages.operation.eraseSuccess'),
      };
    } catch (e) {
      if (signal?.aborted) {
        this.log(this.t('messages.operation.cancelled'), 'warn');
        return {
          success: false,
          message: this.t('messages.operation.cancelled'),
        };
      }
      progressReporter.reportError(this.t('messages.operation.eraseSectorFailed'));
      this.log(`${this.t('messages.operation.eraseSectorFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
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
    this.log(this.t('messages.rom.writing', { size: fileData.length }), 'info');

    const total = fileData.length;
    const speedCalculator = new SpeedCalculator();

    try {
      // 模拟检查空白区域和擦除
      if (!this.mockRomData || this.mockRomData.length === 0) {
        this.log(this.t('messages.rom.checkingIfBlank'), 'info');
        await timeout(100);

        // 模拟擦除
        this.log(this.t('messages.operation.eraseChip'), 'info');
        const eraseResult = await this.eraseChip(signal);
        if (!eraseResult.success) {
          return eraseResult;
        }
      }

      // 模拟扇区进度 (基于文件大小创建虚拟扇区)
      const sectorSize = 0x10000; // 64KB 扇区
      const sectorCount = Math.ceil(total / sectorSize);
      const mockSectorInfo = [{
        startAddress: 0,
        endAddress: total - 1,
        sectorSize,
        sectorCount,
        totalSize: total,
      }];

      // 初始化扇区进度信息
      const sectors = this.initializeSectorProgress(mockSectorInfo);

      // 重置扇区状态为pending，准备开始写入阶段
      this.resetSectorsState();

      // 创建进度报告器
      const progressReporter = new ProgressReporter(
        'write',
        total,
        (progressInfo) => { this.updateProgress(progressInfo); },
        (key, params) => this.t(key, params),
      );
      progressReporter.setSectors(this.currentSectorProgress);

      // 重置 progressReporter 的扇区状态为pending（因为要开始写入阶段）
      progressReporter.resetSectorsState();

      // 报告开始状态
      progressReporter.reportStart(this.t('messages.operation.startWriteROM'));

      let writeCount = 0;

      // 模拟逐个扇区写入进度
      for (const [, sector] of sectors.entries()) {
        // 检查是否已被取消
        if (signal?.aborted) {
          progressReporter.reportError(this.t('messages.operation.cancelled'));
          return {
            success: false,
            message: this.t('messages.operation.cancelled'),
          };
        }

        // 更新当前扇区状态为"正在处理"
        const sectorIndex = progressReporter.updateSectorProgress(sector.address, 'processing');

        // 模拟扇区写入延迟
        await DebugSettings.delay(200 + Math.random() * 300); // 200-500ms 每个扇区

        // 模拟速度
        const currentSpeed = 15000 + Math.random() * 10000; // 15-25 KB/s
        speedCalculator.addDataPoint(sector.size, Date.now());

        // 更新当前扇区状态为"已完成"
        progressReporter.updateSectorProgress(sector.address, 'completed');
        writeCount++;

        const writtenBytes = (writeCount * total) / sectors.length;

        // 报告进度
        progressReporter.reportProgress(
          writtenBytes,
          currentSpeed,
          this.t('messages.progress.writeSpeed', { speed: formatSpeed(currentSpeed) }),
          writeCount,
          sectorIndex,
        );
      }

      if (DebugSettings.shouldSimulateError()) {
        progressReporter.reportError(this.t('messages.rom.writeFailed'));
        this.log(`${this.t('messages.rom.writeFailed')}: 模拟错误`, 'error');
        return {
          success: false,
          message: this.t('messages.rom.writeFailed'),
        };
      }

      // 保存模拟数据
      this.mockRomData = new Uint8Array(fileData);

      const totalTime = speedCalculator.getTotalTime();
      const avgSpeed = speedCalculator.getAverageSpeed();
      const maxSpeed = speedCalculator.getMaxSpeed();

      this.log(this.t('messages.rom.writeComplete'), 'success');
      this.log(this.t('messages.rom.writeSummary', {
        totalTime: formatTimeDuration(totalTime),
        avgSpeed: formatSpeed(avgSpeed),
        maxSpeed: formatSpeed(maxSpeed),
        totalSize: formatBytes(total),
      }), 'info');

      // 报告完成状态
      progressReporter.reportCompleted(this.t('messages.rom.writeComplete'), avgSpeed);

      return {
        success: true,
        message: this.t('messages.rom.writeSuccess'),
      };
    } catch (e) {
      this.log(`${this.t('messages.rom.writeFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
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
    this.log(this.t('messages.operation.queryingRomSize'), 'info');

    await DebugSettings.delay();

    if (DebugSettings.shouldSimulateError()) {
      this.log(this.t('messages.operation.cfiParseFailed'), 'error');
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
      cfiDetected: true,
      isSwapD0D1: false,
      isIntel: false,
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
      eraseSectorBlocks: [{
        sectorSize,
        sectorCount,
        totalSize: deviceSize,
        startAddress: 0,
        endAddress: deviceSize,
      }],
      info: `模拟CFI信息: 设备大小=${deviceSize}字节, 扇区大小=${sectorSize}字节, 扇区数量=${sectorCount}`,
      reverseSectorRegion: false,
    };

    this.log(this.t('messages.operation.cfiParseSuccess'), 'success');
    this.log(mockCfiInfo.info, 'info');

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
    this.log(this.t('messages.rom.reading'), 'info');

    const startTime = Date.now();

    // 使用速度计算器模拟
    const speedCalculator = new SpeedCalculator();

    try {
      // 模拟扇区进度 (基于读取大小创建虚拟扇区)
      const sectorSize = 0x10000; // 64KB 扇区
      const sectorCount = Math.ceil(size / sectorSize);
      const mockSectorInfo = [{
        startAddress: baseAddress,
        endAddress: baseAddress + size - 1,
        sectorSize,
        sectorCount,
        totalSize: size,
      }];

      // 初始化扇区进度信息
      const sectors = this.initializeSectorProgress(mockSectorInfo);
      const sectorsCount = sectors.length;
      let readCount = 0;

      // 创建进度报告器
      const progressReporter = new ProgressReporter(
        'read',
        size,
        (progressInfo) => { this.updateProgress(progressInfo); },
        (key, params) => this.t(key, params),
      );
      progressReporter.setSectors(this.currentSectorProgress);

      // 报告开始状态
      progressReporter.reportStart(this.t('messages.rom.reading'));

      // 模拟逐个扇区读取进度
      for (let i = 0; i < sectorsCount; i++) {
        // 检查是否已被取消
        if (signal?.aborted) {
          progressReporter.reportError(this.t('messages.operation.cancelled'));
          return {
            success: false,
            message: this.t('messages.operation.cancelled'),
          };
        }

        const sector = sectors[i];

        // 更新当前扇区状态为"正在处理"
        const sectorIndex = progressReporter.updateSectorProgress(sector.address, 'processing');

        // 模拟扇区读取延迟
        await DebugSettings.delay(120 + Math.random() * 180); // 120-300ms 每个扇区

        // 模拟速度
        const currentSpeed = 20000 + Math.random() * 15000; // 20-35 KB/s
        speedCalculator.addDataPoint(sector.size, Date.now());

        // 更新当前扇区状态为"已完成"
        progressReporter.updateSectorProgress(sector.address, 'completed');
        readCount++;

        // 报告进度
        progressReporter.reportProgress(
          (readCount * size) / sectorsCount,
          currentSpeed,
          this.t('messages.progress.readSpeed', { speed: formatSpeed(currentSpeed) }),
          readCount,
          sectorIndex,
        );
      }

      if (signal?.aborted) {
        progressReporter.reportError(this.t('messages.operation.cancelled'));
        return {
          success: false,
          message: this.t('messages.operation.cancelled'),
        };
      }

      if (DebugSettings.shouldSimulateError()) {
        progressReporter.reportError(this.t('messages.rom.readFailed'));
        this.log(`${this.t('messages.rom.readFailed')}: 模拟错误`, 'error');
        return {
          success: false,
          message: this.t('messages.rom.readFailed'),
        };
      }

      // 返回之前写入的数据或生成随机数据
      const data = this.mockRomData?.slice(baseAddress, baseAddress + size) ?? DebugSettings.generateRandomData(size);

      const totalTime = speedCalculator.getTotalTime();
      const avgSpeed = speedCalculator.getAverageSpeed();
      const maxSpeed = speedCalculator.getMaxSpeed();

      this.log(this.t('messages.rom.readSuccess', { size: data.length }), 'success');
      this.log(this.t('messages.rom.readSummary', {
        totalTime: formatTimeDuration(totalTime),
        avgSpeed: formatSpeed(avgSpeed),
        maxSpeed: formatSpeed(maxSpeed),
        totalSize: formatBytes(size),
      }), 'info');

      progressReporter.reportCompleted(this.t('messages.rom.readSuccess', { size: data.length }), avgSpeed);

      return {
        success: true,
        data: data,
        message: this.t('messages.rom.readSuccess', { size: data.length }),
      };
    } catch (e) {
      this.updateProgress(this.createErrorProgressInfo('read', this.t('messages.rom.readFailed')));
      this.log(`${this.t('messages.rom.readFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
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
    this.log(this.t('messages.rom.verifying'), 'info');

    const startTime = Date.now();

    // 使用速度计算器模拟
    const speedCalculator = new SpeedCalculator();

    try {
      // 模拟扇区进度 (基于文件大小创建虚拟扇区)
      const sectorSize = 0x10000; // 64KB 扇区
      const sectorCount = Math.ceil(fileData.length / sectorSize);
      const mockSectorInfo = [{
        startAddress: baseAddress,
        endAddress: baseAddress + fileData.length - 1,
        sectorSize,
        sectorCount,
        totalSize: fileData.length,
      }];

      // 初始化扇区进度信息
      const sectors = this.initializeSectorProgress(mockSectorInfo);
      const sectorsCount = sectors.length;
      let verifyCount = 0;

      // 创建进度报告器
      const progressReporter = new ProgressReporter(
        'verify',
        fileData.length,
        (progressInfo) => { this.updateProgress(progressInfo); },
        (key, params) => this.t(key, params),
      );
      progressReporter.setSectors(this.currentSectorProgress);

      // 报告开始状态
      progressReporter.reportStart(this.t('messages.rom.verifying'));

      // 模拟逐个扇区校验进度
      for (let i = 0; i < sectorsCount; i++) {
        // 检查是否已被取消
        if (signal?.aborted) {
          progressReporter.reportError(this.t('messages.operation.cancelled'));
          return {
            success: false,
            message: this.t('messages.operation.cancelled'),
          };
        }

        const sector = sectors[i];

        // 更新当前扇区状态为"正在处理"
        const sectorIndex = progressReporter.updateSectorProgress(sector.address, 'processing');

        // 模拟扇区校验延迟
        await DebugSettings.delay(150 + Math.random() * 250); // 150-400ms 每个扇区

        // 模拟速度
        const currentSpeed = 18000 + Math.random() * 12000; // 18-30 KB/s
        speedCalculator.addDataPoint(sector.size, Date.now());

        // 更新进度显示当前正在校验的扇区
        progressReporter.reportProgress(
          verifyCount * (fileData.length / sectorsCount),
          currentSpeed,
          this.t('messages.progress.verifySpeed', { speed: formatSpeed(currentSpeed) }),
          verifyCount,
          sectorIndex,
        );

        // 更新当前扇区状态为"已完成"
        progressReporter.updateSectorProgress(sector.address, 'completed');
        verifyCount++;

        // 最终进度更新
        progressReporter.reportProgress(
          (verifyCount * fileData.length) / sectorsCount,
          currentSpeed,
          this.t('messages.progress.verifySpeed', { speed: formatSpeed(currentSpeed) }),
          verifyCount,
          sectorIndex,
        );
      }

      if (signal?.aborted) {
        progressReporter.reportError(this.t('messages.operation.cancelled'));
        return {
          success: false,
          message: this.t('messages.operation.cancelled'),
        };
      }

      if (DebugSettings.shouldSimulateError()) {
        this.log(`${this.t('messages.rom.verifyFailed')}: 模拟错误`, 'error');
        progressReporter.reportError(this.t('messages.rom.verifyFailed'));
        return {
          success: false,
          message: this.t('messages.rom.verifyFailed'),
        };
      }

      // 模拟校验结果
      const isMatch = this.mockRomData && this.compareData(fileData, this.mockRomData.slice(baseAddress, baseAddress + fileData.length));

      const totalTime = speedCalculator.getTotalTime();
      const avgSpeed = speedCalculator.getAverageSpeed();
      const maxSpeed = speedCalculator.getMaxSpeed();

      if (isMatch !== false) {
        this.log(this.t('messages.rom.verifySuccess'), 'success');
        this.log(this.t('messages.rom.verifySummary', {
          totalTime: totalTime.toFixed(2),
          avgSpeed: avgSpeed.toFixed(1),
          maxSpeed: maxSpeed.toFixed(1),
          totalSize: formatBytes(fileData.length),
        }), 'info');
        progressReporter.reportCompleted(this.t('messages.rom.verifySuccess'), avgSpeed);
      } else {
        this.log(this.t('messages.rom.verifyFailed'), 'error');
        progressReporter.reportError(this.t('messages.rom.verifyFailed'));
      }

      const message = isMatch !== false ? this.t('messages.rom.verifySuccess') : this.t('messages.rom.verifyFailed');
      return {
        success: isMatch !== false,
        message,
      };
    } catch (e) {
      this.updateProgress(this.createErrorProgressInfo('verify', this.t('messages.rom.verifyFailed')));
      this.log(`${this.t('messages.rom.verifyFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
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
    this.log(this.t('messages.ram.writing', { size: fileData.length }), 'info');

    const startTime = Date.now();
    const total = fileData.length;

    // 使用速度计算器模拟
    const speedCalculator = new SpeedCalculator();

    try {
      // 如果是FLASH类型，模拟擦除过程
      if (options.ramType === 'FLASH') {
        this.log(this.t('messages.gba.erasingFlash'), 'info');
        await DebugSettings.delay(1000);
        this.log(this.t('messages.gba.eraseComplete'), 'success');
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
        this.log(`${this.t('messages.ram.writeFailed')}: 模拟错误`, 'error');
        return {
          success: false,
          message: this.t('messages.ram.writeFailed'),
        };
      }

      this.mockRamData = new Uint8Array(fileData);

      const totalTime = speedCalculator.getTotalTime();
      const avgSpeed = speedCalculator.getAverageSpeed();
      const maxSpeed = speedCalculator.getMaxSpeed();

      this.log(this.t('messages.ram.writeComplete'), 'success');
      this.log(this.t('messages.ram.writeSummary', {
        totalTime: formatTimeDuration(totalTime),
        avgSpeed: formatSpeed(avgSpeed),
        maxSpeed: formatSpeed(maxSpeed),
        totalSize: formatBytes(total),
      }), 'info');

      return {
        success: true,
        message: this.t('messages.ram.writeSuccess'),
      };
    } catch (e) {
      this.log(`${this.t('messages.ram.writeFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
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
    this.log(this.t('messages.ram.reading'), 'info');

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
        this.log(`${this.t('messages.ram.readFailed')}: 模拟错误`, 'error');
        return {
          success: false,
          message: this.t('messages.ram.readFailed'),
        };
      }

      const data = this.mockRamData?.slice(0, size) ?? DebugSettings.generateRandomData(size);

      const totalTime = speedCalculator.getTotalTime();
      const avgSpeed = speedCalculator.getAverageSpeed();
      const maxSpeed = speedCalculator.getMaxSpeed();

      this.log(this.t('messages.ram.readSuccess', { size: data.length }), 'success');
      this.log(this.t('messages.ram.readSummary', {
        totalTime: totalTime.toFixed(2),
        avgSpeed: avgSpeed.toFixed(1),
        maxSpeed: maxSpeed.toFixed(1),
        totalSize: formatBytes(size),
      }), 'info');

      return {
        success: true,
        data: data,
        message: this.t('messages.ram.readSuccess', { size: data.length }),
      };
    } catch (e) {
      this.log(`${this.t('messages.ram.readFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
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
    this.log(this.t('messages.ram.verifying'), 'info');

    const startTime = Date.now();

    try {
      // 模拟进度
      await DebugSettings.simulateProgress(
        (progress) => { },
        1500,
      );

      if (DebugSettings.shouldSimulateError()) {
        this.log(`${this.t('messages.ram.verifyFailed')}: 模拟错误`, 'error');
        return {
          success: false,
          message: this.t('messages.ram.verifyFailed'),
        };
      }

      // 模拟校验结果
      const isMatch = this.mockRamData && this.compareData(fileData, this.mockRamData);
      const message = isMatch !== false ? this.t('messages.ram.verifySuccess') : this.t('messages.ram.verifyFailed');

      this.log(`${this.t('messages.ram.verify')}: ${message}`, isMatch !== false ? 'success' : 'error');
      return {
        success: isMatch !== false,
        message: message,
      };
    } catch (e) {
      this.log(`${this.t('messages.ram.verifyFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
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
    this.log(`模拟ROM Bank切换到 ${bank}`, 'info');
  }

  /**
   * 模拟切换SRAM的Bank
   * @param bank - Bank编号 (0或1)
   */
  async switchSRAMBank(bank: number): Promise<void> {
    bank = bank === 0 ? 0 : 1;
    await DebugSettings.delay(50);
    this.log(this.t('messages.gba.bankSwitchSram', { bank }) || `切换SRAM Bank到 ${bank}`, 'info');
  }

  /**
   * 模拟切换Flash的Bank
   * @param bank - Bank编号 (0或1)
   */
  async switchFlashBank(bank: number): Promise<void> {
    bank = bank === 0 ? 0 : 1;
    await DebugSettings.delay(50);
    this.log(this.t('messages.gba.bankSwitchFlash', { bank }), 'info');
  }

  /**
   * 模拟检查区域是否为空
   * @param address - 检查地址
   * @param size - 检查大小
   * @returns 是否为空白区域
   */
  async isBlank(address: number, size = 0x100): Promise<boolean> {
    this.log(this.t('messages.rom.checkingIfBlank'), 'info');
    await DebugSettings.delay(100);

    // 如果没有写入过数据，认为是空白的
    const blank = !this.mockRomData || this.mockRomData.length === 0;

    if (blank) {
      this.log(this.t('messages.rom.areaIsBlank'), 'info');
    } else {
      this.log(this.t('messages.rom.areaNotBlank'), 'info');
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
