#include "cart_service.h"

#include <ctype.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "cart_adapter.h"

#define ROM_READ_CHUNK_WORDS 128u
#define CFI_QUERY_BUFFER_SIZE 256u
#define CFI_MAX_SECTOR_REGIONS 4u
#define CART_SERVICE_TEXT_BUFFER_BYTES 512u

typedef struct {
    uint32_t sector_size;
    uint32_t sector_count;
    uint32_t total_size;
    uint32_t start_address;
    uint32_t end_address;
} CartServiceCfiRegion;

typedef struct {
    uint16_t flash_id[4];
    uint8_t magic_q;
    uint8_t magic_r;
    uint8_t magic_y;
    bool cfi_detected;
    bool is_swap_d0_d1;
    bool is_intel;
    uint8_t vdd_min_raw;
    uint8_t vdd_max_raw;
    bool single_write;
    uint32_t single_write_time_avg_us;
    uint32_t single_write_time_max_us;
    bool buffer_write;
    uint32_t buffer_size;
    uint32_t buffer_write_time_avg_us;
    uint32_t buffer_write_time_max_us;
    bool sector_erase;
    uint32_t sector_erase_time_avg_ms;
    uint32_t sector_erase_time_max_ms;
    bool chip_erase;
    uint32_t chip_erase_time_avg_ms;
    uint32_t chip_erase_time_max_ms;
    bool tb_boot_sector_valid;
    const char *tb_boot_sector_label;
    uint8_t tb_boot_sector_raw;
    uint32_t device_size;
    uint8_t erase_sector_regions;
    bool reverse_sector_region;
    CartServiceCfiRegion regions[CFI_MAX_SECTOR_REGIONS];
} CartServiceCfiInfo;

typedef struct {
    bool valid;
    CartServiceCfiInfo info;
} CartServiceCfiCache;

typedef struct {
    uint32_t base_address;
    uint32_t size_bytes;
} CartServiceRomWindow;

static CartServiceCfiCache g_cart_service_cfi_cache;
static CartServiceRomWindow g_cart_service_rom_window;

static uint32_t pow2_u32(uint8_t exponent)
{
    if (exponent >= 31u) {
        return 0u;
    }

    return 1u << exponent;
}

static uint8_t swap_d0_d1(uint8_t value)
{
    uint8_t bit0 = (uint8_t)((value & 0x01u) << 1u);
    uint8_t bit1 = (uint8_t)((value & 0x02u) >> 1u);

    return (uint8_t)((value & 0xFCu) | bit0 | bit1);
}

static bool is_known_value(uint8_t value)
{
    return value != 0x00u && value != 0xFFu;
}

static const char *format_bytes_compact(uint32_t bytes)
{
    if ((bytes % (1024u * 1024u)) == 0u) {
        static char mib_buf[16];
        snprintf(mib_buf, sizeof(mib_buf), "%lu MiB", (unsigned long)(bytes / (1024u * 1024u)));
        return mib_buf;
    }

    if ((bytes % 1024u) == 0u) {
        static char kib_buf[16];
        snprintf(kib_buf, sizeof(kib_buf), "%lu KiB", (unsigned long)(bytes / 1024u));
        return kib_buf;
    }

    static char byte_buf[16];
    snprintf(byte_buf, sizeof(byte_buf), "%lu B", (unsigned long)bytes);
    return byte_buf;
}

static bool appendf(char **cursor, uint32_t *remaining, const char *format, ...)
{
    va_list args;
    int written;

    if (cursor == NULL || *cursor == NULL || remaining == NULL || *remaining == 0u) {
        return false;
    }

    va_start(args, format);
    written = vsnprintf(*cursor, *remaining, format, args);
    va_end(args);

    if (written < 0) {
        return false;
    }

    if ((uint32_t)written >= *remaining) {
        *cursor += *remaining - 1u;
        *remaining = 1u;
        return false;
    }

    *cursor += written;
    *remaining -= (uint32_t)written;
    return true;
}

