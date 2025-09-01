import { gbc_read, gbc_write, rom_read, rom_write } from '@/protocol/beggar_socket/protocol';
import { DeviceInfo } from '@/types/device-info';

import { type GBARTCData, type MBC3RTCData, RTCManager } from './rtc';

/**
 * 设置GBA RTC时间
 */
export async function setGBARTC(device: DeviceInfo, rtcData: GBARTCData): Promise<void> {
  const rtcManager = new RTCManager('gba', device);
  await rtcManager.setTime(rtcData);
}

/**
 * 设置MBC3 RTC时间
 */
export async function setMBC3RTC(device: DeviceInfo, rtcData: MBC3RTCData): Promise<void> {
  const rtcManager = new RTCManager('mbc3', device);
  await rtcManager.setTime(rtcData);
}

/**
 * 读取GBA RTC信息
 */
export async function readGBARTC(device: DeviceInfo): Promise<{ status: boolean; time?: Date; error?: string }> {
  const rtcManager = new RTCManager('gba', device);
  return await rtcManager.readTime();
}

/**
 * 读取MBC3 RTC信息
 */
export async function readMBC3RTC(device: DeviceInfo): Promise<{ status: boolean; time?: Date; error?: string }> {
  const rtcManager = new RTCManager('mbc3', device);
  return await rtcManager.readTime();
}

// 导出RTC相关类型供其他地方使用
export type { GBARTCData, MBC3RTCData } from './rtc';

/**
 * 震动测试 (GBA)
 */
