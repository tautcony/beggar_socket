#include "fat16_layout.h"
#include "virtual_disk.h"

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

static void fat16_write_le16(uint8_t *buf, uint32_t offset, uint16_t value)
{
    buf[offset] = (uint8_t)(value & 0xffu);
    buf[offset + 1u] = (uint8_t)((value >> 8u) & 0xffu);
}

static void fat16_write_le32(uint8_t *buf, uint32_t offset, uint32_t value)
{
    buf[offset] = (uint8_t)(value & 0xffu);
    buf[offset + 1u] = (uint8_t)((value >> 8u) & 0xffu);
    buf[offset + 2u] = (uint8_t)((value >> 16u) & 0xffu);
    buf[offset + 3u] = (uint8_t)((value >> 24u) & 0xffu);
}

static void fat16_fill_entry(Fat16DirEntry *entry,
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

static uint16_t fat16_next_cluster(uint16_t cluster)
{
    if (cluster == 0u) {
        return 0xFFF8u;
    }

    if ((cluster >= FAT16_CLUSTER_ROM_CURRENT_GBA_START) &&
        (cluster < (FAT16_CLUSTER_ROM_CURRENT_GBA_START + FAT16_ROM_WINDOW_CLUSTER_COUNT - 1u))) {
        return (uint16_t)(cluster + 1u);
    }

    if ((cluster >= FAT16_CLUSTER_RAM_CURRENT_SAV_START) &&
        (cluster < (FAT16_CLUSTER_RAM_CURRENT_SAV_START + FAT16_SAVE_WINDOW_CLUSTER_COUNT - 1u))) {
        return (uint16_t)(cluster + 1u);
    }

    if (cluster == FAT16_CLUSTER_INFO_TXT || cluster == FAT16_CLUSTER_STATUS_TXT || cluster == FAT16_CLUSTER_APPLY_TXT ||
        cluster == FAT16_CLUSTER_ROM_DIR || cluster == FAT16_CLUSTER_RAM_DIR || cluster == FAT16_CLUSTER_RAM_TYPE_DIR ||
        cluster == FAT16_CLUSTER_ROM_CFI_TXT || cluster == FAT16_CLUSTER_ROM_CONFIG_TXT ||
        cluster == FAT16_CLUSTER_RAM_TYPE_SRAM_TXT || cluster == FAT16_CLUSTER_RAM_TYPE_FRAM_TXT ||
        cluster == FAT16_CLUSTER_RAM_TYPE_FLASH_TXT || cluster == FAT16_CLUSTER_RAM_TYPE_SELECT_TXT ||
        cluster == FAT16_CLUSTER_RAM_STATUS_TXT || cluster == FAT16_CLUSTER_RAM_ERASE_TXT ||
        cluster == (uint16_t)(FAT16_CLUSTER_ROM_CURRENT_GBA_START + FAT16_ROM_WINDOW_CLUSTER_COUNT - 1u) ||
        cluster == (uint16_t)(FAT16_CLUSTER_RAM_CURRENT_SAV_START + FAT16_SAVE_WINDOW_CLUSTER_COUNT - 1u)) {
        return 0xFFF8u;
    }

    return 0x0000u;
}

uint32_t fat16_layout_get_total_sectors(void)
{
    return FAT16_TOTAL_SECTORS;
}

uint32_t fat16_layout_get_data_lba(void)
{
    return FAT16_DATA_LBA;
}

bool fat16_layout_read_boot_sector(uint8_t *buf)
{
    uint32_t total_sectors = FAT16_TOTAL_SECTORS;

    if (buf == NULL) {
        return false;
    }

    memset(buf, 0, FAT16_SECTOR_SIZE);
    buf[0] = 0xEBu;
    buf[1] = 0x3Cu;
    buf[2] = 0x90u;
    memcpy(&buf[3], "BEGGAR  ", 8u);
    fat16_write_le16(buf, 11u, FAT16_SECTOR_SIZE);
    buf[13] = FAT16_SECTORS_PER_CLUSTER;
    fat16_write_le16(buf, 14u, FAT16_RESERVED_SECTORS);
    buf[16] = FAT16_FAT_COUNT;
    fat16_write_le16(buf, 17u, FAT16_ROOT_ENTRY_COUNT);
    fat16_write_le16(buf, 19u, total_sectors <= 0xFFFFu ? (uint16_t)total_sectors : 0u);
    buf[21] = 0xF8u;
    fat16_write_le16(buf, 22u, FAT16_FAT_SECTORS);
    fat16_write_le16(buf, 24u, 1u);
    fat16_write_le16(buf, 26u, 1u);
    fat16_write_le32(buf, 28u, 0u);
    fat16_write_le32(buf, 32u, total_sectors > 0xFFFFu ? total_sectors : 0u);
    buf[36] = 0x80u;
    buf[38] = 0x29u;
    fat16_write_le32(buf, 39u, 0x46415416u);
    memcpy(&buf[43], "BEGGAR FAT ", 11u);
    memcpy(&buf[54], "FAT16   ", 8u);
    buf[510] = 0x55u;
    buf[511] = 0xAAu;
    return true;
}

bool fat16_layout_read_fat_sector(uint32_t fat_index, uint32_t sector_offset, uint8_t *buf)
{
    uint32_t entry_base = sector_offset * (FAT16_SECTOR_SIZE / 2u);

    (void)fat_index;

    if (buf == NULL || sector_offset >= FAT16_FAT_SECTORS) {
        return false;
    }

    memset(buf, 0, FAT16_SECTOR_SIZE);

    for (uint32_t i = 0u; i < (FAT16_SECTOR_SIZE / 2u); ++i) {
        uint32_t entry_index = entry_base + i;
        uint16_t value = 0u;

        if (entry_index == 0u) {
            value = 0xFFF8u;
        } else if (entry_index == 1u) {
            value = 0xFFFFu;
        } else if (entry_index < FAT16_TOTAL_CLUSTERS) {
            value = fat16_next_cluster((uint16_t)entry_index);
        }

        fat16_write_le16(buf, i * 2u, value);
    }

    return true;
}

bool fat16_layout_read_root_sector(uint32_t sector_offset, uint8_t *buf)
{
    Fat16DirEntry *entries = (Fat16DirEntry *)buf;

    if (buf == NULL || sector_offset >= FAT16_ROOT_DIR_SECTORS) {
        return false;
    }

    memset(buf, 0, FAT16_SECTOR_SIZE);

    if (sector_offset == 0u) {
        fat16_fill_entry(&entries[0], "INFO    TXT", 0x01u, FAT16_CLUSTER_INFO_TXT,
                         virtual_disk_get_text_view_size(FAT16_VIEW_INFO_TXT));
        fat16_fill_entry(&entries[1], "STATUS  TXT", 0x01u, FAT16_CLUSTER_STATUS_TXT,
                         virtual_disk_get_text_view_size(FAT16_VIEW_STATUS_TXT));
        fat16_fill_entry(&entries[2], "APPLY   TXT", 0x20u, FAT16_CLUSTER_APPLY_TXT,
                         virtual_disk_get_text_view_size(FAT16_VIEW_APPLY_TXT));
        fat16_fill_entry(&entries[3], "ROM        ", 0x10u, FAT16_CLUSTER_ROM_DIR, 0u);
        fat16_fill_entry(&entries[4], "RAM        ", 0x10u, FAT16_CLUSTER_RAM_DIR, 0u);
    }

    return true;
}

bool fat16_layout_cluster_from_lba(uint32_t lba, uint16_t *cluster, uint32_t *sector_in_cluster)
{
    uint32_t relative_lba;

    if (cluster == NULL || sector_in_cluster == NULL || lba < FAT16_DATA_LBA) {
        return false;
    }

    relative_lba = lba - FAT16_DATA_LBA;
    *cluster = (uint16_t)(relative_lba / FAT16_SECTORS_PER_CLUSTER) + 2u;
    *sector_in_cluster = relative_lba % FAT16_SECTORS_PER_CLUSTER;
    return (*cluster < FAT16_TOTAL_CLUSTERS);
}

bool fat16_layout_get_view(uint16_t cluster, Fat16ViewInfo *view, uint32_t *cluster_offset)
{
    if (view == NULL || cluster_offset == NULL) {
        return false;
    }

    memset(view, 0, sizeof(*view));

    switch (cluster) {
        case FAT16_CLUSTER_INFO_TXT:
            *view = (Fat16ViewInfo){FAT16_CLUSTER_INFO_TXT,
                                    1u,
                                    virtual_disk_get_text_view_size(FAT16_VIEW_INFO_TXT),
                                    FAT16_VIEW_INFO_TXT,
                                    false,
                                    true};
            *cluster_offset = 0u;
            return true;
        case FAT16_CLUSTER_STATUS_TXT:
            *view = (Fat16ViewInfo){FAT16_CLUSTER_STATUS_TXT,
                                    1u,
                                    virtual_disk_get_text_view_size(FAT16_VIEW_STATUS_TXT),
                                    FAT16_VIEW_STATUS_TXT,
                                    false,
                                    true};
            *cluster_offset = 0u;
            return true;
        case FAT16_CLUSTER_APPLY_TXT:
            *view = (Fat16ViewInfo){FAT16_CLUSTER_APPLY_TXT,
                                    1u,
                                    virtual_disk_get_text_view_size(FAT16_VIEW_APPLY_TXT),
                                    FAT16_VIEW_APPLY_TXT,
                                    false,
                                    false};
            *cluster_offset = 0u;
            return true;
        case FAT16_CLUSTER_ROM_DIR:
            *view = (Fat16ViewInfo){FAT16_CLUSTER_ROM_DIR, 1u, FAT16_SECTOR_SIZE, FAT16_VIEW_ROM_DIR, true, true};
            *cluster_offset = 0u;
            return true;
        case FAT16_CLUSTER_RAM_DIR:
            *view = (Fat16ViewInfo){FAT16_CLUSTER_RAM_DIR, 1u, FAT16_SECTOR_SIZE, FAT16_VIEW_RAM_DIR, true, true};
            *cluster_offset = 0u;
            return true;
        case FAT16_CLUSTER_RAM_TYPE_DIR:
            *view = (Fat16ViewInfo){FAT16_CLUSTER_RAM_TYPE_DIR, 1u, FAT16_SECTOR_SIZE, FAT16_VIEW_RAM_TYPE_DIR, true, true};
            *cluster_offset = 0u;
            return true;
        case FAT16_CLUSTER_ROM_CFI_TXT:
            *view = (Fat16ViewInfo){FAT16_CLUSTER_ROM_CFI_TXT,
                                    1u,
                                    virtual_disk_get_text_view_size(FAT16_VIEW_ROM_CFI_TXT),
                                    FAT16_VIEW_ROM_CFI_TXT,
                                    false,
                                    true};
            *cluster_offset = 0u;
            return true;
        case FAT16_CLUSTER_ROM_CONFIG_TXT:
            *view = (Fat16ViewInfo){FAT16_CLUSTER_ROM_CONFIG_TXT,
                                    1u,
                                    virtual_disk_get_text_view_size(FAT16_VIEW_ROM_CONFIG_TXT),
                                    FAT16_VIEW_ROM_CONFIG_TXT,
                                    false,
                                    false};
            *cluster_offset = 0u;
            return true;
        case FAT16_CLUSTER_RAM_TYPE_SRAM_TXT:
            *view = (Fat16ViewInfo){FAT16_CLUSTER_RAM_TYPE_SRAM_TXT,
                                    1u,
                                    virtual_disk_get_text_view_size(FAT16_VIEW_RAM_TYPE_SRAM_TXT),
                                    FAT16_VIEW_RAM_TYPE_SRAM_TXT,
                                    false,
                                    true};
            *cluster_offset = 0u;
            return true;
        case FAT16_CLUSTER_RAM_TYPE_FRAM_TXT:
            *view = (Fat16ViewInfo){FAT16_CLUSTER_RAM_TYPE_FRAM_TXT,
                                    1u,
                                    virtual_disk_get_text_view_size(FAT16_VIEW_RAM_TYPE_FRAM_TXT),
                                    FAT16_VIEW_RAM_TYPE_FRAM_TXT,
                                    false,
                                    true};
            *cluster_offset = 0u;
            return true;
        case FAT16_CLUSTER_RAM_TYPE_FLASH_TXT:
            *view = (Fat16ViewInfo){FAT16_CLUSTER_RAM_TYPE_FLASH_TXT,
                                    1u,
                                    virtual_disk_get_text_view_size(FAT16_VIEW_RAM_TYPE_FLASH_TXT),
                                    FAT16_VIEW_RAM_TYPE_FLASH_TXT,
                                    false,
                                    true};
            *cluster_offset = 0u;
            return true;
        case FAT16_CLUSTER_RAM_TYPE_SELECT_TXT:
            *view = (Fat16ViewInfo){FAT16_CLUSTER_RAM_TYPE_SELECT_TXT,
                                    1u,
                                    virtual_disk_get_text_view_size(FAT16_VIEW_RAM_TYPE_SELECT_TXT),
                                    FAT16_VIEW_RAM_TYPE_SELECT_TXT,
                                    false,
                                    false};
            *cluster_offset = 0u;
            return true;
        case FAT16_CLUSTER_RAM_STATUS_TXT:
            *view = (Fat16ViewInfo){FAT16_CLUSTER_RAM_STATUS_TXT,
                                    1u,
                                    virtual_disk_get_text_view_size(FAT16_VIEW_RAM_STATUS_TXT),
                                    FAT16_VIEW_RAM_STATUS_TXT,
                                    false,
                                    true};
            *cluster_offset = 0u;
            return true;
        case FAT16_CLUSTER_RAM_ERASE_TXT:
            *view = (Fat16ViewInfo){FAT16_CLUSTER_RAM_ERASE_TXT,
                                    1u,
                                    virtual_disk_get_text_view_size(FAT16_VIEW_RAM_ERASE_TXT),
                                    FAT16_VIEW_RAM_ERASE_TXT,
                                    false,
                                    false};
            *cluster_offset = 0u;
            return true;
        default:
            break;
    }

    if ((cluster >= FAT16_CLUSTER_ROM_CURRENT_GBA_START) &&
        (cluster < FAT16_CLUSTER_ROM_CURRENT_GBA_START + FAT16_ROM_WINDOW_CLUSTER_COUNT)) {
        *view = (Fat16ViewInfo){FAT16_CLUSTER_ROM_CURRENT_GBA_START,
                                FAT16_ROM_WINDOW_CLUSTER_COUNT,
                                cart_service_get_rom_size(),
                                FAT16_VIEW_ROM_CURRENT_GBA,
                                false,
                                true};
        *cluster_offset = cluster - FAT16_CLUSTER_ROM_CURRENT_GBA_START;
        return true;
    }

    if ((cluster >= FAT16_CLUSTER_RAM_CURRENT_SAV_START) &&
        (cluster < FAT16_CLUSTER_RAM_CURRENT_SAV_START + FAT16_SAVE_WINDOW_CLUSTER_COUNT)) {
        *view = (Fat16ViewInfo){FAT16_CLUSTER_RAM_CURRENT_SAV_START,
                                FAT16_SAVE_WINDOW_CLUSTER_COUNT,
                                CART_SERVICE_SAVE_SIZE_BYTES,
                                FAT16_VIEW_RAM_CURRENT_SAV,
                                false,
                                true};
        *cluster_offset = cluster - FAT16_CLUSTER_RAM_CURRENT_SAV_START;
        return true;
    }

    return false;
}
