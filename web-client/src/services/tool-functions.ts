import { DateTime } from 'luxon';

import i18n from '@/i18n';
import type { Transport } from '@/platform/serial';
import { gbc_read, gbc_write, rom_read, rom_write, toLittleEndian } from '@/protocol';
import { LogCallback, ProgressCallback } from '@/services/cartridge-adapter';
import { DeviceInfo } from '@/types/device-info';
import { ProgressInfo } from '@/types/progress-info';
import { type BurnerLogInput, formatBurnerLogMessage } from '@/utils/burner-log';

import { GBAAdapter } from './gba-adapter';
import { MBC5Adapter } from './mbc5-adapter';
import { type GBARTCData, type MBC3RTCData, RTCManager } from './rtc';

/**
 * PPB 鎿嶄綔杩涘害淇℃伅
 */
export interface PPBProgress {
  progress?: number;
  message?: string;
  type?: 'info' | 'success' | 'warn' | 'error';
}

/**
 * 鍒涘缓鏃ュ織鍥炶皟鍑芥暟
 */
function createLogCallback(onProgress?: (progress: PPBProgress) => void): LogCallback {
  return (message: BurnerLogInput, type: 'info' | 'success' | 'warn' | 'error') => {
    const entry = typeof message === 'string' ? { message } : message;
    onProgress?.({ message: formatBurnerLogMessage(entry), type });
  };
}

/**
 * 鍒涘缓杩涘害鍥炶皟鍑芥暟
 */
function createProgressCallback(onProgress?: (progress: PPBProgress) => void): ProgressCallback {
  return (progressInfo: ProgressInfo) => {
    if (progressInfo.progress !== undefined && progressInfo.progress !== null) {
      onProgress?.({ progress: progressInfo.progress });
    }
  };
}
function requireDeviceTransport(device: DeviceInfo): Transport {
  const transport = device.transport ?? device.serialHandle?.transport;
  if (!transport) {
    throw new Error('Device transport is not initialized');
  }
  return transport;
}
/**
 * 璁剧疆RTC鏃堕棿
 * @param device - 璁惧淇℃伅
 * @param type - RTC绫诲瀷锛?GBA' 鎴?'MBC3'
 * @param rtcData - RTC鏁版嵁
 */
export async function setRTC(device: DeviceInfo, type: 'GBA' | 'MBC3', rtcData: GBARTCData | MBC3RTCData): Promise<void> {
  const rtcManager = new RTCManager(type, device);
  await rtcManager.setTime(rtcData);
}

/**
 * 璇诲彇RTC淇℃伅
 * @param device - 璁惧淇℃伅
 * @param type - RTC绫诲瀷锛?GBA' 鎴?'MBC3'
 */
export async function readRTC(device: DeviceInfo, type: 'GBA' | 'MBC3'): Promise<{ status: boolean; time?: DateTime; error?: string }> {
  const rtcManager = new RTCManager(type, device);
  return await rtcManager.readTime();
}

/**
 * 闇囧姩娴嬭瘯 (GBA)
 */
