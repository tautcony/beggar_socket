/**
 * 协议层共享常量
 * Flash 命令字节、地址和协议 ACK 字节
 */

// --- Flash 命令字节 ---
/** Flash 解锁序列第一步命令字节 */
export const FLASH_CMD_UNLOCK_1 = 0xaa;
/** Flash 解锁序列第二步命令字节 */
export const FLASH_CMD_UNLOCK_2 = 0x55;
/** Flash 进入 Autoselect 模式命令 */
export const FLASH_CMD_AUTOSELECT = 0x90;
/** Flash 退出 Autoselect 模式命令 */
export const FLASH_CMD_RESET = 0xf0;
/** Flash 擦除准备命令 */
export const FLASH_CMD_ERASE_SETUP = 0x80;
/** Flash 扇区擦除命令 */
export const FLASH_CMD_SECTOR_ERASE = 0x30;
/** Flash 全片擦除命令 */
export const FLASH_CMD_CHIP_ERASE = 0x10;

// --- GBA Flash 地址（16-bit 字模式） ---
/** GBA Flash 解锁地址 1 */
export const GBA_FLASH_ADDR_1 = 0x555;
/** GBA Flash 解锁地址 2 */
export const GBA_FLASH_ADDR_2 = 0x2aa;

// --- GBA RAM Flash 地址（8-bit 字节模式） ---
/** GBA RAM Flash 解锁地址 1 */
export const GBA_RAM_FLASH_ADDR_1 = 0x5555;
/** GBA RAM Flash 解锁地址 2 */
export const GBA_RAM_FLASH_ADDR_2 = 0x2aaa;

// --- GBC Flash 地址（8-bit 字节模式） ---
/** GBC Flash 解锁地址 1 */
export const GBC_FLASH_ADDR_1 = 0xaaa;
/** GBC Flash 解锁地址 2 */
export const GBC_FLASH_ADDR_2 = 0x555;

// --- 协议 ACK ---
/** 协议应答字节 */
export const PROTOCOL_ACK = 0xaa;
