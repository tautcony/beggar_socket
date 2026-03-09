#include "virtual_disk.h"

#include <stdio.h>
#include <string.h>

#define UTF8_BOM_SIZE 3u

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

static void fill_dot_entry(Fat16DirEntry *entry, bool is_parent, uint16_t first_cluster)
{
    static const char self_name[11] = ".          ";
    static const char parent_name[11] = "..         ";

    fill_entry(entry, is_parent ? parent_name : self_name, 0x10u, first_cluster, 0u);
}

static void render_text(uint8_t *buf, const char *text)
{
    memset(buf, 0, FAT16_SECTOR_SIZE);
    if (text != NULL) {
        buf[0] = 0xEFu;
        buf[1] = 0xBBu;
        buf[2] = 0xBFu;
        snprintf((char *)&buf[UTF8_BOM_SIZE], FAT16_SECTOR_SIZE - UTF8_BOM_SIZE, "%s", text);
    }
}

static void render_option_text(uint8_t *buf,
                               const char *group,
                               const char *name,
                               bool selected,
                               const char *path,
                               const char *description)
{
    render_text(buf,
                selected ? "TYPE=OPTION\r\n"
                           "STATE=AVAILABLE\r\n"
                           "SELECTED=1\r\n"
                           :
                           "TYPE=OPTION\r\n"
                           "STATE=AVAILABLE\r\n"
                           "SELECTED=0\r\n");

    snprintf((char *)&buf[UTF8_BOM_SIZE],
             FAT16_SECTOR_SIZE - UTF8_BOM_SIZE,
             "TYPE=OPTION\r\n"
             "STATE=AVAILABLE\r\n"
             "GROUP=%s\r\n"
             "NAME=%s\r\n"
             "SELECTED=%u\r\n"
             "ACCESS=READ_ONLY\r\n"
             "PATH=%s\r\n"
             "DESC=%s\r\n",
             group,
             name,
             selected ? 1u : 0u,
             path,
             description);
}

static bool read_info_text(uint8_t *buf)
{
    memset(buf, 0, FAT16_SECTOR_SIZE);
    buf[0] = 0xEFu;
    buf[1] = 0xBBu;
    buf[2] = 0xBFu;
    snprintf((char *)&buf[UTF8_BOM_SIZE],
             FAT16_SECTOR_SIZE - UTF8_BOM_SIZE,
             "BEGGAR SOCKET\r\n"
             "=============\r\n"
             "DEVICE=BEGGAR_SOCKET\r\n"
             "ROLE=USB_CART_BRIDGE\r\n"
             "FS=FAT16\r\n"
             "TXT_ENCODING=UTF-8\r\n"
             "USB_PROFILE=MSC_ONLY\r\n"
             "DISK_MODE=CONFIG_WRITABLE_STAGE_1\r\n"
             "SECTOR_SIZE=%u\r\n"
             "SECTORS_PER_CLUSTER=%u\r\n"
             "MEDIA=VIRTUAL_DISK\r\n"
             "ROM_BASE_ADDRESS=0x%08lX\r\n"
             "ROM_SIZE=%lu\r\n"
             "ROM_DEVICE_SIZE=%lu\r\n"
             "ROM_SIZE_MAX=%lu\r\n"
             "SAVE_SIZE=%lu\r\n"
             "ROOT_ENTRIES=INFO.TXT,STATUS.TXT,ROM,RAM\r\n"
             "ROM_PATH=/ROM/CURRENT.GBA\r\n"
             "MODE_PATH=/ROM/MODE.TXT\r\n"
             "SAVE_PATH=/RAM/CURRENT.SAV\r\n"
             "NOTE=TXT files are UTF-8 with BOM for Windows compatibility.\r\n"
             "NOTE=ROM and save views are read-only.\r\n"
             "NOTE=MODE.TXT is writable and controls CURRENT.GBA export window.\r\n",
             (unsigned int)FAT16_SECTOR_SIZE,
             (unsigned int)FAT16_SECTORS_PER_CLUSTER,
             (unsigned long)cart_service_get_rom_base_address(),
             (unsigned long)cart_service_get_rom_size(),
             (unsigned long)cart_service_get_rom_device_size(),
             (unsigned long)CART_SERVICE_ROM_MAX_SIZE_BYTES,
             (unsigned long)CART_SERVICE_SAVE_SIZE_BYTES);
    return true;
}

