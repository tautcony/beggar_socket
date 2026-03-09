#ifndef __USBD_MSC_SCAFFOLD_H__
#define __USBD_MSC_SCAFFOLD_H__

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

int8_t usbd_msc_scaffold_get_capacity(uint32_t *block_num, uint16_t *block_size);
int8_t usbd_msc_scaffold_is_ready(void);
int8_t usbd_msc_scaffold_is_write_protected(void);
int8_t usbd_msc_scaffold_read(uint8_t *buf, uint32_t blk_addr, uint16_t blk_len);
int8_t usbd_msc_scaffold_write(uint8_t *buf, uint32_t blk_addr, uint16_t blk_len);

#ifdef __cplusplus
}
#endif

#endif
