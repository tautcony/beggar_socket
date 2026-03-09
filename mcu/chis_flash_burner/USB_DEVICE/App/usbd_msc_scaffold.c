#include "usbd_msc_scaffold.h"

#include "virtual_disk.h"

int8_t usbd_msc_scaffold_get_capacity(uint32_t *block_num, uint16_t *block_size)
{
    if (block_num == 0 || block_size == 0) {
        return -1;
    }

    *block_num = virtual_disk_get_block_count();
    *block_size = virtual_disk_get_block_size();
    return 0;
}

int8_t usbd_msc_scaffold_is_ready(void)
{
    return 0;
}

int8_t usbd_msc_scaffold_is_write_protected(void)
{
    return 1;
}

int8_t usbd_msc_scaffold_read(uint8_t *buf, uint32_t blk_addr, uint16_t blk_len)
{
    return virtual_disk_read(blk_addr, buf, blk_len) ? 0 : -1;
}

int8_t usbd_msc_scaffold_write(uint8_t *buf, uint32_t blk_addr, uint16_t blk_len)
{
    (void)buf;
    (void)blk_addr;
    (void)blk_len;
    return -1;
}
