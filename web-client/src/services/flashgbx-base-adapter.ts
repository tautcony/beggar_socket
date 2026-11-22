/**
 * Shared base adapter for FlashGBX GBA and DMG/MBC adapters.
 * Derived from FlashGBX (GPL-3.0) LK_Device.py.
 */
import { getFirmwareProfile } from '@/device/compat/firmware-profile';
import type { Transport } from '@/platform/serial';
import {
  FLASHGBX_CRC32_CHUNK_SIZE,
  type FlashgbxCartMode,
  FlashgbxCommandClient,
  type FlashgbxFirmwareInfo,
  FlashgbxProtocolError,
  type FlashgbxVoltage,
  FW_VER_THRESHOLDS,
  throwIfAborted,
} from '@/protocol';
import { AdvancedSettings } from '@/settings/advanced-settings';
import { CommandOptions } from '@/types/command-options';
import { CommandResult } from '@/types/command-result';
import { DeviceInfo } from '@/types/device-info';
import type { FlashcartMode, FlashcartProfile, FlashcartValidationResult } from '@/types/flashcart-profile';
import { ProgressInfo, type SectorSizeClass } from '@/types/progress-info';
import { errorToBurnerLog } from '@/utils/burner-log';
import { crc32 } from '@/utils/crc-utils';
import { formatHex, formatSpeed, formatTimeDuration } from '@/utils/formatter-utils';
import type { CFIInfo, SectorBlock } from '@/utils/parsers/cfi-parser';
import { ProgressInfoBuilder } from '@/utils/progress/progress-builder';
import { SpeedCalculator } from '@/utils/progress/speed-calculator';

import {
  CartridgeAdapter,
  type LogCallback,
  type ProgressCallback,
  type TranslateFunction,
} from './cartridge-adapter';
import {
  executeProfileSteps,
  probeFlashcartProfiles,
  resetProfileFlash,
} from './flashcart-profile-runner';
import { FlashcartProfileService } from './flashcart-profile-service';

const clientRegistry = new WeakMap<Transport, FlashgbxCommandClient>();
const blankCrc32Cache = new Map<number, number>();

export function getOrCreateFlashgbxClient(device: DeviceInfo): FlashgbxCommandClient {
  const transport = device.transport ?? device.serialHandle?.transport;
  if (!transport) {
    throw new Error('FlashGBX transport is not initialized');
  }
  const existing = clientRegistry.get(transport);
  if (existing) {
    return existing;
  }
  const fwInfo: FlashgbxFirmwareInfo = device.flashgbxInfo ?? {
    family: 'gbflash',
    cfwId: 'L',
    fwVer: 12,
    pcbVer: 13,
    fwTs: 0,
    ofwVer: null,
    pcbName: 'FlashGBX',
    cartPowerCtrl: true,
    cartPresenceSwitch: false,
    cartModeSwitch: false,
    bootloaderReset: false,
    hasDeviceSerial: false,
    unregistered: false,
    audioWePin: true,
    isCdc: false,
  };
  const baudRate = typeof AdvancedSettings.flashgbxBaudRate === 'number'
    ? AdvancedSettings.flashgbxBaudRate
    : 2_000_000;
  const client = new FlashgbxCommandClient(transport, fwInfo, {
    baudRate,
    timeoutMs: AdvancedSettings.packageReceiveTimeout || 1500,
  });
  clientRegistry.set(transport, client);
  return client;
}

export interface FlashgbxModeTransactionOptions {
  voltage?: FlashgbxVoltage;
  enable5V?: boolean;
  signal?: AbortSignal;
  onCleanupReset?: (client: FlashgbxCommandClient) => Promise<void>;
}

export abstract class FlashgbxBaseAdapter extends CartridgeAdapter {
  protected readonly client: FlashgbxCommandClient;
  protected activeFlashcartProfile: FlashcartProfile | null = null;

  constructor(
    device: DeviceInfo,
    logCallback: LogCallback | null = null,
    progressCallback: ProgressCallback | null = null,
    translateFunc: TranslateFunction | null = null,
    clientOverride?: FlashgbxCommandClient,
  ) {
    super(device, logCallback, progressCallback, translateFunc);
    this.client = clientOverride ?? getOrCreateFlashgbxClient(device);
  }

