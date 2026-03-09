#ifndef __VIRTUAL_DISK_H__
#define __VIRTUAL_DISK_H__

#include <stdbool.h>
#include <stdint.h>

#include "fat16_layout.h"

#ifdef __cplusplus
extern "C" {
#endif

bool virtual_disk_read(uint32_t lba, uint8_t *buf, uint32_t block_count);
bool virtual_disk_write(uint32_t lba, const uint8_t *buf, uint32_t block_count);
uint32_t virtual_disk_get_block_count(void);
uint16_t virtual_disk_get_block_size(void);

#ifdef __cplusplus
}
#endif

#endif
