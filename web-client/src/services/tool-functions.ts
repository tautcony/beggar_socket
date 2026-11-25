import { DateTime } from 'luxon';

import type { CapabilityKey } from '@/device/capabilities';
import { displayTextToString } from '@/device/display';
import i18n from '@/i18n';
import type { Transport } from '@/platform/serial';
import {
  gbc_read,
  gbc_write,
  type GbflashCommandClient,
  rom_read,
  rom_write,
  toLittleEndian,
} from '@/protocol';
import { LogCallback, ProgressCallback } from '@/services/cartridge-adapter';
import { DeviceInfo } from '@/types/device-info';
import { ProgressInfo } from '@/types/progress-info';
import { type BurnerLogInput, formatBurnerLogMessage } from '@/utils/burner-log';

import { GBAAdapter } from './gba-adapter';
import { getOrCreateGbflashClient } from './gbflash-base-adapter';
import { MBC5Adapter } from './mbc5-adapter';
import { type GBARTCData, type MBC3RTCData, RTCManager } from './rtc';

/**
 * PPB 操作进度信息
 */
export interface PPBProgress {
  progress?: number;
  message?: string;
  type?: 'info' | 'success' | 'warn' | 'error';
}

/**
 * 创建日志回调函数
 */
function createLogCallback(onProgress?: (progress: PPBProgress) => void): LogCallback {
  return (message: BurnerLogInput, type: 'info' | 'success' | 'warn' | 'error') => {
    const entry = typeof message === 'string' ? { message } : message;
    onProgress?.({ message: formatBurnerLogMessage(entry), type });
  };
}

/**
 * 创建进度回调函数
 */
function createProgressCallback(onProgress?: (progress: PPBProgress) => void): ProgressCallback {
  return (progressInfo: ProgressInfo) => {
    if (progressInfo.progress !== undefined && progressInfo.progress !== null) {
      onProgress?.({ progress: progressInfo.progress });
    }
  };
}
/** Implementation routing only: availability is decided by the capability matrix. */
function usesGbflashProtocol(device: DeviceInfo): boolean {
  return device.session?.firmware.protocol === 'gbflash';
}

/** Throws the resolved capability reason when the session cannot perform a tool action. */
function requireCapability(device: DeviceInfo, capability: CapabilityKey): void {
  const capabilities = device.session?.capabilities;
  if (!capabilities) {
    throw new Error('Device session is not established; tool capabilities are unknown');
  }
  if (capabilities.has(capability)) {
    return;
  }
  const reason = capabilities.explain(capability);
  throw new Error(reason ? displayTextToString(reason) : `${capability} is not supported by the connected device`);
}

function requireDeviceTransport(device: DeviceInfo, capability: CapabilityKey): Transport {
  requireCapability(device, capability);
  const transport = device.transport ?? device.serialHandle?.transport;
  if (!transport) {
    throw new Error('Device transport is not initialized');
  }
  return transport;
}
function intToBcd(value: number): number {
  const tens = Math.floor(value / 10);
  const units = value % 10;
  return (tens << 4) | units;
}

function bcdToInt(bcd: number): number {
  const tens = (bcd >> 4) & 0x0f;
  const units = bcd & 0x0f;
  return tens * 10 + units;
}

async function withGbflashMode<T>(
  device: DeviceInfo,
  mode: 'AGB' | 'DMG',
  fn: (client: GbflashCommandClient) => Promise<T>,
): Promise<T> {
  const client = getOrCreateGbflashClient(device);
  return await client.mutex.run(async () => {
    try {
      await client.setMode(mode, mode === 'DMG' ? '5V' : '3.3V');
      return await fn(client);
    } finally {
      if (mode === 'DMG') {
        await client.dmgMbcReset().catch(() => undefined);
      }
      await client.cartPowerOff().catch(() => undefined);
      await client.setVoltage('3.3V').catch(() => undefined);
    }
  });
}

async function gbflashGbaS3511WriteByte(client: GbflashCommandClient, value: number): Promise<void> {
  await client.cartWrite('AGB', 0xc6, 0x07);
  let remaining = value;
  for (let i = 0; i < 8; i++) {
    const bit = (remaining & 0x01) !== 0 ? 0x02 : 0x00;
    remaining >>= 1;
    await client.cartWrite('AGB', 0xc4, 0x04 | bit);
    await client.cartWrite('AGB', 0xc4, 0x05 | bit);
  }
}

