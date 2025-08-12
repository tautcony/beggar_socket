/**
 * 通用的数值格式化函数
 * @param value - 要格式化的数值
 * @param sizes - 单位数组
 * @param baseUnit - 基础单位（用于零值显示）
 * @returns - 格式化后的字符串
 */
function formatWithUnits(value: number, sizes: string[], baseUnit: string): string {
  if (value === 0 || typeof value !== 'number') return `0 ${baseUnit}`;
  const k = 1024;
  const i = Math.min(Math.floor(Math.log(value) / Math.log(k)), sizes.length - 1);
  const scaledValue = value / Math.pow(k, i);
  const valueStr = Number.isInteger(scaledValue) ? scaledValue.toString() : scaledValue.toFixed(1);
  return `${valueStr} ${sizes[i]}`;
}

/**
 * 格式化字节数为易读的字符串
 * @param bytes - 字节数
 * @description 格式化字节数为易读的字符串
 * @example
 * formatBytes(1024) // "1.0 KB"
 * formatBytes(1048576) // "1.0 MB"
 * formatBytes(0) // "0 B"
 * @returns - 格式化后的字符串
 */
export function formatBytes(bytes: number): string {
  return formatWithUnits(bytes, ['B', 'KiB', 'MiB', 'GiB'], 'B');
}

/**
 * 格式化速度为易读的字符串
 * @param speed - 速度 (B/s)
 * @description 将速度格式化为 B/s 或 KiB/s 或 MiB/s
 * @example
 * formatSpeed(1024 * 1024) // "1.0 MiB/s"
 * formatSpeed(512) // "512 B/s"
 * formatSpeed(0) // "0 B/s"
 * @returns - 格式化后的字符串
 */
export function formatSpeed(speed: number): string {
  return formatWithUnits(speed, ['B/s', 'KiB/s', 'MiB/s', 'GiB/s'], 'B/s');
}

/**
 * 格式化时间为 MM:SS 或 MM:SS.D 格式
 * @param value - 时间数值
 * @param unit - 时间单位，'s' 表示秒，'ms' 表示毫秒，默认为 's'
 * @param showMilliseconds - 是否显示毫秒（以100ms为最小单位，显示为0.1秒），默认为 false
 * @description 将时间格式化为 MM:SS 格式或 MM:SS.D 格式（包含十分之一秒）
 * @example
 * formatTimeClock(90) // "01:30"
 * formatTimeClock(90.15, 's', true) // "01:30.1"
 * formatTimeClock(1500, 'ms') // "00:01"
 * formatTimeClock(1550, 'ms', true) // "00:01.5"
 * formatTimeClock(0) // "00:00"
 * formatTimeClock(0, 's', true) // "00:00.0"
 * @returns - 格式化后的字符串
 */
export function formatTimeClock(value: number, unit: 's' | 'ms' = 's', showMilliseconds = false): string {
  let totalMs: number;

  // 转换为毫秒
  if (unit === 'ms') {
    totalMs = value;
  } else {
    totalMs = value * 1000;
  }

  // 如果值为0，根据是否显示毫秒返回相应格式
  if (totalMs <= 0) {
    return showMilliseconds ? '00:00.0' : '00:00';
  }

  const totalSeconds = Math.floor(totalMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const remainingMs = totalMs % 1000;
  const decisecond = Math.floor(remainingMs / 100); // 以100ms为单位，得到0-9的数字

  const baseTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  if (showMilliseconds) {
    return `${baseTime}.${decisecond}`;
  }

  return baseTime;
}

/**
 * 格式化时间为人类可读的字符串
 * @param seconds - 秒数
 * @description 格式化时间为易读的格式：ms、s、m s
 * @example
 * formatTimeDuration(0.5) // "500ms"
 * formatTimeDuration(30) // "30s"
 * formatTimeDuration(135) // "2m 15s"
 * @returns - 格式化后的字符串
 */
export function formatTimeDuration(seconds: number): string {
  if (seconds < 1) {
    return `${(seconds * 1000).toFixed(0)}ms`;
  } else if (seconds < 60) {
    return `${seconds.toFixed(0)}s`;
  } else {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  }
}

export function formatHex(value: number, byteLength: 1 | 2 | 3 | 4 | 6) {
  if (typeof value !== 'number' || byteLength <= 0) {
    throw new Error('Invalid input for formatHex');
  }

  // 处理负数：使用无符号右移操作或Math.abs
  const unsignedValue = value < 0 ? (value >>> 0) : value;
  const hexString = unsignedValue.toString(16).toUpperCase().padStart(byteLength * 2, '0');
  return `0x${hexString}`;
};