static void cart_service_reset_rom_read_mode(void)
{
    uint16_t cmd = 0xF0u;

    cart_romWrite(0u, &cmd, 1u);
}

static bool cart_service_read_rom_raw(uint32_t offset, uint8_t *buf, uint32_t len)
{
    uint16_t scratch[ROM_READ_CHUNK_WORDS];

    if (buf == NULL) {
        return false;
    }

    while (len > 0u) {
        uint32_t byte_in_word = offset & 0x1u;
        uint32_t words_needed = (len + byte_in_word + 1u) / 2u;
        uint32_t words_to_read = words_needed;
        uint32_t copied = 0u;

        if (words_to_read > ROM_READ_CHUNK_WORDS) {
            words_to_read = ROM_READ_CHUNK_WORDS;
        }

        cart_romRead(offset >> 1u, scratch, (uint16_t)words_to_read);

        for (uint32_t word_index = 0u; word_index < words_to_read && copied < len; ++word_index) {
            uint16_t value = scratch[word_index];
            uint8_t lo = (uint8_t)(value & 0x00ffu);
            uint8_t hi = (uint8_t)((value >> 8u) & 0x00ffu);

            if ((word_index != 0u) || (byte_in_word == 0u)) {
                buf[copied++] = lo;
                if (copied >= len) {
                    break;
                }
            }

            buf[copied++] = hi;
        }

        offset += copied;
        buf += copied;
        len -= copied;
    }

    return true;
}

static void cart_service_read_rom_id(uint16_t flash_id[4])
{
    uint16_t cmd;

    if (flash_id == NULL) {
        return;
    }

    cmd = 0xAAu;
    cart_romWrite(0x555u, &cmd, 1u);
    cmd = 0x55u;
    cart_romWrite(0x2AAu, &cmd, 1u);
    cmd = 0x90u;
    cart_romWrite(0x555u, &cmd, 1u);

    cart_romRead(0x00u, &flash_id[0], 1u);
    cart_romRead(0x01u, &flash_id[1], 1u);
    cart_romRead(0x0Eu, &flash_id[2], 1u);
    cart_romRead(0x0Fu, &flash_id[3], 1u);

    cart_service_reset_rom_read_mode();
}

static void cart_service_read_cfi_raw(uint8_t *buf, uint32_t len)
{
    uint16_t cmd = 0x98u;

    if (buf == NULL || len == 0u) {
        return;
    }

    cart_service_reset_rom_read_mode();
    cart_romWrite(0x55u, &cmd, 1u);
    (void)cart_service_read_rom_raw(0u, buf, len);
    cart_service_reset_rom_read_mode();
}

static bool cart_service_flash_id_matches(const uint16_t lhs[4], const uint16_t rhs[4])
{
    return memcmp(lhs, rhs, sizeof(uint16_t) * 4u) == 0;
}

static void cart_service_parse_cfi_regions(const uint8_t *buffer, CartServiceCfiInfo *info)
{
    uint32_t region_sizes[CFI_MAX_SECTOR_REGIONS];
    uint32_t total_size = 0u;

    info->erase_sector_regions = buffer[0x58u];
    if (info->erase_sector_regions > CFI_MAX_SECTOR_REGIONS) {
        info->erase_sector_regions = CFI_MAX_SECTOR_REGIONS;
    }

    for (uint32_t i = 0u; i < info->erase_sector_regions; ++i) {
        uint32_t sector_count = (uint32_t)(((uint16_t)buffer[0x5Au + (i * 8u)] |
                                            ((uint16_t)buffer[0x5Cu + (i * 8u)] << 8u)) +
                                           1u);
        uint32_t sector_size =
            (uint32_t)(((uint16_t)buffer[0x5Eu + (i * 8u)] | ((uint16_t)buffer[0x60u + (i * 8u)] << 8u)) * 256u);

        info->regions[i].sector_count = sector_count;
        info->regions[i].sector_size = sector_size;
        info->regions[i].total_size = sector_count * sector_size;
        region_sizes[i] = info->regions[i].total_size;
        total_size += region_sizes[i];
    }

    if (info->reverse_sector_region) {
        uint32_t current_addr = total_size;

        for (uint32_t i = 0u; i < info->erase_sector_regions; ++i) {
            uint32_t reverse_index = (info->erase_sector_regions - 1u) - i;
            current_addr -= region_sizes[i];
            info->regions[reverse_index].start_address = current_addr;
            info->regions[reverse_index].end_address = current_addr + region_sizes[i];
        }
    } else {
        uint32_t current_addr = 0u;

        for (uint32_t i = 0u; i < info->erase_sector_regions; ++i) {
            info->regions[i].start_address = current_addr;
            info->regions[i].end_address = current_addr + region_sizes[i];
            current_addr += region_sizes[i];
        }
    }
}

