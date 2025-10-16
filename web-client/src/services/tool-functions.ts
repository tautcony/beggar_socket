import { DateTime } from 'luxon';

import i18n from '@/i18n';
import { gbc_read, gbc_write, rom_read, rom_write } from '@/protocol/beggar_socket/protocol';
import { toLittleEndian } from '@/protocol/beggar_socket/protocol-utils';
import { LogCallback, ProgressCallback } from '@/services/cartridge-adapter';
import { DeviceInfo } from '@/types/device-info';
import { ProgressInfo } from '@/types/progress-info';

import { GBAAdapter } from './gba-adapter';
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
  return (message: string, type: 'info' | 'success' | 'warn' | 'error') => {
    onProgress?.({ message, type });
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

/**
 * 设置RTC时间
 * @param device - 设备信息
 * @param type - RTC类型，'GBA' 或 'MBC3'
 * @param rtcData - RTC数据
 */
export async function setRTC(device: DeviceInfo, type: 'GBA' | 'MBC3', rtcData: GBARTCData | MBC3RTCData): Promise<void> {
  const rtcManager = new RTCManager(type, device);
  await rtcManager.setTime(rtcData);
}

/**
 * 读取RTC信息
 * @param device - 设备信息
 * @param type - RTC类型，'GBA' 或 'MBC3'
 */
export async function readRTC(device: DeviceInfo, type: 'GBA' | 'MBC3'): Promise<{ status: boolean; time?: DateTime; error?: string }> {
  const rtcManager = new RTCManager(type, device);
  return await rtcManager.readTime();
}

/**
 * 震动测试 (GBA)
 */
export async function rumbleTest(device: DeviceInfo): Promise<void> {

  console.log('GPIO 指令');
  // GPIO 震动控制序列
  await rom_write(device, toLittleEndian(0x01, 2), 0xc8 >> 1); // enable gpio
  await rom_write(device, toLittleEndian(0x08, 2), 0xc6 >> 1); // gpio3 output
  await rom_write(device, toLittleEndian(0x08, 2), 0xc4 >> 1); // gpio3 1
  await new Promise(resolve => setTimeout(resolve, 500));
  await rom_write(device, toLittleEndian(0x00, 2), 0xc4 >> 1); // gpio3 0
  await rom_write(device, toLittleEndian(0x00, 2), 0xc8 >> 1); // disable gpio
  await new Promise(resolve => setTimeout(resolve, 250));

  console.log('EZODE 指令');
  // EZODE 震动控制序列
  for (let i = 0; i < 10; i++) {
    await rom_write(device, toLittleEndian(0xd200, 2), 0xff0000);
    await rom_write(device, toLittleEndian(0x1500, 2), 0x000000);
    await rom_write(device, toLittleEndian(0xd200, 2), 0x010000);
    await rom_write(device, toLittleEndian(0x1500, 2), 0x020000);
    await rom_write(device, toLittleEndian(0x00f1, 2), 0xf10000);
    await rom_write(device, toLittleEndian(0x1500, 2), 0xfe0000);
    await rom_write(device, toLittleEndian(0x0002, 2), 0x000800);
    await rom_write(device, toLittleEndian(0x0000, 2), 0x000800);
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
    await rom_write(device, toLittleEndian(0x90, 2), 0);
    await rom_write(device, toLittleEndian(0x00, 2), 0); // Command Set Exit
    await rom_write(device, toLittleEndian(0xf0, 2), 0); // Reset/ASO Exit

    onProgress?.({ progress: 10 });

    // 检查PPB Lock状态
    // Global Non-Volatile Sector Protection Freeze Command Set Definitions
    await rom_write(device, toLittleEndian(0xaa, 2), 0x000555);
    await rom_write(device, toLittleEndian(0x55, 2), 0x0002aa);
    await rom_write(device, toLittleEndian(0x50, 2), 0x000555);

    const lockBit = await rom_read(device, 2, 0);

    // Reset
    await rom_write(device, toLittleEndian(0x90, 2), 0);
    await rom_write(device, toLittleEndian(0x00, 2), 0);
    await rom_write(device, toLittleEndian(0xf0, 2), 0);

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
      await rom_write(device, toLittleEndian(0xaa, 2), 0x000555);
      await rom_write(device, toLittleEndian(0x55, 2), 0x0002aa);
      await rom_write(device, toLittleEndian(0xc0, 2), 0x000555);

      const sectorLockBit = await rom_read(device, 2, i * sectorSize);

      // Reset
      await rom_write(device, toLittleEndian(0x90, 2), 0);
      await rom_write(device, toLittleEndian(0x00, 2), 0);
      await rom_write(device, toLittleEndian(0xf0, 2), 0);

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
    await rom_write(device, toLittleEndian(0xaa, 2), 0x000555);
    await rom_write(device, toLittleEndian(0x55, 2), 0x0002aa);
    await rom_write(device, toLittleEndian(0xc0, 2), 0x000555);
    await rom_write(device, toLittleEndian(0x80, 2), 0);
    await rom_write(device, toLittleEndian(0x30, 2), 0); // All PPB Erase

    onProgress?.({ progress: 70 });

    // 等待擦除完成
    await new Promise(resolve => setTimeout(resolve, 2000));

    await rom_write(device, toLittleEndian(0x90, 2), 0);
    await rom_write(device, toLittleEndian(0x00, 2), 0);
    await rom_write(device, toLittleEndian(0xf0, 2), 0);

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
      await rom_write(device, toLittleEndian(0xaa, 2), 0x000555);
      await rom_write(device, toLittleEndian(0x55, 2), 0x0002aa);
      await rom_write(device, toLittleEndian(0xc0, 2), 0x000555);

      const sectorLockBit = await rom_read(device, 2, i * sectorSize);

      // Reset
      await rom_write(device, toLittleEndian(0x90, 2), 0);
      await rom_write(device, toLittleEndian(0x00, 2), 0);
      await rom_write(device, toLittleEndian(0xf0, 2), 0);

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
    await gbc_write(device, new Uint8Array([0x90]), 0);
    await gbc_write(device, new Uint8Array([0x00]), 0); // Command Set Exit
    await gbc_write(device, new Uint8Array([0xf0]), 0); // Reset/ASO Exit

    onProgress?.({ progress: 10 });

    // 检查PPB Lock状态
    // Global Non-Volatile Sector Protection Freeze Command Set Definitions
    await gbc_write(device, new Uint8Array([0xaa]), 0xaaa);
    await gbc_write(device, new Uint8Array([0x55]), 0x555);
    await gbc_write(device, new Uint8Array([0x50]), 0xaaa);

    const lockBit = await gbc_read(device, 1, 0);

    // Reset
    await gbc_write(device, new Uint8Array([0x90]), 0);
    await gbc_write(device, new Uint8Array([0x00]), 0);
    await gbc_write(device, new Uint8Array([0xf0]), 0);

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
      await gbc_write(device, new Uint8Array([0xaa]), 0xaaa);
      await gbc_write(device, new Uint8Array([0x55]), 0x555);
      await gbc_write(device, new Uint8Array([0xc0]), 0xaaa);

      const sectorLockBit = await gbc_read(device, 1, cartAddress);

      // Reset
      await gbc_write(device, new Uint8Array([0x90]), 0);
      await gbc_write(device, new Uint8Array([0x00]), 0);
      await gbc_write(device, new Uint8Array([0xf0]), 0);

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
    await gbc_write(device, new Uint8Array([0xaa]), 0xaaa);
    await gbc_write(device, new Uint8Array([0x55]), 0x555);
    await gbc_write(device, new Uint8Array([0xc0]), 0xaaa);
    await gbc_write(device, new Uint8Array([0x80]), 0);
    await gbc_write(device, new Uint8Array([0x30]), 0); // All PPB Erase

    onProgress?.({ progress: 70 });

    // 等待擦除完成
    await new Promise(resolve => setTimeout(resolve, 2000));

    await gbc_write(device, new Uint8Array([0x90]), 0);
    await gbc_write(device, new Uint8Array([0x00]), 0);
    await gbc_write(device, new Uint8Array([0xf0]), 0);

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
      await gbc_write(device, new Uint8Array([0xaa]), 0xaaa);
      await gbc_write(device, new Uint8Array([0x55]), 0x555);
      await gbc_write(device, new Uint8Array([0xc0]), 0xaaa);

      const sectorLockBit = await gbc_read(device, 1, cartAddress);

      // Reset
      await gbc_write(device, new Uint8Array([0x90]), 0);
      await gbc_write(device, new Uint8Array([0x00]), 0);
      await gbc_write(device, new Uint8Array([0xf0]), 0);

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
