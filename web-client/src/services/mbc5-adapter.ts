import {
  cart_power,
  FLASH_CMD_RESET,
  GBC_FLASH_CMD_SET,
  gbc_read,
  gbc_read_fram,
  gbc_rom_erase_chip,
  gbc_rom_erase_sector,
  gbc_rom_get_id,
  gbc_rom_program,
  gbc_write,
  gbc_write_fram,
  getFlashName,
  setSignals,
} from '@/protocol';
import { CartridgeAdapter, LogCallback, ProgressCallback, TranslateFunction } from '@/services/cartridge-adapter';
import { AdvancedSettings } from '@/settings/advanced-settings';
import { CommandOptions, MbcType } from '@/types/command-options';
import { CommandResult } from '@/types/command-result';
import { DeviceInfo } from '@/types/device-info';
import { firmwareUnsupportedResult, isRamTypeSupportedByFirmware } from '@/types/firmware-profile';
import type { SectorProgressInfo } from '@/types/progress-info';
import { timeout } from '@/utils/async-utils';
import { errorToBurnerLog } from '@/utils/burner-log';
import { formatBytes, formatHex, formatSpeed, formatTimeDuration } from '@/utils/formatter-utils';
import { PerformanceTracker } from '@/utils/monitoring/sentry-tracker';
import { CFIInfo, parseCFI, SectorBlock } from '@/utils/parsers/cfi-parser';
import { ProgressReporter } from '@/utils/progress/progress-reporter';
import { SpeedCalculator } from '@/utils/progress/speed-calculator';
import { calcSectorUsage } from '@/utils/sector-utils';

import type { PlatformOps } from './platform-ops';

/**
 * MBC5 Adapter - 灏佽MBC5鍗″甫鐨勫崗璁搷浣?
 */
export class MBC5Adapter extends CartridgeAdapter {
  private power5vActive = false;

  /**
   * 鏋勯€犲嚱鏁?
   * @param device - 璁惧瀵硅薄
   * @param logCallback - 鏃ュ織鍥炶皟鍑芥暟
   * @param progressCallback - 杩涘害鍥炶皟鍑芥暟
   * @param translateFunc - 鍥介檯鍖栫炕璇戝嚱鏁?
   */
  constructor(
    device: DeviceInfo,
    logCallback: LogCallback | null = null,
    progressCallback: ProgressCallback | null = null,
    translateFunc: TranslateFunction | null = null,
  ) {
    super(device, logCallback, progressCallback, translateFunc);
  }

  protected override createPlatformOps(): PlatformOps {
    return {
      platformId: 'mbc5',
      flashCmdSet: {
        ...GBC_FLASH_CMD_SET,
        read: (...args: Parameters<typeof gbc_read>) => gbc_read(...args),
        write: (...args: Parameters<typeof gbc_write>) => gbc_write(...args),
      },
      cfiEntryAddress: 0xaa,
      romProgram: (device, data, addr, buf) => gbc_rom_program(device, data, addr, buf),
      romEraseSector: (device, addr) => gbc_rom_erase_sector(device, addr),
      cfiGetId: (device) => gbc_rom_get_id(device),
      toRomBank: (address) => {
        const bank = Math.max(0, address >> 14);
        const cartAddress = this.getBaseAddressOfBank('MBC5', bank) + (address & 0x3fff);
        return { bank, cartAddress };
      },
      switchRomBank: async (_device, bank, options) => {
        const mbcType = (options as CommandOptions | undefined)?.mbcType ?? 'MBC5';
        await this.switchROMBank(bank, mbcType);
      },
      needsRomBankSwitch: () => true,
    };
  }

  protected override async withPowerConfig<T>(enable5V: boolean, fn: () => Promise<T>): Promise<T> {
    return this.withOptional5v(enable5V, fn);
  }

  private getUnsupportedPowerControlResult(): CommandResult | null {
    return this.firmwareProfile.capabilities.cartPowerControl
      ? null
      : firmwareUnsupportedResult('MBC 5V power control', this.firmwareProfile);
  }

  private getUnsupportedRamTypeResult(ramType: CommandOptions['ramType'], operation: string): CommandResult | null {
    const resolvedRamType = ramType ?? 'SRAM';
    return isRamTypeSupportedByFirmware(this.firmwareProfile, 'mbc5', resolvedRamType)
      ? null
      : firmwareUnsupportedResult(operation, this.firmwareProfile);
  }

  private async pulseSignals(): Promise<void> {
    try {
      await setSignals(this.transport, { dataTerminalReady: true, requestToSend: true });
      await timeout(10);
      await setSignals(this.transport, { dataTerminalReady: false, requestToSend: false });
    } catch (e) {
      // 浠呰緭鍑鸿皟璇曚俊鎭紝涓嶄腑鏂祦绋?
      console.debug('Failed to toggle serial signals after cart_power:', e);
    } finally {
      await timeout(10);
    }
  }

  private async setCartPower(mode: 0 | 1 | 2): Promise<void> {
    await cart_power(this.transport, mode);
    await this.pulseSignals();
  }

  private async enableFiveVoltPower(): Promise<void> {
    this.log(this.t('messages.operation.enable5V'), 'info');
    await this.setCartPower(0); // power down
    await timeout(120);
    await this.setCartPower(2); // 5V
    await timeout(350);
    this.power5vActive = true;
  }

  private async restoreDefaultPower(): Promise<void> {
    if (!this.power5vActive) return;
    await this.setCartPower(1); // 3.3V
    this.log(this.t('messages.operation.disable5V'), 'info');
    this.power5vActive = false;
    await timeout(200);
  }

  private async withOptional5v<T>(enable: boolean, fn: () => Promise<T>): Promise<T> {
    if (!enable) {
      return fn();
    }

    await this.enableFiveVoltPower();
    try {
      return await fn();
    } finally {
      await this.restoreDefaultPower();
    }
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private buildRomSampleOffsets(logicalAddress: number, regionSize: number, sampleSize: number): number[] {
    if (regionSize <= 0 || sampleSize <= 0) {
      return [];
    }

    const maxOffset = Math.max(0, regionSize - sampleSize);
    const sampleSlots = maxOffset + 1;
    const sampleCount = Math.min(MBC5Adapter.ROM_WRITE_SAMPLE_COUNT, sampleSlots);
    const offsets = new Set<number>([0, maxOffset]);

    while (offsets.size < sampleCount) {
      offsets.add(Math.floor(Math.random() * sampleSlots));
    }

    return [...offsets].sort((a, b) => a - b);
  }

  private async sampleRomRegionBlank(
    logicalAddress: number,
    regionSize: number,
    mbcType: MbcType,
  ): Promise<boolean> {
    const sampleSize = Math.min(MBC5Adapter.ROM_WRITE_SAMPLE_BYTES, regionSize);
    const sampleOffsets = this.buildRomSampleOffsets(logicalAddress, regionSize, sampleSize);

    for (const offset of sampleOffsets) {
      const sampleAddress = logicalAddress + offset;
      const { bank, cartAddress } = this.romBankRelevantAddress(sampleAddress, mbcType);
      const bankWindowRemaining = 0x4000 - (sampleAddress & 0x3fff);
      const readSize = Math.min(sampleSize, regionSize - offset, bankWindowRemaining);
      const sample = await this.readROMChunkWithRetry(
        readSize,
        sampleAddress,
        cartAddress,
        offset + 1,
        bank,
        async () => { await this.switchROMBank(bank, mbcType); },
      );
      if (!sample.every(byte => byte === 0xff)) {
        return false;
      }
    }

    return true;
  }

  private async eraseRomSectorWithRetry(
    sector: SectorProgressInfo,
    mbcType: MbcType,
    reason: 'prepare' | 'recover',
    signal?: AbortSignal,
  ): Promise<void> {
    const retries = AdvancedSettings.romEraseRetryCount;
    const attempts = retries + 1;
    const retryDelayMs = AdvancedSettings.romEraseRetryDelayMs;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      if (signal?.aborted) {
        throw new Error(this.t('messages.operation.cancelled'));
      }

      try {
        const { bank, cartAddress } = this.romBankRelevantAddress(sector.address, mbcType);
        await this.switchROMBank(bank, mbcType);
        await gbc_rom_erase_sector(this.transport, cartAddress);
        return;
      } catch (error) {
        lastError = error;
        this.log(
          errorToBurnerLog(
            `ROM sector erase retry ${attempt}/${attempts} @ ${formatHex(sector.address, 4)} (${reason})`,
            error,
          ),
          'warn',
        );

        if (attempt < attempts) {
          await this.stabilizeCommandChannel(MBC5Adapter.ROM_ERASE_RETRY_RESET_MS);
          if (retryDelayMs > 0) {
            await timeout(retryDelayMs * attempt);
          }
        }
      }
    }

    throw new Error(
      `ROM sector erase retry exhausted at ${formatHex(sector.address, 4)} `
      + `(${reason}): ${this.describeError(lastError)}`,
    );
  }

