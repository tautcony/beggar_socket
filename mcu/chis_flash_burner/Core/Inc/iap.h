#ifndef __IAP_H_
#define __IAP_H_

#include <stdint.h>
#include "stm32f1xx_hal.h"

/* IAP 相关定义 */
#define IAP_FLASH_BASE_ADDR         0x08000000  /* Flash 基地址 */
#define IAP_FLASH_SIZE              (64 * 1024) /* 64KB Flash */
#define IAP_PAGE_SIZE               0x400       /* 1KB per page */

/* BootLoader 区域 (前20KB) */
#define IAP_BOOTLOADER_BASE_ADDR    0x08000000
#define IAP_BOOTLOADER_SIZE         (20 * 1024)

/* Application 区域 (后44KB) */
#define IAP_APPLICATION_BASE_ADDR   0x08005000
#define IAP_APPLICATION_SIZE        (44 * 1024)

/* IAP 标志存储地址 (在 RAM 中) */
#define IAP_FLAG_ADDR               0x20004000  /* RAM 末尾预留区域 */
#define IAP_FLAG_VALUE              0x12345678  /* IAP 升级标志值 */

/* IAP 状态枚举 */
typedef enum {
    IAP_OK = 0,
    IAP_ERROR_FLASH_ERASE,
    IAP_ERROR_FLASH_WRITE,
    IAP_ERROR_FLASH_VERIFY,
    IAP_ERROR_INVALID_ADDR,
    IAP_ERROR_INVALID_SIZE,
    IAP_ERROR_CRC_FAIL
} iap_status_t;

/* IAP 升级信息结构体 */
typedef struct {
    uint32_t app_size;          /* 应用程序大小 */
    uint32_t app_crc;           /* 应用程序 CRC32 校验值 */
    uint32_t packet_size;       /* 数据包大小 */
    uint32_t total_packets;     /* 总数据包数量 */
    uint32_t current_packet;    /* 当前数据包编号 */
} iap_upgrade_info_t;

/* IAP 功能函数 */
iap_status_t iap_flash_erase(uint32_t start_addr, uint32_t size);
iap_status_t iap_flash_write(uint32_t addr, uint8_t *data, uint32_t size);
iap_status_t iap_flash_read(uint32_t addr, uint8_t *data, uint32_t size);
uint8_t iap_flash_verify(uint32_t addr, uint8_t *data, uint32_t size);

void iap_set_upgrade_flag(void);
uint8_t iap_check_upgrade_flag(void);
void iap_clear_upgrade_flag(void);

void iap_jump_to_app(void);
uint8_t iap_check_app_valid(void);

/* IAP 升级流程函数 */
void iap_upgrade_start(uint32_t app_size, uint32_t app_crc);
iap_status_t iap_upgrade_data(uint32_t packet_num, uint8_t *data, uint32_t size);
iap_status_t iap_upgrade_finish(void);

/* CRC32 计算函数 */
uint32_t iap_crc32(uint8_t *data, uint32_t size);

#endif /* __IAP_H_ */