async function gbflashGbaS3511ReadByte(client: GbflashCommandClient): Promise<number> {
  let value = 0;
  await client.cartWrite('AGB', 0xc6, 0x05);
  for (let i = 0; i < 8; i++) {
    await client.cartWrite('AGB', 0xc4, 0x04);
    await client.cartWrite('AGB', 0xc4, 0x05);
    const data = await client.readRom('AGB', 0xc4, 2);
    value >>= 1;
    if ((data[0] & 0x02) !== 0) {
      value |= 0x80;
    }
  }
  return value;
}

async function gbflashGbaCleanupGpio(client: GbflashCommandClient): Promise<void> {
  await client.cartWrite('AGB', 0xc4, 0x01).catch(() => undefined);
  await client.cartWrite('AGB', 0xc8, 0x00).catch(() => undefined);
}

async function gbflashGbaCheckGpio(client: GbflashCommandClient): Promise<boolean> {
  try {
    const read1 = await client.readRom('AGB', 0xc4, 6);
    await client.cartWrite('AGB', 0xc8, 0x01);
    const read2 = await client.readRom('AGB', 0xc4, 6);
    return read1.some((byte, i) => byte !== read2[i]);
  } finally {
    await gbflashGbaCleanupGpio(client);
  }
}

async function gbflashGbaInitAndNormalizeStatus(client: GbflashCommandClient, normalize24Hour: boolean): Promise<number> {
  await client.cartWrite('AGB', 0xc4, 0x01);
  await client.cartWrite('AGB', 0xc6, 0x07);
  await client.cartWrite('AGB', 0xc8, 0x01);

  await gbflashGbaS3511WriteByte(client, 0xc6);
  const status = await gbflashGbaS3511ReadByte(client);
  await client.cartWrite('AGB', 0xc4, 0x01);

  if ((status & 0x80) !== 0) {
    await gbflashGbaS3511WriteByte(client, 0x06);
    await client.cartWrite('AGB', 0xc4, 0x01);
    await gbflashGbaS3511WriteByte(client, 0x46);
    await gbflashGbaS3511WriteByte(client, 0x40);
    await client.cartWrite('AGB', 0xc4, 0x01);
  } else if (normalize24Hour && (status & 0xc0) === 0) {
    await gbflashGbaS3511WriteByte(client, 0x46);
    await gbflashGbaS3511WriteByte(client, (status & 0x2a) | 0x40);
    await client.cartWrite('AGB', 0xc4, 0x01);
  }

  return status;
}

function parseGbaRtcBytes(bytes: Uint8Array): { status: boolean; time?: DateTime; error?: string } {
  const year = bcdToInt(bytes[0]);
  const month = bcdToInt(bytes[1] & 0x1f);
  const date = bcdToInt(bytes[2] & 0x3f);
  const hour = bcdToInt(bytes[4] & 0x3f);
  const minute = bcdToInt(bytes[5] & 0x7f);
  const second = bcdToInt(bytes[6] & 0x7f);

  const time = DateTime.fromObject({
    year: 2000 + year,
    month,
    day: date,
    hour,
    minute,
    second,
  });
  if (!time.isValid) {
    return { status: false, error: `Invalid date/time values: ${time.invalidReason}` };
  }
  return { status: true, time };
}

function validateGbaRtcData(data: GBARTCData): void {
  const fields = [data.year, data.month, data.date, data.day, data.hour, data.minute, data.second];
  if (!fields.every(v => typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v))) {
    throw new Error('Invalid RTC time data');
  }
  if (
    data.year < 0 || data.year > 99
    || data.month < 1 || data.month > 12
    || data.day < 0 || data.day > 6
    || data.hour < 0 || data.hour > 23
    || data.minute < 0 || data.minute > 59
    || data.second < 0 || data.second > 59
    || !DateTime.fromObject({
      year: data.year + 2000,
      month: data.month,
      day: data.date,
      hour: data.hour,
      minute: data.minute,
      second: data.second,
    }).isValid
  ) {
    throw new Error('Invalid date/time provided');
  }
}

function validateMbc3RtcData(data: MBC3RTCData): void {
  const fields = [data.day, data.hour, data.minute, data.second];
  if (!fields.every(v => typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v))) {
    throw new Error('Invalid RTC time data');
  }
  const currentYear = DateTime.now().year;
  const maxDays = DateTime.local(currentYear).isInLeapYear ? 366 : 365;
  if (
    data.day < 1 || data.day > maxDays
    || data.hour < 0 || data.hour > 23
    || data.minute < 0 || data.minute > 59
    || data.second < 0 || data.second > 59
  ) {
    throw new Error('Invalid date/time provided');
  }
}

