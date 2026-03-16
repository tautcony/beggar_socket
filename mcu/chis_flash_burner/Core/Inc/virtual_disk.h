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
uint32_t virtual_disk_get_text_view_size(Fat16ViewId view_id);
bool virtual_disk_get_ram_import_debug(uint32_t *active,
                                       uint32_t *valid,
                                       uint32_t *first_cluster,
                                       uint32_t *cluster_count,
                                       uint32_t *file_size,
                                       uint32_t *candidate_count,
                                       uint32_t *ram_dir_write_count,
                                       uint32_t *fat_write_count,
                                       uint32_t *last_fat_cluster,
                                       uint32_t *last_fat_value);
void virtual_disk_note_medium_change(void);
bool virtual_disk_consume_medium_change(void);

#ifdef __cplusplus
}
#endif

#endif
