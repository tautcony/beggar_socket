#include "act_led.h"
#include "virtual_disk.h"

#include <stdio.h>
#include <string.h>

#define UTF8_BOM_SIZE 3u
#define FAT16_ATTR_READ_ONLY 0x01u
#define FAT16_ATTR_HIDDEN 0x02u
#define FAT16_ATTR_SYSTEM 0x04u
#define FAT16_ATTR_VOLUME_ID 0x08u
#define FAT16_ATTR_DIRECTORY 0x10u
#define FAT16_ATTR_ARCHIVE 0x20u

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

static volatile bool g_virtual_disk_medium_changed = false;
static uint16_t g_current_save_write_date = 0x5A21u;
static uint16_t g_current_save_write_time = 0x0000u;
static uint32_t g_current_save_revision = 0u;

static void bump_current_save_timestamp(void);

typedef struct {
    bool active;
    bool valid;
    uint16_t first_cluster;
    uint32_t file_size;
    uint16_t cluster_chain[FAT16_SAVE_WINDOW_CLUSTER_COUNT];
    uint16_t cluster_count;
} RamImportFile;

typedef struct {
    bool valid;
    uint16_t cluster;
    uint16_t next_cluster;
} FatOverride;

static RamImportFile g_ram_import_file;
static FatOverride g_fat_overrides[64];
static uint16_t g_candidate_import_clusters[FAT16_SAVE_WINDOW_CLUSTER_COUNT];
static uint16_t g_candidate_import_cluster_count = 0u;
static uint32_t g_ram_dir_write_count = 0u;
static uint32_t g_fat_write_count = 0u;
static uint16_t g_last_fat_cluster = 0u;
static uint16_t g_last_fat_value = 0u;

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

static void set_entry_write_timestamp(Fat16DirEntry *entry, uint16_t write_date, uint16_t write_time)
{
    if (entry == NULL) {
        return;
    }

    entry->creation_date = write_date;
    entry->access_date = write_date;
    entry->write_date = write_date;
    entry->creation_time = write_time;
    entry->write_time = write_time;
}

static uint16_t read_le16(const uint8_t *buf, uint32_t offset)
{
    return (uint16_t)buf[offset] | (uint16_t)((uint16_t)buf[offset + 1u] << 8u);
}

static uint32_t read_le32(const uint8_t *buf, uint32_t offset)
{
    return (uint32_t)buf[offset] | ((uint32_t)buf[offset + 1u] << 8u) | ((uint32_t)buf[offset + 2u] << 16u) |
           ((uint32_t)buf[offset + 3u] << 24u);
}

static bool is_zero_name(const uint8_t name[11])
{
    for (uint32_t i = 0u; i < 11u; ++i) {
        if (name[i] != 0x00u) {
            return false;
        }
    }

    return true;
}

static bool names_equal(const uint8_t lhs[11], const char rhs[11])
{
    return memcmp(lhs, rhs, 11u) == 0;
}

static bool is_static_ram_name(const uint8_t name[11])
{
    return names_equal(name, "CURRENT SAV") || names_equal(name, "TYPE       ") || names_equal(name, "STATUS  TXT") ||
           names_equal(name, "ERASE   TXT") || names_equal(name, ".          ") || names_equal(name, "..         ");
}

static bool should_ignore_ram_entry(const Fat16DirEntry *entry)
{
    if (entry == NULL) {
        return true;
    }

    if ((entry->attr & (FAT16_ATTR_HIDDEN | FAT16_ATTR_SYSTEM | FAT16_ATTR_VOLUME_ID)) != 0u) {
        return true;
    }

    /* Ignore dotfiles such as macOS metadata entries (for example ._*, .Trashes). */
    if (entry->name[0] == '.') {
        return true;
    }

    return false;
}

static bool is_ram_upload_window_cluster(uint16_t cluster)
{
    return (cluster >= FAT16_CLUSTER_RAM_UPLOAD_SAV_START) &&
           (cluster < (FAT16_CLUSTER_RAM_UPLOAD_SAV_START + FAT16_SAVE_WINDOW_CLUSTER_COUNT));
}