async function gbflashMbc3Cleanup(client: GbflashCommandClient): Promise<void> {
  await client.cartWrite('DMG', 0x6000, 0x00).catch(() => undefined);
  await client.cartWrite('DMG', 0x4000, 0x00).catch(() => undefined);
  await client.cartWrite('DMG', 0x0000, 0x00).catch(() => undefined);
}

async function gbflashMbc3Latch(client: GbflashCommandClient): Promise<void> {
  await client.cartWrite('DMG', 0x6000, 0x00);
  await client.cartWrite('DMG', 0x6000, 0x01);
}

async function gbflashMbc3ReadReg(client: GbflashCommandClient, reg: number): Promise<number> {
  await client.cartWrite('DMG', 0x4000, reg);
  return await client.cartRead('DMG', 0xa000);
}

async function gbflashMbc3WriteReg(client: GbflashCommandClient, reg: number, value: number): Promise<void> {
  await client.cartWrite('DMG', 0x4000, reg);
  await client.cartWrite('DMG', 0xa000, value, { sram: true });
}

async function gbflashSetRTC(device: DeviceInfo, type: 'GBA' | 'MBC3', rtcData: GBARTCData | MBC3RTCData): Promise<void> {
  if (type === 'GBA') {
    const gbaData = rtcData as GBARTCData;
    validateGbaRtcData(gbaData);
    await withGbflashMode(device, 'AGB', async (client) => {
      if (!(await gbflashGbaCheckGpio(client))) {
        throw new Error('Cartridge does not have GPIO functionality');
      }
      try {
        await gbflashGbaInitAndNormalizeStatus(client, true);
        await gbflashGbaS3511WriteByte(client, 0x26);
        await gbflashGbaS3511WriteByte(client, intToBcd(gbaData.year % 100));
        await gbflashGbaS3511WriteByte(client, intToBcd(gbaData.month));
        await gbflashGbaS3511WriteByte(client, intToBcd(gbaData.date));
        await gbflashGbaS3511WriteByte(client, intToBcd(gbaData.day));
        await gbflashGbaS3511WriteByte(client, intToBcd(gbaData.hour));
        await gbflashGbaS3511WriteByte(client, intToBcd(gbaData.minute));
        await gbflashGbaS3511WriteByte(client, intToBcd(gbaData.second));
        await client.cartWrite('AGB', 0xc4, 0x01);
      } finally {
        await gbflashGbaCleanupGpio(client);
      }
    });
    return;
  }

  validateMbc3RtcData(rtcData);
  await withGbflashMode(device, 'DMG', async (client) => {
    try {
      await client.cartWrite('DMG', 0x0000, 0x0a);
      await gbflashMbc3Latch(client);
      const originalHigh = await gbflashMbc3ReadReg(client, 0x0c);
      await client.cartWrite('DMG', 0x6000, 0x00);

      // Stop timer before updating registers
      await gbflashMbc3Latch(client);
      await gbflashMbc3WriteReg(client, 0x0c, originalHigh | 0x40);

      const registers = [
        rtcData.second,
        rtcData.minute,
        rtcData.hour,
        rtcData.day & 0xff,
        (rtcData.day & 0x100) >> 8,
      ];
      for (let i = 0; i < registers.length; i++) {
        await gbflashMbc3WriteReg(client, 0x08 + i, registers[i]);
      }

      // Restart timer
      await gbflashMbc3Latch(client);
      await client.cartWrite('DMG', 0x6000, 0x00);
    } finally {
      await gbflashMbc3Cleanup(client);
    }
  });
}

