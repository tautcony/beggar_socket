#ifndef __CART_SERVICE_H__
#define __CART_SERVICE_H__

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define CART_SERVICE_ROM_MAX_SIZE_BYTES (32u * 1024u * 1024u)
#define CART_SERVICE_SAVE_SIZE_BYTES (32u * 1024u)
#define CART_SERVICE_UPLOAD_BUFFER_SIZE CART_SERVICE_SAVE_SIZE_BYTES

typedef enum {
    CART_SERVICE_RAM_TYPE_SRAM = 0,
    CART_SERVICE_RAM_TYPE_FRAM,
    CART_SERVICE_RAM_TYPE_FLASH,
} CartServiceRamType;

typedef enum {
    CART_SERVICE_RAM_JOB_STATE_IDLE = 0,
    CART_SERVICE_RAM_JOB_STATE_UPLOADING,
    CART_SERVICE_RAM_JOB_STATE_COMMITTING,
    CART_SERVICE_RAM_JOB_STATE_VERIFYING,
    CART_SERVICE_RAM_JOB_STATE_SUCCESS,
    CART_SERVICE_RAM_JOB_STATE_ERROR,
} CartServiceRamJobState;

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
const char *cart_service_get_last_apply_status(void);
const char *cart_service_get_ram_type_name(CartServiceRamType type);
const char *cart_service_get_ram_type_description(CartServiceRamType type);
bool cart_service_read_rom(uint32_t offset, uint8_t *buf, uint32_t len);
bool cart_service_read_save(uint32_t offset, uint8_t *buf, uint32_t len);
bool cart_service_build_cfi_text(char *buf, uint32_t buf_size);
bool cart_service_build_status_text(char *buf, uint32_t buf_size);
bool cart_service_build_apply_text(char *buf, uint32_t buf_size);
bool cart_service_apply_pending_config_text(const uint8_t *buf, uint32_t len);
bool cart_service_build_rom_config_text(char *buf, uint32_t buf_size);
bool cart_service_apply_rom_config_text(const uint8_t *buf, uint32_t len);
bool cart_service_build_ram_type_option_text(char *buf, uint32_t buf_size, CartServiceRamType type);
bool cart_service_build_ram_type_select_text(char *buf, uint32_t buf_size);
bool cart_service_apply_ram_type_select_text(const uint8_t *buf, uint32_t len);
bool cart_service_build_mode_text(char *buf, uint32_t buf_size);
bool cart_service_apply_mode_text(const uint8_t *buf, uint32_t len);
bool cart_service_write_save(uint32_t offset, const uint8_t *buf, uint32_t len);
bool cart_service_erase_save(void);
bool cart_service_verify_save(const uint8_t *expected_buf, uint32_t len);
CartServiceRamJobState cart_service_get_ram_job_state(void);
uint32_t cart_service_get_ram_job_progress(void);
const char *cart_service_get_ram_job_error(void);
bool cart_service_commit_ram_upload(void);
bool cart_service_erase_ram(void);
bool cart_service_build_ram_status_text(char *buf, uint32_t buf_size);
bool cart_service_build_ram_erase_text(char *buf, uint32_t buf_size);
bool cart_service_apply_ram_erase_text(const uint8_t *buf, uint32_t len);
bool cart_service_build_ram_commit_text(char *buf, uint32_t buf_size);
bool cart_service_apply_ram_commit_text(const uint8_t *buf, uint32_t len);

#ifdef __cplusplus
}
#endif

#endif