static void cart_service_parse_cfi_info(const uint8_t *raw_buffer, CartServiceCfiInfo *info)
{
    uint8_t buffer[CFI_QUERY_BUFFER_SIZE];
    uint32_t pri_address;

    memset(info, 0, sizeof(*info));
    memcpy(buffer, raw_buffer, sizeof(buffer));

    info->magic_q = buffer[0x20u];
    info->magic_r = buffer[0x22u];
    info->magic_y = buffer[0x24u];
    info->is_intel = false;

    if (info->magic_q == 0x51u && info->magic_r == 0x52u && info->magic_y == 0x59u) {
        info->cfi_detected = true;
        info->is_swap_d0_d1 = false;
    } else if (swap_d0_d1(info->magic_q) == 0x51u && swap_d0_d1(info->magic_r) == 0x52u &&
               swap_d0_d1(info->magic_y) == 0x59u) {
        info->cfi_detected = true;
        info->is_swap_d0_d1 = true;
    } else {
        return;
    }

    if (info->is_swap_d0_d1) {
        for (uint32_t i = 0u; i < sizeof(buffer); ++i) {
            buffer[i] = swap_d0_d1(buffer[i]);
        }
    }

    info->magic_q = buffer[0x20u];
    info->magic_r = buffer[0x22u];
    info->magic_y = buffer[0x24u];

    info->vdd_min_raw = buffer[0x36u];
    info->vdd_max_raw = buffer[0x38u];

    if (is_known_value(buffer[0x3Eu])) {
        info->single_write = true;
        info->single_write_time_avg_us = pow2_u32(buffer[0x3Eu]);
        info->single_write_time_max_us = pow2_u32(buffer[0x46u]) * info->single_write_time_avg_us;
    }

    if (is_known_value(buffer[0x40u])) {
        info->buffer_write = true;
        info->buffer_write_time_avg_us = pow2_u32(buffer[0x40u]);
        info->buffer_write_time_max_us = pow2_u32(buffer[0x48u]) * info->buffer_write_time_avg_us;
    }

    if (is_known_value(buffer[0x42u])) {
        info->sector_erase = true;
        info->sector_erase_time_avg_ms = pow2_u32(buffer[0x42u]);
        info->sector_erase_time_max_ms = pow2_u32(buffer[0x4Au]) * info->sector_erase_time_avg_ms;
    }

    if (is_known_value(buffer[0x44u])) {
        info->chip_erase = true;
        info->chip_erase_time_avg_ms = pow2_u32(buffer[0x44u]);
        info->chip_erase_time_max_ms = pow2_u32(buffer[0x4Cu]) * info->chip_erase_time_avg_ms;
    }

    info->device_size = pow2_u32(buffer[0x4Eu]);

    {
        uint16_t buffer_size_value = (uint16_t)((buffer[0x56u] << 8u) | buffer[0x54u]);
        if (buffer_size_value > 1u) {
            info->buffer_write = true;
            info->buffer_size = pow2_u32((uint8_t)buffer_size_value);
        }
    }

    pri_address = (uint32_t)(((uint16_t)buffer[0x2Au] | ((uint16_t)buffer[0x2Cu] << 8u)) * 2u);
    if ((pri_address + 0x1Eu) >= sizeof(buffer)) {
        pri_address = 0x80u;
    }

    if ((pri_address + 0x1Eu) < sizeof(buffer) && buffer[pri_address] == 'P' && buffer[pri_address + 2u] == 'R' &&
        buffer[pri_address + 4u] == 'I' && is_known_value(buffer[pri_address + 0x1Eu])) {
        info->tb_boot_sector_valid = true;
        info->tb_boot_sector_raw = buffer[pri_address + 0x1Eu];
        if (info->tb_boot_sector_raw == 0x02u) {
            info->tb_boot_sector_label = "AS_SHOWN";
        } else if (info->tb_boot_sector_raw == 0x03u) {
            info->tb_boot_sector_label = "REVERSED";
            info->reverse_sector_region = true;
        } else {
            info->tb_boot_sector_label = "UNKNOWN";
        }
    }

    cart_service_parse_cfi_regions(buffer, info);
}