export async function rumbleTest(device: DeviceInfo): Promise<void> {
  const transport = requireDeviceTransport(device);

  console.log('GPIO 鎸囦护');
  // GPIO 闇囧姩鎺у埗搴忓垪
  await rom_write(transport, toLittleEndian(0x01, 2), 0xc8 >> 1); // enable gpio
  await rom_write(transport, toLittleEndian(0x08, 2), 0xc6 >> 1); // gpio3 output
  await rom_write(transport, toLittleEndian(0x08, 2), 0xc4 >> 1); // gpio3 1
  await new Promise(resolve => setTimeout(resolve, 500));
  await rom_write(transport, toLittleEndian(0x00, 2), 0xc4 >> 1); // gpio3 0
  await rom_write(transport, toLittleEndian(0x00, 2), 0xc8 >> 1); // disable gpio
  await new Promise(resolve => setTimeout(resolve, 250));

  console.log('EZODE 鎸囦护');
  // EZODE 闇囧姩鎺у埗搴忓垪
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
 * PPB瑙ｉ攣鍔熻兘 - GBA妯″紡
 * @param device - 璁惧淇℃伅
 * @param onProgress - 杩涘害鍥炶皟鍑芥暟
 */
export async function ppbUnlockGBA(device: DeviceInfo, onProgress?: (progress: PPBProgress) => void): Promise<{ success: boolean; message: string }> {
  const t = i18n.global.t;
  const transport = requireDeviceTransport(device);

  try {
    // 鍒涘缓鍥炶皟鍑芥暟
    const logCallback = createLogCallback(onProgress);
    const progressCallback = createProgressCallback(onProgress);

    // 鍒涘缓 GBA Adapter
    const gbaAdapter = new GBAAdapter(
      device,
      logCallback,
      progressCallback,
      t,
    );

    onProgress?.({ message: t('messages.tools.ppbUnlockGBA.starting'), type: 'info' });
    onProgress?.({ progress: 5 });

    // 鑾峰彇璁惧淇℃伅
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

    // 妫€鏌ヨ澶囧閲?
    if (deviceSize > 512 * 1024 * 1024) {
      return { success: false, message: t('messages.tools.ppbUnlockGBA.flashDetectionFailed') };
    }

    // 鍒ゆ柇鏄惁涓哄鍗?(>32MB)
    const isMultiCard = deviceSize > (32 * 1024 * 1024);

    // Reset
    await rom_write(transport, toLittleEndian(0x90, 2), 0);
    await rom_write(transport, toLittleEndian(0x00, 2), 0); // Command Set Exit
    await rom_write(transport, toLittleEndian(0xf0, 2), 0); // Reset/ASO Exit

    onProgress?.({ progress: 10 });

    // 妫€鏌PB Lock鐘舵€?
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

    // 浣跨敤瀹為檯鎵囧尯鏁伴噺
    onProgress?.({ message: t('messages.tools.ppbUnlockGBA.checkingSectors', { count: actualSectorCount }), type: 'info' });
    let currentBank = -1;
    let needToUnlock = false;
    let ppbStatusMsg = '';

    // 妫€鏌ユ寚瀹氭暟閲忔墖鍖虹殑PPB鐘舵€?
    for (let i = 0; i < actualSectorCount; i++) {
      // 濡傛灉鏄鍗★紝闇€瑕佸垏鎹?bank
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

      // 姣?6涓墖鍖鸿緭鍑轰竴娆℃棩蹇?
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

    // 绛夊緟鎿﹂櫎瀹屾垚
    await new Promise(resolve => setTimeout(resolve, 2000));

    await rom_write(transport, toLittleEndian(0x90, 2), 0);
    await rom_write(transport, toLittleEndian(0x00, 2), 0);
    await rom_write(transport, toLittleEndian(0xf0, 2), 0);

    onProgress?.({ progress: 90 });

    // 楠岃瘉PPB鎿﹂櫎缁撴灉
    currentBank = -1;
    let verifyMsg = '';
    for (let i = 0; i < actualSectorCount; i++) {
      // 濡傛灉鏄鍗★紝闇€瑕佸垏鎹?bank
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

      // 姣?6涓墖鍖鸿緭鍑轰竴娆℃棩蹇?
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
 * PPB瑙ｉ攣鍔熻兘 - MBC5妯″紡
 * @param device - 璁惧淇℃伅
 * @param onProgress - 杩涘害鍥炶皟鍑芥暟
 */
export async function ppbUnlockMBC5(device: DeviceInfo, onProgress?: (progress: PPBProgress) => void): Promise<{ success: boolean; message: string }> {
  const t = i18n.global.t;
  const transport = requireDeviceTransport(device);

  try {
    // 鍒涘缓鍥炶皟鍑芥暟
    const logCallback = createLogCallback(onProgress);
    const progressCallback = createProgressCallback(onProgress);

    // 鍒涘缓 MBC5 Adapter
    const mbc5Adapter = new MBC5Adapter(
      device,
      logCallback,
      progressCallback,
      t,
    );

    logCallback(t('messages.tools.ppbUnlockMBC5.starting'), 'info');
    onProgress?.({ progress: 5 });

    // 鑾峰彇璁惧淇℃伅
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

    // 妫€鏌ヨ澶囧閲?
    if (deviceSize > 512 * 1024 * 1024) {
      return { success: false, message: t('messages.tools.ppbUnlockMBC5.flashDetectionFailed') };
    }

    // Reset
    await gbc_write(transport, new Uint8Array([0x90]), 0);
    await gbc_write(transport, new Uint8Array([0x00]), 0); // Command Set Exit
    await gbc_write(transport, new Uint8Array([0xf0]), 0); // Reset/ASO Exit

    onProgress?.({ progress: 10 });

    // 妫€鏌PB Lock鐘舵€?
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

    // 浣跨敤瀹為檯鎵囧尯鏁伴噺
    logCallback(t('messages.tools.ppbUnlockMBC5.checkingSectors', { count: actualSectorCount }), 'info');
    let currentBank = -1;
    let needUnlock = false;
    let ppbStatusMsg = '';

    for (let i = 0; i < actualSectorCount; i++) {
      // 璁＄畻bank鍜宑artridge鍦板潃
      const bank = Math.floor((i * sectorSize) / 0x4000);
      let cartAddress: number;

      if (bank === 0) {
        cartAddress = 0x0000 + ((i * sectorSize) & 0x3fff);
      } else {
        cartAddress = 0x4000 + ((i * sectorSize) & 0x3fff);
      }

      // 鍒囨崲 ROM bank锛堝鏋滈渶瑕侊級
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

      // 姣?6涓墖鍖鸿緭鍑轰竴娆℃棩蹇?
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

    // 绛夊緟鎿﹂櫎瀹屾垚
    await new Promise(resolve => setTimeout(resolve, 2000));

    await gbc_write(transport, new Uint8Array([0x90]), 0);
    await gbc_write(transport, new Uint8Array([0x00]), 0);
    await gbc_write(transport, new Uint8Array([0xf0]), 0);

    onProgress?.({ progress: 90 });

    // 楠岃瘉PPB鎿﹂櫎缁撴灉
    currentBank = -1;
    let verifyMsg = '';
    for (let i = 0; i < actualSectorCount; i++) {
      // 璁＄畻bank鍜宑artridge鍦板潃
      const bank = Math.floor((i * sectorSize) / 0x4000);
      let cartAddress: number;

      if (bank === 0) {
        cartAddress = 0x0000 + ((i * sectorSize) & 0x3fff);
      } else {
        cartAddress = 0x4000 + ((i * sectorSize) & 0x3fff);
      }

      // 鍒囨崲 ROM bank锛堝鏋滈渶瑕侊級
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

      // 姣?6涓墖鍖鸿緭鍑轰竴娆℃棩蹇?
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
