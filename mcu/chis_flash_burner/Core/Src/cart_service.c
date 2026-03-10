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
#define CART_SERVICE_FRAM_READ_LATENCY_CYCLES 4u
#define CART_SERVICE_RAM_WRITE_CHUNK_SIZE 1024u

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

typedef struct {
    CartServiceRomWindow rom_window;
    CartServiceRamType ram_type;
} CartServiceConfig;

typedef struct {
    CartServiceConfig current_config;
    CartServiceConfig pending_config;
    uint32_t dirty_mask;
    char last_error[96];
    char last_apply_status[32];
} CartServiceSessionState;

typedef struct {
    CartServiceRamJobState state;
    uint32_t bytes_written;
    uint32_t total_bytes;
    char error_message[96];
    uint8_t upload_buffer[CART_SERVICE_UPLOAD_BUFFER_SIZE];
} CartServiceRamJob;

static CartServiceCfiCache g_cart_service_cfi_cache;
static CartServiceSessionState g_cart_service_session;
static CartServiceRamJob g_cart_service_ram_job;

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

static const char *cart_service_ram_type_label(CartServiceRamType type)
{
    switch (type) {
        case CART_SERVICE_RAM_TYPE_SRAM:
            return "SRAM";
        case CART_SERVICE_RAM_TYPE_FRAM:
            return "FRAM";
        case CART_SERVICE_RAM_TYPE_FLASH:
            return "FLASH";
        default:
            return "UNKNOWN";
    }
}

static const char *cart_service_ram_type_detail(CartServiceRamType type)
{
    switch (type) {
        case CART_SERVICE_RAM_TYPE_SRAM:
            return "Static RAM save mode.";
        case CART_SERVICE_RAM_TYPE_FRAM:
            return "FRAM save mode.";
        case CART_SERVICE_RAM_TYPE_FLASH:
            return "Flash save mode. Capacity-specific handling is resolved later.";
        default:
            return "Unknown save-type option.";
    }
}

static void cart_service_clear_error(void)
{
    g_cart_service_session.last_error[0] = '\0';
}

static void cart_service_set_apply_status(const char *message)
{
    if (message == NULL) {
        g_cart_service_session.last_apply_status[0] = '\0';
        return;
    }

    snprintf(g_cart_service_session.last_apply_status, sizeof(g_cart_service_session.last_apply_status), "%s", message);
}

