#ifndef __CART_SERVICE_H__
#define __CART_SERVICE_H__

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define CART_SERVICE_ROM_MAX_SIZE_BYTES (32u * 1024u * 1024u)
#define CART_SERVICE_SAVE_SIZE_BYTES (32u * 1024u)

uint32_t cart_service_get_rom_device_size(void);
uint32_t cart_service_get_rom_size(void);
uint32_t cart_service_get_rom_base_address(void);
uint32_t cart_service_get_save_size(void);
bool cart_service_read_rom(uint32_t offset, uint8_t *buf, uint32_t len);
bool cart_service_read_save(uint32_t offset, uint8_t *buf, uint32_t len);
bool cart_service_build_cfi_text(char *buf, uint32_t buf_size);
bool cart_service_build_mode_text(char *buf, uint32_t buf_size);
bool cart_service_apply_mode_text(const uint8_t *buf, uint32_t len);

#ifdef __cplusplus
}
#endif

#endif
