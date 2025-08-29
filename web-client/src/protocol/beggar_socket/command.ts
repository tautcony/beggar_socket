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

export type Command = GBACommand | GBCCommand;