  private async readRAMChunkWithRetry(
    chunkSize: number,
    logicalAddress: number,
    cartAddress: number,
    chunkIndex: number,
    bank: number,
    ramType: 'SRAM' | 'FLASH' | 'FRAM',
    framLatency: number,
    restoreState?: () => Promise<void>,
  ): Promise<Uint8Array> {
    let lastError: unknown;
    const retries = AdvancedSettings.ramReadRetryCount;
    const attempts = retries + 1;
    const retryDelayMs = AdvancedSettings.ramReadRetryDelayMs;
    const timeoutMs = AdvancedSettings.packageReceiveTimeout;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return ramType === 'FRAM'
          ? await gbc_read_fram(this.transport, chunkSize, cartAddress, framLatency)
          : await gbc_read(this.transport, chunkSize, cartAddress);
      } catch (error) {
        lastError = error;
        this.log(
          errorToBurnerLog(
            `RAM chunk read retry ${attempt}/${attempts} #${chunkIndex} @ ${formatHex(logicalAddress, 4)} `
            + `(cart ${formatHex(cartAddress, 4)}, bank ${bank}, ${chunkSize}B, timeout ${timeoutMs}ms, type ${ramType})`,
            error,
          ),
          'warn',
        );

        if (attempt < attempts) {
          await this.stabilizeCommandChannel(MBC5Adapter.RAM_READ_RETRY_RESET_MS);
          if (restoreState) {
            await restoreState();
          }
          this.log(
            `RAM chunk channel resynchronized before retry #${chunkIndex} @ ${formatHex(logicalAddress, 4)} `
            + `(cart ${formatHex(cartAddress, 4)}, bank ${bank}, type ${ramType})`,
            'info',
          );
          if (retryDelayMs > 0) {
            await timeout(retryDelayMs * attempt);
          }
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  /**
   * 鏍规嵁 MBC 绫诲瀷鍜?bank 鍙疯繑鍥炲熀纭€鍦板潃
   * @param mbcType - MBC 绫诲瀷
   * @param bank - Bank 鍙?
   * @returns 鍩虹鍦板潃锛?x0000 鎴?0x4000锛?
   */
  private getBaseAddressOfBank(mbcType: MbcType, bank: number): number {
    switch (mbcType) {
      case 'MBC3':
        // MBC3: bank 0 浣跨敤 0x0000, 鍏朵粬 bank 浣跨敤 0x4000
        return bank === 0 ? 0x0000 : 0x4000;
      case 'MBC5':
      case 'MBC1':
      case 'MBC2':
      default:
        // MBC5/MBC1/MBC2: 鎵€鏈?bank 閮戒娇鐢?0x4000
        return 0x4000;
    }
  }

  /**
   * 鏍规嵁 MBC 绫诲瀷鍒囨崲 ROM bank
   * @param mbcType - MBC 绫诲瀷
   * @param bank - Bank 鍙?
   */
  private async switchRomBank(mbcType: MbcType, bank: number): Promise<void> {
    if (bank < 0) return;

    switch (mbcType) {
      case 'MBC3': {
        // MBC3: 鍐欏叆 0x2000 鍦板潃锛?浣?bank 鍙?
        // bank 0 浼氳鏄犲皠涓?bank 1
        const bankValue = bank === 0 ? 1 : bank & 0xff;
        await gbc_write(this.transport, new Uint8Array([bankValue]), 0x2000);
        break;
      }
      case 'MBC5': {
        // MBC5: 鏀寔 9浣?bank 鍙?(0-511)
        // 浣?8浣嶅啓鍏?0x2000, 楂樹綅鍐欏叆 0x3000
        const b0 = bank & 0xff;
        const b1 = (bank >> 8) & 0xff;
        await gbc_write(this.transport, new Uint8Array([b1]), 0x3000);
        await gbc_write(this.transport, new Uint8Array([b0]), 0x2000);
        break;
      }
      case 'MBC1':
        // MBC1: 鏀寔鏈€澶?125 涓?ROM banks
        // 浣?5浣嶅啓鍏?0x2000 (0x01-0x1F)
        // 楂?2浣嶅啓鍏?0x4000 (0x00-0x03)
        // 闇€瑕佽缃?banking mode
        // TODO: 瀹炵幇 MBC1 瀹屾暣鏀寔
        throw new Error('MBC1 ROM bank switching not yet implemented');
      case 'MBC2':
        // MBC2: 鏀寔鏈€澶?16 涓?ROM banks
        // 浣?4浣嶅啓鍏?0x2100 (0x00-0x0F)
        // TODO: 瀹炵幇 MBC2 瀹屾暣鏀寔
        throw new Error('MBC2 ROM bank switching not yet implemented');
      default:
        throw new Error(`Unsupported MBC type: ${mbcType}`);
    }
  }

  /**
   * 鏍规嵁 MBC 绫诲瀷鍒囨崲 RAM bank
   * @param mbcType - MBC 绫诲瀷
   * @param bank - Bank 鍙?
   */
  private async switchRamBank(mbcType: MbcType, bank: number): Promise<void> {
    if (bank < 0) return;

    switch (mbcType) {
      case 'MBC3': {
        // MBC3: 鍐欏叆 0x4000 鍦板潃锛?浣?bank 鍙?(0-7)
        const bankValue = bank & 0x07;
        await gbc_write(this.transport, new Uint8Array([bankValue]), 0x4000);
        break;
      }
      case 'MBC5': {
        // MBC5: 鍐欏叆 0x4000 鍦板潃锛?浣?bank 鍙?(0-255)
        const bankValue = bank & 0xff;
        await gbc_write(this.transport, new Uint8Array([bankValue]), 0x4000);
        break;
      }
      case 'MBC1':
        // MBC1: RAM banking 涓?ROM banking 鍏变韩楂樹綅
        // 鍐欏叆 0x4000 (0x00-0x03)
        // 闇€瑕佽缃?banking mode 涓?simple (0)
        // TODO: 瀹炵幇 MBC1 瀹屾暣鏀寔
        throw new Error('MBC1 RAM bank switching not yet implemented');
      case 'MBC2':
        // MBC2: 娌℃湁 RAM banking锛堝唴缃?512x4bit RAM锛?
        // 涓嶉渶瑕?bank 鍒囨崲
        break;
      default:
        throw new Error(`Unsupported MBC type: ${mbcType}`);
    }
  }

  /**
   * 璁＄畻鑺墖鎿﹂櫎瓒呮椂鏃堕棿
   * 浠?CFI 淇℃伅璇诲彇鎿﹂櫎瓒呮椂鍙傛暟骞惰绠楅鏈熸摝闄ゆ椂闂?
   * @param cfiInfo - CFI 淇℃伅瀵硅薄
   * @returns 棰勬湡鎿﹂櫎鏃堕棿锛堟绉掞級锛屽鏋滄棤娉曡绠楀垯杩斿洖 0
   */
  private calculateEraseTimeout(cfiInfo: CFIInfo): number {
    try {
      let timeoutBlock = 0;
      let timeoutChip = 0;
      let totalSectors = 0;

      if (cfiInfo) {
        timeoutBlock = cfiInfo.sectorEraseTimeAvg ?? 0;
        timeoutChip = cfiInfo.chipEraseTimeAvg ?? 0;
        totalSectors = cfiInfo.eraseSectorBlocks.reduce((sum, block) => sum + block.sectorCount, 0);
      }

      // 濡傛灉鏈夎姱鐗囨摝闄よ秴鏃讹紝浣跨敤瀹冿紱鍚﹀垯浣跨敤鎵囧尯鎿﹂櫎瓒呮椂 脳 鎵囧尯鏁伴噺
      if (timeoutChip > 0) {
        this.log(`${this.t('messages.operation.eraseTimeout')}: ${(timeoutChip / 1000).toFixed(1)}s (chip)`, 'info');
        return timeoutChip;
      }

      if (timeoutBlock > 0 && totalSectors > 0) {
        const estimatedTime = timeoutBlock * totalSectors;
        this.log(`${this.t('messages.operation.eraseTimeout')}: ${(estimatedTime / 1000).toFixed(1)}s (block 脳 ${totalSectors})`, 'info');
        return estimatedTime;
      }

      return 0;
    } catch (e) {
      this.log(errorToBurnerLog(this.t('messages.operation.calculateEraseTimeoutFailed'), e), 'warn');
      return 0;
    }
  }

  /**
   * 鍏ㄧ墖鎿﹂櫎
   * @param options - 鍛戒护閫夐」锛屽寘鍚?CFI 淇℃伅銆丮BC 绫诲瀷鍜?5V 浣胯兘璁剧疆
   * @param signal - 鍙栨秷淇″彿锛岀敤浜庝腑姝㈡搷浣?
   * @returns - 鍖呭惈鎴愬姛鐘舵€佸拰娑堟伅鐨勫璞?
   */
  override async eraseChip(options: CommandOptions, signal?: AbortSignal) : Promise<CommandResult> {
    if (options.enable5V) {
      const unsupported = this.getUnsupportedPowerControlResult();
      if (unsupported) return unsupported;
    }

    return PerformanceTracker.trackAsyncOperation(
      'mbc5.eraseChip',
      async () => {
        this.log(this.t('messages.operation.eraseChip'), 'info');

        const mbcType = options.mbcType ?? 'MBC5';
        const enable5V = options.enable5V ?? false;

        try {
          return await this.withOptional5v(enable5V, async () => {
            // 妫€鏌ユ槸鍚﹀凡琚彇娑?
            if (signal?.aborted) {
              return {
                success: false,
                message: this.t('messages.operation.cancelled'),
              };
            }

            // 鑾峰彇鎿﹂櫎瓒呮椂鏃堕棿
            const eraseTimeoutMs = this.calculateEraseTimeout(options.cfiInfo);

            await gbc_rom_erase_chip(this.transport);

            const startTime = Date.now();
            let elapsedMilliseconds = 0;

            // 楠岃瘉鎿﹂櫎鏄惁瀹屾垚
            const eraseDeadline = startTime + Math.max(eraseTimeoutMs * 2, 120_000);
            while (Date.now() < eraseDeadline) {
              if (signal?.aborted) {
                this.log(this.t('messages.operation.cancelled'), 'warn');
                return {
                  success: false,
                  message: this.t('messages.operation.cancelled'),
                };
              }

              const eraseComplete = await this.isBlank(0x00, 0x100, mbcType);
              elapsedMilliseconds = Date.now() - startTime;

              if (eraseComplete) {
                this.log(`${this.t('messages.operation.eraseComplete')} (${(elapsedMilliseconds / 1000).toFixed(1)}s)`, 'success');
                break;
              } else {
                // 濡傛灉鏈夐鏈熸摝闄ゆ椂闂达紝鏄剧ず杩涘害鐧惧垎姣?
                if (eraseTimeoutMs > 0) {
                  const progress = Math.min(100, Math.floor((elapsedMilliseconds / eraseTimeoutMs) * 100));
                  this.log(`${this.t('messages.operation.eraseInProgress')} (${(elapsedMilliseconds / 1000).toFixed(1)}s, ${progress}%)`, 'info');
                } else {
                  this.log(`${this.t('messages.operation.eraseInProgress')} (${(elapsedMilliseconds / 1000).toFixed(1)}s)`, 'info');
                }
                await timeout(1000);
              }
            }
            if (Date.now() >= eraseDeadline) {
              throw new Error(`Chip erase timeout after ${(eraseDeadline - startTime) / 1000}s`);
            }

            return {
              success: true,
              message: this.t('messages.operation.eraseComplete'),
            };
          });
        } catch (e) {
          if (signal?.aborted) {
            this.log(this.t('messages.operation.cancelled'), 'warn');
            return {
              success: false,
              message: this.t('messages.operation.cancelled'),
            };
          }

          this.log(errorToBurnerLog(this.t('messages.operation.eraseFailed'), e), 'error');
          return {
            success: false,
            message: this.t('messages.operation.eraseFailed'),
          };
        }
      },
      {
        adapter_type: 'mbc5',
        operation_type: 'erase_chip',
      },
    );
  }

  /**
   * 鎿﹂櫎ROM鎵囧尯
   * @param sectorInfo - 鎵囧尯淇℃伅鏁扮粍
   * @param options - 鍛戒护閫夐」锛屽寘鍚?MBC 绫诲瀷鍜?5V 浣胯兘璁剧疆
   * @param signal - 鍙栨秷淇″彿锛岀敤浜庝腑姝㈡搷浣?
   * @returns - 鎿嶄綔缁撴灉
   */
  override async eraseSectors(
    sectorInfo: SectorBlock[],
    options: CommandOptions,
    signal?: AbortSignal,
    allowSampleSkip = false,
  ): Promise<CommandResult> {
    if (options.enable5V) {
      const unsupported = this.getUnsupportedPowerControlResult();
      if (unsupported) return unsupported;
    }

    return PerformanceTracker.trackAsyncOperation(
      'mbc5.eraseSectors',
      async () => {
        // 璁＄畻鎿﹂櫎鑼冨洿淇℃伅
        const minStartAddress = Math.min(...sectorInfo.map(info => info.startAddress));
        const maxEndAddress = Math.max(...sectorInfo.map(info => info.endAddress));
        const totalSectors = sectorInfo.reduce((sum, info) => sum + info.sectorCount, 0);
        const sectorSizes = [...new Set(sectorInfo.map(info => info.sectorSize))];
        const sectorSizeStr = sectorSizes.length === 1
          ? `${sectorSizes[0]}`
          : sectorSizes.join('/');

        this.log(this.t('messages.operation.startEraseSectors', {
          startAddress: formatHex(minStartAddress, 4),
          endAddress: formatHex(maxEndAddress - 1, 4),
          sectorSize: sectorSizeStr,
        }), 'info');

        const mbcType = options.mbcType ?? 'MBC5';
        const enable5V = options.enable5V ?? false;

        try {
          return await this.withOptional5v(enable5V, async () => {
            let currentBank = -1;
            let eraseCount = 0;

            // 浣跨敤閫熷害璁＄畻鍣?
            const speedCalculator = new SpeedCalculator();

            // 鍒涘缓鎵囧尯杩涘害淇℃伅
            const sectors = this.initializeSectorProgress(sectorInfo);

            // 璁＄畻鎬诲瓧鑺傛暟
            const totalBytes = sectorInfo.reduce((sum, info) => sum + (info.endAddress - info.startAddress), 0);

            // 鍒涘缓杩涘害鎶ュ憡鍣?
            const progressReporter = new ProgressReporter(
              'erase',
              totalBytes,
              (progressInfo) => { this.updateProgress(progressInfo); },
              (key, params) => this.t(key, params),
            );
            progressReporter.setSectors(this.currentSectorProgress);

            // 鎶ュ憡寮€濮嬬姸鎬?
            progressReporter.reportStart(this.t('messages.operation.startEraseSectors'));

            // 鎸夌収鍒涘缓鐨勬墖鍖洪『搴忚繘琛屾摝闄わ紙浠庨珮鍦板潃鍒颁綆鍦板潃锛?
            for (const sector of sectors) {
              // 妫€鏌ユ槸鍚﹀凡琚彇娑?
              if (signal?.aborted) {
                progressReporter.reportError(this.t('messages.operation.cancelled'));
                return {
                  success: false,
                  message: this.t('messages.operation.cancelled'),
                };
              }

              // 鏇存柊褰撳墠鎵囧尯鐘舵€佷负"姝ｅ湪澶勭悊"
              const currentSpeedBeforeErase = speedCalculator.getCurrentSpeed();
              progressReporter.markSectorState(sector.address, 'erasing');
              progressReporter.emitProgress(
                eraseCount * sector.size,
                currentSpeedBeforeErase,
                this.t('messages.progress.eraseSpeed', { speed: formatSpeed(currentSpeedBeforeErase) }),
                sector.address,
              );

              const { bank } = this.romBankRelevantAddress(sector.address, mbcType);
              if (bank !== currentBank) {
                currentBank = bank;
                await this.switchROMBank(bank, mbcType);
              }

              let skippedBySample = false;
              if (allowSampleSkip) {
                const sampleBlank = await this.sampleRomRegionBlank(sector.address, sector.size, mbcType);
                skippedBySample = sampleBlank;
              }

              if (skippedBySample) {
                this.log({
                  message: this.t('messages.operation.eraseSector', {
                    from: formatHex(sector.address, 4),
                    to: formatHex(sector.address + sector.size - 1, 4),
                  }),
                  details: this.t('messages.operation.eraseSectorSkipped', {
                    samples: `${MBC5Adapter.ROM_WRITE_SAMPLE_COUNT}x${MBC5Adapter.ROM_WRITE_SAMPLE_BYTES}B`,
                  }),
                }, 'info');
              } else {
                this.log(this.t('messages.operation.eraseSector', {
                  from: formatHex(sector.address, 4),
                  to: formatHex(sector.address + sector.size - 1, 4),
                }), 'info');
                await this.eraseRomSectorWithRetry(sector, mbcType, 'prepare', signal);
              }
              const sectorEndTime = Date.now();

              // 鏇存柊褰撳墠鎵囧尯鐘舵€佷负"宸插畬鎴?鎴?宸茶烦杩囨摝闄?
              progressReporter.markSectorState(sector.address, skippedBySample ? 'skipped_erase' : 'erased');

              eraseCount++;
              const erasedBytes = eraseCount * sector.size;

              // 娣诲姞鏁版嵁鐐瑰埌閫熷害璁＄畻鍣?
              speedCalculator.addDataPoint(sector.size, sectorEndTime);

              // 璁＄畻褰撳墠閫熷害
              const currentSpeed = speedCalculator.getCurrentSpeed();

              // 鎶ュ憡杩涘害
              progressReporter.emitProgress(
                erasedBytes,
                currentSpeed,
                this.t('messages.progress.eraseSpeed', { speed: formatSpeed(currentSpeed) }),
                sector.address,
              );
            }

            const totalTime = speedCalculator.getTotalTime();
            const avgSpeed = speedCalculator.getAverageSpeed();
            const maxSpeed = speedCalculator.getMaxSpeed();

            this.log(this.t('messages.operation.eraseSuccess'), 'success');
            this.log(this.t('messages.operation.eraseSummary', {
              totalTime: formatTimeDuration(totalTime),
              avgSpeed: formatSpeed(avgSpeed),
              maxSpeed: formatSpeed(maxSpeed),
              totalSectors: totalSectors,
            }), 'info');

            // 鎶ュ憡瀹屾垚鐘舵€?
            progressReporter.reportCompleted(this.t('messages.operation.eraseSuccess'), avgSpeed);

            return {
              success: true,
              message: this.t('messages.operation.eraseSuccess'),
            };
          });
        } catch (e) {
          if (signal?.aborted) {
            this.log(this.t('messages.operation.cancelled'), 'warn');
            return {
              success: false,
              message: this.t('messages.operation.cancelled'),
            };
          }

          // Reset sector progress so stale UI state doesn't persist into the next operation.
          this.resetSectorsState();

          const progressReporter = new ProgressReporter(
            'erase',
            sectorInfo.reduce((sum, info) => sum + (info.endAddress - info.startAddress), 0),
            (progressInfo) => { this.updateProgress(progressInfo); },
            (key, params) => this.t(key, params),
          );
          const errorLog = errorToBurnerLog(this.t('messages.operation.eraseSectorFailed'), e);
          const errorMessage = this.summarizeLogMessage(errorLog);
          progressReporter.reportError(errorMessage);
          this.log(errorLog, 'error');
          return {
            success: false,
            message: errorMessage,
          };
        }
      },
      {
        adapter_type: 'mbc5',
        operation_type: 'erase_sectors',
      },
    );
  }

  /**
   * 鍐欏叆ROM
   * @param fileData - 鏂囦欢鏁版嵁
   * @param options - 鍐欏叆閫夐」
   * @param signal - 鍙栨秷淇″彿锛岀敤浜庝腑姝㈡搷浣?
   * @returns - 鎿嶄綔缁撴灉
   */
  override async writeROM(fileData: Uint8Array, options: CommandOptions, signal?: AbortSignal) : Promise<CommandResult> {
    if (options.enable5V) {
      const unsupported = this.getUnsupportedPowerControlResult();
      if (unsupported) return unsupported;
    }

    const mbcType = options.mbcType ?? 'MBC5';
    const enable5V = options.enable5V ?? false;
    const baseAddress = options.baseAddress ?? 0x00;
    const pageSize = this.resolveRomPageSize(options.romPageSize);
    const bufferSize = options.cfiInfo.bufferSize ?? 0;

    this.log(this.t('messages.operation.startWriteROM', {
      fileSize: fileData.byteLength,
      baseAddress: formatHex(baseAddress, 4),
      pageSize,
      bufferSize,
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'mbc5.writeROM',
      async () => {
        try {
          return await this.withOptional5v(enable5V, async () => {
            const total = options.size ?? fileData.byteLength;
            const wallClockStartTime = Date.now();
            let written = 0;
            this.log(this.t('messages.rom.writing', { size: total }), 'info');

            const sectorInfo = calcSectorUsage(options.cfiInfo.eraseSectorBlocks, total, baseAddress);
            const eraseStartTime = Date.now();
            const eraseResult = await this.eraseSectors(sectorInfo, options, signal, true);
            const eraseDuration = Date.now() - eraseStartTime;
            if (!eraseResult.success) {
              return eraseResult;
            }

            this.currentSectorProgress = this.currentSectorProgress.map((sector) => ({
              ...sector,
              state: 'pending' as const,
            }));
            const sectors = this.currentSectorProgress;
            const speedCalculator = new SpeedCalculator();
            const progressReporter = new ProgressReporter(
              'write',
              total,
              (progressInfo) => { this.updateProgress(progressInfo); },
              (key, params) => this.t(key, params),
            );
            progressReporter.setSectors(this.currentSectorProgress);
            progressReporter.reportStart(this.t('messages.rom.writing', { size: total }));

            let lastLoggedProgress = -1;
            let chunkCount = 0;
            let currentBank = -1;
            const sectorWriteRetryCounts = new Map<number, number>();
            const writeEndAddressExclusive = baseAddress + total;

            const recoverSectorWrite = async (sectorIndex: number, reason: unknown): Promise<void> => {
              const sector = sectors[sectorIndex];
              const retriesUsed = sectorWriteRetryCounts.get(sector.address) ?? 0;
              const maxRetries = AdvancedSettings.romWriteRetryCount;
              const retryLog = errorToBurnerLog(
                `ROM write retry ${retriesUsed + 1}/${maxRetries + 1} @ ${formatHex(sector.address, 4)}`,
                reason,
              );
              const writeFailureMessage = this.summarizeLogMessage(
                errorToBurnerLog(this.t('messages.rom.writeFailed'), reason),
              );

              if (retriesUsed >= maxRetries) {
                throw new Error(`ROM write retries exhausted @ ${formatHex(sector.address, 4)}: ${this.describeError(reason)}`);
              }

              const nextRetry = retriesUsed + 1;
              sectorWriteRetryCounts.set(sector.address, nextRetry);
              this.log(retryLog, 'warn');

              progressReporter.emitProgress(
                written,
                speedCalculator.getCurrentSpeed(),
                writeFailureMessage,
                sector.address,
              );

              await this.stabilizeCommandChannel(MBC5Adapter.ROM_WRITE_RETRY_RESET_MS);
              // 上次失败的编程命令可能被中途打断，flash 芯片会停留在命令序列中间；
              // 先发 reset(0xF0) 让其回到读取阵列状态，再执行擦除重写。
              try {
                await gbc_write(this.transport, new Uint8Array([FLASH_CMD_RESET]), 0x00);
              } catch (resetError) {
                this.log(errorToBurnerLog(`Flash reset before retry failed @ ${formatHex(sector.address, 4)}`, resetError), 'warn');
              }
              if (AdvancedSettings.romWriteRetryDelayMs > 0) {
                await timeout(AdvancedSettings.romWriteRetryDelayMs * nextRetry);
              }
              progressReporter.markSectorState(sector.address, 'erasing');
              progressReporter.emitProgress(
                written,
                speedCalculator.getCurrentSpeed(),
                this.t('messages.operation.eraseSector', {
                  from: formatHex(sector.address, 4),
                  to: formatHex(sector.address + sector.size - 1, 4),
                }),
                sector.address,
              );
              await this.eraseRomSectorWithRetry(sector, mbcType, 'recover', signal);
              progressReporter.markSectorState(sector.address, 'pending');
              written = sector.address - baseAddress;
              chunkCount = 0;
              currentBank = -1;
            };

            while (written < total) {
              if (signal?.aborted) {
                progressReporter.reportError(this.t('messages.operation.cancelled'));
                return {
                  success: false,
                  message: this.t('messages.operation.cancelled'),
                };
              }

              const currentAddress = baseAddress + written;
              const currentSectorIndex = progressReporter.getCurrentSectorIndexByAddress(currentAddress);
              if (currentSectorIndex < 0) {
                throw new Error(`No sector metadata for write address ${formatHex(currentAddress, 4)}`);
              }
              const currentSector = sectors[currentSectorIndex];
              const sectorWriteEnd = Math.min(writeEndAddressExclusive, currentSector.address + currentSector.size);

              const bankWindowRemaining = 0x4000 - (currentAddress & 0x3fff);
              const chunkSize = Math.min(
                pageSize,
                total - written,
                sectorWriteEnd - currentAddress,
                bankWindowRemaining,
              );
              const chunk = fileData.subarray(written, written + chunkSize);
              if (chunk.byteLength === 0) {
                this.log(this.t('messages.rom.writeNoData'), 'warn');
                break;
              }

              const currentSpeedBeforeWrite = speedCalculator.getCurrentSpeed();
              progressReporter.markSectorState(currentSector.address, 'processing');
              progressReporter.emitProgress(
                written,
                currentSpeedBeforeWrite,
                this.t('messages.progress.writeSpeed', { speed: formatSpeed(currentSpeedBeforeWrite) }),
                currentAddress,
              );

              const { bank, cartAddress } = this.romBankRelevantAddress(currentAddress, mbcType);
              if (bank !== currentBank) {
                currentBank = bank;
                await this.switchROMBank(bank, mbcType);
              }

              try {
                await gbc_rom_program(this.transport, chunk, cartAddress, bufferSize);
              } catch (error) {
                await recoverSectorWrite(currentSectorIndex, error);
                continue;
              }
              const chunkEndTime = Date.now();

              written += chunkSize;
              chunkCount++;

              if (written + baseAddress >= sectorWriteEnd) {
                progressReporter.markSectorState(currentSector.address, 'completed');
              }

              speedCalculator.addDataPoint(chunkSize, chunkEndTime);

              if (chunkCount % 10 === 0 || written >= total || written + baseAddress >= sectorWriteEnd) {
                const currentSpeed = speedCalculator.getCurrentSpeed();
                progressReporter.emitProgress(
                  written,
                  currentSpeed,
                  this.t('messages.progress.writeSpeed', { speed: formatSpeed(currentSpeed) }),
                  currentAddress,
                );
              }

              const progress = Math.floor((written / total) * 100);
              if (progress % 5 === 0 && progress !== lastLoggedProgress) {
                this.log(this.t('messages.rom.writingAt', { address: formatHex(currentAddress, 4), progress }), 'info');
                lastLoggedProgress = progress;
              }
            }

            const transferTime = speedCalculator.getTotalTime();
            const totalTime = (Date.now() - wallClockStartTime) / 1000;
            const eraseTime = eraseDuration / 1000;
            const avgSpeed = speedCalculator.getAverageSpeed();
            const maxSpeed = speedCalculator.getMaxSpeed();

            this.log(this.t('messages.rom.writeComplete'), 'success');
            this.log(this.t('messages.rom.writeSummary', {
              totalTime: formatTimeDuration(totalTime),
              transferTime: formatTimeDuration(transferTime),
              eraseTime: formatTimeDuration(eraseTime),
              avgSpeed: formatSpeed(avgSpeed),
              maxSpeed: formatSpeed(maxSpeed),
              totalSize: formatBytes(total),
            }), 'info');

            // 鎶ュ憡瀹屾垚鐘舵€?
            progressReporter.reportCompleted(this.t('messages.rom.writeComplete'), avgSpeed);

            return {
              success: true,
              message: this.t('messages.rom.writeSuccess'),
            };
          });
        } catch (e) {
          const progressReporter = new ProgressReporter(
            'write',
            fileData.byteLength,
            (progressInfo) => { this.updateProgress(progressInfo); },
            (key, params) => this.t(key, params),
          );
          const errorLog = errorToBurnerLog(this.t('messages.rom.writeFailed'), e);
          const errorMessage = this.summarizeLogMessage(errorLog);
          progressReporter.reportError(errorMessage);
          this.log(errorLog, 'error');
          return {
            success: false,
            message: errorMessage,
          };
        }
      },
      {
        adapter_type: 'mbc5',
        operation_type: 'write_rom',
      },
      {
        fileSize: fileData.byteLength,
        baseAddress,
        bufferSize,
        pageSize,
      },
    );
  }

  /**
   * 璇诲彇ROM
   * @param size - 璇诲彇澶у皬
   * @param baseAddress - 鍩虹鍦板潃
   * @param signal - 鍙栨秷淇″彿锛岀敤浜庝腑姝㈡搷浣?
   * @param showProgress - 鏄惁鏄剧ず璇诲彇杩涘害闈㈡澘锛岄粯璁や负true
   * @returns - 鎿嶄綔缁撴灉锛屽寘鍚鍙栫殑鏁版嵁
   */
  override async readROM(size: number, options: CommandOptions, signal?: AbortSignal, showProgress = true) : Promise<CommandResult> {
    if (options.enable5V) {
      const unsupported = this.getUnsupportedPowerControlResult();
      if (unsupported) return unsupported;
    }

    const mbcType = options.mbcType ?? 'MBC5';
    const enable5V = options.enable5V ?? false;
    const baseAddress = options.baseAddress ?? 0x00;
    const pageSize = this.resolveRomPageSize(options.romPageSize);
    const retries = AdvancedSettings.romReadRetryCount;
    const retryDelayMs = AdvancedSettings.romReadRetryDelayMs;
    const timeoutMs = AdvancedSettings.packageReceiveTimeout;

    this.log(this.t('messages.operation.startReadROM', {
      size,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'mbc5.readROM',
      async () => {
        try {
          // 妫€鏌ユ槸鍚﹀凡琚彇娑?
          if (signal?.aborted) {
            const progressReporter = new ProgressReporter(
              'read',
              size,
              (progressInfo) => { this.updateProgress(progressInfo); },
              (key, params) => this.t(key, params),
              showProgress,
            );
            progressReporter.reportError(this.t('messages.operation.cancelled'));
            return {
              success: false,
              message: this.t('messages.operation.cancelled'),
            };
          }

          return await this.withOptional5v(enable5V, async () => {
            await this.stabilizeCommandChannel(MBC5Adapter.ROM_READ_START_SETTLE_MS);
            this.log(this.t('messages.rom.reading'), 'info');
            let totalRead = 0;

            const data = new Uint8Array(size);

            // 浣跨敤閫熷害璁＄畻鍣?
            const speedCalculator = new SpeedCalculator();

            // 鍒涘缓杩涘害鎶ュ憡鍣?
            const progressReporter = new ProgressReporter(
              'read',
              size,
              (progressInfo) => { this.updateProgress(progressInfo); },
              (key, params) => this.t(key, params),
              showProgress,
            );

            // 鎶ュ憡寮€濮嬬姸鎬?
            progressReporter.reportStart(this.t('messages.rom.reading'));

            // 鍒嗗潡璇诲彇浠ヤ究璁＄畻閫熷害缁熻
            let lastLoggedProgress = -1; // 鍒濆鍖栦负-1锛岀‘淇濈涓€娆?%浼氳璁板綍
            let chunkCount = 0; // 璁板綍宸插鐞嗙殑鍧楁暟
            let currentBank = -1;

            while (totalRead < size) {
              // 妫€鏌ユ槸鍚﹀凡琚彇娑?
              if (signal?.aborted) {
                progressReporter.reportError(this.t('messages.operation.cancelled'));
                return {
                  success: false,
                  message: this.t('messages.operation.cancelled'),
                };
              }

              const chunkSize = Math.min(pageSize, size - totalRead);
              const currentAddress = baseAddress + totalRead;

              // 璁＄畻bank鍜屽湴鍧€
              const { bank, cartAddress } = this.romBankRelevantAddress(currentAddress, mbcType);
              if (bank !== currentBank) {
                currentBank = bank;
                await this.switchROMBank(bank, mbcType);
              }

              // 璇诲彇鏁版嵁
              const chunk = await this.readROMChunkWithRetry(
                chunkSize,
                currentAddress,
                cartAddress,
                Math.floor(totalRead / pageSize) + 1,
                bank,
                async () => { await this.switchROMBank(bank, mbcType); },
              );
              const chunkEndTime = Date.now();
              data.set(chunk, totalRead);

              totalRead += chunkSize;
              chunkCount++;

              // 娣诲姞鏁版嵁鐐瑰埌閫熷害璁＄畻鍣?
              speedCalculator.addDataPoint(chunkSize, chunkEndTime);

              // 姣?0娆℃搷浣滄垨鏈€鍚庝竴娆℃洿鏂拌繘搴?
              if (chunkCount % 10 === 0 || totalRead >= size) {
                // 璁＄畻褰撳墠閫熷害
                const currentSpeed = speedCalculator.getCurrentSpeed();

                // 鎶ュ憡杩涘害
                progressReporter.reportProgress(
                  totalRead,
                  currentSpeed,
                  this.t('messages.progress.readSpeed', { speed: formatSpeed(currentSpeed) }),
                );
              }

              // 姣?涓櫨鍒嗘瘮璁板綍涓€娆℃棩蹇?
              const progress = Math.floor((totalRead / size) * 100);
              if (progress % 5 === 0 && progress !== lastLoggedProgress) {
                this.log(this.t('messages.rom.readingAt', { address: formatHex(currentAddress, 4), progress }), 'info');
                lastLoggedProgress = progress;
              }
            }

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

            // 鎶ュ憡瀹屾垚鐘舵€?
            progressReporter.reportCompleted(this.t('messages.rom.readSuccess', { size: data.length }), avgSpeed);

            return {
              success: true,
              data: data,
              message: this.t('messages.rom.readSuccess', { size: data.length }),
            };
          });
        } catch (e) {
          const progressReporter = new ProgressReporter(
            'read',
            size,
            (progressInfo) => { this.updateProgress(progressInfo); },
            (key, params) => this.t(key, params),
            showProgress,
          );
          progressReporter.reportError(this.t('messages.rom.readFailed'));
          this.log(errorToBurnerLog(this.t('messages.rom.readFailed'), e), 'error');
          return {
            success: false,
            message: this.t('messages.rom.readFailed'),
          };
        }
      },
      {
        adapter_type: 'mbc5',
        operation_type: 'read_rom',
      },
      {
        dataSize: size,
        baseAddress,
      },
    );
  }

  /**
   * 鏍￠獙ROM
   * @param fileData - 鏂囦欢鏁版嵁
   * @param baseAddress - 鍩虹鍦板潃
   * @returns - 鎿嶄綔缁撴灉
   */
  override async verifyROM(fileData: Uint8Array, options: CommandOptions, signal?: AbortSignal): Promise<CommandResult> {
    if (options.enable5V) {
      const unsupported = this.getUnsupportedPowerControlResult();
      if (unsupported) return unsupported;
    }

    const mbcType = options.mbcType ?? 'MBC5';
    const baseAddress = options.baseAddress ?? 0;
    const pageSize = this.resolveRomPageSize(options.romPageSize);

    this.log(this.t('messages.operation.startVerifyROM', {
      fileSize: fileData.byteLength,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'mbc5.verifyROM',
      async () => {
        // 妫€鏌ユ槸鍚﹀凡琚彇娑?
        if (signal?.aborted) {
          const progressReporter = new ProgressReporter(
            'verify',
            fileData.byteLength,
            (progressInfo) => { this.updateProgress(progressInfo); },
            (key, params) => this.t(key, params),
          );
          progressReporter.reportError(this.t('messages.operation.cancelled'));
          return {
            success: false,
            message: this.t('messages.operation.cancelled'),
          };
        }
        try {
          this.log(this.t('messages.rom.verifying'), 'info');

          const configuredSize = options.size ?? fileData.byteLength;
          const deviceSize = options.cfiInfo.deviceSize;
          const fileSize = fileData.byteLength;
          const total = Math.min(configuredSize, deviceSize, fileSize);
          if (configuredSize > deviceSize) {
            this.log(this.t('messages.rom.verifyClampedToDevice', {
              configured: formatBytes(configuredSize),
              device: formatBytes(deviceSize),
              actual: formatBytes(total),
            }), 'warn');
          }
          if (configuredSize > fileSize) {
            this.log(this.t('messages.rom.verifyClampedToFile', {
              configured: formatBytes(configuredSize),
              file: formatBytes(fileSize),
              actual: formatBytes(total),
            }), 'warn');
          }
          let verified = 0;
          let success = true;
          let failedAddress = -1;
          let lastLoggedProgress = -1; // 鍒濆鍖栦负-1锛岀‘淇濈涓€娆?%浼氳璁板綍
          let currentBank = -1;
          let activeSectorIndex = -1;
          let completedSectorIndex = -1;

          // 鍒濆鍖栨墖鍖鸿繘搴︿俊鎭?(鐢ㄤ簬鏄剧ず鏍￠獙杩涘害鍙鍖?
          const sectorInfo = calcSectorUsage(options.cfiInfo.eraseSectorBlocks, total, baseAddress);
          const sectors = this.initializeSectorProgress(sectorInfo);

          // 浣跨敤閫熷害璁＄畻鍣?
          const speedCalculator = new SpeedCalculator();

          // 鍒涘缓杩涘害鎶ュ憡鍣?
          const progressReporter = new ProgressReporter(
            'verify',
            total,
            (progressInfo) => { this.updateProgress(progressInfo); },
            (key, params) => this.t(key, params),
          );
          progressReporter.setSectors(sectors);

          // 鎶ュ憡寮€濮嬬姸鎬?
          progressReporter.reportStart(this.t('messages.rom.verifying'));

          // 鍒嗗潡鏍￠獙骞舵洿鏂拌繘搴?
          let chunkCount = 0; // 璁板綍宸插鐞嗙殑鍧楁暟
          while (verified < total && success) {
            // 妫€鏌ユ槸鍚﹀凡琚彇娑?
            if (signal?.aborted) {
              progressReporter.reportError(this.t('messages.operation.cancelled'));
              return {
                success: false,
                message: this.t('messages.operation.cancelled'),
              };
            }

            const chunkSize = Math.min(pageSize, total - verified);
            const currentAddress = baseAddress + verified;

            while (
              activeSectorIndex + 1 < sectors.length
              && currentAddress >= sectors[activeSectorIndex + 1].address
            ) {
              activeSectorIndex++;
            }

            const enteredNewSector = activeSectorIndex >= 0
              && progressReporter.markSectorState(sectors[activeSectorIndex].address, 'processing') >= 0
              && (verified === 0 || verified === sectors[activeSectorIndex].address - baseAddress);

            if (enteredNewSector) {
              const currentSpeedBeforeVerify = speedCalculator.getCurrentSpeed();
              progressReporter.emitProgress(
                verified,
                currentSpeedBeforeVerify,
                this.t('messages.progress.verifySpeed', { speed: formatSpeed(currentSpeedBeforeVerify) }),
                currentAddress,
              );
            }

            const { bank, cartAddress } = this.romBankRelevantAddress(currentAddress, mbcType);
            if (bank !== currentBank) {
              currentBank = bank;
              await this.switchROMBank(bank, mbcType);
            }

            // 璇诲彇鏁版嵁
            const actualChunk = await gbc_read(this.transport, chunkSize, cartAddress);
            const chunkEndTime = Date.now();

            // 閫愬瓧鑺傛瘮杈?
            for (let i = 0; i < chunkSize; i++) {
              const expectedByte = fileData[verified + i];
              const actualByte = actualChunk[i];
              if (expectedByte !== actualByte) {
                success = false;
                failedAddress = verified + i;
                this.log(this.t('messages.rom.verifyFailedAt', {
                  address: formatHex(failedAddress, 4),
                  expected: formatHex(expectedByte, 1),
                  actual: formatHex(actualByte, 1),
                }), 'error');
                if (activeSectorIndex >= 0) {
                  progressReporter.markSectorState(sectors[activeSectorIndex].address, 'error');
                }
                break;
              }
            }

            if (!success) break;

            verified += chunkSize;
            chunkCount++;

            const verifiedEndAddress = baseAddress + verified - 1;
            while (completedSectorIndex + 1 < sectors.length) {
              const nextSector = sectors[completedSectorIndex + 1];
              const nextSectorEnd = nextSector.address + nextSector.size - 1;
              if (nextSectorEnd > verifiedEndAddress) {
                break;
              }

              completedSectorIndex++;
              progressReporter.markSectorState(nextSector.address, 'completed');
            }

            // 娣诲姞鏁版嵁鐐瑰埌閫熷害璁＄畻鍣?
            speedCalculator.addDataPoint(chunkSize, chunkEndTime);

            // 姣?0娆℃搷浣滄垨鏈€鍚庝竴娆℃洿鏂拌繘搴?
            if (chunkCount % 10 === 0 || verified >= total) {
              // 璁＄畻褰撳墠閫熷害
              const currentSpeed = speedCalculator.getCurrentSpeed();

              // 鎶ュ憡杩涘害
              progressReporter.emitProgress(
                verified,
                currentSpeed,
                this.t('messages.progress.verifySpeed', { speed: formatSpeed(currentSpeed) }),
                currentAddress,
              );
            }

            // 姣?%璁板綍涓€娆℃棩蹇?
            const progress = Math.floor((verified / total) * 100);
            if (progress % 5 === 0 && progress !== lastLoggedProgress) {
              this.log(this.t('messages.rom.verifyingAt', {
                address: formatHex(currentAddress, 4),
                progress,
              }), 'info');
              lastLoggedProgress = progress;
            }
          }

          const totalTime = speedCalculator.getTotalTime();
          const avgSpeed = speedCalculator.getAverageSpeed();
          const maxSpeed = speedCalculator.getMaxSpeed();

          if (success) {
            while (completedSectorIndex + 1 < sectors.length) {
              completedSectorIndex++;
              progressReporter.markSectorState(sectors[completedSectorIndex].address, 'completed');
            }

            this.log(this.t('messages.rom.verifySuccess'), 'success');
            this.log(this.t('messages.rom.verifySummary', {
              totalTime: formatTimeDuration(totalTime),
              avgSpeed: formatSpeed(avgSpeed),
              maxSpeed: formatSpeed(maxSpeed),
              totalSize: formatBytes(total),
            }), 'info');

            // 鎶ュ憡瀹屾垚鐘舵€?
            progressReporter.reportCompleted(this.t('messages.rom.verifySuccess'), avgSpeed);
          } else {
            this.log(this.t('messages.rom.verifyFailed'), 'error');
            progressReporter.reportError(this.t('messages.rom.verifyFailed'));
          }

          const message = success ? this.t('messages.rom.verifySuccess') : this.t('messages.rom.verifyFailed');
          return {
            success: success,
            message: message,
          };
        } catch (e) {
          const progressReporter = new ProgressReporter(
            'verify',
            fileData.byteLength,
            (progressInfo) => { this.updateProgress(progressInfo); },
            (key, params) => this.t(key, params),
          );
          progressReporter.reportError(this.t('messages.rom.verifyFailed'));
          this.log(errorToBurnerLog(this.t('messages.rom.verifyFailed'), e), 'error');
          return {
            success: false,
            message: this.t('messages.rom.verifyFailed'),
          };
        }
      },
      {
        adapter_type: 'mbc5',
        operation_type: 'verify_rom',
      },
      {
        fileSize: fileData.byteLength,
        baseAddress: baseAddress,
      },
    );
  }

  /**
   * 鍐欏叆RAM
   * @param fileData - 鏂囦欢鏁版嵁
   * @param options - 鍐欏叆閫夐」
   * @returns - 鎿嶄綔缁撴灉
   */
  override async writeRAM(fileData: Uint8Array, options: CommandOptions) : Promise<CommandResult> {
    if (options.enable5V) {
      const unsupported = this.getUnsupportedPowerControlResult();
      if (unsupported) return unsupported;
    }
    const unsupportedRamType = this.getUnsupportedRamTypeResult(options.ramType, 'MBC RAM write');
    if (unsupportedRamType) return unsupportedRamType;

    const mbcType = options.mbcType ?? 'MBC5';
    const enable5V = options.enable5V ?? false;
    const baseAddress = options.baseAddress ?? 0x00;
    const ramType = options.ramType ?? 'SRAM';
    const pageSize = this.resolveRamPageSize(options.ramPageSize);

    this.log(this.t('messages.operation.startWriteRAM', {
      fileSize: fileData.byteLength,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'mbc5.writeRAM',
      async () => {
        try {
          return await this.withOptional5v(enable5V, async () => {
            this.log(this.t('messages.ram.writing', { size: fileData.byteLength }), 'info');

            const total = options.size ?? fileData.byteLength;
            let written = 0;

            // 寮€鍚疪AM璁块棶鏉冮檺
            await gbc_write(this.transport, new Uint8Array([0x0a]), 0x0000);

            // 寮€濮嬪啓鍏?
            let lastLoggedProgress = -1; // 鍒濆鍖栦负-1锛岀‘淇濈涓€娆?%浼氳璁板綍
            let chunkCount = 0; // 璁板綍宸插鐞嗙殑鍧楁暟
            let currentBank = -1;

            // 浣跨敤閫熷害璁＄畻鍣?
            const speedCalculator = new SpeedCalculator();

            while (written < total) {
              const ramAddress = baseAddress + written;
              // 鍒嗗寘
              const remainingSize = total - written;
              const chunkSize = Math.min(pageSize, remainingSize);
              const chunk = fileData.subarray(written, written + chunkSize);

              // 璁＄畻bank鍜屽湴鍧€
              const { bank, cartAddress } = this.ramBankRelevantAddress(ramAddress, mbcType);
              if (bank !== currentBank) {
                currentBank = bank;
                await this.switchRAMBank(bank, mbcType);
              }

              // 鍐欏叆鏁版嵁
              if (ramType === 'FRAM') {
                const latency = options.framLatency ?? 25;
                await gbc_write_fram(this.transport, chunk, cartAddress, latency);
              } else {
                await gbc_write(this.transport, chunk, cartAddress);
              }

              const chunkEndTime = Date.now();

              written += chunkSize;
              chunkCount++;

              // 娣诲姞鏁版嵁鐐瑰埌閫熷害璁＄畻鍣?
              speedCalculator.addDataPoint(chunkSize, chunkEndTime);

              const progress = Math.floor((written / total) * 100);

              // 姣?涓櫨鍒嗘瘮璁板綍涓€娆℃棩蹇?
              if (progress % 5 === 0 && progress !== lastLoggedProgress) {
                this.log(this.t('messages.ram.writingAt', { address: formatHex(ramAddress, 4), progress }), 'info');
                lastLoggedProgress = progress;
              }
            }

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
          });
        } catch (e) {
          this.log(errorToBurnerLog(this.t('messages.ram.writeFailed'), e), 'error');
          return {
            success: false,
            message: this.t('messages.ram.writeFailed'),
          };
        }
      },
      {
        adapter_type: 'mbc5',
        operation_type: 'write_ram',
        ram_type: ramType,
      },
      {
        fileSize: fileData.byteLength,
        base_address: baseAddress,
      },
    );
  }

  /**
   * 璇诲彇RAM
   * @param size - 璇诲彇澶у皬
   * @param options - 璇诲彇鍙傛暟
   * @returns - 鎿嶄綔缁撴灉锛屽寘鍚鍙栫殑鏁版嵁
   */
  override async readRAM(size: number, options: CommandOptions) : Promise<CommandResult> {
    if (options.enable5V) {
      const unsupported = this.getUnsupportedPowerControlResult();
      if (unsupported) return unsupported;
    }
    const unsupportedRamType = this.getUnsupportedRamTypeResult(options.ramType, 'MBC RAM read');
    if (unsupportedRamType) return unsupportedRamType;

    const mbcType = options.mbcType ?? 'MBC5';
    const enable5V = options.enable5V ?? false;
    const baseAddress = options.baseAddress ?? 0x00;
    const ramType = options.ramType ?? 'SRAM';
    const effectiveRamType = ramType === 'BATLESS' ? 'SRAM' : ramType;
    const pageSize = this.resolveRamPageSize(options.ramPageSize);
    const retries = AdvancedSettings.ramReadRetryCount;
    const retryDelayMs = AdvancedSettings.ramReadRetryDelayMs;
    const timeoutMs = AdvancedSettings.packageReceiveTimeout;
    const framLatency = options.framLatency ?? 25;

    this.log(this.t('messages.operation.startReadRAM', {
      size,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');
    this.log(
      `RAM read session config: page=${formatBytes(pageSize)}, retries=${retries}, `
      + `retryDelay=${retryDelayMs}ms, timeout=${timeoutMs}ms, type=${ramType}, mbc=${mbcType}, 5v=${enable5V}`,
      'info',
    );

    return PerformanceTracker.trackAsyncOperation(
      'mbc5.readRAM',
      async () => {
        try {
          return await this.withOptional5v(enable5V, async () => {
            await this.stabilizeCommandChannel(MBC5Adapter.RAM_READ_START_SETTLE_MS);
            this.log(this.t('messages.ram.reading'), 'info');

            // 寮€鍚疪AM璁块棶鏉冮檺
            await gbc_write(this.transport, new Uint8Array([0x0a]), 0x0000);

            const result = new Uint8Array(size);
            let currentBank = -1;
            let read = 0;

            // 浣跨敤閫熷害璁＄畻鍣?
            const speedCalculator = new SpeedCalculator();

            while (read < size) {
              const ramAddress = baseAddress + read;

              // 璁＄畻bank鍜屽湴鍧€
              const { bank, cartAddress } = this.ramBankRelevantAddress(ramAddress, mbcType);
              if (bank !== currentBank) {
                currentBank = bank;
                await this.switchRAMBank(bank, mbcType);
              }

              // 鍒嗗寘
              const remainingSize = size - read;
              const chunkSize = Math.min(pageSize, remainingSize);

              // 璇诲彇鏁版嵁
              const chunk = await this.readRAMChunkWithRetry(
                chunkSize,
                ramAddress,
                cartAddress,
                Math.floor(read / pageSize) + 1,
                bank,
                effectiveRamType,
                framLatency,
                async () => { await this.switchRAMBank(bank, mbcType); },
              );
              const chunkEndTime = Date.now();
              result.set(chunk, read);

              read += chunkSize;

              // 娣诲姞鏁版嵁鐐瑰埌閫熷害璁＄畻鍣?
              speedCalculator.addDataPoint(chunkSize, chunkEndTime);
            }

            const totalTime = speedCalculator.getTotalTime();
            const avgSpeed = speedCalculator.getAverageSpeed();
            const maxSpeed = speedCalculator.getMaxSpeed();

            this.log(this.t('messages.ram.readSuccess', { size: result.length }), 'success');
            this.log(this.t('messages.ram.readSummary', {
              totalTime: formatTimeDuration(totalTime),
              avgSpeed: formatSpeed(avgSpeed),
              maxSpeed: formatSpeed(maxSpeed),
              totalSize: formatBytes(size),
            }), 'info');

            return {
              success: true,
              data: result,
              message: this.t('messages.ram.readSuccess', { size: result.length }),
            };
          });
        } catch (e) {
          this.log(errorToBurnerLog(this.t('messages.ram.readFailed'), e), 'error');
          return {
            success: false,
            message: this.t('messages.ram.readFailed'),
          };
        }
      },
      {
        adapter_type: 'mbc5',
        operation_type: 'read_ram',
        ram_type: ramType ?? 'SRAM',
      },
      {
        dataSize: size,
        base_address: baseAddress,
      },
    );
  }

  /**
   * 鏍￠獙RAM
   * @param fileData - 鏂囦欢鏁版嵁
   * @param options - 閫夐」瀵硅薄
   * @returns - 鎿嶄綔缁撴灉
   */
  override async verifyRAM(fileData: Uint8Array, options: CommandOptions) : Promise<CommandResult> {
    if (options.enable5V) {
      const unsupported = this.getUnsupportedPowerControlResult();
      if (unsupported) return unsupported;
    }
    const unsupportedRamType = this.getUnsupportedRamTypeResult(options.ramType, 'MBC RAM verify');
    if (unsupportedRamType) return unsupportedRamType;

    const baseAddress = options.baseAddress ?? 0x00;
    const ramType = options.ramType ?? 'SRAM';
    const configuredSize = options.size ?? fileData.byteLength;
    const fileSize = fileData.byteLength;
    const size = Math.min(configuredSize, fileSize);

    this.log(this.t('messages.operation.startVerifyRAM', {
      fileSize: fileData.byteLength,
      baseAddress: formatHex(baseAddress, 4),
    }), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'mbc5.verifyRAM',
      async () => {
        try {
          if (configuredSize > fileSize) {
            this.log(this.t('messages.ram.verifyClampedToFile', {
              configured: formatBytes(configuredSize),
              file: formatBytes(fileSize),
              actual: formatBytes(size),
            }), 'warn');
          }
          this.log(this.t('messages.ram.verifying'), 'info');
          let success = true;

          const readResult = await this.readRAM(size, options);
          if (readResult.success && readResult.data) {
            const ramData = readResult.data;
            for (let i = 0; i < size; i++) {
              if (fileData[i] !== ramData[i]) {
                this.log(this.t('messages.ram.verifyFailedAt', {
                  address: formatHex(i, 4),
                  expected: formatHex(fileData[i], 1),
                  actual: formatHex(ramData[i], 1),
                }), 'error');
                success = false;
                break;
              }
            }
          }

          const message = success ? this.t('messages.ram.verifySuccess') : this.t('messages.ram.verifyFailed');
          this.log(`${this.t('messages.ram.verify')}: ${message}`, success ? 'success' : 'error');

          return {
            success: success,
            message,
          };
        } catch (e) {
          this.log(errorToBurnerLog(this.t('messages.ram.verifyFailed'), e), 'error');
          return {
            success: false,
            message: this.t('messages.ram.verifyFailed'),
          };
        }
      },
      {
        adapter_type: 'mbc5',
        operation_type: 'verify_ram',
        ram_type: ramType ?? 'SRAM',
      },
      {
        file_size: fileData.byteLength,
      },
    );
  }

  /**
   * 鑾峰彇鍗″甫淇℃伅
   * @param enable5V - 鏄惁鍚敤 5V 鐢垫簮锛堝彲閫夛紝榛樿 false锛?
   * @returns 鍗″甫瀹归噺鐩稿叧淇℃伅
   */
  override async getCartInfo(enable5V = false): Promise<CFIInfo | false> {
    if (enable5V && !this.firmwareProfile.capabilities.cartPowerControl) {
      this.log(firmwareUnsupportedResult('MBC 5V power control', this.firmwareProfile).message, 'error');
      return false;
    }

    this.log(this.t('messages.operation.startGetCartInfo'), 'info');

    return PerformanceTracker.trackAsyncOperation(
      'mbc5.getCartInfo',
      async () => {
        try {
          return await this.withOptional5v(enable5V, async () => {
            // CFI Query
            await gbc_write(this.transport, new Uint8Array([0x98]), 0xaa);
            const cfiData = await gbc_read(this.transport, 0x100, 0x00);
            // Reset
            await gbc_write(this.transport, new Uint8Array([0xf0]), 0x00);

            const cfiInfo = parseCFI(cfiData);

            if (!cfiInfo) {
              this.log(this.t('messages.operation.cfiParseFailed'), 'error');
              return false;
            }

            // 璇诲彇Flash ID骞舵坊鍔犲埌CFI淇℃伅涓?
            try {
              const flashId = await gbc_rom_get_id(this.transport);
              cfiInfo.flashId = flashId;
              const idStr = Array.from(flashId).map(x => x.toString(16).padStart(2, '0')).join(' ');
              const flashName = getFlashName([...flashId]);
              this.log(`Flash ID: ${idStr} (${flashName})`, 'info');
            } catch (e) {
              this.log(errorToBurnerLog(this.t('messages.operation.readIdFailed'), e), 'warn');
              // 鍗充娇Flash ID璇诲彇澶辫触锛屼篃缁х画杩斿洖CFI淇℃伅
            }

            // 璁板綍CFI瑙ｆ瀽缁撴灉
            this.log(this.t('messages.operation.cfiParseSuccess'), 'success');
            this.log(cfiInfo.info, 'info');

            return cfiInfo;
          });
        } catch (e) {
          this.log(errorToBurnerLog(this.t('messages.operation.romSizeQueryFailed'), e), 'error');
          return false;
        }
      },
      {
        adapter_type: 'mbc5',
        operation_type: 'get_cart_info',
      },
    );
  }

  /**
   * ROM Bank 鍒囨崲
   */
  async switchROMBank(bank: number, mbcType: MbcType = 'MBC5') : Promise<void> {
    await this.switchRomBank(mbcType, bank);
    this.log(this.t('messages.rom.bankSwitch', { bank }), 'info');
  }

  /**
   * RAM Bank 鍒囨崲
   */
  async switchRAMBank(bank: number, mbcType: MbcType = 'MBC5') : Promise<void> {
    await this.switchRamBank(mbcType, bank);
    this.log(this.t('messages.ram.bankSwitch', { bank }), 'info');
  }

  // 妫€鏌ュ尯鍩熸槸鍚︿负绌?
  async isBlank(address: number, size = 0x100, mbcType: MbcType = 'MBC5') : Promise<boolean> {
    this.log(this.t('messages.rom.checkingIfBlank'), 'info');

    const { bank, cartAddress } = this.romBankRelevantAddress(address, mbcType);
    await this.switchROMBank(bank, mbcType);

    const data = await gbc_read(this.transport, size, cartAddress);
    const blank = data.every(byte => byte === 0xff);

    if (blank) {
      this.log(this.t('messages.rom.areaIsBlank'), 'success');
    } else {
      this.log(this.t('messages.rom.areaNotBlank'), 'info');
    }

    return blank;
  }

  romBankRelevantAddress(address: number, mbcType: MbcType = 'MBC5') {
    const bank = address >> 14;
    const b = bank < 0 ? 0 : bank;

    const cartAddress = this.getBaseAddressOfBank(mbcType, b) + (address & 0x3fff);

    return {
      bank: b,
      cartAddress,
    };
  }

  ramBankRelevantAddress(address: number, mbcType: MbcType = 'MBC5') {
    const bank = address >> 13;
    const b = bank < 0 ? 0 : bank;

    const cartAddress = 0xa000 + (address & 0x1fff);

    return {
      bank: b,
      cartAddress,
    };
  }
}

// 榛樿瀵煎嚭
export default MBC5Adapter;