static void clear_fat_overrides(void)
{
    memset(g_fat_overrides, 0, sizeof(g_fat_overrides));
}

static void clear_ram_import_file(void)
{
    memset(&g_ram_import_file, 0, sizeof(g_ram_import_file));
    clear_fat_overrides();
    memset(g_candidate_import_clusters, 0, sizeof(g_candidate_import_clusters));
    g_candidate_import_cluster_count = 0u;
}

static void set_fat_override(uint16_t cluster, uint16_t next_cluster)
{
    for (uint32_t i = 0u; i < (sizeof(g_fat_overrides) / sizeof(g_fat_overrides[0])); ++i) {
        if (g_fat_overrides[i].valid && g_fat_overrides[i].cluster == cluster) {
            g_fat_overrides[i].next_cluster = next_cluster;
            return;
        }
    }

    for (uint32_t i = 0u; i < (sizeof(g_fat_overrides) / sizeof(g_fat_overrides[0])); ++i) {
        if (!g_fat_overrides[i].valid) {
            g_fat_overrides[i].valid = true;
            g_fat_overrides[i].cluster = cluster;
            g_fat_overrides[i].next_cluster = next_cluster;
            return;
        }
    }
}

static uint16_t get_fat_override(uint16_t cluster)
{
    for (uint32_t i = 0u; i < (sizeof(g_fat_overrides) / sizeof(g_fat_overrides[0])); ++i) {
        if (g_fat_overrides[i].valid && g_fat_overrides[i].cluster == cluster) {
            return g_fat_overrides[i].next_cluster;
        }
    }

    return 0u;
}

static void rebuild_ram_import_chain(void)
{
    uint16_t cluster;

    g_ram_import_file.cluster_count = 0u;

    if (!g_ram_import_file.active || g_ram_import_file.first_cluster < 2u) {
        return;
    }

    cluster = g_ram_import_file.first_cluster;
    while (g_ram_import_file.cluster_count < FAT16_SAVE_WINDOW_CLUSTER_COUNT && cluster >= 2u) {
        uint16_t next_cluster;

        g_ram_import_file.cluster_chain[g_ram_import_file.cluster_count++] = cluster;
        next_cluster = get_fat_override(cluster);
        if (next_cluster >= 0xFFF8u || next_cluster == 0u) {
            break;
        }
        cluster = next_cluster;
    }
}

static void infer_ram_import_chain_from_fat(void)
{
    uint16_t best_start = 0u;
    uint16_t best_chain[FAT16_SAVE_WINDOW_CLUSTER_COUNT];
    uint16_t best_count = 0u;

    memset(best_chain, 0, sizeof(best_chain));

    for (uint16_t cluster = FAT16_CLUSTER_RAM_UPLOAD_SAV_START;
         cluster < (FAT16_CLUSTER_RAM_UPLOAD_SAV_START + FAT16_SAVE_WINDOW_CLUSTER_COUNT);
         ++cluster) {
        uint16_t chain[FAT16_SAVE_WINDOW_CLUSTER_COUNT];
        uint16_t count = 0u;
        bool has_predecessor = false;
        uint16_t current = cluster;

        if (get_fat_override(cluster) == 0u) {
            continue;
        }

        for (uint16_t probe = FAT16_CLUSTER_RAM_UPLOAD_SAV_START;
             probe < (FAT16_CLUSTER_RAM_UPLOAD_SAV_START + FAT16_SAVE_WINDOW_CLUSTER_COUNT);
             ++probe) {
            if (get_fat_override(probe) == cluster) {
                has_predecessor = true;
                break;
            }
        }

        if (has_predecessor) {
            continue;
        }

        memset(chain, 0, sizeof(chain));
        while (count < FAT16_SAVE_WINDOW_CLUSTER_COUNT && current >= 2u) {
            uint16_t next_cluster = get_fat_override(current);
            bool seen = false;

            if (next_cluster == 0u) {
                break;
            }

            for (uint16_t i = 0u; i < count; ++i) {
                if (chain[i] == current) {
                    seen = true;
                    break;
                }
            }

            if (seen) {
                break;
            }

            chain[count++] = current;

            if (next_cluster >= 0xFFF8u) {
                break;
            }

            if (!is_ram_upload_window_cluster(next_cluster)) {
                break;
            }

            current = next_cluster;
        }

        if (count > best_count) {
            best_start = cluster;
            best_count = count;
            memcpy(best_chain, chain, sizeof(best_chain));
        }
    }

    if (best_count == 0u) {
        return;
    }

    g_ram_import_file.active = true;
    g_ram_import_file.valid = true;
    g_ram_import_file.first_cluster = best_start;
    g_ram_import_file.cluster_count = best_count;
    memcpy(g_ram_import_file.cluster_chain, best_chain, sizeof(g_ram_import_file.cluster_chain));
    memset(g_candidate_import_clusters, 0, sizeof(g_candidate_import_clusters));
    g_candidate_import_cluster_count = 0u;

    if (g_ram_import_file.file_size == 0u ||
        g_ram_import_file.file_size > (best_count * FAT16_CLUSTER_SIZE_BYTES)) {
        g_ram_import_file.file_size = best_count * FAT16_CLUSTER_SIZE_BYTES;
    }
}