static void cart_service_refresh_cfi_cache(void)
{
    uint8_t raw_cfi[CFI_QUERY_BUFFER_SIZE];
    uint16_t flash_id[4];

    cart_service_read_rom_id(flash_id);

    if (g_cart_service_cfi_cache.valid &&
        cart_service_flash_id_matches(g_cart_service_cfi_cache.info.flash_id, flash_id)) {
        return;
    }

    memset(&g_cart_service_cfi_cache.info, 0, sizeof(g_cart_service_cfi_cache.info));
    memcpy(g_cart_service_cfi_cache.info.flash_id, flash_id, sizeof(flash_id));

    memset(raw_cfi, 0, sizeof(raw_cfi));
    cart_service_read_cfi_raw(raw_cfi, sizeof(raw_cfi));
    cart_service_parse_cfi_info(raw_cfi, &g_cart_service_cfi_cache.info);
    memcpy(g_cart_service_cfi_cache.info.flash_id, flash_id, sizeof(flash_id));
    g_cart_service_cfi_cache.valid = true;
}

static uint32_t cart_service_get_effective_rom_size(const CartServiceCfiInfo *info)
{
    uint32_t size = CART_SERVICE_ROM_MAX_SIZE_BYTES;

    if (info != NULL && info->cfi_detected && info->device_size != 0u) {
        size = info->device_size;
    }

    if (size > CART_SERVICE_ROM_MAX_SIZE_BYTES) {
        size = CART_SERVICE_ROM_MAX_SIZE_BYTES;
    }

    return size;
}

static uint32_t cart_service_get_detected_rom_size(void)
{
    cart_service_refresh_cfi_cache();
    return cart_service_get_effective_rom_size(&g_cart_service_cfi_cache.info);
}

static void cart_service_get_resolved_rom_window(uint32_t *base_address, uint32_t *size_bytes)
{
    uint32_t device_size = cart_service_get_detected_rom_size();
    uint32_t resolved_base = g_cart_service_rom_window.base_address;
    uint32_t resolved_size = g_cart_service_rom_window.size_bytes;
    uint32_t max_window_size = device_size;

    if (resolved_base >= device_size) {
        resolved_base = 0u;
    }

    if (resolved_base < device_size) {
        max_window_size = device_size - resolved_base;
    }

    if (resolved_size == 0u || resolved_size > max_window_size) {
        resolved_size = max_window_size;
    }

    if (base_address != NULL) {
        *base_address = resolved_base;
    }

    if (size_bytes != NULL) {
        *size_bytes = resolved_size;
    }
}

static char *trim_left(char *text)
{
    while (*text != '\0' && isspace((unsigned char)*text)) {
        ++text;
    }

    return text;
}

static void trim_right(char *text)
{
    size_t len = strlen(text);

    while (len > 0u && isspace((unsigned char)text[len - 1u])) {
        text[--len] = '\0';
    }
}

static bool key_equals(const char *lhs, const char *rhs)
{
    while (*lhs != '\0' && *rhs != '\0') {
        if (toupper((unsigned char)*lhs) != toupper((unsigned char)*rhs)) {
            return false;
        }

        ++lhs;
        ++rhs;
    }

    return *lhs == '\0' && *rhs == '\0';
}