  /**
   * FlashGBX devices MUST NOT pulse DTR/RTS. Only flush/drain buffers.
   */
  override async resetCommandBuffer(): Promise<void> {
    await this.client.resetChannel();
  }

  /**
   * FlashGBX devices MUST NOT pulse DTR/RTS on channel stabilization.
   */
  protected override async stabilizeCommandChannel(): Promise<void> {
    await this.client.resetChannel();
  }

  /**
   * Safely updates GBFlash hardware mode and LEDs without turning on cartridge power or 5V.
   */
  async syncHardwareMode(mode: 'GBA' | 'MBC5'): Promise<void> {
    const lkMode: FlashgbxCartMode = mode === 'MBC5' ? 'DMG' : 'AGB';
    await this.client.mutex.run(async () => {
      await this.client.cartPowerOff();
      await this.client.setVoltage('3.3V');
      await this.client.syncModeOnly(lkMode);
    });
  }

  protected getReadChunkLimit(): number {
    const userLimit = AdvancedSettings.romReadPageSize || this.client.bufferLimits.maxRead;
    return Math.min(Math.max(userLimit, 0x1000), this.client.bufferLimits.maxRead);
  }

  protected getWriteChunkLimit(): number {
    const userLimit = AdvancedSettings.romPageSize || this.client.bufferLimits.maxWrite;
    return Math.min(userLimit, this.client.bufferLimits.maxWrite);
  }

  protected getRamWriteChunkLimit(): number {
    const userLimit = AdvancedSettings.ramPageSize || this.client.bufferLimits.maxWrite;
    return Math.min(userLimit, this.client.bufferLimits.maxWrite);
  }

  protected getBlankCrc32(length: number): number {
    const cached = blankCrc32Cache.get(length);
    if (cached !== undefined) {
      return cached;
    }
    const blank = new Uint8Array(length);
    blank.fill(0xFF);
    const value = crc32(blank) >>> 0;
    blankCrc32Cache.set(length, value);
    return value;
  }

  protected async isRegionBlankCrc32(
    client: FlashgbxCommandClient,
    mode: 'AGB' | 'DMG',
    address: number,
    length: number,
    signal?: AbortSignal,
  ): Promise<boolean> {
    if (client.fwInfo.fwVer < FW_VER_THRESHOLDS.CALC_CRC32 || length <= 0) {
      return false;
    }
    const { supported, chunkCrcs } = await client.calcCrc32(mode, address, length, { signal });
    if (!supported || chunkCrcs.length === 0) {
      return false;
    }
    let remaining = length;
    let idx = 0;
    while (remaining > 0) {
      if (idx >= chunkCrcs.length) {
        return false;
      }
      const chunkLen = Math.min(remaining, FLASHGBX_CRC32_CHUNK_SIZE);
      if ((chunkCrcs[idx] >>> 0) !== this.getBlankCrc32(chunkLen)) {
        return false;
      }
      remaining -= chunkLen;
      idx++;
    }
    return idx === chunkCrcs.length;
  }

  protected async withModeTransaction<T>(
    mode: FlashgbxCartMode,
    options: FlashgbxModeTransactionOptions,
    fn: (client: FlashgbxCommandClient) => Promise<T>,
  ): Promise<T> {
    return this.client.mutex.run(async () => {
      throwIfAborted(options.signal);

      const voltage: FlashgbxVoltage = options.voltage ?? (mode === 'DMG' && options.enable5V !== false ? '5V' : '3.3V');
      const previousAutoPowerOff = await this.client.enterAutoPowerOffKeepAlive(600_000);

      let failedOrCancelled = false;
      try {
        await this.client.setMode(mode, voltage);
        return await fn(this.client);
      } catch (error) {
        failedOrCancelled = true;
        throw error;
      } finally {
        if (failedOrCancelled && options.onCleanupReset) {
          await options.onCleanupReset(this.client).catch(() => undefined);
        }
        if (failedOrCancelled || voltage === '5V') {
          await this.restoreVoltageAndPower(mode).catch(() => undefined);
        }
        await this.client.leaveAutoPowerOffKeepAlive(previousAutoPowerOff).catch(() => undefined);
      }
    }, options.signal);
  }