static void note_ram_import_progress(void)
{
    bump_current_save_timestamp();
    virtual_disk_note_medium_change();
}

static void handle_ram_dir_write(uint32_t sector_in_cluster, const uint8_t *buf)
{
    const Fat16DirEntry *entries = (const Fat16DirEntry *)buf;
    const Fat16DirEntry *candidate = NULL;

    if (buf == NULL || sector_in_cluster != 0u) {
        return;
    }

    g_ram_dir_write_count++;

    for (uint32_t i = 0u; i < (FAT16_SECTOR_SIZE / sizeof(Fat16DirEntry)); ++i) {
        const Fat16DirEntry *entry = &entries[i];

        if (entry->name[0] == 0xE5u || is_zero_name(entry->name) || is_static_ram_name(entry->name) ||
            (entry->attr & FAT16_ATTR_DIRECTORY) != 0u || should_ignore_ram_entry(entry)) {
            continue;
        }

        candidate = entry;
        break;
    }

    if (candidate == NULL) {
        clear_ram_import_file();
        return;
    }

    if (!g_ram_import_file.active || g_ram_import_file.first_cluster != candidate->first_cluster_lo) {
        clear_ram_import_file();
        g_ram_import_file.active = true;
        g_ram_import_file.first_cluster = candidate->first_cluster_lo;
    }

    g_ram_import_file.file_size = read_le32((const uint8_t *)candidate, 28u);
    g_ram_import_file.valid = g_ram_import_file.first_cluster >= 2u;
    rebuild_ram_import_chain();
}

static void handle_fat_write(uint32_t sector_offset, const uint8_t *buf)
{
    uint32_t entry_base = sector_offset * (FAT16_SECTOR_SIZE / 2u);

    if (buf == NULL) {
        return;
    }

    for (uint32_t i = 0u; i < (FAT16_SECTOR_SIZE / 2u); ++i) {
        uint16_t cluster = (uint16_t)(entry_base + i);
        uint16_t value = read_le16(buf, i * 2u);

        if (value != 0u) {
            g_fat_write_count++;
            g_last_fat_cluster = cluster;
            g_last_fat_value = value;
        }

        if (is_ram_upload_window_cluster(cluster) && value != 0u) {
            set_fat_override(cluster, value);
        }
    }

    if (g_ram_import_file.active) {
        rebuild_ram_import_chain();
    }

    infer_ram_import_chain_from_fat();
}

