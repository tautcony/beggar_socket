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
  if (bytes === 0 || typeof bytes !== 'number') return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

/**
 * 格式化速度为易读的字符串
 * @param speed - 速度 (KB/s)
 * @description 将速度格式化为 KB/s 或 MB/s
 * @example
 * formatSpeed(1024) // "1.0 MB/s"
 * formatSpeed(512) // "512.0 KB/s"
 * formatSpeed(0) // "0 KB/s"
 * @returns - 格式化后的字符串
 */
export function formatSpeed(speed: number): string {
  if (speed === 0 || typeof speed !== 'number') return '0 KB/s';
  if (speed >= 1024) {
    return (speed / 1024).toFixed(1) + ' MB/s';
  }
  return speed.toFixed(1) + ' KB/s';
}

/**
 * 格式化时间为 MM:SS 或 MM:SS.D 格式
 * @param value - 时间数值
 * @param unit - 时间单位，'s' 表示秒，'ms' 表示毫秒，默认为 's'
 * @param showMilliseconds - 是否显示毫秒（以100ms为最小单位，显示为0.1秒），默认为 false
 * @description 将时间格式化为 MM:SS 格式或 MM:SS.D 格式（包含十分之一秒）
 * @example
 * formatTime(90) // "01:30"
 * formatTime(90.15, 's', true) // "01:30.1"
 * formatTime(1500, 'ms') // "00:01"
 * formatTime(1550, 'ms', true) // "00:01.5"
 * formatTime(0) // "00:00"
 * formatTime(0, 's', true) // "00:00.0"
 * @returns - 格式化后的字符串
 */
export function formatTime(value: number, unit: 's' | 'ms' = 's', showMilliseconds = false): string {
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

export function formatHex(value: number, byteLength: 1 | 2 | 3 | 4 | 6) {
  if (typeof value !== 'number' || byteLength <= 0) {
    throw new Error('Invalid input for formatHex');
  }

  const hexString = value.toString(16).toUpperCase().padStart(byteLength * 2, '0');
  return `0x${hexString}`;
};