  protected async restoreVoltageAndPower(mode: FlashgbxCartMode): Promise<void> {
    if (mode === 'DMG') {
      await this.client.dmgMbcReset().catch(() => undefined);
    }
    await this.client.cartPowerOff().catch(() => undefined);
    await this.client.setVoltage('3.3V').catch(() => undefined);
  }

  protected createOperationProgress(
    type: 'erase' | 'write' | 'read' | 'verify' | 'other',
    totalBytes: number,
    allowCancel: boolean,
    sectorBlocks?: SectorBlock[],
    sectorBaseAddress = 0,
  ) {
    const startTime = Date.now();
    const speedCalc = new SpeedCalculator();
    let transferred = 0;
    let requestCount = 0;
    let lastReportTime = 0;
    let nextLogPct = 10;

    const sectors = sectorBlocks && sectorBlocks.length > 0
      ? this.initializeSectorProgress(sectorBlocks)
      : [];
    const sectorMeta = sectors.length > 0
      ? {
        addresses: sectors.map(s => s.address),
        sizes: sectors.map(s => s.size),
        sizeClasses: sectors.map<SectorSizeClass>(s => (s.size <= 0x1000 ? 'small' : s.size <= 0x8000 ? 'medium' : 'large')),
        stateBuffer: new Uint8Array(sectors.length).fill(type === 'erase' ? 4 : 0),
      }
      : null;
    let completedSectors = 0;
    let currentSectorIndex = -1;

    const updateSectorPosition = (done: boolean) => {
      if (!sectorMeta) {
        return;
      }
      const doneCode = type === 'erase' ? 6 : 2;
      const activeCode = type === 'erase' ? 5 : 1;
      if (done) {
        sectorMeta.stateBuffer.fill(doneCode);
        completedSectors = sectorMeta.addresses.length;
        currentSectorIndex = -1;
        return;
      }
      const cursor = sectorBaseAddress + transferred;
      let activeIdx = -1;
      let doneCount = 0;
      for (let i = 0; i < sectorMeta.addresses.length; i++) {
        const start = sectorMeta.addresses[i];
        const end = start + sectorMeta.sizes[i];
        if (cursor >= end) {
          sectorMeta.stateBuffer[i] = doneCode;
          doneCount++;
        } else if (cursor >= start && cursor < end && activeIdx === -1) {
          sectorMeta.stateBuffer[i] = activeCode;
          activeIdx = i;
        }
      }
      completedSectors = doneCount;
      currentSectorIndex = activeIdx;
    };

    const emit = (force: boolean) => {
      const now = Date.now();
      if (!force && now - lastReportTime < 80) {
        return;
      }
      lastReportTime = now;
      const pct = totalBytes > 0 ? Math.min(100, Math.round((transferred / totalBytes) * 100)) : 100;
      const builder = ProgressInfoBuilder.running(type)
        .showProgress(true)
        .progress(pct)
        .bytes(transferred, totalBytes)
        .speed(speedCalc.getCurrentSpeed(now))
        .cancellable(allowCancel)
        .startTime(startTime)
        .detail(`${formatHex(transferred, 6)} / ${formatHex(totalBytes, 6)}`);
      if (sectorMeta) {
        builder.sectorProgress(
          {
            addresses: sectorMeta.addresses,
            sizes: sectorMeta.sizes,
            sizeClasses: sectorMeta.sizeClasses,
            stateBuffer: new Uint8Array(sectorMeta.stateBuffer),
          },
          completedSectors,
          currentSectorIndex,
        );
      }
      this.updateProgress(builder.build());
    };

    emit(true);

    return {
      startTime,
      speedCalc,
      advance: (bytes: number) => {
        transferred += bytes;
        requestCount += 1;
        speedCalc.addDataPoint(bytes);
        updateSectorPosition(false);
        emit(false);
      },
      maybeLogMilestone: (key: string, address: number) => {
        if (totalBytes <= 0) {
          return;
        }
        const pct = Math.floor((transferred / totalBytes) * 100);
        if (pct >= nextLogPct && pct < 100) {
          this.log(this.t(key, { address: formatHex(address, 4), progress: pct }), 'info');
          nextLogPct = Math.floor(pct / 10) * 10 + 10;
        }
      },
      getStats: () => {
        const totalTime = speedCalc.getTotalTime();
        const avgSpeed = totalTime > 0 ? transferred / totalTime : speedCalc.getAverageSpeed();
        return {
          totalTime: formatTimeDuration(totalTime),
          avgSpeed: formatSpeed(avgSpeed),
          maxSpeed: formatSpeed(speedCalc.getMaxSpeed()),
          requestCount,
        };
      },
      finish: (detail: string) => {
        updateSectorPosition(true);
        const builder = ProgressInfoBuilder.completed(type)
          .showProgress(true)
          .bytes(totalBytes, totalBytes)
          .speed(speedCalc.getAverageSpeed())
          .cancellable(false)
          .startTime(startTime)
          .detail(detail);
        if (sectorMeta) {
          builder.sectorProgress(
            {
              addresses: sectorMeta.addresses,
              sizes: sectorMeta.sizes,
              sizeClasses: sectorMeta.sizeClasses,
              stateBuffer: new Uint8Array(sectorMeta.stateBuffer),
            },
            completedSectors,
            currentSectorIndex,
          );
        }
        this.updateProgress(builder.build());
      },
      error: (detail: string) => {
        const info = ProgressInfoBuilder.error(type, detail)
          .showProgress(true)
          .bytes(transferred, totalBytes)
          .startTime(startTime)
          .build();
        this.updateProgress(info);
      },
    };
  }