static bool resolve_ram_import_offset(uint16_t cluster, uint32_t sector_in_cluster, uint32_t *file_offset)
{
    if (file_offset == NULL || !g_ram_import_file.valid) {
        return false;
    }

    for (uint32_t i = 0u; i < g_ram_import_file.cluster_count; ++i) {
        if (g_ram_import_file.cluster_chain[i] == cluster) {
            *file_offset = ((i * FAT16_SECTORS_PER_CLUSTER) + sector_in_cluster) * FAT16_SECTOR_SIZE;
            return *file_offset < CART_SERVICE_UPLOAD_BUFFER_SIZE;
        }
    }

    return false;
}

static bool resolve_candidate_import_offset(uint16_t cluster, uint32_t sector_in_cluster, uint32_t *file_offset)
{
    if (file_offset == NULL || cluster < 2u || !g_ram_import_file.active || g_ram_import_file.valid) {
        return false;
    }

    for (uint32_t i = 0u; i < g_candidate_import_cluster_count; ++i) {
        if (g_candidate_import_clusters[i] == cluster) {
            *file_offset = ((i * FAT16_SECTORS_PER_CLUSTER) + sector_in_cluster) * FAT16_SECTOR_SIZE;
            return *file_offset < CART_SERVICE_UPLOAD_BUFFER_SIZE;
        }
    }

    if (sector_in_cluster != 0u || g_candidate_import_cluster_count >= FAT16_SAVE_WINDOW_CLUSTER_COUNT) {
        return false;
    }

    g_candidate_import_clusters[g_candidate_import_cluster_count] = cluster;
    *file_offset = (g_candidate_import_cluster_count * FAT16_SECTORS_PER_CLUSTER) * FAT16_SECTOR_SIZE;
    g_candidate_import_cluster_count++;
    return *file_offset < CART_SERVICE_UPLOAD_BUFFER_SIZE;
}

static void bump_current_save_timestamp(void)
{
    uint32_t minute_of_day;

    g_current_save_revision++;
    g_current_save_write_date = (uint16_t)(0x5A21u + (g_current_save_revision / 1440u));
    minute_of_day = g_current_save_revision % 1440u;
    g_current_save_write_time = (uint16_t)(((minute_of_day / 60u) << 11) | ((minute_of_day % 60u) << 5));
}

static void fill_dot_entry(Fat16DirEntry *entry, bool is_parent, uint16_t first_cluster)
{
    static const char self_name[11] = ".          ";
    static const char parent_name[11] = "..         ";

    fill_entry(entry, is_parent ? parent_name : self_name, 0x10u, first_cluster, 0u);
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
             "DISK_MODE=PARAMETER_CONTROL_PLANE\r\n"
             "SECTOR_SIZE=%u\r\n"
             "SECTORS_PER_CLUSTER=%u\r\n"
             "MEDIA=VIRTUAL_DISK\r\n"
             "ROM_BASE_ADDRESS=0x%08lX\r\n"
             "ROM_SIZE=%lu\r\n"
             "ROM_DEVICE_SIZE=%lu\r\n"
             "ROM_SIZE_MAX=%lu\r\n"
             "SAVE_SIZE=%lu\r\n"
             "ROOT_ENTRIES=INFO.TXT,STATUS.TXT,APPLY.TXT,ROM,RAM\r\n"
             "ROM_PATH=/ROM/CURRENT.GBA\r\n"
             "ROM_CONFIG_PATH=/ROM/CONFIG.TXT\r\n"
             "APPLY_PATH=/APPLY.TXT\r\n"
             "RAM_STATUS_PATH=/RAM/STATUS.TXT\r\n"
             "RAM_ERASE_PATH=/RAM/ERASE.TXT\r\n"
             "RAM_TYPE_PATH=/RAM/TYPE/SELECT.TXT\r\n"
             "SAVE_PATH=/RAM/CURRENT.SAV\r\n"
             "NOTE=TXT files are UTF-8 with BOM for Windows compatibility.\r\n"
             "NOTE=ROM and save views are read-only.\r\n"
             "NOTE=Add one new save file under /RAM to import data into CURRENT.SAV.\r\n"
             "NOTE=Writable control files either update pending configuration or trigger RAM actions on save.\r\n",
             (unsigned int)FAT16_SECTOR_SIZE,
             (unsigned int)FAT16_SECTORS_PER_CLUSTER,
             (unsigned long)cart_service_get_rom_base_address(),
             (unsigned long)cart_service_get_rom_size(),
             (unsigned long)cart_service_get_rom_device_size(),
             (unsigned long)CART_SERVICE_ROM_MAX_SIZE_BYTES,
             (unsigned long)CART_SERVICE_SAVE_SIZE_BYTES);
    return true;
}

