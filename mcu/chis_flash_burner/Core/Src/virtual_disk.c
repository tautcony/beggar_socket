#include "virtual_disk.h"

#include <stdio.h>
#include <string.h>

typedef struct __attribute__((packed)) {
    uint8_t name[11];
    uint8_t attr;
    uint8_t nt_reserved;
    uint8_t creation_time_tenths;
    uint16_t creation_time;
    uint16_t creation_date;
    uint16_t access_date;
    uint16_t first_cluster_hi;
    uint16_t write_time;
    uint16_t write_date;
    uint16_t first_cluster_lo;
    uint32_t size;
} Fat16DirEntry;

static void fill_entry(Fat16DirEntry *entry,
                       const char name[11],
                       uint8_t attr,
                       uint16_t first_cluster,
                       uint32_t size)
{
    memset(entry, 0, sizeof(*entry));
    memcpy(entry->name, name, 11u);
    entry->attr = attr;
    entry->first_cluster_lo = first_cluster;
    entry->size = size;
}

static void render_text(uint8_t *buf, const char *text)
{
    memset(buf, 0, FAT16_SECTOR_SIZE);
    if (text != NULL) {
        snprintf((char *)buf, FAT16_SECTOR_SIZE, "%s", text);
    }
}

static bool read_directory_view(Fat16ViewId view_id, uint8_t *buf)
{
    Fat16DirEntry *entries = (Fat16DirEntry *)buf;

    memset(buf, 0, FAT16_SECTOR_SIZE);

    switch (view_id) {
        case FAT16_VIEW_ROM_DIR:
            fill_entry(&entries[0], "CURRENT  GBA", 0x01u, FAT16_CLUSTER_ROM_CURRENT_GBA_START,
                       CART_SERVICE_ROM_SIZE_BYTES);
            fill_entry(&entries[1], "MODE       ", 0x10u, FAT16_CLUSTER_ROM_MODE_DIR, 0u);
            return true;
        case FAT16_VIEW_RAM_DIR:
            fill_entry(&entries[0], "CURRENT  SAV", 0x01u, FAT16_CLUSTER_RAM_CURRENT_SAV_START,
                       CART_SERVICE_SAVE_SIZE_BYTES);
            fill_entry(&entries[1], "TYPE       ", 0x10u, FAT16_CLUSTER_RAM_TYPE_DIR, 0u);
            return true;
        case FAT16_VIEW_ROM_MODE_DIR:
            fill_entry(&entries[0], "READ    TXT", 0x01u, FAT16_CLUSTER_ROM_MODE_READ_TXT, FAT16_SECTOR_SIZE);
            return true;
        case FAT16_VIEW_RAM_TYPE_DIR:
            fill_entry(&entries[0], "AUTO    TXT", 0x01u, FAT16_CLUSTER_RAM_TYPE_AUTO_TXT, FAT16_SECTOR_SIZE);
            fill_entry(&entries[1], "SRAM    TXT", 0x01u, FAT16_CLUSTER_RAM_TYPE_SRAM_TXT, FAT16_SECTOR_SIZE);
            fill_entry(&entries[2], "FRAM    TXT", 0x01u, FAT16_CLUSTER_RAM_TYPE_FRAM_TXT, FAT16_SECTOR_SIZE);
            fill_entry(&entries[3], "FLASH64 TXT", 0x01u, FAT16_CLUSTER_RAM_TYPE_FLASH64_TXT, FAT16_SECTOR_SIZE);
            fill_entry(&entries[4], "FLASH128TXT", 0x01u, FAT16_CLUSTER_RAM_TYPE_FLASH128_TXT,
                       FAT16_SECTOR_SIZE);
            return true;
        default:
            return false;
    }
}