  protected formatRomVerifyMismatch(
    platformLabel: string,
    offset: number,
    result: { expected?: number; actual?: number; expectedByte?: number; actualByte?: number },
  ): string {
    const addr = formatHex(offset, 4);
    const parts: string[] = [];
    if (result.expectedByte !== undefined && result.actualByte !== undefined) {
      parts.push(`expected=${formatHex(result.expectedByte, 1)}, actual=${formatHex(result.actualByte, 1)}`);
    }
    if (result.expected !== undefined && result.actual !== undefined) {
      parts.push(`crc expected=${formatHex(result.expected, 4)}, actual=${formatHex(result.actual, 4)}`);
    }
    return parts.length > 0
      ? `${platformLabel} ROM verify mismatch at ${addr} (${parts.join(', ')})`
      : `${platformLabel} ROM verify mismatch at ${addr}`;
  }

  protected mapOperationError(error: unknown, fallbackMessage: string): CommandResult {
    if (
      (error instanceof FlashgbxProtocolError && error.code === 'aborted')
      || (error instanceof Error && error.name === 'AbortError')
    ) {
      const cancelMsg = this.t('messages.operation.cancelled') || 'Operation cancelled';
      this.log(cancelMsg, 'warn');
      return {
        success: false,
        errorCode: 'cancelled',
        message: cancelMsg,
      };
    }
    this.log(errorToBurnerLog(fallbackMessage, error), 'error');
    const profile = getFirmwareProfile(this.device);
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `${fallbackMessage} (${profile.label}): ${msg}`,
    };
  }

  protected verifyDataEqual(expected: Uint8Array, actual: Uint8Array): { matched: boolean; mismatchOffset?: number } {
    if (expected.length !== actual.length) {
      return { matched: false, mismatchOffset: Math.min(expected.length, actual.length) };
    }
    if (crc32(expected) === crc32(actual)) {
      return { matched: true };
    }
    for (let i = 0; i < expected.length; i++) {
      if (expected[i] !== actual[i]) {
        return { matched: false, mismatchOffset: i };
      }
    }
    return { matched: false, mismatchOffset: 0 };
  }

  protected clearCartInfoError(): void {
    this.lastCartInfoError = undefined;
    this.lastCartInfoErrorCode = undefined;
    this.lastCartInfoErrorDetails = undefined;
  }

  protected validateProfileCapabilities(profile: FlashcartProfile): FlashcartValidationResult {
    return FlashcartProfileService.validateCapabilities(profile, {
      audioWePin: this.client.fwInfo.audioWePin,
      cartPowerControl: this.client.fwInfo.cartPowerCtrl,
    });
  }

  protected async resolveProfileForOperation(
    flashcartMode: FlashcartMode,
    options?: Partial<CommandOptions>,
  ): Promise<{ profile: FlashcartProfile | null; errorResult?: CommandResult }> {
    let profile: FlashcartProfile | null = null;
    if (options?.flashcartProfileId) {
      if (this.activeFlashcartProfile?.id === options.flashcartProfileId) {
        profile = this.activeFlashcartProfile;
      } else {
        const list = await FlashcartProfileService.loadByMode(flashcartMode);
        profile = list.find(item => item.id === options.flashcartProfileId) ?? null;
        if (!profile) {
          return {
            profile: null,
            errorResult: {
              success: false,
              errorCode: 'profile_not_found',
              message: `Flashcart profile "${options.flashcartProfileId}" not found`,
            },
          };
        }
      }
    } else {
      profile = this.activeFlashcartProfile;
    }

    if (profile) {
      const validation = this.validateProfileCapabilities(profile);
      if (!validation.valid) {
        return {
          profile: null,
          errorResult: {
            success: false,
            errorCode: validation.errorCode,
            message: validation.reason,
          },
        };
      }
    }
    return { profile };
  }

  protected async resolveManualProfileCartInfo(
    client: FlashgbxCommandClient,
    mode: FlashgbxCartMode,
    flashcartMode: FlashcartMode,
    profileId: string,
  ): Promise<CFIInfo | false> {
    const profiles = await FlashcartProfileService.loadByMode(flashcartMode);
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) {
      this.lastCartInfoErrorCode = 'profile_not_found';
      this.lastCartInfoError = `Flashcart profile "${profileId}" not found`;
      return false;
    }

    const validation = this.validateProfileCapabilities(profile);
    if (!validation.valid) {
      this.lastCartInfoErrorCode = validation.errorCode;
      this.lastCartInfoError = validation.reason;
      return false;
    }

    let observedId: Uint8Array | undefined;
    if (profile.commands.read_identifier?.length) {
      try {
        await resetProfileFlash(client, mode, profile);
        await executeProfileSteps(client, mode, profile.commands.read_identifier);
        observedId = await client.readRom(mode, profile.read_identifier_at ?? 0, 8, { maxLength: 8 });
      } finally {
        await resetProfileFlash(client, mode, profile);
      }
    }

    this.activeFlashcartProfile = profile;
    this.log(`Using manual flashcart profile: ${profile.names[0]}`, 'info');
    return FlashcartProfileService.synthesizeCfiInfo(profile, observedId);
  }

  protected async runAutoProfileFallback(
    client: FlashgbxCommandClient,
    mode: FlashgbxCartMode,
    flashcartMode: FlashcartMode,
  ): Promise<CFIInfo | false> {
    const outcome = await probeFlashcartProfiles(client, mode, flashcartMode);
    if (outcome.match.status === 'none') {
      this.lastCartInfoErrorCode = 'profile_not_found';
      this.lastCartInfoError = `No matching flashcart profile found for ${mode} cartridge`;
      return false;
    }

    if (outcome.match.status === 'ambiguous') {
      this.lastCartInfoErrorCode = 'profile_ambiguous';
      this.lastCartInfoError = `Multiple flashcart profiles matched (${outcome.match.candidates.length})`;
      this.lastCartInfoErrorDetails = {
        candidates: outcome.match.candidates.map(profile => FlashcartProfileService.toSummary(profile)),
      };
      return false;
    }

    const { profile } = outcome.match;
    const validation = this.validateProfileCapabilities(profile);
    if (!validation.valid) {
      this.lastCartInfoErrorCode = validation.errorCode;
      this.lastCartInfoError = validation.reason;
      return false;
    }

    this.activeFlashcartProfile = profile;
    this.log(`Matched flashcart profile: ${profile.names[0]}`, 'info');
    return FlashcartProfileService.synthesizeCfiInfo(profile, outcome.observedId);
  }
}
