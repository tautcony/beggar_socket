#ifndef __CART_ADAPTER_H_
#define __CART_ADAPTER_H_

// Memory barrier macro to prevent compiler optimization issues
#define MEMORY_BARRIER() __asm volatile("" ::: "memory")

// Function attribute to prevent aggressive optimization
#define NO_OPTIMIZE __attribute__((optimize("O0")))
#define NO_INLINE __attribute__((noinline))

#define VOLATILE_CAST(type, addr) (*(volatile type *)(addr))
#define VOLATILE_32(var) (*(volatile uint32_t *)(&var))
#define VOLATILE_16(var) (*(volatile uint16_t *)(&var))
#define VOLATILE_8(var) (*(volatile uint8_t *)(&var))

// Short delay macro for timing critical operations
// Increased delay for release builds to ensure timing requirements
#ifdef NDEBUG
    #define TIMING_DELAY()                                                                         \
        do {                                                                                       \
            __asm volatile("nop");                                                                 \
            __asm volatile("nop");                                                                 \
            __asm volatile("nop");                                                                 \
            __asm volatile("nop");                                                                 \
            __asm volatile("nop");                                                                 \
            __asm volatile("nop");                                                                 \
        } while (0)
#else
    #define TIMING_DELAY()                                                                         \
        do {                                                                                       \
            __asm volatile("nop");                                                                 \
            __asm volatile("nop");                                                                 \
            __asm volatile("nop");                                                                 \
        } while (0)
#endif

void cart_romRead(uint32_t addr, uint16_t *buf, uint16_t len);
void cart_romWrite(uint32_t addr, const uint16_t *buf, uint16_t len);
void cart_ramRead(uint16_t addr, uint8_t *buf, uint16_t len);
void cart_ramWrite(uint16_t addr, const uint8_t *buf, uint16_t len);

void cart_gbcRead(uint16_t addr, uint8_t *buf, uint16_t len);
void cart_gbcWrite(uint16_t addr, const uint8_t *buf, uint16_t len);

#endif
