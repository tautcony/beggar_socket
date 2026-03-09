#include "cart_service.h"

#include <string.h>

#include "cart_adapter.h"

#define ROM_READ_CHUNK_WORDS 128u

uint32_t cart_service_get_rom_size(void)
{
    return CART_SERVICE_ROM_SIZE_BYTES;
}

uint32_t cart_service_get_save_size(void)
{
    return CART_SERVICE_SAVE_SIZE_BYTES;
}

bool cart_service_read_rom(uint32_t offset, uint8_t *buf, uint32_t len)
{
    uint16_t scratch[ROM_READ_CHUNK_WORDS];

    if (buf == NULL) {
        return false;
    }

    if ((offset + len) > cart_service_get_rom_size()) {
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

bool cart_service_read_save(uint32_t offset, uint8_t *buf, uint32_t len)
{
    if (buf == NULL) {
        return false;
    }

    if ((offset + len) > cart_service_get_save_size()) {
        return false;
    }

    cart_ramRead((uint16_t)offset, buf, (uint16_t)len);
    return true;
}