static bool parse_u32_value(const char *text, uint32_t *value)
{
    char *endptr;
    unsigned long parsed = strtoul(text, &endptr, 0);

    if (endptr == text) {
        return false;
    }

    while (*endptr != '\0' && isspace((unsigned char)*endptr)) {
        ++endptr;
    }

    if (*endptr != '\0') {
        return false;
    }

    *value = (uint32_t)parsed;
    return true;
}

uint32_t cart_service_get_rom_device_size(void)
{
    return cart_service_get_detected_rom_size();
}

uint32_t cart_service_get_rom_size(void)
{
    uint32_t export_size = 0u;

    cart_service_get_resolved_rom_window(NULL, &export_size);
    return export_size;
}

uint32_t cart_service_get_rom_base_address(void)
{
    uint32_t base_address = 0u;

    cart_service_get_resolved_rom_window(&base_address, NULL);
    return base_address;
}

uint32_t cart_service_get_save_size(void)
{
    return CART_SERVICE_SAVE_SIZE_BYTES;
}

bool cart_service_read_rom(uint32_t offset, uint8_t *buf, uint32_t len)
{
    uint32_t base_address = 0u;
    uint32_t export_size = 0u;

    if (buf == NULL) {
        return false;
    }

    cart_service_get_resolved_rom_window(&base_address, &export_size);

    if (offset > export_size || len > (export_size - offset)) {
        return false;
    }

    return cart_service_read_rom_raw(base_address + offset, buf, len);
}

bool cart_service_read_save(uint32_t offset, uint8_t *buf, uint32_t len)
{
    if (buf == NULL) {
        return false;
    }

    if (offset > cart_service_get_save_size() || len > (cart_service_get_save_size() - offset)) {
        return false;
    }

    cart_ramRead((uint16_t)offset, buf, (uint16_t)len);
    return true;
}