export async function rumbleTest(device: DeviceInfo): Promise<void> {
  console.log('震动测试');

  console.log('GPIO 指令');
  // GPIO 震动控制序列
  await rom_write(device, new Uint8Array([0x01, 0x00]), 0xc8 >> 1); // enable gpio
  await rom_write(device, new Uint8Array([0x08, 0x00]), 0xc6 >> 1); // gpio3 output
  await rom_write(device, new Uint8Array([0x08, 0x00]), 0xc4 >> 1); // gpio3 1
  await new Promise(resolve => setTimeout(resolve, 500));
  await rom_write(device, new Uint8Array([0x00, 0x00]), 0xc4 >> 1); // gpio3 0
  await rom_write(device, new Uint8Array([0x00, 0x00]), 0xc8 >> 1); // disable gpio
  await new Promise(resolve => setTimeout(resolve, 250));

  console.log('EZODE 指令');
  // EZODE 震动控制序列
  for (let i = 0; i < 10; i++) {
    await rom_write(device, new Uint8Array([0x00, 0xd2]), 0xff0000);
    await rom_write(device, new Uint8Array([0x00, 0x15]), 0x000000);
    await rom_write(device, new Uint8Array([0x00, 0xd2]), 0x010000);
    await rom_write(device, new Uint8Array([0x00, 0x15]), 0x020000);
    await rom_write(device, new Uint8Array([0xf1, 0x00]), 0xf10000);
    await rom_write(device, new Uint8Array([0x00, 0x15]), 0xfe0000);
    await rom_write(device, new Uint8Array([0x02, 0x00]), 0x000800);
    await rom_write(device, new Uint8Array([0x00, 0x00]), 0x000800);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

/**
 * PPB解锁功能 - GBA模式
 * @param device - 设备信息
 * @param sectorCount - 要检查的扇区数量（可选，默认16）
 * @param onProgress - 进度回调函数
 */
export async function ppbUnlockGBA(device: DeviceInfo, sectorCount = 16, onProgress?: (progress: number) => void): Promise<{ success: boolean; message: string }> {
  try {
    console.log('解锁PPB');
    if (onProgress) onProgress(5);

    // Reset
    await rom_write(device, new Uint8Array([0x90, 0x00]), 0);
    await rom_write(device, new Uint8Array([0x00, 0x00]), 0); // Command Set Exit
    await rom_write(device, new Uint8Array([0xf0, 0x00]), 0); // Reset/ASO Exit

    if (onProgress) onProgress(10);

    // 检查PPB Lock状态
    // Global Non-Volatile Sector Protection Freeze Command Set Definitions
    await rom_write(device, new Uint8Array([0xaa, 0x00]), 0x000555);
    await rom_write(device, new Uint8Array([0x55, 0x00]), 0x0002aa);
    await rom_write(device, new Uint8Array([0x50, 0x00]), 0x000555);

    const lockBit = await rom_read(device, 2, 0);

    // Reset
    await rom_write(device, new Uint8Array([0x90, 0x00]), 0);
    await rom_write(device, new Uint8Array([0x00, 0x00]), 0);
    await rom_write(device, new Uint8Array([0xf0, 0x00]), 0);

    const lockStatus = (lockBit[1] << 8) | lockBit[0];
    console.log(`PPB Lock Status: 0x${lockStatus.toString(16)}`);

    if ((lockBit[0] & 0x01) !== 1) {
      return { success: false, message: '无法解锁PPB' };
    }

    if (onProgress) onProgress(20);

    // 验证扇区数量
    if (sectorCount <= 0 || sectorCount > 512) {
      return { success: false, message: '扇区数量必须在1-512之间' };
    }

    console.log(`检查 ${sectorCount} 个扇区的PPB状态`);
    const baseSectorSize = 0x10000; // 64KB 扇区大小
    let needToUnlock = false;
    let ppbStatusMsg = '';

    // 检查指定数量扇区的PPB状态
    for (let i = 0; i < sectorCount; i++) {
      // Non-Volatile Sector Protection Command Set Definitions
      await rom_write(device, new Uint8Array([0xaa, 0x00]), 0x000555);
      await rom_write(device, new Uint8Array([0x55, 0x00]), 0x0002aa);
      await rom_write(device, new Uint8Array([0xc0, 0x00]), 0x000555);

      const sectorLockBit = await rom_read(device, 2, i * baseSectorSize);

      // Reset
      await rom_write(device, new Uint8Array([0x90, 0x00]), 0);
      await rom_write(device, new Uint8Array([0x00, 0x00]), 0);
      await rom_write(device, new Uint8Array([0xf0, 0x00]), 0);

      const ppb = (sectorLockBit[1] << 8) | sectorLockBit[0];
      if (ppb !== 1) {
        needToUnlock = true;
      }
      ppbStatusMsg += `${ppb.toString(16).padStart(4, '0')}  `;
    }

    console.log(`PPB状态: ${ppbStatusMsg}`);

    if (!needToUnlock) {
      console.log('所有扇区已解锁，但仍将执行PPB擦除操作');
    }

    if (onProgress) onProgress(40);

    // All PPB Erase
    console.log('---- All PPB Erase ----');
    await rom_write(device, new Uint8Array([0xaa, 0x00]), 0x000555);
    await rom_write(device, new Uint8Array([0x55, 0x00]), 0x0002aa);
    await rom_write(device, new Uint8Array([0xc0, 0x00]), 0x000555);
    await rom_write(device, new Uint8Array([0x80, 0x00]), 0);
    await rom_write(device, new Uint8Array([0x30, 0x00]), 0); // All PPB Erase

    if (onProgress) onProgress(70);

    // 等待擦除完成
    await new Promise(resolve => setTimeout(resolve, 2000));

    await rom_write(device, new Uint8Array([0x90, 0x00]), 0);
    await rom_write(device, new Uint8Array([0x00, 0x00]), 0);
    await rom_write(device, new Uint8Array([0xf0, 0x00]), 0);

    if (onProgress) onProgress(90);

    // 验证PPB擦除结果
    let verifyMsg = '';
    for (let i = 0; i < sectorCount; i++) {
      // Non-Volatile Sector Protection Command Set Definitions
      await rom_write(device, new Uint8Array([0xaa, 0x00]), 0x000555);
      await rom_write(device, new Uint8Array([0x55, 0x00]), 0x0002aa);
      await rom_write(device, new Uint8Array([0xc0, 0x00]), 0x000555);

      const sectorLockBit = await rom_read(device, 2, i * baseSectorSize);

      // Reset
      await rom_write(device, new Uint8Array([0x90, 0x00]), 0);
      await rom_write(device, new Uint8Array([0x00, 0x00]), 0);
      await rom_write(device, new Uint8Array([0xf0, 0x00]), 0);

      const ppb = (sectorLockBit[1] << 8) | sectorLockBit[0];
      verifyMsg += `${ppb.toString(16).padStart(4, '0')}  `;
    }

    console.log(`验证PPB状态: ${verifyMsg}`);

    if (onProgress) onProgress(100);

    return { success: true, message: 'PPB解锁成功' };
  } catch (error) {
    console.error('GBA PPB解锁失败:', error);
    return { success: false, message: error instanceof Error ? error.message : '未知错误' };
  }
}

/**
 * PPB解锁功能 - MBC5模式
 * @param device - 设备信息
 * @param sectorCount - 要检查的扇区数量（可选，默认16）
 * @param onProgress - 进度回调函数
 */
export async function ppbUnlockMBC5(device: DeviceInfo, sectorCount = 16, onProgress?: (progress: number) => void): Promise<{ success: boolean; message: string }> {
  try {
    console.log('解锁PPB');
    if (onProgress) onProgress(5);

    // Reset
    await gbc_write(device, new Uint8Array([0x90]), 0);
    await gbc_write(device, new Uint8Array([0x00]), 0); // Command Set Exit
    await gbc_write(device, new Uint8Array([0xf0]), 0); // Reset/ASO Exit

    if (onProgress) onProgress(10);

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

    console.log(`PPB Lock Status: 0x${lockBit[0].toString(16)}`);

    if ((lockBit[0] & 0x01) !== 1) {
      return { success: false, message: '无法解锁PPB' };
    }

    if (onProgress) onProgress(20);

    // 验证扇区数量
    if (sectorCount <= 0 || sectorCount > 256) {
      return { success: false, message: '扇区数量必须在1-256之间' };
    }

    console.log(`检查 ${sectorCount} 个扇区的PPB状态`);
    const baseSectorSize = 0x4000; // 16KB 扇区大小
    let needUnlock = false;
    let ppbStatusMsg = '';

    for (let i = 0; i < sectorCount; i++) {
      // 计算bank和cartridge地址
      const bank = (i * baseSectorSize) >> 14;
      let cartAddress: number;

      if (bank === 0) {
        cartAddress = 0x0000 + ((i * baseSectorSize) & 0x3fff);
      } else {
        cartAddress = 0x4000 + ((i * baseSectorSize) & 0x3fff);
      }

      // 注意：这里简化了bank切换逻辑
      // 完整实现需要调用 mbc5_romSwitchBank(bank)

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
    }

    console.log(`PPB状态: ${ppbStatusMsg}`);

    if (!needUnlock) {
      console.log('所有扇区已解锁，但仍将执行PPB擦除操作');
    }

    if (onProgress) onProgress(40);

    // All PPB Erase
    console.log('---- All PPB Erase ----');
    await gbc_write(device, new Uint8Array([0xaa]), 0xaaa);
    await gbc_write(device, new Uint8Array([0x55]), 0x555);
    await gbc_write(device, new Uint8Array([0xc0]), 0xaaa);
    await gbc_write(device, new Uint8Array([0x80]), 0);
    await gbc_write(device, new Uint8Array([0x30]), 0); // All PPB Erase

    if (onProgress) onProgress(70);

    // 等待擦除完成
    await new Promise(resolve => setTimeout(resolve, 2000));

    await gbc_write(device, new Uint8Array([0x90]), 0);
    await gbc_write(device, new Uint8Array([0x00]), 0);
    await gbc_write(device, new Uint8Array([0xf0]), 0);

    if (onProgress) onProgress(90);

    // 验证PPB擦除结果
    let verifyMsg = '';
    for (let i = 0; i < sectorCount; i++) {
      // 计算bank和cartridge地址
      const bank = (i * baseSectorSize) >> 14;
      let cartAddress: number;

      if (bank === 0) {
        cartAddress = 0x0000 + ((i * baseSectorSize) & 0x3fff);
      } else {
        cartAddress = 0x4000 + ((i * baseSectorSize) & 0x3fff);
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
    }

    console.log(`验证PPB状态: ${verifyMsg}`);

    if (onProgress) onProgress(100);

    return { success: true, message: 'PPB解锁成功' };
  } catch (error) {
    console.error('MBC5 PPB解锁失败:', error);
    return { success: false, message: error instanceof Error ? error.message : '未知错误' };
  }
}