static bool read_directory_view(Fat16ViewId view_id, uint32_t sector_in_cluster, uint8_t *buf)
{
    Fat16DirEntry *entries = (Fat16DirEntry *)buf;
    uint16_t self_cluster = 0u;
    uint16_t parent_cluster = 0u;

    memset(buf, 0, FAT16_SECTOR_SIZE);

    if (sector_in_cluster != 0u) {
        return true;
    }

    switch (view_id) {
        case FAT16_VIEW_ROM_DIR:
            self_cluster = FAT16_CLUSTER_ROM_DIR;
            parent_cluster = 0u;
            fill_dot_entry(&entries[0], false, self_cluster);
            fill_dot_entry(&entries[1], true, parent_cluster);
            fill_entry(&entries[2], "CURRENT GBA", 0x01u, FAT16_CLUSTER_ROM_CURRENT_GBA_START,
                       cart_service_get_rom_size());
            fill_entry(&entries[3], "CFI     TXT", 0x01u, FAT16_CLUSTER_ROM_CFI_TXT, FAT16_SECTOR_SIZE);
            fill_entry(&entries[4], "MODE    TXT", 0x01u, FAT16_CLUSTER_ROM_MODE_READ_TXT, FAT16_SECTOR_SIZE);
            return true;
        case FAT16_VIEW_RAM_DIR:
            self_cluster = FAT16_CLUSTER_RAM_DIR;
            parent_cluster = 0u;
            fill_dot_entry(&entries[0], false, self_cluster);
            fill_dot_entry(&entries[1], true, parent_cluster);
            fill_entry(&entries[2], "CURRENT SAV", 0x01u, FAT16_CLUSTER_RAM_CURRENT_SAV_START,
                       CART_SERVICE_SAVE_SIZE_BYTES);
            fill_entry(&entries[3], "TYPE       ", 0x10u, FAT16_CLUSTER_RAM_TYPE_DIR, 0u);
            return true;
        case FAT16_VIEW_ROM_MODE_DIR:
            self_cluster = FAT16_CLUSTER_ROM_MODE_DIR;
            parent_cluster = FAT16_CLUSTER_ROM_DIR;
            fill_dot_entry(&entries[0], false, self_cluster);
            fill_dot_entry(&entries[1], true, parent_cluster);
            fill_entry(&entries[2], "READ    TXT", 0x01u, FAT16_CLUSTER_ROM_MODE_READ_TXT, FAT16_SECTOR_SIZE);
            return true;
        case FAT16_VIEW_RAM_TYPE_DIR:
            self_cluster = FAT16_CLUSTER_RAM_TYPE_DIR;
            parent_cluster = FAT16_CLUSTER_RAM_DIR;
            fill_dot_entry(&entries[0], false, self_cluster);
            fill_dot_entry(&entries[1], true, parent_cluster);
            fill_entry(&entries[2], "AUTO    TXT", 0x01u, FAT16_CLUSTER_RAM_TYPE_AUTO_TXT, FAT16_SECTOR_SIZE);
            fill_entry(&entries[3], "SRAM    TXT", 0x01u, FAT16_CLUSTER_RAM_TYPE_SRAM_TXT, FAT16_SECTOR_SIZE);
            fill_entry(&entries[4], "FRAM    TXT", 0x01u, FAT16_CLUSTER_RAM_TYPE_FRAM_TXT, FAT16_SECTOR_SIZE);
            fill_entry(&entries[5], "FLASH64 TXT", 0x01u, FAT16_CLUSTER_RAM_TYPE_FLASH64_TXT, FAT16_SECTOR_SIZE);
            fill_entry(&entries[6], "FLASH128TXT", 0x01u, FAT16_CLUSTER_RAM_TYPE_FLASH128_TXT,
                       FAT16_SECTOR_SIZE);
            return true;
        default:
            return false;
    }
}

static bool read_text_view(Fat16ViewId view_id, uint32_t sector_in_cluster, uint8_t *buf)
{
    if (sector_in_cluster != 0u) {
        memset(buf, 0, FAT16_SECTOR_SIZE);
        return true;
    }

    switch (view_id) {
        case FAT16_VIEW_INFO_TXT:
            read_info_text(buf);
            return true;
        case FAT16_VIEW_STATUS_TXT:
            render_text(buf,
                        "DEVICE STATUS\r\n"
                        "=============\r\n"
                        "DEVICE=BEGGAR_SOCKET\r\n"
                        "STATE=IDLE\r\n"
                        "USB_MODE=MSC_ONLY\r\n"
                        "DISK_STATE=READY\r\n"
                        "READ_ONLY=0\r\n"
                        "WRITE_SCOPE=/ROM/MODE.TXT\r\n"
                        "ROM_VIEW=READY\r\n"
                        "SAVE_VIEW=READY\r\n"
                        "LAST_ERROR=NONE\r\n"
                        "ACTIVE_LAYOUT=FAT16_STAGE_1\r\n");
            return true;
        case FAT16_VIEW_ROM_MODE_READ_TXT:
            memset(buf, 0, FAT16_SECTOR_SIZE);
            buf[0] = 0xEFu;
            buf[1] = 0xBBu;
            buf[2] = 0xBFu;
            return cart_service_build_mode_text((char *)&buf[UTF8_BOM_SIZE], FAT16_SECTOR_SIZE - UTF8_BOM_SIZE);
        case FAT16_VIEW_ROM_CFI_TXT:
            memset(buf, 0, FAT16_SECTOR_SIZE);
            buf[0] = 0xEFu;
            buf[1] = 0xBBu;
            buf[2] = 0xBFu;
            return cart_service_build_cfi_text((char *)&buf[UTF8_BOM_SIZE], FAT16_SECTOR_SIZE - UTF8_BOM_SIZE);
        case FAT16_VIEW_RAM_TYPE_AUTO_TXT:
            render_option_text(buf,
                               "RAM_TYPE",
                               "AUTO",
                               true,
                               "/RAM/TYPE/AUTO.TXT",
                               "Default stage-1 selection. Detailed detection is deferred.");
            return true;
        case FAT16_VIEW_RAM_TYPE_SRAM_TXT:
            render_option_text(buf,
                               "RAM_TYPE",
                               "SRAM",
                               false,
                               "/RAM/TYPE/SRAM.TXT",
                               "Static RAM save mode.");
            return true;
        case FAT16_VIEW_RAM_TYPE_FRAM_TXT:
            render_option_text(buf,
                               "RAM_TYPE",
                               "FRAM",
                               false,
                               "/RAM/TYPE/FRAM.TXT",
                               "FRAM save mode.");
            return true;
        case FAT16_VIEW_RAM_TYPE_FLASH64_TXT:
            render_option_text(buf,
                               "RAM_TYPE",
                               "FLASH64",
                               false,
                               "/RAM/TYPE/FLASH64.TXT",
                               "64K flash save mode.");
            return true;
        case FAT16_VIEW_RAM_TYPE_FLASH128_TXT:
            render_option_text(buf,
                               "RAM_TYPE",
                               "FLASH128",
                               false,
                               "/RAM/TYPE/FLASH128.TXT",
                               "128K flash save mode.");
            return true;
        default:
            return false;
    }
}