static uint32_t bounded_text_length(const char *text, uint32_t max_len)
{
    uint32_t len = 0u;

    if (text == NULL) {
        return 0u;
    }

    while (len < max_len && text[len] != '\0') {
        ++len;
    }

    return len;
}

static uint32_t get_text_buffer_size(const uint8_t *buf)
{
    uint32_t text_len;

    if (buf == NULL) {
        return 0u;
    }

    text_len = bounded_text_length((const char *)&buf[UTF8_BOM_SIZE], FAT16_SECTOR_SIZE - UTF8_BOM_SIZE);
    return UTF8_BOM_SIZE + text_len;
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
            fill_entry(&entries[2], "CURRENT GBA", FAT16_ATTR_READ_ONLY, FAT16_CLUSTER_ROM_CURRENT_GBA_START,
                       cart_service_get_rom_size());
            fill_entry(&entries[3], "CFI     TXT", FAT16_ATTR_READ_ONLY, FAT16_CLUSTER_ROM_CFI_TXT,
                       virtual_disk_get_text_view_size(FAT16_VIEW_ROM_CFI_TXT));
            fill_entry(&entries[4], "CONFIG  TXT", FAT16_ATTR_ARCHIVE, FAT16_CLUSTER_ROM_CONFIG_TXT,
                       virtual_disk_get_text_view_size(FAT16_VIEW_ROM_CONFIG_TXT));
            return true;
        case FAT16_VIEW_RAM_DIR:
            self_cluster = FAT16_CLUSTER_RAM_DIR;
            parent_cluster = 0u;
            fill_dot_entry(&entries[0], false, self_cluster);
            fill_dot_entry(&entries[1], true, parent_cluster);
            fill_entry(&entries[2], "CURRENT SAV", FAT16_ATTR_READ_ONLY, FAT16_CLUSTER_RAM_CURRENT_SAV_START,
                       CART_SERVICE_SAVE_SIZE_BYTES);
            set_entry_write_timestamp(&entries[2], g_current_save_write_date, g_current_save_write_time);
            fill_entry(&entries[3], "TYPE       ", FAT16_ATTR_DIRECTORY, FAT16_CLUSTER_RAM_TYPE_DIR, 0u);
            fill_entry(&entries[4], "STATUS  TXT", FAT16_ATTR_READ_ONLY, FAT16_CLUSTER_RAM_STATUS_TXT,
                       virtual_disk_get_text_view_size(FAT16_VIEW_RAM_STATUS_TXT));
            fill_entry(&entries[5], "ERASE   TXT", FAT16_ATTR_ARCHIVE, FAT16_CLUSTER_RAM_ERASE_TXT,
                       virtual_disk_get_text_view_size(FAT16_VIEW_RAM_ERASE_TXT));
            return true;
        case FAT16_VIEW_RAM_TYPE_DIR:
            self_cluster = FAT16_CLUSTER_RAM_TYPE_DIR;
            parent_cluster = FAT16_CLUSTER_RAM_DIR;
            fill_dot_entry(&entries[0], false, self_cluster);
            fill_dot_entry(&entries[1], true, parent_cluster);
            fill_entry(&entries[2], "SRAM    TXT", FAT16_ATTR_READ_ONLY, FAT16_CLUSTER_RAM_TYPE_SRAM_TXT,
                       virtual_disk_get_text_view_size(FAT16_VIEW_RAM_TYPE_SRAM_TXT));
            fill_entry(&entries[3], "FRAM    TXT", FAT16_ATTR_READ_ONLY, FAT16_CLUSTER_RAM_TYPE_FRAM_TXT,
                       virtual_disk_get_text_view_size(FAT16_VIEW_RAM_TYPE_FRAM_TXT));
            fill_entry(&entries[4], "FLASH   TXT", FAT16_ATTR_READ_ONLY, FAT16_CLUSTER_RAM_TYPE_FLASH_TXT,
                       virtual_disk_get_text_view_size(FAT16_VIEW_RAM_TYPE_FLASH_TXT));
            fill_entry(&entries[5], "SELECT  TXT", FAT16_ATTR_ARCHIVE, FAT16_CLUSTER_RAM_TYPE_SELECT_TXT,
                       virtual_disk_get_text_view_size(FAT16_VIEW_RAM_TYPE_SELECT_TXT));
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
            memset(buf, 0, FAT16_SECTOR_SIZE);
            buf[0] = 0xEFu;
            buf[1] = 0xBBu;
            buf[2] = 0xBFu;
            return cart_service_build_status_text((char *)&buf[UTF8_BOM_SIZE], FAT16_SECTOR_SIZE - UTF8_BOM_SIZE);
        case FAT16_VIEW_APPLY_TXT:
            memset(buf, 0, FAT16_SECTOR_SIZE);
            buf[0] = 0xEFu;
            buf[1] = 0xBBu;
            buf[2] = 0xBFu;
            return cart_service_build_apply_text((char *)&buf[UTF8_BOM_SIZE], FAT16_SECTOR_SIZE - UTF8_BOM_SIZE);
        case FAT16_VIEW_ROM_CFI_TXT:
            memset(buf, 0, FAT16_SECTOR_SIZE);
            buf[0] = 0xEFu;
            buf[1] = 0xBBu;
            buf[2] = 0xBFu;
            return cart_service_build_cfi_text((char *)&buf[UTF8_BOM_SIZE], FAT16_SECTOR_SIZE - UTF8_BOM_SIZE);
        case FAT16_VIEW_ROM_CONFIG_TXT:
            memset(buf, 0, FAT16_SECTOR_SIZE);
            buf[0] = 0xEFu;
            buf[1] = 0xBBu;
            buf[2] = 0xBFu;
            return cart_service_build_rom_config_text((char *)&buf[UTF8_BOM_SIZE], FAT16_SECTOR_SIZE - UTF8_BOM_SIZE);
        case FAT16_VIEW_RAM_TYPE_SRAM_TXT:
            memset(buf, 0, FAT16_SECTOR_SIZE);
            buf[0] = 0xEFu;
            buf[1] = 0xBBu;
            buf[2] = 0xBFu;
            return cart_service_build_ram_type_option_text(
                (char *)&buf[UTF8_BOM_SIZE], FAT16_SECTOR_SIZE - UTF8_BOM_SIZE, CART_SERVICE_RAM_TYPE_SRAM);
        case FAT16_VIEW_RAM_TYPE_FRAM_TXT:
            memset(buf, 0, FAT16_SECTOR_SIZE);
            buf[0] = 0xEFu;
            buf[1] = 0xBBu;
            buf[2] = 0xBFu;
            return cart_service_build_ram_type_option_text(
                (char *)&buf[UTF8_BOM_SIZE], FAT16_SECTOR_SIZE - UTF8_BOM_SIZE, CART_SERVICE_RAM_TYPE_FRAM);
        case FAT16_VIEW_RAM_TYPE_FLASH_TXT:
            memset(buf, 0, FAT16_SECTOR_SIZE);
            buf[0] = 0xEFu;
            buf[1] = 0xBBu;
            buf[2] = 0xBFu;
            return cart_service_build_ram_type_option_text(
                (char *)&buf[UTF8_BOM_SIZE], FAT16_SECTOR_SIZE - UTF8_BOM_SIZE, CART_SERVICE_RAM_TYPE_FLASH);
        case FAT16_VIEW_RAM_TYPE_SELECT_TXT:
            memset(buf, 0, FAT16_SECTOR_SIZE);
            buf[0] = 0xEFu;
            buf[1] = 0xBBu;
            buf[2] = 0xBFu;
            return cart_service_build_ram_type_select_text(
                (char *)&buf[UTF8_BOM_SIZE], FAT16_SECTOR_SIZE - UTF8_BOM_SIZE);
        case FAT16_VIEW_RAM_STATUS_TXT:
            memset(buf, 0, FAT16_SECTOR_SIZE);
            buf[0] = 0xEFu;
            buf[1] = 0xBBu;
            buf[2] = 0xBFu;
            return cart_service_build_ram_status_text(
                (char *)&buf[UTF8_BOM_SIZE], FAT16_SECTOR_SIZE - UTF8_BOM_SIZE);
        case FAT16_VIEW_RAM_ERASE_TXT:
            memset(buf, 0, FAT16_SECTOR_SIZE);
            buf[0] = 0xEFu;
            buf[1] = 0xBBu;
            buf[2] = 0xBFu;
            return cart_service_build_ram_erase_text(
                (char *)&buf[UTF8_BOM_SIZE], FAT16_SECTOR_SIZE - UTF8_BOM_SIZE);
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

static bool is_text_view(Fat16ViewId view_id)
{
    switch (view_id) {
        case FAT16_VIEW_INFO_TXT:
        case FAT16_VIEW_STATUS_TXT:
        case FAT16_VIEW_APPLY_TXT:
        case FAT16_VIEW_ROM_CFI_TXT:
        case FAT16_VIEW_ROM_CONFIG_TXT:
        case FAT16_VIEW_RAM_TYPE_SRAM_TXT:
        case FAT16_VIEW_RAM_TYPE_FRAM_TXT:
        case FAT16_VIEW_RAM_TYPE_FLASH_TXT:
        case FAT16_VIEW_RAM_TYPE_SELECT_TXT:
        case FAT16_VIEW_RAM_STATUS_TXT:
        case FAT16_VIEW_RAM_ERASE_TXT:
            return true;
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

    if (is_text_view(view.view_id)) {
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
        case FAT16_VIEW_APPLY_TXT:
            if (cart_service_apply_pending_config_text(buf, FAT16_SECTOR_SIZE)) {
                virtual_disk_note_medium_change();
                return true;
            }
            return false;
        case FAT16_VIEW_ROM_CONFIG_TXT:
            if (cart_service_apply_rom_config_text(buf, FAT16_SECTOR_SIZE)) {
                virtual_disk_note_medium_change();
                return true;
            }
            return false;
        case FAT16_VIEW_RAM_TYPE_SELECT_TXT:
            if (cart_service_apply_ram_type_select_text(buf, FAT16_SECTOR_SIZE)) {
                virtual_disk_note_medium_change();
                return true;
            }
            return false;
        case FAT16_VIEW_RAM_ERASE_TXT:
            if (cart_service_apply_ram_erase_text(buf, FAT16_SECTOR_SIZE)) {
                bump_current_save_timestamp();
                virtual_disk_note_medium_change();
                return true;
            }
            return false;
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
    uint32_t file_offset = 0u;

    if (!fat16_layout_cluster_from_lba(lba, &cluster, &sector_in_cluster)) {
        return true;
    }

    if (fat16_layout_get_view(cluster, &view, &cluster_offset)) {
        if (view.is_directory) {
            if (view.view_id == FAT16_VIEW_RAM_DIR) {
                handle_ram_dir_write(sector_in_cluster, buf);
            }
            return true;
        }

        if (is_text_view(view.view_id)) {
            return write_text_view(view.view_id, sector_in_cluster, buf);
        }

        if (resolve_ram_import_offset(cluster, sector_in_cluster, &file_offset)) {
            uint32_t bytes_to_write = FAT16_SECTOR_SIZE;

            if ((CART_SERVICE_UPLOAD_BUFFER_SIZE - file_offset) < bytes_to_write) {
                bytes_to_write = CART_SERVICE_UPLOAD_BUFFER_SIZE - file_offset;
            }

            if (cart_service_write_save(file_offset, buf, bytes_to_write)) {
                note_ram_import_progress();
                return true;
            }

            return false;
        }

        return true;
    }

    if (resolve_ram_import_offset(cluster, sector_in_cluster, &file_offset) ||
        resolve_candidate_import_offset(cluster, sector_in_cluster, &file_offset)) {
        uint32_t bytes_to_write = FAT16_SECTOR_SIZE;

        if ((CART_SERVICE_UPLOAD_BUFFER_SIZE - file_offset) < bytes_to_write) {
            bytes_to_write = CART_SERVICE_UPLOAD_BUFFER_SIZE - file_offset;
        }

        if (cart_service_write_save(file_offset, buf, bytes_to_write)) {
            note_ram_import_progress();
            return true;
        }

        return false;
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

        act_led_signal_activity();

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

        act_led_signal_activity();

        if (current_lba < FAT16_DATA_LBA) {
            if (current_lba >= FAT16_RESERVED_SECTORS &&
                current_lba < (FAT16_RESERVED_SECTORS + FAT16_FAT_SECTORS)) {
                handle_fat_write(current_lba - FAT16_RESERVED_SECTORS, current_buf);
            } else if (current_lba >= (FAT16_RESERVED_SECTORS + FAT16_FAT_SECTORS) &&
                       current_lba < (FAT16_RESERVED_SECTORS + (2u * FAT16_FAT_SECTORS))) {
                handle_fat_write(current_lba - FAT16_RESERVED_SECTORS - FAT16_FAT_SECTORS, current_buf);
            }
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

bool virtual_disk_get_ram_import_debug(uint32_t *active,
                                       uint32_t *valid,
                                       uint32_t *first_cluster,
                                       uint32_t *cluster_count,
                                       uint32_t *file_size,
                                       uint32_t *candidate_count,
                                       uint32_t *ram_dir_write_count,
                                       uint32_t *fat_write_count,
                                       uint32_t *last_fat_cluster,
                                       uint32_t *last_fat_value)
{
    if (active != NULL) {
        *active = g_ram_import_file.active ? 1u : 0u;
    }
    if (valid != NULL) {
        *valid = g_ram_import_file.valid ? 1u : 0u;
    }
    if (first_cluster != NULL) {
        *first_cluster = g_ram_import_file.first_cluster;
    }
    if (cluster_count != NULL) {
        *cluster_count = g_ram_import_file.cluster_count;
    }
    if (file_size != NULL) {
        *file_size = g_ram_import_file.file_size;
    }
    if (candidate_count != NULL) {
        *candidate_count = g_candidate_import_cluster_count;
    }
    if (ram_dir_write_count != NULL) {
        *ram_dir_write_count = g_ram_dir_write_count;
    }
    if (fat_write_count != NULL) {
        *fat_write_count = g_fat_write_count;
    }
    if (last_fat_cluster != NULL) {
        *last_fat_cluster = g_last_fat_cluster;
    }
    if (last_fat_value != NULL) {
        *last_fat_value = g_last_fat_value;
    }

    return true;
}

uint32_t virtual_disk_get_text_view_size(Fat16ViewId view_id)
{
    uint8_t buf[FAT16_SECTOR_SIZE];

    if (!read_text_view(view_id, 0u, buf)) {
        return 0u;
    }

    return get_text_buffer_size(buf);
}

void virtual_disk_note_medium_change(void)
{
    g_virtual_disk_medium_changed = true;
}

bool virtual_disk_consume_medium_change(void)
{
    bool changed = g_virtual_disk_medium_changed;

    g_virtual_disk_medium_changed = false;
    return changed;
}
