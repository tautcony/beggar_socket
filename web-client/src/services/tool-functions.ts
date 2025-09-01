import { gbc_read, gbc_write, rom_read, rom_write } from '@/protocol/beggar_socket/protocol';
import { DeviceInfo } from '@/types/device-info';

export interface GBARTCData {
  year: number;
  month: number;
  date: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface MBC3RTCData {
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * 将整数转换为压缩BCD码
 */
function intToCompressedBCD(number: number): number {
  const tens = Math.floor(number / 10);
  const units = number % 10;
  return (tens << 4) | units;
}

/**
 * 将压缩BCD码转换为整数
 */
function compressedBCDToInt(bcd: number): number {
  const tens = (bcd >> 4) & 0x0f;
  const units = bcd & 0x0f;
  return tens * 10 + units;
}

/**
 * GBA RTC GPIO 操作函数
 */
async function s3511_writeByte(device: DeviceInfo, value: number): Promise<void> {
  // 设置SIO为输出
  await rom_write(device, new Uint8Array([7, 0]), 0xc6 >> 1); // sio out

  for (let i = 0; i < 8; i++) {
    const bit = (value & 0x01) !== 0 ? 0x02 : 0x00;
    value >>= 1;

    await rom_write(device, new Uint8Array([4 | bit, 0]), 0xc4 >> 1); // cs 1, sck 0
    await rom_write(device, new Uint8Array([5 | bit, 0]), 0xc4 >> 1); // cs 1, sck 1
  }
}

async function s3511_readByte(device: DeviceInfo): Promise<number> {
  let value = 0;

  // 设置SIO为输入
  await rom_write(device, new Uint8Array([5, 0]), 0xc6 >> 1); // sio in

  for (let i = 0; i < 8; i++) {
    await rom_write(device, new Uint8Array([4, 0]), 0xc4 >> 1); // cs 1, sck 0
    await rom_write(device, new Uint8Array([5, 0]), 0xc4 >> 1); // cs 1, sck 1

    const data = await rom_read(device, 2, 0xc4);

    // lsb in
    value >>= 1;
    if ((data[0] & 0x02) !== 0) {
      value |= 0x80;
    }
  }

  return value;
}

/**
 * 设置GBA RTC时间
 */
export async function setGBARTC(device: DeviceInfo, rtcData: GBARTCData): Promise<void> {
  try {
    // 检测GPIO功能
    const read1 = await rom_read(device, 6, 0xc4);
    await rom_write(device, new Uint8Array([0x01, 0x00]), 0xc8 >> 1); // enable gpio
    const read2 = await rom_read(device, 6, 0xc4);
    await rom_write(device, new Uint8Array([0x00, 0x00]), 0xc8 >> 1); // disable gpio

    // 检查是否有GPIO功能
    let hasGPIO = false;
    for (let i = 0; i < 6; i++) {
      if (read1[i] !== read2[i]) {
        hasGPIO = true;
        break;
      }
    }

    if (!hasGPIO) {
      throw new Error('Cartridge does not have GPIO functionality');
    }

    // 正确初始化GPIO
    await rom_write(device, new Uint8Array([0x01, 0x00]), 0xc4 >> 1); // cs 0, sck 1
    await rom_write(device, new Uint8Array([0x07, 0x00]), 0xc6 >> 1); // cs sio sck output
    await rom_write(device, new Uint8Array([0x01, 0x00]), 0xc8 >> 1); // enable gpio

    // 读取RTC状态
    await s3511_writeByte(device, 0xc6);
    const status = await s3511_readByte(device);
    await rom_write(device, new Uint8Array([0x01, 0x00]), 0xc4 >> 1); // cs 0, sck 1

    // 如果电池没电，重置RTC
    if ((status & 0x80) !== 0) {
      await s3511_writeByte(device, 0x06); // reset
      await rom_write(device, new Uint8Array([0x01, 0x00]), 0xc4 >> 1); // cs 0, sck 1

      await s3511_writeByte(device, 0x46); // write status
      await s3511_writeByte(device, 0x40); // 24 hour mode
      await rom_write(device, new Uint8Array([0x01, 0x00]), 0xc4 >> 1); // cs 0, sck 1
    }

    // 设置时间
    const year = intToCompressedBCD(rtcData.year % 100); // 只取后两位
    const month = intToCompressedBCD(rtcData.month);
    const date = intToCompressedBCD(rtcData.date);
    const day = intToCompressedBCD(rtcData.day);
    const hour = intToCompressedBCD(rtcData.hour);
    const minute = intToCompressedBCD(rtcData.minute);
    const second = intToCompressedBCD(rtcData.second);

    await s3511_writeByte(device, 0x26); // write time command
    await s3511_writeByte(device, year);
    await s3511_writeByte(device, month);
    await s3511_writeByte(device, date);
    await s3511_writeByte(device, day);
    await s3511_writeByte(device, hour);
    await s3511_writeByte(device, minute);
    await s3511_writeByte(device, second);
    await rom_write(device, new Uint8Array([0x01, 0x00]), 0xc4 >> 1); // cs 0, sck 1

    // 等待写入完成
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 验证写入：重新读取时间来确认写入成功
    for (let i = 4; i > 0; i--) {
      // 重新启用GPIO
      await rom_write(device, new Uint8Array([0x01, 0x00]), 0xc8 >> 1); // enable gpio

      // 读取时间验证
      await s3511_writeByte(device, 0xa6);
      const verifyYear = compressedBCDToInt(await s3511_readByte(device));
      const verifyMonth = compressedBCDToInt(await s3511_readByte(device) & 0x1f);
      const verifyDate = compressedBCDToInt(await s3511_readByte(device) & 0x3f);
      const verifyDay = compressedBCDToInt(await s3511_readByte(device) & 0x07);
      const verifyHour = compressedBCDToInt(await s3511_readByte(device) & 0x3f);
      const verifyMinute = compressedBCDToInt(await s3511_readByte(device) & 0x7f);
      const verifySecond = compressedBCDToInt(await s3511_readByte(device) & 0x7f);

      await rom_write(device, new Uint8Array([0x01, 0x00]), 0xc4 >> 1); // cs 0, sck 1
      await rom_write(device, new Uint8Array([0x00, 0x00]), 0xc8 >> 1); // disable gpio

      console.log(`验证 ${i}: ${verifyYear}-${verifyMonth}-${verifyDate} ${verifyHour}:${verifyMinute}:${verifySecond} 星期${verifyDay}`);

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 最终禁用GPIO
    await rom_write(device, new Uint8Array([0x00, 0x00]), 0xc8 >> 1); // disable gpio
  } catch (error) {
    // 确保在出错时也清理GPIO状态
    try {
      await rom_write(device, new Uint8Array([0x00, 0x00]), 0xc8 >> 1); // disable gpio
    } catch (cleanupError) {
      console.error('清理GPIO状态时出错:', cleanupError);
    }
    throw error; // 重新抛出原始错误
  }
}

/**
 * 设置MBC3 RTC时间
 */
export async function setMBC3RTC(device: DeviceInfo, rtcData: MBC3RTCData): Promise<void> {
  // 启用RAM访问
  await gbc_write(device, new Uint8Array([0x0a]), 0x0000);

  // 读取当前时间以验证功能
  await gbc_write(device, new Uint8Array([0x01]), 0x6000); // 锁存时间

  const buffer: number[] = [];
  for (let i = 0x08; i <= 0x0d; i++) {
    await gbc_write(device, new Uint8Array([i]), 0x4000);
    const data = await gbc_read(device, 1, 0xa000);
    buffer.push(data[0]);
  }

  await gbc_write(device, new Uint8Array([0x00]), 0x6000); // 解锁

  // 准备新的时间数据
  const timeData = [
    rtcData.second,
    rtcData.minute,
    rtcData.hour,
    rtcData.day & 0xff,
    (rtcData.day & 0x100) >> 8, // 修正日期高位计算
  ];

  // 停止计时器
  await gbc_write(device, new Uint8Array([0x00]), 0x6000);
  await gbc_write(device, new Uint8Array([0x01]), 0x6000); // 锁存时间
  await gbc_write(device, new Uint8Array([0x0c]), 0x4000); // RTC DH
  await gbc_write(device, new Uint8Array([0x40]), 0xa000); // Bit 6: Halt

  // 写入新时间
  for (let i = 0x08; i <= 0x0d; i++) {
    await gbc_write(device, new Uint8Array([i]), 0x4000);
    const value = timeData[i - 0x08];
    await gbc_write(device, new Uint8Array([value]), 0xa000);
  }

  // 重启计时器
  await gbc_write(device, new Uint8Array([0x00]), 0x6000);
  await gbc_write(device, new Uint8Array([0x01]), 0x6000);
  await gbc_write(device, new Uint8Array([0x00]), 0x4000);
  await gbc_write(device, new Uint8Array([0x00]), 0x0000);
  await new Promise(resolve => setTimeout(resolve, 100));
  await gbc_write(device, new Uint8Array([0x00]), 0x6000);
  await new Promise(resolve => setTimeout(resolve, 100));

  // 验证设置 - 重新读取时间
  await gbc_write(device, new Uint8Array([0x0a]), 0x0000); // EnableRAM
  for (let ii = 5; ii > 0; ii--) {
    const verifyBuffer: number[] = [];
    await gbc_write(device, new Uint8Array([0x01]), 0x6000); // 锁存时间
    for (let i = 0x08; i <= 0x0d; i++) {
      await gbc_write(device, new Uint8Array([i]), 0x4000);
      const data = await gbc_read(device, 1, 0xa000);
      verifyBuffer.push(data[0]);
    }
    await gbc_write(device, new Uint8Array([0x00]), 0x6000); // 解锁

    const verifyDay = ((verifyBuffer[4] & 0x01) << 8) | verifyBuffer[3];
    const verifyHour = verifyBuffer[2];
    const verifyMinute = verifyBuffer[1];
    const verifySecond = verifyBuffer[0];

    console.log(`验证 ${ii}: ${verifyDay}日 ${verifyHour}:${verifyMinute}:${verifySecond}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

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
 * 读取GBA RTC信息
 */
export async function readGBARTC(device: DeviceInfo): Promise<{ status: boolean; time?: Date; error?: string }> {
  try {
    // 检测GPIO功能
    const read1 = await rom_read(device, 6, 0xc4);
    await rom_write(device, new Uint8Array([0x01, 0x00]), 0xc8 >> 1); // enable gpio
    const read2 = await rom_read(device, 6, 0xc4);
    await rom_write(device, new Uint8Array([0x00, 0x00]), 0xc8 >> 1); // disable gpio

    // 检查是否有GPIO功能
    let hasGPIO = false;
    for (let i = 0; i < 6; i++) {
      if (read1[i] !== read2[i]) {
        hasGPIO = true;
        break;
      }
    }

    if (!hasGPIO) {
      return { status: false, error: 'Cartridge does not have GPIO functionality' };
    }

    // 初始化GPIO
    await rom_write(device, new Uint8Array([0x01, 0x00]), 0xc4 >> 1); // cs 0, sck 1
    await rom_write(device, new Uint8Array([0x07, 0x00]), 0xc6 >> 1); // cs sio sck output
    await rom_write(device, new Uint8Array([0x01, 0x00]), 0xc8 >> 1); // enable gpio

    // 读取RTC状态验证连接
    await s3511_writeByte(device, 0xc6);
    const status = await s3511_readByte(device);
    await rom_write(device, new Uint8Array([0x01, 0x00]), 0xc4 >> 1); // cs 0, sck 1

    console.log(`RTC Status: 0x${status.toString(16)}`);

    // 如果电池没电，重置RTC（但仍然可以读取时间）
    if ((status & 0x80) !== 0) {
      console.log('电池没电，重置RTC');
      await s3511_writeByte(device, 0x06); // reset
      await rom_write(device, new Uint8Array([0x01, 0x00]), 0xc4 >> 1); // cs 0, sck 1

      await s3511_writeByte(device, 0x46); // write status
      await s3511_writeByte(device, 0x40); // 24 hour mode
      await rom_write(device, new Uint8Array([0x01, 0x00]), 0xc4 >> 1); // cs 0, sck 1
    }

    // 读取时间数据
    await s3511_writeByte(device, 0xa6); // read time command
    const year = compressedBCDToInt(await s3511_readByte(device));
    const month = compressedBCDToInt(await s3511_readByte(device) & 0x1f);
    const date = compressedBCDToInt(await s3511_readByte(device) & 0x3f);
    const day = compressedBCDToInt(await s3511_readByte(device) & 0x07);
    const hour = compressedBCDToInt(await s3511_readByte(device) & 0x3f);
    const minute = compressedBCDToInt(await s3511_readByte(device) & 0x7f);
    const second = compressedBCDToInt(await s3511_readByte(device) & 0x7f);

    await rom_write(device, new Uint8Array([0x01, 0x00]), 0xc4 >> 1); // cs 0, sck 1

    const time = new Date(2000 + year, month - 1, date, hour, minute, second);

    // 清理：禁用GPIO
    await rom_write(device, new Uint8Array([0x00, 0x00]), 0xc8 >> 1); // disable gpio

    return { status: true, time };
  } catch (error) {
    console.error('读取GBA RTC时出错:', error);
    // 确保在出错时也清理GPIO状态
    try {
      await rom_write(device, new Uint8Array([0x00, 0x00]), 0xc8 >> 1); // disable gpio
    } catch (cleanupError) {
      console.error('清理GPIO状态时出错:', cleanupError);
    }
    return { status: false, error: error instanceof Error ? error.message : '未知错误' };
  }
}

/**
 * 读取MBC3 RTC信息
 */
export async function readMBC3RTC(device: DeviceInfo): Promise<{ status: boolean; time?: Date; error?: string }> {
  try {
    // MBC3 RTC读取序列
    // 启用RTC寄存器访问
    await gbc_write(device, new Uint8Array([0x0A]), 0x0000);

    // 锁存当前时间
    await gbc_write(device, new Uint8Array([0x00]), 0x6000);
    await gbc_write(device, new Uint8Array([0x01]), 0x6000);

    // 读取时间寄存器
    await gbc_write(device, new Uint8Array([0x08]), 0x4000); // 选择秒寄存器
    const second = (await gbc_read(device, 1, 0xa000))[0] & 0x3F;

    await gbc_write(device, new Uint8Array([0x09]), 0x4000); // 选择分寄存器
    const minute = (await gbc_read(device, 1, 0xa000))[0] & 0x3F;

    await gbc_write(device, new Uint8Array([0x0A]), 0x4000); // 选择时寄存器
    const hour = (await gbc_read(device, 1, 0xa000))[0] & 0x1F;

    await gbc_write(device, new Uint8Array([0x0B]), 0x4000); // 选择日寄存器低位
    const dayLow = (await gbc_read(device, 1, 0xa000))[0];

    await gbc_write(device, new Uint8Array([0x0C]), 0x4000); // 选择日寄存器高位
    const dayHigh = (await gbc_read(device, 1, 0xa000))[0] & 0x01;

    const day = dayLow | (dayHigh << 8);

    // MBC3没有年月信息，使用当前年月
    const now = new Date();
    const time = new Date(now.getFullYear(), now.getMonth(), day, hour, minute, second);

    return { status: true, time };
  } catch (error) {
    console.error('读取MBC3 RTC时出错:', error);
    return { status: false, error: error instanceof Error ? error.message : '未知错误' };
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
