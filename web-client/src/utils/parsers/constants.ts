/**
 * ROM Header 偏移量常量
 * 供 rom-parser.ts 和 rom-editor.ts 共用
 */

// --- GBA ROM Header 偏移量 ---
export const GBA_HEADER = {
  /** Nintendo Logo 起始偏移 */
  LOGO_OFFSET: 0x04,
  /** 标题起始偏移 (12 bytes) */
  TITLE_OFFSET: 0xa0,
  /** 标题结束偏移（不含） */
  TITLE_END: 0xac,
  /** 游戏代码起始偏移 (4 bytes) */
  GAME_CODE_OFFSET: 0xac,
  /** 游戏代码结束偏移（不含） */
  GAME_CODE_END: 0xb0,
  /** 制造商代码起始偏移 (2 bytes) */
  MAKER_CODE_OFFSET: 0xb0,
  /** 制造商代码结束偏移（不含） */
  MAKER_CODE_END: 0xb2,
  /** 固定签名字节偏移 (0x96) */
  FIXED_BYTE_OFFSET: 0xb2,
  /** 固定签名字节值 */
  FIXED_BYTE_VALUE: 0x96,
  /** 版本号偏移 */
  VERSION_OFFSET: 0xbc,
  /** 头部校验和偏移 */
  CHECKSUM_OFFSET: 0xbd,
  /** 最小有效 ROM 大小 */
  MIN_VALID_SIZE: 0xc0,
  /** 校验和计算起始偏移 */
  CHECKSUM_START: 0xa0,
  /** 校验和计算结束偏移 */
  CHECKSUM_END: 0xbc,
} as const;

// --- GB/GBC ROM Header 偏移量 ---
export const GB_HEADER = {
  /** Nintendo Logo 起始偏移 */
  LOGO_OFFSET: 0x104,
  /** 标题起始偏移 (最多 16 bytes) */
  TITLE_OFFSET: 0x134,
  /** 标题结束偏移（CGB 模式） / CGB 标志偏移 */
  TITLE_END: 0x143,
  /** CGB 标志偏移 */
  CGB_FLAG_OFFSET: 0x143,
  /** 制造商代码起始偏移 (新格式, 4 bytes) */
  MAKER_CODE_OFFSET: 0x13f,
  /** 制造商代码结束偏移（不含） */
  MAKER_CODE_END: 0x143,
  /** 许可证代码高字节偏移 */
  LICENSE_HIGH_OFFSET: 0x144,
  /** 许可证代码低字节偏移 */
  LICENSE_LOW_OFFSET: 0x145,
  /** SGB 标志偏移 */
  SGB_FLAG_OFFSET: 0x146,
  /** 卡带类型偏移 */
  CART_TYPE_OFFSET: 0x147,
  /** ROM 大小代码偏移 */
  ROM_SIZE_OFFSET: 0x148,
  /** RAM 大小代码偏移 */
  RAM_SIZE_OFFSET: 0x149,
  /** 区域代码偏移 */
  REGION_OFFSET: 0x14a,
  /** 版本号偏移 */
  VERSION_OFFSET: 0x14c,
  /** 头部校验和偏移 */
  HEADER_CHECKSUM_OFFSET: 0x14d,
  /** 全局校验和高字节偏移 */
  GLOBAL_CHECKSUM_HIGH: 0x14e,
  /** 全局校验和低字节偏移 */
  GLOBAL_CHECKSUM_LOW: 0x14f,
  /** 最小有效 ROM 大小 */
  MIN_VALID_SIZE: 0x150,
  /** 头部校验和计算起始偏移 */
  CHECKSUM_START: 0x134,
  /** 头部校验和计算结束偏移 */
  CHECKSUM_END: 0x14c,
} as const;
