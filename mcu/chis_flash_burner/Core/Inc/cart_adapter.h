#ifndef __CART_ADAPTER_H_
#define __CART_ADAPTER_H_

// Memory barrier macro to prevent compiler optimization issues
#define MEMORY_BARRIER() __asm volatile("" ::: "memory")

// Short delay macro for timing critical operations
#define TIMING_DELAY()                                                                             \
    do {                                                                                           \
        __asm volatile("nop");                                                                     \
        __asm volatile("nop");                                                                     \
        __asm volatile("nop");                                                                     \
    } while (0)

void cart_romRead(uint32_t addr, uint16_t *buf, uint16_t len);
void cart_romWrite(uint32_t addr, const uint16_t *buf, uint16_t len);
void cart_ramRead(uint16_t addr, uint8_t *buf, uint16_t len);
void cart_ramWrite(uint16_t addr, const uint8_t *buf, uint16_t len);

void cart_gbcRead(uint16_t addr, uint8_t *buf, uint16_t len);
void cart_gbcWrite(uint16_t addr, const uint8_t *buf, uint16_t len);

#endif