bool cart_service_build_cfi_text(char *buf, uint32_t buf_size)
{
    const CartServiceCfiInfo *info;
    char *cursor = buf;
    uint32_t remaining = buf_size;

    if (buf == NULL || buf_size == 0u) {
        return false;
    }

    memset(buf, 0, buf_size);
    cart_service_refresh_cfi_cache();
    info = &g_cart_service_cfi_cache.info;

    appendf(&cursor, &remaining, "CFI REPORT\r\n");
    appendf(&cursor, &remaining, "==========\r\n");
    appendf(&cursor,
            &remaining,
            "CFI_STATUS=%s\r\n",
            info->cfi_detected ? "DETECTED" : "NOT_DETECTED");
    appendf(&cursor,
            &remaining,
            "FLASH_ID=0x%04X,0x%04X,0x%04X,0x%04X\r\n",
            info->flash_id[0],
            info->flash_id[1],
            info->flash_id[2],
            info->flash_id[3]);
    appendf(&cursor,
            &remaining,
            "MAGIC_RAW=0x%02X,0x%02X,0x%02X\r\n",
            info->magic_q,
            info->magic_r,
            info->magic_y);

    if (!info->cfi_detected) {
        appendf(&cursor, &remaining, "NOTE=CFI query failed or cartridge did not answer with QRY.\r\n");
        appendf(&cursor,
                &remaining,
                "EXPORT_SIZE=0x%08lX (%s)\r\n",
                (unsigned long)cart_service_get_effective_rom_size(info),
                format_bytes_compact(cart_service_get_effective_rom_size(info)));
        return true;
    }

    appendf(&cursor,
            &remaining,
            "MAGIC=%c%c%c\r\n",
            info->magic_q,
            info->magic_r,
            info->magic_y);
    appendf(&cursor,
            &remaining,
            "DATA_SWAP=%s\r\n",
            info->is_swap_d0_d1 ? "D0D1_SWAPPED" : "NONE");
    appendf(&cursor, &remaining, "INTEL_FLASH=%u\r\n", info->is_intel ? 1u : 0u);
    appendf(&cursor,
            &remaining,
            "DEVICE_SIZE=0x%08lX (%s)\r\n",
            (unsigned long)info->device_size,
            format_bytes_compact(info->device_size));
    appendf(&cursor,
            &remaining,
            "EXPORT_SIZE=0x%08lX (%s)\r\n",
            (unsigned long)cart_service_get_effective_rom_size(info),
            format_bytes_compact(cart_service_get_effective_rom_size(info)));

    if (is_known_value(info->vdd_min_raw) && is_known_value(info->vdd_max_raw)) {
        appendf(&cursor,
                &remaining,
                "VDD=%u.%u-%u.%uV\r\n",
                (unsigned int)(info->vdd_min_raw >> 4u),
                (unsigned int)(info->vdd_min_raw & 0x0Fu),
                (unsigned int)(info->vdd_max_raw >> 4u),
                (unsigned int)(info->vdd_max_raw & 0x0Fu));
    }

    appendf(&cursor, &remaining, "SINGLE_WRITE=%u\r\n", info->single_write ? 1u : 0u);
    if (info->single_write) {
        appendf(&cursor,
                &remaining,
                "SINGLE_WRITE_TIME_US=%lu-%lu\r\n",
                (unsigned long)info->single_write_time_avg_us,
                (unsigned long)info->single_write_time_max_us);
    }

    appendf(&cursor, &remaining, "BUFFER_WRITE=%u\r\n", info->buffer_write ? 1u : 0u);
    if (info->buffer_write) {
        if (info->buffer_size != 0u) {
            appendf(&cursor, &remaining, "BUFFER_SIZE=%lu\r\n", (unsigned long)info->buffer_size);
        }
        if (info->buffer_write_time_avg_us != 0u && info->buffer_write_time_max_us != 0u) {
            appendf(&cursor,
                    &remaining,
                    "BUFFER_WRITE_TIME_US=%lu-%lu\r\n",
                    (unsigned long)info->buffer_write_time_avg_us,
                    (unsigned long)info->buffer_write_time_max_us);
        }
    }

    appendf(&cursor, &remaining, "SECTOR_ERASE=%u\r\n", info->sector_erase ? 1u : 0u);
    if (info->sector_erase) {
        appendf(&cursor,
                &remaining,
                "SECTOR_ERASE_TIME_MS=%lu-%lu\r\n",
                (unsigned long)info->sector_erase_time_avg_ms,
                (unsigned long)info->sector_erase_time_max_ms);
    }

    appendf(&cursor, &remaining, "CHIP_ERASE=%u\r\n", info->chip_erase ? 1u : 0u);
    if (info->chip_erase) {
        appendf(&cursor,
                &remaining,
                "CHIP_ERASE_TIME_MS=%lu-%lu\r\n",
                (unsigned long)info->chip_erase_time_avg_ms,
                (unsigned long)info->chip_erase_time_max_ms);
    }

    if (info->tb_boot_sector_valid) {
        appendf(&cursor,
                &remaining,
                "BOOT_SECTOR=%s (0x%02X)\r\n",
                info->tb_boot_sector_label,
                info->tb_boot_sector_raw);
    }

    appendf(&cursor, &remaining, "REGION_COUNT=%u\r\n", info->erase_sector_regions);
    for (uint32_t i = 0u; i < info->erase_sector_regions; ++i) {
        appendf(&cursor,
                &remaining,
                "REGION%lu=0x%06lX-0x%06lX @0x%04lX x %lu\r\n",
                (unsigned long)(i + 1u),
                (unsigned long)info->regions[i].start_address,
                (unsigned long)(info->regions[i].end_address - 1u),
                (unsigned long)info->regions[i].sector_size,
                (unsigned long)info->regions[i].sector_count);
    }

    return true;
}

