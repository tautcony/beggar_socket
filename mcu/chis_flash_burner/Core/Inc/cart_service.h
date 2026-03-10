#ifndef __CART_SERVICE_H__
#define __CART_SERVICE_H__

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define CART_SERVICE_ROM_MAX_SIZE_BYTES (32u * 1024u * 1024u)
#define CART_SERVICE_SAVE_SIZE_BYTES (32u * 1024u)

typedef enum {
    CART_SERVICE_RAM_TYPE_SRAM = 0,
    CART_SERVICE_RAM_TYPE_FRAM,
    CART_SERVICE_RAM_TYPE_FLASH,
} CartServiceRamType;

enum {
    CART_SERVICE_DIRTY_NONE = 0u,
    CART_SERVICE_DIRTY_ROM_WINDOW = 1u << 0,
    CART_SERVICE_DIRTY_RAM_TYPE = 1u << 1,
};

uint32_t cart_service_get_rom_device_size(void);
uint32_t cart_service_get_rom_size(void);
uint32_t cart_service_get_rom_base_address(void);
uint32_t cart_service_get_pending_rom_size(void);
uint32_t cart_service_get_pending_rom_base_address(void);
uint32_t cart_service_get_save_size(void);
CartServiceRamType cart_service_get_current_ram_type(void);
CartServiceRamType cart_service_get_pending_ram_type(void);
bool cart_service_has_pending_changes(void);
uint32_t cart_service_get_dirty_mask(void);
const char *cart_service_get_last_error(void);
const char *cart_service_get_ram_type_name(CartServiceRamType type);
const char *cart_service_get_ram_type_description(CartServiceRamType type);
bool cart_service_read_rom(uint32_t offset, uint8_t *buf, uint32_t len);
bool cart_service_read_save(uint32_t offset, uint8_t *buf, uint32_t len);
bool cart_service_build_cfi_text(char *buf, uint32_t buf_size);
bool cart_service_build_status_text(char *buf, uint32_t buf_size);
bool cart_service_build_rom_config_text(char *buf, uint32_t buf_size);
bool cart_service_apply_rom_config_text(const uint8_t *buf, uint32_t len);
bool cart_service_build_ram_type_option_text(char *buf, uint32_t buf_size, CartServiceRamType type);
bool cart_service_build_ram_type_select_text(char *buf, uint32_t buf_size);
bool cart_service_apply_ram_type_select_text(const uint8_t *buf, uint32_t len);
bool cart_service_build_mode_text(char *buf, uint32_t buf_size);
bool cart_service_apply_mode_text(const uint8_t *buf, uint32_t len);

#ifdef __cplusplus
}
#endif

#endif