async function gbflashReadRTC(device: DeviceInfo, type: 'GBA' | 'MBC3'): Promise<{ status: boolean; time?: DateTime; error?: string }> {
  try {
    if (type === 'GBA') {
      return await withGbflashMode(device, 'AGB', async (client) => {
        const nativeRaw = await client.agbReadGpioRtc();
        if (nativeRaw !== null) {
          if (nativeRaw.length < 8 || nativeRaw[0] === 0) {
            return { status: false, error: 'Cartridge does not have GPIO functionality' };
          }
          if ((nativeRaw[0] & 0x80) !== 0) {
            return { status: false, error: 'RTC power loss detected' };
          }
          return parseGbaRtcBytes(nativeRaw.subarray(1, 8));
        }

        if (!(await gbflashGbaCheckGpio(client))) {
          return { status: false, error: 'Cartridge does not have GPIO functionality' };
        }
        try {
          await gbflashGbaInitAndNormalizeStatus(client, false);
          await gbflashGbaS3511WriteByte(client, 0xa6);
          const raw = new Uint8Array(7);
          for (let i = 0; i < 7; i++) {
            raw[i] = await gbflashGbaS3511ReadByte(client);
          }
          await client.cartWrite('AGB', 0xc4, 0x01);
          return parseGbaRtcBytes(raw);
        } finally {
          await gbflashGbaCleanupGpio(client);
        }
      });
    }

    return await withGbflashMode(device, 'DMG', async (client) => {
      try {
        await client.cartWrite('DMG', 0x0000, 0x0a);
        await gbflashMbc3Latch(client);

        const second = (await gbflashMbc3ReadReg(client, 0x08)) & 0x3f;
        const minute = (await gbflashMbc3ReadReg(client, 0x09)) & 0x3f;
        const hour = (await gbflashMbc3ReadReg(client, 0x0a)) & 0x1f;
        const dayLow = await gbflashMbc3ReadReg(client, 0x0b);
        const dayHigh = (await gbflashMbc3ReadReg(client, 0x0c)) & 0x01;
        const day = dayLow | (dayHigh << 8);

        const currentYear = DateTime.now().year;
        const time = DateTime.fromObject({ year: currentYear, month: 1, day: 1 })
          .plus({ days: day - 1 })
          .set({ hour, minute, second });

        if (!time.isValid) {
          return { status: false, error: `Invalid date/time values: ${time.invalidReason}` };
        }
        return { status: true, time };
      } finally {
        await gbflashMbc3Cleanup(client);
      }
    });
  } catch (error) {
    return { status: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 设置RTC时间
 * @param device - 设备信息
 * @param type - RTC 类型，'GBA' 或 'MBC3'
 * @param rtcData - RTC数据
 */
export async function setRTC(device: DeviceInfo, type: 'GBA' | 'MBC3', rtcData: GBARTCData | MBC3RTCData): Promise<void> {
  requireCapability(device, type === 'GBA' ? 'tool.rtc.gba' : 'tool.rtc.mbc3');
  if (usesGbflashProtocol(device)) {
    await gbflashSetRTC(device, type, rtcData);
    return;
  }
  const rtcManager = new RTCManager(type, device);
  await rtcManager.setTime(rtcData);
}

/**
 * 读取RTC信息
 * @param device - 设备信息
 * @param type - RTC 类型，'GBA' 或 'MBC3'
 */
export async function readRTC(device: DeviceInfo, type: 'GBA' | 'MBC3'): Promise<{ status: boolean; time?: DateTime; error?: string }> {
  requireCapability(device, type === 'GBA' ? 'tool.rtc.gba' : 'tool.rtc.mbc3');
  if (usesGbflashProtocol(device)) {
    return await gbflashReadRTC(device, type);
  }
  const rtcManager = new RTCManager(type, device);
  return await rtcManager.readTime();
}

/**
 * 震动测试 (GBA)
 */
export async function rumbleTest(device: DeviceInfo): Promise<void> {
  requireCapability(device, 'tool.rumble.gba');
  if (usesGbflashProtocol(device)) {
    await withGbflashMode(device, 'AGB', async (client) => {
      try {
        await client.cartWrite('AGB', 0xc8, 0x01); // enable gpio
        await client.cartWrite('AGB', 0xc6, 0x08); // gpio3 output
        await client.cartWrite('AGB', 0xc4, 0x08); // gpio3 1
        await new Promise(resolve => setTimeout(resolve, 500));
        await client.cartWrite('AGB', 0xc4, 0x00); // gpio3 0
        await client.cartWrite('AGB', 0xc8, 0x00); // disable gpio
      } finally {
        await client.cartWrite('AGB', 0xc4, 0x00).catch(() => undefined);
        await client.cartWrite('AGB', 0xc8, 0x00).catch(() => undefined);
      }
    });
    return;
  }

  const transport = requireDeviceTransport(device, 'tool.rumble.gba');

  console.log('GPIO 指令');
  // GPIO 震动控制序列
  await rom_write(transport, toLittleEndian(0x01, 2), 0xc8 >> 1); // enable gpio
  await rom_write(transport, toLittleEndian(0x08, 2), 0xc6 >> 1); // gpio3 output
  await rom_write(transport, toLittleEndian(0x08, 2), 0xc4 >> 1); // gpio3 1
  await new Promise(resolve => setTimeout(resolve, 500));
  await rom_write(transport, toLittleEndian(0x00, 2), 0xc4 >> 1); // gpio3 0
  await rom_write(transport, toLittleEndian(0x00, 2), 0xc8 >> 1); // disable gpio
  await new Promise(resolve => setTimeout(resolve, 250));

  console.log('EZODE 指令');
  // EZODE 震动控制序列
  for (let i = 0; i < 10; i++) {
    await rom_write(transport, toLittleEndian(0xd200, 2), 0xff0000);
    await rom_write(transport, toLittleEndian(0x1500, 2), 0x000000);
    await rom_write(transport, toLittleEndian(0xd200, 2), 0x010000);
    await rom_write(transport, toLittleEndian(0x1500, 2), 0x020000);
    await rom_write(transport, toLittleEndian(0x00f1, 2), 0xf10000);
    await rom_write(transport, toLittleEndian(0x1500, 2), 0xfe0000);
    await rom_write(transport, toLittleEndian(0x0002, 2), 0x000800);
    await rom_write(transport, toLittleEndian(0x0000, 2), 0x000800);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

/**
 * PPB解锁功能 - GBA模式
 * @param device - 设备信息
 * @param onProgress - 进度回调函数
 */
export async function ppbUnlockGBA(device: DeviceInfo, onProgress?: (progress: PPBProgress) => void): Promise<{ success: boolean; message: string }> {
  const t = i18n.global.t;
  const transport = requireDeviceTransport(device, 'tool.ppbUnlock');

  try {
    // 创建回调函数
    const logCallback = createLogCallback(onProgress);
    const progressCallback = createProgressCallback(onProgress);

    // 创建 GBA Adapter
    const gbaAdapter = new GBAAdapter(
      device,
      logCallback,
      progressCallback,
      t,
    );

    onProgress?.({ message: t('messages.tools.ppbUnlockGBA.starting'), type: 'info' });
    onProgress?.({ progress: 5 });

    // 获取设备信息
    const cartInfo = await gbaAdapter.getCartInfo();
    if (!cartInfo) {
      return { success: false, message: t('messages.tools.ppbUnlockGBA.flashDetectionFailed') };
    }

    const deviceSize = cartInfo.deviceSize;
    const actualSectorCount = cartInfo.eraseSectorBlocks.reduce((sum: number, block) => sum + block.sectorCount, 0);
    const sectorSize = cartInfo.eraseSectorBlocks[0]?.sectorSize ?? 0x10000;

    logCallback(
      t('messages.tools.ppbUnlockGBA.deviceInfo', {
        capacity: deviceSize,
        sectorCount: actualSectorCount,
        sectorSize: sectorSize,
      }),
      'info',
    );

    // 检查设备容量
    if (deviceSize > 512 * 1024 * 1024) {
      return { success: false, message: t('messages.tools.ppbUnlockGBA.flashDetectionFailed') };
    }

    // 判断是否为多卡 (>32MB)
    const isMultiCard = deviceSize > (32 * 1024 * 1024);

    // Reset
    await rom_write(transport, toLittleEndian(0x90, 2), 0);
    await rom_write(transport, toLittleEndian(0x00, 2), 0); // Command Set Exit
    await rom_write(transport, toLittleEndian(0xf0, 2), 0); // Reset/ASO Exit

    onProgress?.({ progress: 10 });

    // 检查 PPB Lock 状态
    // Global Non-Volatile Sector Protection Freeze Command Set Definitions
    await rom_write(transport, toLittleEndian(0xaa, 2), 0x000555);
    await rom_write(transport, toLittleEndian(0x55, 2), 0x0002aa);
    await rom_write(transport, toLittleEndian(0x50, 2), 0x000555);

    const lockBit = await rom_read(transport, 2, 0);

    // Reset
    await rom_write(transport, toLittleEndian(0x90, 2), 0);
    await rom_write(transport, toLittleEndian(0x00, 2), 0);
    await rom_write(transport, toLittleEndian(0xf0, 2), 0);

    const lockStatus = (lockBit[1] << 8) | lockBit[0];
    onProgress?.({ message: `PPB Lock Status: 0x${lockStatus.toString(16)}`, type: 'info' });

    if ((lockBit[0] & 0x01) !== 1) {
      return { success: false, message: t('messages.tools.ppbUnlockGBA.cannotUnlock') };
    }

    onProgress?.({ progress: 20 });

    // 使用实际扇区数量
    onProgress?.({ message: t('messages.tools.ppbUnlockGBA.checkingSectors', { count: actualSectorCount }), type: 'info' });
    let currentBank = -1;
    let needToUnlock = false;
    let ppbStatusMsg = '';

    // 检查指定数量扇区的PPB状态
    for (let i = 0; i < actualSectorCount; i++) {
      // 如果是多卡，需要切换 bank
      if (isMultiCard) {
        const bank = Math.floor((i * sectorSize) / (32 * 1024 * 1024));
        if (bank !== currentBank) {
          await gbaAdapter.switchROMBank(bank);
          currentBank = bank;
        }
      }

      // Non-Volatile Sector Protection Command Set Definitions
      await rom_write(transport, toLittleEndian(0xaa, 2), 0x000555);
      await rom_write(transport, toLittleEndian(0x55, 2), 0x0002aa);
      await rom_write(transport, toLittleEndian(0xc0, 2), 0x000555);

      const sectorLockBit = await rom_read(transport, 2, i * sectorSize);

      // Reset
      await rom_write(transport, toLittleEndian(0x90, 2), 0);
      await rom_write(transport, toLittleEndian(0x00, 2), 0);
      await rom_write(transport, toLittleEndian(0xf0, 2), 0);

      const ppb = (sectorLockBit[1] << 8) | sectorLockBit[0];
      if (ppb !== 1) {
        needToUnlock = true;
      }
      ppbStatusMsg += `${ppb.toString(16).padStart(4, '0')}  `;

      // 每16个扇区输出一次日志
      if (i !== 0 && ((i + 1) % 16 === 0)) {
        onProgress?.({ message: ppbStatusMsg, type: 'info' });
        ppbStatusMsg = '';
      }
    }

    if (ppbStatusMsg) {
      onProgress?.({ message: ppbStatusMsg, type: 'info' });
    }

    if (!needToUnlock) {
      onProgress?.({ message: t('messages.tools.ppbUnlockGBA.allSectorsUnlocked'), type: 'info' });
    }

    onProgress?.({ progress: 40 });

    // All PPB Erase
    onProgress?.({ message: t('messages.tools.ppbUnlockGBA.ppbEraseStarting'), type: 'info' });
    await rom_write(transport, toLittleEndian(0xaa, 2), 0x000555);
    await rom_write(transport, toLittleEndian(0x55, 2), 0x0002aa);
    await rom_write(transport, toLittleEndian(0xc0, 2), 0x000555);
    await rom_write(transport, toLittleEndian(0x80, 2), 0);
    await rom_write(transport, toLittleEndian(0x30, 2), 0); // All PPB Erase

    onProgress?.({ progress: 70 });

    // 等待擦除完成
    await new Promise(resolve => setTimeout(resolve, 2000));

    await rom_write(transport, toLittleEndian(0x90, 2), 0);
    await rom_write(transport, toLittleEndian(0x00, 2), 0);
    await rom_write(transport, toLittleEndian(0xf0, 2), 0);

    onProgress?.({ progress: 90 });

    // 验证PPB擦除结果
    currentBank = -1;
    let verifyMsg = '';
    for (let i = 0; i < actualSectorCount; i++) {
      // 如果是多卡，需要切换 bank
      if (isMultiCard) {
        const bank = Math.floor((i * sectorSize) / (32 * 1024 * 1024));
        if (bank !== currentBank) {
          await gbaAdapter.switchROMBank(bank);
          currentBank = bank;
        }
      }

      // Non-Volatile Sector Protection Command Set Definitions
      await rom_write(transport, toLittleEndian(0xaa, 2), 0x000555);
      await rom_write(transport, toLittleEndian(0x55, 2), 0x0002aa);
      await rom_write(transport, toLittleEndian(0xc0, 2), 0x000555);

      const sectorLockBit = await rom_read(transport, 2, i * sectorSize);

      // Reset
      await rom_write(transport, toLittleEndian(0x90, 2), 0);
      await rom_write(transport, toLittleEndian(0x00, 2), 0);
      await rom_write(transport, toLittleEndian(0xf0, 2), 0);

      const ppb = (sectorLockBit[1] << 8) | sectorLockBit[0];
      verifyMsg += `${ppb.toString(16).padStart(4, '0')}  `;

      // 每16个扇区输出一次日志
      if (i !== 0 && ((i + 1) % 16 === 0)) {
        onProgress?.({ message: verifyMsg, type: 'info' });
        verifyMsg = '';
      }
    }

    if (verifyMsg) {
      onProgress?.({ message: t('messages.tools.ppbUnlockGBA.verifyingStatus', { status: verifyMsg }), type: 'success' });
    }

    onProgress?.({ progress: 100 });

    return { success: true, message: t('messages.tools.ppbUnlockGBA.unlockSuccess') };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : t('messages.tools.ppbUnlockGBA.unknownError');
    onProgress?.({ message: t('messages.tools.ppbUnlockGBA.unlockFailed', { error: errorMsg }), type: 'error' });
    return { success: false, message: errorMsg };
  }
}

/**
 * PPB解锁功能 - MBC5模式
 * @param device - 设备信息
 * @param onProgress - 进度回调函数
 */
export async function ppbUnlockMBC5(device: DeviceInfo, onProgress?: (progress: PPBProgress) => void): Promise<{ success: boolean; message: string }> {
  const t = i18n.global.t;
  const transport = requireDeviceTransport(device, 'tool.ppbUnlock');

  try {
    // 创建回调函数
    const logCallback = createLogCallback(onProgress);
    const progressCallback = createProgressCallback(onProgress);

    // 创建 MBC5 Adapter
    const mbc5Adapter = new MBC5Adapter(
      device,
      logCallback,
      progressCallback,
      t,
    );

    logCallback(t('messages.tools.ppbUnlockMBC5.starting'), 'info');
    onProgress?.({ progress: 5 });

    // 获取设备信息
    const cartInfo = await mbc5Adapter.getCartInfo();
    if (!cartInfo) {
      return { success: false, message: t('messages.tools.ppbUnlockMBC5.flashDetectionFailed') };
    }

    const deviceSize = cartInfo.deviceSize;
    const actualSectorCount = cartInfo.eraseSectorBlocks.reduce((sum: number, block) => sum + block.sectorCount, 0);
    const sectorSize = cartInfo.eraseSectorBlocks[0]?.sectorSize ?? 0x4000;

    logCallback(
      t('messages.tools.ppbUnlockMBC5.deviceInfo', {
        capacity: deviceSize,
        sectorCount: actualSectorCount,
        sectorSize: sectorSize,
      }),
      'info',
    );

    // 检查设备容量
    if (deviceSize > 512 * 1024 * 1024) {
      return { success: false, message: t('messages.tools.ppbUnlockMBC5.flashDetectionFailed') };
    }

    // Reset
    await gbc_write(transport, new Uint8Array([0x90]), 0);
    await gbc_write(transport, new Uint8Array([0x00]), 0); // Command Set Exit
    await gbc_write(transport, new Uint8Array([0xf0]), 0); // Reset/ASO Exit

    onProgress?.({ progress: 10 });

    // 检查 PPB Lock 状态
    // Global Non-Volatile Sector Protection Freeze Command Set Definitions
    await gbc_write(transport, new Uint8Array([0xaa]), 0xaaa);
    await gbc_write(transport, new Uint8Array([0x55]), 0x555);
    await gbc_write(transport, new Uint8Array([0x50]), 0xaaa);

    const lockBit = await gbc_read(transport, 1, 0);

    // Reset
    await gbc_write(transport, new Uint8Array([0x90]), 0);
    await gbc_write(transport, new Uint8Array([0x00]), 0);
    await gbc_write(transport, new Uint8Array([0xf0]), 0);

    logCallback(`PPB Lock Status: 0x${lockBit[0].toString(16)}`, 'info');

    if ((lockBit[0] & 0x01) !== 1) {
      return { success: false, message: t('messages.tools.ppbUnlockMBC5.cannotUnlock') };
    }

    onProgress?.({ progress: 20 });

    // 使用实际扇区数量
    logCallback(t('messages.tools.ppbUnlockMBC5.checkingSectors', { count: actualSectorCount }), 'info');
    let currentBank = -1;
    let needUnlock = false;
    let ppbStatusMsg = '';

    for (let i = 0; i < actualSectorCount; i++) {
      // 计算bank和cartridge地址
      const bank = Math.floor((i * sectorSize) / 0x4000);
      let cartAddress: number;

      if (bank === 0) {
        cartAddress = 0x0000 + ((i * sectorSize) & 0x3fff);
      } else {
        cartAddress = 0x4000 + ((i * sectorSize) & 0x3fff);
      }

      // 切换 ROM bank（如果需要）
      if (bank !== currentBank) {
        await mbc5Adapter.switchROMBank(bank);
        currentBank = bank;
      }

      // Non-Volatile Sector Protection Command Set Definitions
      await gbc_write(transport, new Uint8Array([0xaa]), 0xaaa);
      await gbc_write(transport, new Uint8Array([0x55]), 0x555);
      await gbc_write(transport, new Uint8Array([0xc0]), 0xaaa);

      const sectorLockBit = await gbc_read(transport, 1, cartAddress);

      // Reset
      await gbc_write(transport, new Uint8Array([0x90]), 0);
      await gbc_write(transport, new Uint8Array([0x00]), 0);
      await gbc_write(transport, new Uint8Array([0xf0]), 0);

      if (sectorLockBit[0] !== 1) {
        needUnlock = true;
      }
      ppbStatusMsg += `${sectorLockBit[0].toString(16).padStart(2, '0')}  `;

      // 每16个扇区输出一次日志
      if (i !== 0 && ((i + 1) % 16 === 0)) {
        logCallback(ppbStatusMsg, 'info');
        ppbStatusMsg = '';
      }
    }

    if (ppbStatusMsg) {
      logCallback(ppbStatusMsg, 'info');
    }

    if (!needUnlock) {
      logCallback(t('messages.tools.ppbUnlockMBC5.allSectorsUnlocked'), 'info');
    }

    onProgress?.({ progress: 40 });

    // All PPB Erase
    logCallback(t('messages.tools.ppbUnlockMBC5.ppbEraseStarting'), 'info');
    await gbc_write(transport, new Uint8Array([0xaa]), 0xaaa);
    await gbc_write(transport, new Uint8Array([0x55]), 0x555);
    await gbc_write(transport, new Uint8Array([0xc0]), 0xaaa);
    await gbc_write(transport, new Uint8Array([0x80]), 0);
    await gbc_write(transport, new Uint8Array([0x30]), 0); // All PPB Erase

    onProgress?.({ progress: 70 });

    // 等待擦除完成
    await new Promise(resolve => setTimeout(resolve, 2000));

    await gbc_write(transport, new Uint8Array([0x90]), 0);
    await gbc_write(transport, new Uint8Array([0x00]), 0);
    await gbc_write(transport, new Uint8Array([0xf0]), 0);

    onProgress?.({ progress: 90 });

    // 验证PPB擦除结果
    currentBank = -1;
    let verifyMsg = '';
    for (let i = 0; i < actualSectorCount; i++) {
      // 计算bank和cartridge地址
      const bank = Math.floor((i * sectorSize) / 0x4000);
      let cartAddress: number;

      if (bank === 0) {
        cartAddress = 0x0000 + ((i * sectorSize) & 0x3fff);
      } else {
        cartAddress = 0x4000 + ((i * sectorSize) & 0x3fff);
      }

      // 切换 ROM bank（如果需要）
      if (bank !== currentBank) {
        await mbc5Adapter.switchROMBank(bank);
        currentBank = bank;
      }

      // Non-Volatile Sector Protection Command Set Definitions
      await gbc_write(transport, new Uint8Array([0xaa]), 0xaaa);
      await gbc_write(transport, new Uint8Array([0x55]), 0x555);
      await gbc_write(transport, new Uint8Array([0xc0]), 0xaaa);

      const sectorLockBit = await gbc_read(transport, 1, cartAddress);

      // Reset
      await gbc_write(transport, new Uint8Array([0x90]), 0);
      await gbc_write(transport, new Uint8Array([0x00]), 0);
      await gbc_write(transport, new Uint8Array([0xf0]), 0);

      verifyMsg += `${sectorLockBit[0].toString(16).padStart(2, '0')}  `;

      // 每16个扇区输出一次日志
      if (i !== 0 && ((i + 1) % 16 === 0)) {
        logCallback(verifyMsg, 'info');
        verifyMsg = '';
      }
    }

    if (verifyMsg) {
      logCallback(t('messages.tools.ppbUnlockMBC5.verifyingStatus', { status: verifyMsg }), 'success');
    }

    onProgress?.({ progress: 100 });

    return { success: true, message: t('messages.tools.ppbUnlockMBC5.unlockSuccess') };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : t('messages.tools.ppbUnlockMBC5.unknownError');
    onProgress?.({ message: t('messages.tools.ppbUnlockMBC5.unlockFailed', { error: errorMsg }), type: 'error' });
    return { success: false, message: errorMsg };
  }
}