bool cart_service_build_mode_text(char *buf, uint32_t buf_size)
{
    char *cursor = buf;
    uint32_t remaining = buf_size;
    uint32_t base_address = 0u;
    uint32_t export_size = 0u;
    uint32_t device_size = 0u;
    uint32_t export_end = 0u;

    if (buf == NULL || buf_size == 0u) {
        return false;
    }

    memset(buf, 0, buf_size);
    cart_service_get_resolved_rom_window(&base_address, &export_size);
    device_size = cart_service_get_rom_device_size();
    export_end = export_size == 0u ? base_address : (base_address + export_size - 1u);

    appendf(&cursor, &remaining, "ROM MODE\r\n");
    appendf(&cursor, &remaining, "========\r\n");
    appendf(&cursor, &remaining, "BASE_ADDRESS=0x%08lX\r\n", (unsigned long)base_address);
    appendf(&cursor, &remaining, "SIZE=0x%08lX\r\n", (unsigned long)export_size);
    appendf(&cursor,
            &remaining,
            "DEVICE_SIZE=0x%08lX (%s)\r\n",
            (unsigned long)device_size,
            format_bytes_compact(device_size));
    appendf(&cursor, &remaining, "EXPORT_END=0x%08lX\r\n", (unsigned long)export_end);
    appendf(&cursor, &remaining, "ROM_PATH=/ROM/CURRENT.GBA\r\n");
    appendf(&cursor, &remaining, "NOTE=Edit BASE_ADDRESS and SIZE, then save MODE.TXT.\r\n");
    appendf(&cursor, &remaining, "NOTE=SIZE=0 uses the remaining bytes from BASE_ADDRESS.\r\n");
    appendf(&cursor, &remaining, "NOTE=Values are clamped to the detected ROM size.\r\n");
    return true;
}

bool cart_service_apply_mode_text(const uint8_t *buf, uint32_t len)
{
    char text[CART_SERVICE_TEXT_BUFFER_BYTES + 1u];
    char *cursor = text;
    uint32_t base_address = cart_service_get_rom_base_address();
    uint32_t export_size = cart_service_get_rom_size();
    uint32_t recognized = 0u;
    uint32_t copy_len = len;

    if (buf == NULL) {
        return false;
    }

    if (copy_len > CART_SERVICE_TEXT_BUFFER_BYTES) {
        copy_len = CART_SERVICE_TEXT_BUFFER_BYTES;
    }

    memset(text, 0, sizeof(text));
    memcpy(text, buf, copy_len);

    if ((uint8_t)cursor[0] == 0xEFu && (uint8_t)cursor[1] == 0xBBu && (uint8_t)cursor[2] == 0xBFu) {
        cursor += 3;
    }

    while (*cursor != '\0') {
        char *line = cursor;
        char *equals;
        char *key;
        char *value;
        char line_end;

        while (*cursor != '\0' && *cursor != '\r' && *cursor != '\n') {
            ++cursor;
        }

        line_end = *cursor;
        *cursor = '\0';

        line = trim_left(line);
        trim_right(line);

        if (*line != '\0' && *line != '#' && *line != ';') {
            equals = strchr(line, '=');
            if (equals != NULL) {
                *equals = '\0';
                key = trim_left(line);
                trim_right(key);
                value = trim_left(equals + 1);
                trim_right(value);

                if (key_equals(key, "BASE_ADDRESS")) {
                    if (key_equals(value, "AUTO")) {
                        base_address = 0u;
                    } else if (!parse_u32_value(value, &base_address)) {
                        return false;
                    }
                    ++recognized;
                } else if (key_equals(key, "SIZE")) {
                    if (key_equals(value, "AUTO")) {
                        export_size = 0u;
                    } else if (!parse_u32_value(value, &export_size)) {
                        return false;
                    }
                    ++recognized;
                }
            }
        }

        if (line_end == '\0') {
            break;
        }

        ++cursor;
        if (line_end == '\r' && *cursor == '\n') {
            ++cursor;
        }
    }

    if (recognized == 0u) {
        return false;
    }

    g_cart_service_rom_window.base_address = base_address;
    g_cart_service_rom_window.size_bytes = export_size;
    cart_service_get_resolved_rom_window(&g_cart_service_rom_window.base_address, &g_cart_service_rom_window.size_bytes);
    return true;
}
