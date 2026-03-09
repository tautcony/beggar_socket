#include "usbd_msc_scaffold.h"

#include "virtual_disk.h"

#define USBD_MSC_SCAFFOLD_LUN_COUNT 1U

static int8_t usbd_msc_scaffold_init(uint8_t lun)
{
    (void)lun;
    return 0;
}

static int8_t usbd_msc_scaffold_get_capacity(uint8_t lun, uint32_t *block_num, uint16_t *block_size)
{
    (void)lun;
    if (block_num == 0 || block_size == 0) {
        return -1;
    }

    *block_num = virtual_disk_get_block_count();
    *block_size = virtual_disk_get_block_size();
    return 0;
}

static int8_t usbd_msc_scaffold_is_ready(uint8_t lun)
{
    (void)lun;
    return 0;
}

static int8_t usbd_msc_scaffold_is_write_protected(uint8_t lun)
{
    (void)lun;
    return 0;
}

static int8_t usbd_msc_scaffold_read(uint8_t lun, uint8_t *buf, uint32_t blk_addr, uint16_t blk_len)
{
    (void)lun;
    return virtual_disk_read(blk_addr, buf, blk_len) ? 0 : -1;
}

static int8_t usbd_msc_scaffold_write(uint8_t lun, uint8_t *buf, uint32_t blk_addr, uint16_t blk_len)
{
    (void)lun;
    return virtual_disk_write(blk_addr, buf, blk_len) ? 0 : -1;
}

static int8_t usbd_msc_scaffold_get_max_lun(void)
{
    return (int8_t)(USBD_MSC_SCAFFOLD_LUN_COUNT - 1U);
}

static int8_t usbd_msc_scaffold_inquiry_data[] = {
    0x00, 0x80, 0x02, 0x02, (STANDARD_INQUIRY_DATA_LEN - 5), 0x00, 0x00, 0x00,
    'C',  'N',  'Y',  ' ',  ' ',                        ' ',  ' ',  ' ',
    'B',  'e',  'g',  'g',  'a',                        'r',  ' ',  'S',
    'o',  'c',  'k',  'e',  't',                        ' ',  ' ',  ' ',
    '0',  '.',  '1',  '0',
};

USBD_StorageTypeDef USBD_MSC_Scaffold_fops = {
    usbd_msc_scaffold_init,            usbd_msc_scaffold_get_capacity, usbd_msc_scaffold_is_ready,
    usbd_msc_scaffold_is_write_protected, usbd_msc_scaffold_read,      usbd_msc_scaffold_write,
    usbd_msc_scaffold_get_max_lun,     usbd_msc_scaffold_inquiry_data,
};
