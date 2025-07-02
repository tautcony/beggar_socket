/**
 * 设备版本信息
 */
export interface DeviceVersionInfo {
  /** 主版本号 */
  majorVersion: number;
  /** 次版本号 */
  minorVersion: number;
  /** 补丁号 */
  patchVersion: number;
  /** 构建号 */
  buildNumber: number;
  /** 时间戳 */
  timestamp: number;
  /** 版本类型 (0: Bootloader, 1: Application) */
  versionType: number;
  /** 版本字符串 */
  versionString: string;
}

/**
 * 固件升级状态
 */
export enum FirmwareUpgradeStatus {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  READING_VERSION = 'reading_version',
  PREPARING = 'preparing',
  ERASING = 'erasing',
  PROGRAMMING = 'programming',
  VERIFYING = 'verifying',
  FINISHING = 'finishing',
  SUCCESS = 'success',
  ERROR = 'error',
}

/**
 * 固件升级进度信息
 */
export interface FirmwareUpgradeProgress {
  status: FirmwareUpgradeStatus;
  progress: number; // 0-100
  message: string;
  error?: string;
}
