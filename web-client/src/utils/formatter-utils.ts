
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
  if (bytes === 0) return '0 B';
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
  if (speed === 0) return '0 KB/s';
  if (speed >= 1024) {
    return (speed / 1024).toFixed(1) + ' MB/s';
  }
  return speed.toFixed(1) + ' KB/s';
}

/**
 * 格式化时间为 MM:SS
 * @param seconds - 秒数
 * @description 将秒数格式化为 MM:SS 格式
 * @example
 * formatTime(90) // "01:30"
 * formatTime(0) // "00:00"
 * @returns - 格式化后的字符串
 */
export function formatTime(seconds: number): string {
  if (seconds === 0) return '00:00';
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