static bool read_text_view(Fat16ViewId view_id, uint8_t *buf)
{
    switch (view_id) {
        case FAT16_VIEW_INFO_TXT:
            render_text(buf,
                        "DEVICE=BEGGAR_SOCKET\r\n"
                        "FS=FAT16\r\n"
                        "MODE=READ_ONLY_STAGE_1\r\n"
                        "ROM_SIZE=8388608\r\n"
                        "SAVE_SIZE=32768\r\n");
            return true;
        case FAT16_VIEW_STATUS_TXT:
            render_text(buf,
                        "STATE=IDLE\r\n"
                        "USB_MODE=MSC_SCAFFOLD\r\n"
                        "ROM_VIEW=READY\r\n"
                        "SAVE_VIEW=READY\r\n");
            return true;
        case FAT16_VIEW_ROM_MODE_READ_TXT:
            render_text(buf, "NAME=READ\r\nSELECTED=1\r\nDESC=Read-only ROM export mode\r\n");
            return true;
        case FAT16_VIEW_RAM_TYPE_AUTO_TXT:
            render_text(buf, "NAME=AUTO\r\nSELECTED=1\r\nDESC=Auto-detect in later phases\r\n");
            return true;
        case FAT16_VIEW_RAM_TYPE_SRAM_TXT:
            render_text(buf, "NAME=SRAM\r\nSELECTED=0\r\nDESC=Static RAM save mode\r\n");
            return true;
        case FAT16_VIEW_RAM_TYPE_FRAM_TXT:
            render_text(buf, "NAME=FRAM\r\nSELECTED=0\r\nDESC=FRAM save mode\r\n");
            return true;
        case FAT16_VIEW_RAM_TYPE_FLASH64_TXT:
            render_text(buf, "NAME=FLASH64\r\nSELECTED=0\r\nDESC=64K flash save mode\r\n");
            return true;
        case FAT16_VIEW_RAM_TYPE_FLASH128_TXT:
            render_text(buf, "NAME=FLASH128\r\nSELECTED=0\r\nDESC=128K flash save mode\r\n");
            return true;
        default:
            return false;
    }
}

static bool read_data_view(const Fat16ViewInfo *view, uint32_t cluster_offset, uint8_t *buf)
{
    uint32_t file_offset = cluster_offset * FAT16_SECTOR_SIZE;

    switch (view->view_id) {
        case FAT16_VIEW_ROM_CURRENT_GBA:
            return cart_service_read_rom(file_offset, buf, FAT16_SECTOR_SIZE);
        case FAT16_VIEW_RAM_CURRENT_SAV:
            return cart_service_read_save(file_offset, buf, FAT16_SECTOR_SIZE);
        default:
            return false;
    }
}

static bool read_data_sector(uint32_t lba, uint8_t *buf)
{
    Fat16ViewInfo view;
    uint16_t cluster = 0u;
    uint32_t sector_in_cluster = 0u;
    uint32_t cluster_offset = 0u;

    if (!fat16_layout_cluster_from_lba(lba, &cluster, &sector_in_cluster) || sector_in_cluster != 0u) {
        return false;
    }

    if (!fat16_layout_get_view(cluster, &view, &cluster_offset)) {
        return false;
    }

    if (view.is_directory) {
        return read_directory_view(view.view_id, buf);
    }

    if ((view.view_id >= FAT16_VIEW_INFO_TXT) && (view.view_id <= FAT16_VIEW_RAM_TYPE_FLASH128_TXT)) {
        if (read_text_view(view.view_id, buf)) {
            return true;
        }
    }

    return read_data_view(&view, cluster_offset, buf);
}

bool virtual_disk_read(uint32_t lba, uint8_t *buf, uint32_t block_count)
{
    if (buf == NULL) {
        return false;
    }

    for (uint32_t block = 0u; block < block_count; ++block) {
        uint32_t current_lba = lba + block;
        uint8_t *current_buf = buf + (block * FAT16_SECTOR_SIZE);

        if (current_lba == 0u) {
            if (!fat16_layout_read_boot_sector(current_buf)) {
                return false;
            }
            continue;
        }

        if (current_lba < (FAT16_RESERVED_SECTORS + FAT16_FAT_SECTORS)) {
            if (!fat16_layout_read_fat_sector(0u, current_lba - FAT16_RESERVED_SECTORS, current_buf)) {
                return false;
            }
            continue;
        }

        if (current_lba < (FAT16_RESERVED_SECTORS + (2u * FAT16_FAT_SECTORS))) {
            if (!fat16_layout_read_fat_sector(
                    1u, current_lba - FAT16_RESERVED_SECTORS - FAT16_FAT_SECTORS, current_buf)) {
                return false;
            }
            continue;
        }

        if (current_lba < FAT16_DATA_LBA) {
            if (!fat16_layout_read_root_sector(current_lba - (FAT16_RESERVED_SECTORS + (2u * FAT16_FAT_SECTORS)),
                                               current_buf)) {
                return false;
            }
            continue;
        }

        if (!read_data_sector(current_lba, current_buf)) {
            memset(current_buf, 0, FAT16_SECTOR_SIZE);
        }
    }

    return true;
}

bool virtual_disk_write(uint32_t lba, const uint8_t *buf, uint32_t block_count)
{
    (void)lba;
    (void)buf;
    (void)block_count;
    return false;
}

uint32_t virtual_disk_get_block_count(void)
{
    return fat16_layout_get_total_sectors();
}

uint16_t virtual_disk_get_block_size(void)
{
    return FAT16_SECTOR_SIZE;
}
