export enum GBACommand {
  READ_ID = 0xf0,
  ERASE_CHIP = 0xf1,
  BLOCK_ERASE = 0xf2,
  SECTOR_ERASE = 0xf3,
  PROGRAM = 0xf4,
  DIRECT_WRITE = 0xf5,
  READ = 0xf6,
  RAM_WRITE = 0xf7,
  RAM_READ = 0xf8,
  RAM_WRITE_TO_FLASH = 0xf9,
}

export enum GBCCommand {
  DIRECT_WRITE = 0xfa,
  READ = 0xfb,
  ROM_PROGRAM = 0xfc,
}

// IAP系统升级命令
export enum IAPCommand {
  IAP_CMD = 0xff,
}

// IAP子命令
export enum IAPSubCommand {
  GET_VERSION_INFO = 0x00,
  RESTART_TO_BOOTLOADER = 0xff,
}

// Bootloader子命令
export enum BootloaderSubCommand {
  GET_VERSION_INFO = 0x00,
  ERASE_FLASH = 0x01,
  PROGRAM_FLASH = 0x02,
  START_UPGRADE = 0x10,
  UPGRADE_DATA = 0x11,
  FINISH_UPGRADE = 0x12,
  JUMP_TO_APP = 0xff,
}

// 版本类型
export enum VersionType {
  BOOTLOADER = 0,
  APPLICATION = 1,
}

// Bootloader错误码
export enum BootloaderError {
  INVALID_PARAM = 0x01,
  BUFFER_FULL = 0x02,
  CRC_ERROR = 0x03,
  UNSUPPORTED_COMMAND = 0x04,
  SIZE_MISMATCH = 0x05,
}