static void cart_service_set_error(const char *message)
{
    if (message == NULL) {
        cart_service_clear_error();
        return;
    }

    snprintf(g_cart_service_session.last_error, sizeof(g_cart_service_session.last_error), "%s", message);
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

static void cart_service_session_sync_dirty_mask(void)
{
    uint32_t dirty_mask = CART_SERVICE_DIRTY_NONE;

    if ((g_cart_service_session.pending_config.rom_window.base_address !=
         g_cart_service_session.current_config.rom_window.base_address) ||
        (g_cart_service_session.pending_config.rom_window.size_bytes !=
         g_cart_service_session.current_config.rom_window.size_bytes)) {
        dirty_mask |= CART_SERVICE_DIRTY_ROM_WINDOW;
    }

    if (g_cart_service_session.pending_config.ram_type != g_cart_service_session.current_config.ram_type) {
        dirty_mask |= CART_SERVICE_DIRTY_RAM_TYPE;
    }

    g_cart_service_session.dirty_mask = dirty_mask;
}

static void cart_service_get_resolved_rom_window_from_config(const CartServiceConfig *config,
                                                             uint32_t *base_address,
                                                             uint32_t *size_bytes)
{
    uint32_t device_size = cart_service_get_detected_rom_size();
    uint32_t resolved_base = 0u;
    uint32_t resolved_size = 0u;
    uint32_t max_window_size = device_size;

    if (config != NULL) {
        resolved_base = config->rom_window.base_address;
        resolved_size = config->rom_window.size_bytes;
    }

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

static void cart_service_normalize_session_config(CartServiceConfig *config)
{
    if (config == NULL) {
        return;
    }

    cart_service_get_resolved_rom_window_from_config(config,
                                                     &config->rom_window.base_address,
                                                     &config->rom_window.size_bytes);
}

static void cart_service_init_session_state(void)
{
    static bool initialized = false;

    if (initialized) {
        return;
    }

    memset(&g_cart_service_session, 0, sizeof(g_cart_service_session));
    g_cart_service_session.current_config.ram_type = CART_SERVICE_RAM_TYPE_SRAM;
    g_cart_service_session.pending_config = g_cart_service_session.current_config;
    cart_service_normalize_session_config(&g_cart_service_session.current_config);
    cart_service_normalize_session_config(&g_cart_service_session.pending_config);
    cart_service_session_sync_dirty_mask();
    cart_service_clear_error();
    cart_service_set_apply_status("NONE");
    initialized = true;
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

static bool cart_service_parse_ram_type(const char *text, CartServiceRamType *type)
{
    if (text == NULL || type == NULL) {
        return false;
    }

    if (key_equals(text, "SRAM")) {
        *type = CART_SERVICE_RAM_TYPE_SRAM;
    } else if (key_equals(text, "FRAM")) {
        *type = CART_SERVICE_RAM_TYPE_FRAM;
    } else if (key_equals(text, "FLASH")) {
        *type = CART_SERVICE_RAM_TYPE_FLASH;
    } else {
        return false;
    }

    return true;
}

static bool cart_service_read_save_sram(uint32_t offset, uint8_t *buf, uint32_t len)
{
    cart_ramRead((uint16_t)offset, buf, (uint16_t)len);
    return true;
}

static bool cart_service_read_save_fram(uint32_t offset, uint8_t *buf, uint32_t len)
{
    for (uint32_t i = 0u; i < len; ++i) {
        cart_ramRead((uint16_t)(offset + i), buf + i, 1u);
        for (uint32_t wait = 0u; wait < CART_SERVICE_FRAM_READ_LATENCY_CYCLES; ++wait) {
            TIMING_DELAY();
        }
    }

    return true;
}

static bool cart_service_read_save_flash(uint32_t offset, uint8_t *buf, uint32_t len)
{
    for (uint32_t i = 0u; i < len; ++i) {
        cart_ramRead((uint16_t)(offset + i), buf + i, 1u);
        MEMORY_BARRIER();
    }

    return true;
}

static bool cart_service_write_save_sram(uint32_t offset, const uint8_t *buf, uint32_t len)
{
    cart_ramWrite((uint16_t)offset, buf, (uint16_t)len);
    return true;
}

static bool cart_service_write_save_fram(uint32_t offset, const uint8_t *buf, uint32_t len)
{
    for (uint32_t i = 0u; i < len; ++i) {
        cart_ramWrite((uint16_t)(offset + i), buf + i, 1u);
        for (uint32_t wait = 0u; wait < CART_SERVICE_FRAM_READ_LATENCY_CYCLES; ++wait) {
            TIMING_DELAY();
        }
    }

    return true;
}

static bool cart_service_write_save_flash(uint32_t offset, const uint8_t *buf, uint32_t len)
{
    for (uint32_t i = 0u; i < len; ++i) {
        cart_ramWrite((uint16_t)(offset + i), buf + i, 1u);
        MEMORY_BARRIER();
    }

    return true;
}

static bool cart_service_erase_flash_save(void)
{
    return true;
}

uint32_t cart_service_get_rom_device_size(void)
{
    cart_service_init_session_state();
    return cart_service_get_detected_rom_size();
}

uint32_t cart_service_get_rom_size(void)
{
    uint32_t export_size = 0u;

    cart_service_init_session_state();
    cart_service_get_resolved_rom_window_from_config(&g_cart_service_session.current_config, NULL, &export_size);
    return export_size;
}

uint32_t cart_service_get_rom_base_address(void)
{
    uint32_t base_address = 0u;

    cart_service_init_session_state();
    cart_service_get_resolved_rom_window_from_config(&g_cart_service_session.current_config, &base_address, NULL);
    return base_address;
}

uint32_t cart_service_get_pending_rom_size(void)
{
    uint32_t export_size = 0u;

    cart_service_init_session_state();
    cart_service_get_resolved_rom_window_from_config(&g_cart_service_session.pending_config, NULL, &export_size);
    return export_size;
}

uint32_t cart_service_get_pending_rom_base_address(void)
{
    uint32_t base_address = 0u;

    cart_service_init_session_state();
    cart_service_get_resolved_rom_window_from_config(&g_cart_service_session.pending_config, &base_address, NULL);
    return base_address;
}

uint32_t cart_service_get_save_size(void)
{
    return CART_SERVICE_SAVE_SIZE_BYTES;
}

CartServiceRamType cart_service_get_current_ram_type(void)
{
    cart_service_init_session_state();
    return g_cart_service_session.current_config.ram_type;
}

CartServiceRamType cart_service_get_pending_ram_type(void)
{
    cart_service_init_session_state();
    return g_cart_service_session.pending_config.ram_type;
}

bool cart_service_has_pending_changes(void)
{
    cart_service_init_session_state();
    cart_service_session_sync_dirty_mask();
    return g_cart_service_session.dirty_mask != CART_SERVICE_DIRTY_NONE;
}

uint32_t cart_service_get_dirty_mask(void)
{
    cart_service_init_session_state();
    cart_service_session_sync_dirty_mask();
    return g_cart_service_session.dirty_mask;
}

const char *cart_service_get_last_error(void)
{
    cart_service_init_session_state();
    return g_cart_service_session.last_error[0] == '\0' ? "NONE" : g_cart_service_session.last_error;
}

const char *cart_service_get_last_apply_status(void)
{
    cart_service_init_session_state();
    return g_cart_service_session.last_apply_status[0] == '\0' ? "NONE" : g_cart_service_session.last_apply_status;
}

const char *cart_service_get_ram_type_name(CartServiceRamType type)
{
    return cart_service_ram_type_label(type);
}

const char *cart_service_get_ram_type_description(CartServiceRamType type)
{
    return cart_service_ram_type_detail(type);
}

bool cart_service_read_rom(uint32_t offset, uint8_t *buf, uint32_t len)
{
    uint32_t base_address = 0u;
    uint32_t export_size = 0u;

    if (buf == NULL) {
        return false;
    }

    cart_service_init_session_state();
    cart_service_get_resolved_rom_window_from_config(&g_cart_service_session.current_config, &base_address, &export_size);

    if (offset > export_size || len > (export_size - offset)) {
        return false;
    }

    return cart_service_read_rom_raw(base_address + offset, buf, len);
}

bool cart_service_read_save(uint32_t offset, uint8_t *buf, uint32_t len)
{
    cart_service_init_session_state();

    if (buf == NULL) {
        return false;
    }

    if (offset > cart_service_get_save_size() || len > (cart_service_get_save_size() - offset)) {
        return false;
    }

    switch (g_cart_service_session.current_config.ram_type) {
        case CART_SERVICE_RAM_TYPE_SRAM:
            return cart_service_read_save_sram(offset, buf, len);
        case CART_SERVICE_RAM_TYPE_FRAM:
            return cart_service_read_save_fram(offset, buf, len);
        case CART_SERVICE_RAM_TYPE_FLASH:
            return cart_service_read_save_flash(offset, buf, len);
        default:
            return false;
    }
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

bool cart_service_build_status_text(char *buf, uint32_t buf_size)
{
    char *cursor = buf;
    uint32_t remaining = buf_size;

    if (buf == NULL || buf_size == 0u) {
        return false;
    }

    cart_service_init_session_state();
    cart_service_session_sync_dirty_mask();
    memset(buf, 0, buf_size);

    appendf(&cursor, &remaining, "DEVICE STATUS\r\n");
    appendf(&cursor, &remaining, "=============\r\n");
    appendf(&cursor, &remaining, "DEVICE=BEGGAR_SOCKET\r\n");
    appendf(&cursor, &remaining, "STATE=IDLE\r\n");
    appendf(&cursor, &remaining, "USB_MODE=MSC_ONLY\r\n");
    appendf(&cursor, &remaining, "DISK_STATE=READY\r\n");
    appendf(&cursor, &remaining, "CONTROL_PLANE=PARAMETER_FILES\r\n");
    appendf(&cursor, &remaining, "CURRENT_ROM_BASE=0x%08lX\r\n", (unsigned long)cart_service_get_rom_base_address());
    appendf(&cursor, &remaining, "CURRENT_ROM_SIZE=0x%08lX\r\n", (unsigned long)cart_service_get_rom_size());
    appendf(&cursor,
            &remaining,
            "CURRENT_RAM_TYPE=%s\r\n",
            cart_service_ram_type_label(g_cart_service_session.current_config.ram_type));
    appendf(&cursor,
            &remaining,
            "PENDING_ROM_BASE=0x%08lX\r\n",
            (unsigned long)cart_service_get_pending_rom_base_address());
    appendf(&cursor,
            &remaining,
            "PENDING_ROM_SIZE=0x%08lX\r\n",
            (unsigned long)cart_service_get_pending_rom_size());
    appendf(&cursor,
            &remaining,
            "PENDING_RAM_TYPE=%s\r\n",
            cart_service_ram_type_label(g_cart_service_session.pending_config.ram_type));
    appendf(&cursor, &remaining, "UNAPPLIED_CHANGES=%u\r\n", cart_service_has_pending_changes() ? 1u : 0u);
    appendf(&cursor, &remaining, "DIRTY_MASK=0x%02lX\r\n", (unsigned long)g_cart_service_session.dirty_mask);
    appendf(&cursor, &remaining, "LAST_APPLY=%s\r\n", cart_service_get_last_apply_status());
    appendf(&cursor, &remaining, "LAST_ERROR=%s\r\n", cart_service_get_last_error());
    appendf(&cursor, &remaining, "ACTIVE_LAYOUT=FAT16_STAGE_2\r\n");
    return true;
}

bool cart_service_build_apply_text(char *buf, uint32_t buf_size)
{
    char *cursor = buf;
    uint32_t remaining = buf_size;

    if (buf == NULL || buf_size == 0u) {
        return false;
    }

    cart_service_init_session_state();
    cart_service_session_sync_dirty_mask();
    memset(buf, 0, buf_size);

    appendf(&cursor, &remaining, "TYPE=APPLY\r\n");
    appendf(&cursor, &remaining, "PATH=/APPLY.TXT\r\n");
    appendf(&cursor, &remaining, "PENDING_CHANGES=%u\r\n", cart_service_has_pending_changes() ? 1u : 0u);
    appendf(&cursor, &remaining, "LAST_APPLY=%s\r\n", cart_service_get_last_apply_status());
    appendf(&cursor, &remaining, "NOTE=Write APPLY=1 to promote pending config into current config.\r\n");
    return true;
}

bool cart_service_apply_pending_config_text(const uint8_t *buf, uint32_t len)
{
    char text[CART_SERVICE_TEXT_BUFFER_BYTES + 1u];
    char *cursor = text;
    bool recognized = false;
    uint32_t copy_len = len;

    if (buf == NULL) {
        return false;
    }

    cart_service_init_session_state();

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

                if (key_equals(key, "APPLY") && (key_equals(value, "1") || key_equals(value, "YES") || key_equals(value, "TRUE"))) {
                    recognized = true;
                }
            } else if (key_equals(line, "APPLY")) {
                recognized = true;
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

    if (!recognized) {
        cart_service_set_error("INVALID_APPLY_REQUEST");
        cart_service_set_apply_status("REJECTED");
        return false;
    }

    g_cart_service_session.current_config = g_cart_service_session.pending_config;
    cart_service_normalize_session_config(&g_cart_service_session.current_config);
    g_cart_service_session.pending_config = g_cart_service_session.current_config;
    cart_service_session_sync_dirty_mask();
    cart_service_clear_error();
    cart_service_set_apply_status("SUCCESS");
    return true;
}

bool cart_service_build_rom_config_text(char *buf, uint32_t buf_size)
{
    char *cursor = buf;
    uint32_t remaining = buf_size;
    uint32_t current_base = 0u;
    uint32_t current_size = 0u;
    uint32_t pending_base = 0u;
    uint32_t pending_size = 0u;
    uint32_t device_size = 0u;
    uint32_t pending_end = 0u;

    if (buf == NULL || buf_size == 0u) {
        return false;
    }

    cart_service_init_session_state();
    memset(buf, 0, buf_size);
    current_base = cart_service_get_rom_base_address();
    current_size = cart_service_get_rom_size();
    pending_base = cart_service_get_pending_rom_base_address();
    pending_size = cart_service_get_pending_rom_size();
    device_size = cart_service_get_rom_device_size();
    pending_end = pending_size == 0u ? pending_base : (pending_base + pending_size - 1u);

    appendf(&cursor, &remaining, "TYPE=CONFIG\r\n");
    appendf(&cursor, &remaining, "GROUP=ROM_WINDOW\r\n");
    appendf(&cursor, &remaining, "PATH=/ROM/CONFIG.TXT\r\n");
    appendf(&cursor, &remaining, "CURRENT_BASE_ADDRESS=0x%08lX\r\n", (unsigned long)current_base);
    appendf(&cursor, &remaining, "CURRENT_SIZE=0x%08lX\r\n", (unsigned long)current_size);
    appendf(&cursor, &remaining, "BASE_ADDRESS=0x%08lX\r\n", (unsigned long)pending_base);
    appendf(&cursor, &remaining, "SIZE=0x%08lX\r\n", (unsigned long)pending_size);
    appendf(&cursor,
            &remaining,
            "DEVICE_SIZE=0x%08lX (%s)\r\n",
            (unsigned long)device_size,
            format_bytes_compact(device_size));
    appendf(&cursor, &remaining, "PENDING_EXPORT_END=0x%08lX\r\n", (unsigned long)pending_end);
    appendf(&cursor, &remaining, "UNAPPLIED=%u\r\n", (g_cart_service_session.dirty_mask & CART_SERVICE_DIRTY_ROM_WINDOW) ? 1u : 0u);
    appendf(&cursor, &remaining, "NOTE=Edit BASE_ADDRESS and SIZE, then save CONFIG.TXT.\r\n");
    appendf(&cursor, &remaining, "NOTE=SIZE=0 uses the remaining bytes from BASE_ADDRESS.\r\n");
    return true;
}

bool cart_service_apply_rom_config_text(const uint8_t *buf, uint32_t len)
{
    char text[CART_SERVICE_TEXT_BUFFER_BYTES + 1u];
    char *cursor = text;
    CartServiceConfig candidate;
    uint32_t recognized = 0u;
    uint32_t copy_len = len;

    if (buf == NULL) {
        return false;
    }

    cart_service_init_session_state();
    candidate = g_cart_service_session.pending_config;

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
                        candidate.rom_window.base_address = 0u;
                    } else if (!parse_u32_value(value, &candidate.rom_window.base_address)) {
                        cart_service_set_error("INVALID_BASE_ADDRESS");
                        return false;
                    }
                    ++recognized;
                } else if (key_equals(key, "SIZE")) {
                    if (key_equals(value, "AUTO")) {
                        candidate.rom_window.size_bytes = 0u;
                    } else if (!parse_u32_value(value, &candidate.rom_window.size_bytes)) {
                        cart_service_set_error("INVALID_SIZE");
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
        cart_service_set_error("NO_SUPPORTED_KEYS");
        return false;
    }

    cart_service_normalize_session_config(&candidate);
    g_cart_service_session.pending_config = candidate;
    cart_service_session_sync_dirty_mask();
    cart_service_clear_error();
    return true;
}

bool cart_service_build_ram_type_option_text(char *buf, uint32_t buf_size, CartServiceRamType type)
{
    char *cursor = buf;
    uint32_t remaining = buf_size;
    bool is_current;
    bool is_pending;

    if (buf == NULL || buf_size == 0u) {
        return false;
    }

    cart_service_init_session_state();
    memset(buf, 0, buf_size);
    is_current = g_cart_service_session.current_config.ram_type == type;
    is_pending = g_cart_service_session.pending_config.ram_type == type;

    appendf(&cursor, &remaining, "TYPE=OPTION\r\n");
    appendf(&cursor, &remaining, "GROUP=RAM_TYPE\r\n");
    appendf(&cursor, &remaining, "NAME=%s\r\n", cart_service_ram_type_label(type));
    appendf(&cursor, &remaining, "CURRENT=%u\r\n", is_current ? 1u : 0u);
    appendf(&cursor, &remaining, "PENDING=%u\r\n", is_pending ? 1u : 0u);
    appendf(&cursor, &remaining, "SELECTABLE=1\r\n");
    appendf(&cursor, &remaining, "DESC=%s\r\n", cart_service_ram_type_detail(type));
    return true;
}

bool cart_service_build_ram_type_select_text(char *buf, uint32_t buf_size)
{
    char *cursor = buf;
    uint32_t remaining = buf_size;

    if (buf == NULL || buf_size == 0u) {
        return false;
    }

    cart_service_init_session_state();
    memset(buf, 0, buf_size);

    appendf(&cursor, &remaining, "TYPE=SELECT\r\n");
    appendf(&cursor, &remaining, "GROUP=RAM_TYPE\r\n");
    appendf(&cursor, &remaining, "PATH=/RAM/TYPE/SELECT.TXT\r\n");
    appendf(&cursor,
            &remaining,
            "CURRENT=%s\r\n",
            cart_service_ram_type_label(g_cart_service_session.current_config.ram_type));
    appendf(&cursor,
            &remaining,
            "PENDING=%s\r\n",
            cart_service_ram_type_label(g_cart_service_session.pending_config.ram_type));
    appendf(&cursor, &remaining, "VALUE=%s\r\n", cart_service_ram_type_label(g_cart_service_session.pending_config.ram_type));
    appendf(&cursor, &remaining, "OPTIONS=SRAM,FRAM,FLASH\r\n");
    appendf(&cursor, &remaining, "NOTE=Write VALUE=<option> and save SELECT.TXT.\r\n");
    return true;
}

bool cart_service_apply_ram_type_select_text(const uint8_t *buf, uint32_t len)
{
    char text[CART_SERVICE_TEXT_BUFFER_BYTES + 1u];
    char *cursor = text;
    CartServiceRamType parsed_type = CART_SERVICE_RAM_TYPE_SRAM;
    bool recognized = false;
    uint32_t copy_len = len;

    if (buf == NULL) {
        return false;
    }

    cart_service_init_session_state();

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

                if (key_equals(key, "VALUE") || key_equals(key, "SELECT")) {
                    if (!cart_service_parse_ram_type(value, &parsed_type)) {
                        cart_service_set_error("INVALID_RAM_TYPE");
                        return false;
                    }
                    recognized = true;
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

    if (!recognized) {
        cart_service_set_error("NO_SELECTION_VALUE");
        return false;
    }

    g_cart_service_session.pending_config.ram_type = parsed_type;
    cart_service_session_sync_dirty_mask();
    cart_service_clear_error();
    return true;
}

bool cart_service_build_mode_text(char *buf, uint32_t buf_size)
{
    return cart_service_build_rom_config_text(buf, buf_size);
}

bool cart_service_apply_mode_text(const uint8_t *buf, uint32_t len)
{
    return cart_service_apply_rom_config_text(buf, len);
}

/**
 * @brief Accumulates uploaded data into RAM job buffer (Step 4 of workflow)
 *
 * This function is called when user writes to /RAM/UPLOAD.SAV via FAT16.
 * Data is accumulated in memory but NOT written to cartridge hardware yet.
 *
 * Workflow: Configure → Apply → Erase → UPLOAD → Commit → Verify
 *                                        ^^^^^^
 *
 * @param offset Byte offset within the upload buffer (0 to 32KB-1)
 * @param buf Source data buffer
 * @param len Number of bytes to write
 * @return true if successful, false if parameters invalid
 *
 * @note Data remains in MCU memory until cart_service_commit_ram_upload() is called
 * @note Supports FAT16 out-of-order writes by tracking highest offset written
 * @see cart_service_commit_ram_upload() for actual hardware write
 */
bool cart_service_write_save(uint32_t offset, const uint8_t *buf, uint32_t len)
{
    cart_service_init_session_state();

    if (buf == NULL) {
        return false;
    }

    if (offset > CART_SERVICE_UPLOAD_BUFFER_SIZE || len > (CART_SERVICE_UPLOAD_BUFFER_SIZE - offset)) {
        return false;
    }

    /* Copy data to upload buffer (in-memory only) */
    memcpy(&g_cart_service_ram_job.upload_buffer[offset], buf, len);

    /* Transition from IDLE to UPLOADING on first write */
    if (g_cart_service_ram_job.state == CART_SERVICE_RAM_JOB_STATE_IDLE) {
        g_cart_service_ram_job.state = CART_SERVICE_RAM_JOB_STATE_UPLOADING;
        g_cart_service_ram_job.bytes_written = 0u;
        g_cart_service_ram_job.total_bytes = 0u;
        memset(g_cart_service_ram_job.error_message, 0, sizeof(g_cart_service_ram_job.error_message));
    }

    /* Track highest offset written (handles FAT16 out-of-order writes) */
    if ((offset + len) > g_cart_service_ram_job.bytes_written) {
        g_cart_service_ram_job.bytes_written = offset + len;
    }

    return true;
}

bool cart_service_erase_save(void)
{
    cart_service_init_session_state();

    switch (g_cart_service_session.current_config.ram_type) {
        case CART_SERVICE_RAM_TYPE_FLASH:
            return cart_service_erase_flash_save();
        case CART_SERVICE_RAM_TYPE_SRAM:
        case CART_SERVICE_RAM_TYPE_FRAM:
        default:
            return true;
    }
}

bool cart_service_verify_save(const uint8_t *expected_buf, uint32_t len)
{
    uint8_t read_buf[256];
    uint32_t offset = 0u;

    cart_service_init_session_state();

    if (expected_buf == NULL || len == 0u) {
        return false;
    }

    while (offset < len) {
        uint32_t chunk_size = sizeof(read_buf);
        if ((len - offset) < chunk_size) {
            chunk_size = len - offset;
        }

        if (!cart_service_read_save(offset, read_buf, chunk_size)) {
            return false;
        }

        if (memcmp(expected_buf + offset, read_buf, chunk_size) != 0) {
            return false;
        }

        offset += chunk_size;
    }

    return true;
}

CartServiceRamJobState cart_service_get_ram_job_state(void)
{
    cart_service_init_session_state();
    return g_cart_service_ram_job.state;
}

uint32_t cart_service_get_ram_job_progress(void)
{
    cart_service_init_session_state();
    return g_cart_service_ram_job.bytes_written;
}

const char *cart_service_get_ram_job_error(void)
{
    cart_service_init_session_state();
    return g_cart_service_ram_job.error_message[0] == '\0' ? "NONE" : g_cart_service_ram_job.error_message;
}

/**
 * @brief Commits uploaded data to cartridge RAM hardware (Step 5 of workflow)
 *
 * This function is triggered when user writes to /RAM/COMMIT.TXT.
 * It writes the accumulated upload buffer to the actual cartridge hardware.
 *
 * Workflow: Configure → Apply → Erase → Upload → COMMIT → Verify
 *                                                 ^^^^^^
 *
 * Key Design Decisions:
 * 1. EXPLICIT COMMIT MODEL: User must explicitly trigger commit to prevent
 *    accidental writes due to FAT16 metadata/data ordering issues
 * 2. 1KB CHUNKED WRITES: Data is written in 1KB chunks even if file is small,
 *    ensuring hardware stability and compatibility across RAM types
 * 3. TYPE-SPECIFIC HANDLERS: Different RAM types (SRAM/FRAM/FLASH) use
 *    appropriate write functions with proper timing/barriers
 * 4. AUTOMATIC VERIFICATION: After write completes, data is read back and
 *    compared byte-by-byte to ensure integrity
 *
 * State Machine:
 *   UPLOADING → COMMITTING → VERIFYING → SUCCESS or ERROR
 *
 * @return true if commit and verification successful, false otherwise
 *
 * @note Only valid when state is UPLOADING; returns INVALID_STATE error otherwise
 * @note Sets state to ERROR with descriptive message on any failure
 * @see cart_service_write_save() for upload phase
 * @see cart_service_verify_save() for verification phase
 * @see docs/RAM-UPLOAD-WORKFLOW.md for complete workflow documentation
 */
bool cart_service_commit_ram_upload(void)
{
    bool success = true;
    uint32_t write_size;
    uint32_t offset;
    uint32_t chunk_size;

    cart_service_init_session_state();

    /* Verify we're in the correct state for commit */
    if (g_cart_service_ram_job.state != CART_SERVICE_RAM_JOB_STATE_UPLOADING) {
        snprintf(g_cart_service_ram_job.error_message,
                 sizeof(g_cart_service_ram_job.error_message),
                 "INVALID_STATE");
        g_cart_service_ram_job.state = CART_SERVICE_RAM_JOB_STATE_ERROR;
        return false;
    }

    g_cart_service_ram_job.state = CART_SERVICE_RAM_JOB_STATE_COMMITTING;
    write_size = g_cart_service_ram_job.bytes_written;
    if (write_size > CART_SERVICE_SAVE_SIZE_BYTES) {
        write_size = CART_SERVICE_SAVE_SIZE_BYTES;
    }

    /*
     * Write data in 1KB chunks (CART_SERVICE_RAM_WRITE_CHUNK_SIZE = 1024)
     *
     * Why 1KB chunks even for small files?
     * - Hardware stability: Smaller chunks allow better timeout recovery
     * - Memory constraints: STM32F103C8 has limited RAM
     * - Type compatibility: FRAM needs per-byte latency, chunks allow incremental application
     * - Progress tracking: Enables finer-grained progress reporting in future
     *
     * This requirement came from real-world testing showing that writing
     * entire buffer at once caused reliability issues on certain cartridge types.
     */
    offset = 0u;
    while (offset < write_size) {
        /* Calculate chunk size (last chunk may be smaller than 1KB) */
        chunk_size = write_size - offset;
        if (chunk_size > CART_SERVICE_RAM_WRITE_CHUNK_SIZE) {
            chunk_size = CART_SERVICE_RAM_WRITE_CHUNK_SIZE;
        }

        /* Use type-specific write handler */
        switch (g_cart_service_session.current_config.ram_type) {
            case CART_SERVICE_RAM_TYPE_SRAM:
                success = cart_service_write_save_sram(offset, &g_cart_service_ram_job.upload_buffer[offset], chunk_size);
                break;
            case CART_SERVICE_RAM_TYPE_FRAM:
                success = cart_service_write_save_fram(offset, &g_cart_service_ram_job.upload_buffer[offset], chunk_size);
                break;
            case CART_SERVICE_RAM_TYPE_FLASH:
                success = cart_service_write_save_flash(offset, &g_cart_service_ram_job.upload_buffer[offset], chunk_size);
                break;
            default:
                success = false;
                break;
        }

        if (!success) {
            snprintf(g_cart_service_ram_job.error_message,
                     sizeof(g_cart_service_ram_job.error_message),
                     "WRITE_FAILED");
            g_cart_service_ram_job.state = CART_SERVICE_RAM_JOB_STATE_ERROR;
            return false;
        }

        offset += chunk_size;
    }

    /* Verify the written data matches upload buffer */
    g_cart_service_ram_job.state = CART_SERVICE_RAM_JOB_STATE_VERIFYING;

    if (!cart_service_verify_save(g_cart_service_ram_job.upload_buffer, write_size)) {
        snprintf(g_cart_service_ram_job.error_message,
                 sizeof(g_cart_service_ram_job.error_message),
                 "VERIFY_FAILED");
        g_cart_service_ram_job.state = CART_SERVICE_RAM_JOB_STATE_ERROR;
        return false;
    }

    g_cart_service_ram_job.state = CART_SERVICE_RAM_JOB_STATE_SUCCESS;
    g_cart_service_ram_job.total_bytes = write_size;
    return true;
}

bool cart_service_erase_ram(void)
{
    cart_service_init_session_state();

    memset(&g_cart_service_ram_job, 0, sizeof(g_cart_service_ram_job));
    g_cart_service_ram_job.state = CART_SERVICE_RAM_JOB_STATE_IDLE;

    if (!cart_service_erase_save()) {
        snprintf(g_cart_service_ram_job.error_message,
                 sizeof(g_cart_service_ram_job.error_message),
                 "ERASE_FAILED");
        g_cart_service_ram_job.state = CART_SERVICE_RAM_JOB_STATE_ERROR;
        return false;
    }

    return true;
}

bool cart_service_build_ram_status_text(char *buf, uint32_t buf_size)
{
    char *cursor = buf;
    uint32_t remaining = buf_size;
    const char *state_str = "IDLE";

    if (buf == NULL || buf_size == 0u) {
        return false;
    }

    cart_service_init_session_state();
    memset(buf, 0, buf_size);

    switch (g_cart_service_ram_job.state) {
        case CART_SERVICE_RAM_JOB_STATE_IDLE:
            state_str = "IDLE";
            break;
        case CART_SERVICE_RAM_JOB_STATE_UPLOADING:
            state_str = "UPLOADING";
            break;
        case CART_SERVICE_RAM_JOB_STATE_COMMITTING:
            state_str = "COMMITTING";
            break;
        case CART_SERVICE_RAM_JOB_STATE_VERIFYING:
            state_str = "VERIFYING";
            break;
        case CART_SERVICE_RAM_JOB_STATE_SUCCESS:
            state_str = "SUCCESS";
            break;
        case CART_SERVICE_RAM_JOB_STATE_ERROR:
            state_str = "ERROR";
            break;
        default:
            state_str = "UNKNOWN";
            break;
    }

    appendf(&cursor, &remaining, "RAM JOB STATUS\r\n");
    appendf(&cursor, &remaining, "==============\r\n");
    appendf(&cursor, &remaining, "STATE=%s\r\n", state_str);
    appendf(&cursor, &remaining, "BYTES_WRITTEN=%lu\r\n", (unsigned long)g_cart_service_ram_job.bytes_written);
    appendf(&cursor, &remaining, "TOTAL_BYTES=%lu\r\n", (unsigned long)g_cart_service_ram_job.total_bytes);
    appendf(&cursor, &remaining, "RAM_TYPE=%s\r\n",
            cart_service_ram_type_label(g_cart_service_session.current_config.ram_type));
    appendf(&cursor, &remaining, "ERROR=%s\r\n", cart_service_get_ram_job_error());
    return true;
}

bool cart_service_build_ram_erase_text(char *buf, uint32_t buf_size)
{
    char *cursor = buf;
    uint32_t remaining = buf_size;

    if (buf == NULL || buf_size == 0u) {
        return false;
    }

    cart_service_init_session_state();
    memset(buf, 0, buf_size);

    appendf(&cursor, &remaining, "TYPE=ERASE\r\n");
    appendf(&cursor, &remaining, "PATH=/RAM/ERASE.TXT\r\n");
    appendf(&cursor, &remaining, "NOTE=Write ERASE=1 to erase RAM and reset upload state.\r\n");
    return true;
}

bool cart_service_apply_ram_erase_text(const uint8_t *buf, uint32_t len)
{
    char text[CART_SERVICE_TEXT_BUFFER_BYTES + 1u];
    char *cursor = text;
    bool recognized = false;
    uint32_t copy_len = len;

    if (buf == NULL) {
        return false;
    }

    cart_service_init_session_state();

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

                if (key_equals(key, "ERASE") && (key_equals(value, "1") || key_equals(value, "YES") || key_equals(value, "TRUE"))) {
                    recognized = true;
                }
            } else if (key_equals(line, "ERASE")) {
                recognized = true;
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

    if (!recognized) {
        return false;
    }

    return cart_service_erase_ram();
}

bool cart_service_build_ram_commit_text(char *buf, uint32_t buf_size)
{
    char *cursor = buf;
    uint32_t remaining = buf_size;

    if (buf == NULL || buf_size == 0u) {
        return false;
    }

    cart_service_init_session_state();
    memset(buf, 0, buf_size);

    appendf(&cursor, &remaining, "TYPE=COMMIT\r\n");
    appendf(&cursor, &remaining, "PATH=/RAM/COMMIT.TXT\r\n");
    appendf(&cursor, &remaining, "NOTE=Write COMMIT=1 to commit uploaded data to cartridge.\r\n");
    return true;
}

bool cart_service_apply_ram_commit_text(const uint8_t *buf, uint32_t len)
{
    char text[CART_SERVICE_TEXT_BUFFER_BYTES + 1u];
    char *cursor = text;
    bool recognized = false;
    uint32_t copy_len = len;

    if (buf == NULL) {
        return false;
    }

    cart_service_init_session_state();

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

                if (key_equals(key, "COMMIT") && (key_equals(value, "1") || key_equals(value, "YES") || key_equals(value, "TRUE"))) {
                    recognized = true;
                }
            } else if (key_equals(line, "COMMIT")) {
                recognized = true;
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

    if (!recognized) {
        return false;
    }

    return cart_service_commit_ram_upload();
}