static bool read_data_view(const Fat16ViewInfo *view, uint32_t cluster_offset, uint32_t sector_in_cluster, uint8_t *buf)
{
    uint32_t file_offset = ((cluster_offset * FAT16_SECTORS_PER_CLUSTER) + sector_in_cluster) * FAT16_SECTOR_SIZE;
    uint32_t bytes_to_read = FAT16_SECTOR_SIZE;

    memset(buf, 0, FAT16_SECTOR_SIZE);

    if (file_offset >= view->size_bytes) {
        return true;
    }

    if ((view->size_bytes - file_offset) < bytes_to_read) {
        bytes_to_read = view->size_bytes - file_offset;
    }

    switch (view->view_id) {
        case FAT16_VIEW_ROM_CURRENT_GBA:
            return cart_service_read_rom(file_offset, buf, bytes_to_read);
        case FAT16_VIEW_RAM_CURRENT_SAV:
            return cart_service_read_save(file_offset, buf, bytes_to_read);
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

    if (!fat16_layout_cluster_from_lba(lba, &cluster, &sector_in_cluster)) {
        return false;
    }

    if (!fat16_layout_get_view(cluster, &view, &cluster_offset)) {
        return false;
    }

    if (view.is_directory) {
        return read_directory_view(view.view_id, sector_in_cluster, buf);
    }

    if ((view.view_id >= FAT16_VIEW_INFO_TXT) && (view.view_id <= FAT16_VIEW_RAM_TYPE_FLASH128_TXT)) {
        if (read_text_view(view.view_id, sector_in_cluster, buf)) {
            return true;
        }
    }

    return read_data_view(&view, cluster_offset, sector_in_cluster, buf);
}

static bool write_text_view(Fat16ViewId view_id, uint32_t sector_in_cluster, const uint8_t *buf)
{
    if (sector_in_cluster != 0u) {
        return true;
    }

    switch (view_id) {
        case FAT16_VIEW_ROM_MODE_READ_TXT:
            return cart_service_apply_mode_text(buf, FAT16_SECTOR_SIZE);
        default:
            return true;
    }
}

static bool write_data_sector(uint32_t lba, const uint8_t *buf)
{
    Fat16ViewInfo view;
    uint16_t cluster = 0u;
    uint32_t sector_in_cluster = 0u;
    uint32_t cluster_offset = 0u;

    if (!fat16_layout_cluster_from_lba(lba, &cluster, &sector_in_cluster)) {
        return true;
    }

    if (!fat16_layout_get_view(cluster, &view, &cluster_offset)) {
        return true;
    }

    if (view.is_directory) {
        return true;
    }

    if ((view.view_id >= FAT16_VIEW_INFO_TXT) && (view.view_id <= FAT16_VIEW_RAM_TYPE_FLASH128_TXT)) {
        return write_text_view(view.view_id, sector_in_cluster, buf);
    }

    return true;
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
    if (buf == NULL) {
        return false;
    }

    for (uint32_t block = 0u; block < block_count; ++block) {
        uint32_t current_lba = lba + block;
        const uint8_t *current_buf = buf + (block * FAT16_SECTOR_SIZE);

        if (current_lba < FAT16_DATA_LBA) {
            continue;
        }

        if (!write_data_sector(current_lba, current_buf)) {
            return false;
        }
    }

    return true;
}

uint32_t virtual_disk_get_block_count(void)
{
    return fat16_layout_get_total_sectors();
}

uint16_t virtual_disk_get_block_size(void)
{
    return FAT16_SECTOR_SIZE;
}
