#include <stdint.h>

#include "cart_adapter.h"
#include "main.h"

static inline void NO_OPTIMIZE cart_setDirection_ad(uint8_t dir)
{
    if (dir == 0) {
        VOLATILE_32(GPIOB->CRH) = 0x88888888;  // 8-15 上下拉输入
        VOLATILE_32(GPIOB->CRL) = 0x88888888;  // 7-0  上下拉输入
        VOLATILE_32(GPIOB->ODR) = 0x0000ffff;  // 15-0 上拉
    } else {
        VOLATILE_32(GPIOB->CRH) = 0x33333333;  // 8-15 推挽输出, 50mhz
        VOLATILE_32(GPIOB->CRL) = 0x33333333;  // 7-0  推挽输出, 50mhz
    }
}

static inline void NO_OPTIMIZE cart_setDirection_a(uint8_t dir)
{
    if (dir == 0) {
        VOLATILE_32(GPIOA->CRL) = 0x88888888;   // 7-0 上下拉输入
        VOLATILE_32(GPIOA->BSRR) = 0x000000ff;  // 7-0 上拉
    } else {
        VOLATILE_32(GPIOA->CRL) = 0x33333333;  // 7-0 推挽输出, 50mhz
    }
}

static inline uint16_t NO_OPTIMIZE cart_readBus_ad()
{
    return (uint16_t)(VOLATILE_32(GPIOB->IDR) & 0x0000FFFF);
}

static inline uint8_t NO_OPTIMIZE cart_readBus_a()
{
    return (uint8_t)(VOLATILE_32(GPIOA->IDR) & 0x000000FF);
}

static inline void NO_OPTIMIZE cart_writeBus_ad(uint16_t value)
{
    VOLATILE_32(GPIOB->ODR) = value;
}

static inline void NO_OPTIMIZE cart_writeBus_a(uint8_t value)
{
    uint32_t temp = VOLATILE_32(GPIOA->ODR);
    VOLATILE_32(GPIOA->ODR) = (temp & 0xFFFFFF00u) | value;
}

void cart_romRead(uint32_t addr, uint16_t *buf, uint16_t len)
{
    // latch base address
    cart_setDirection_a(1);
    cart_setDirection_ad(1);

    cart_writeBus_a((addr & 0x00ff0000) >> 16);
    cart_writeBus_ad((addr & 0x0000ffff));

    VOLATILE_32(cs1_GPIO_Port->BSRR) = cs1_Pin << 16;  // cs1=0 126ns
    TIMING_DELAY();

    // read bus
    cart_setDirection_ad(0);
    for (int i = 0; i < len; i++) {
        VOLATILE_32(rd_GPIO_Port->BSRR) = rd_Pin << 16;  // rd=0 126ns
        TIMING_DELAY();                                  // Ensure timing requirements

        // tOE >25ns, tACC >110ns
        *buf = cart_readBus_ad();

        VOLATILE_32(rd_GPIO_Port->BSRR) = rd_Pin;  // rd=1 126ns
        TIMING_DELAY();                            // Ensure timing requirements

        buf++;
    }

    // release bus
    VOLATILE_32(cs1_GPIO_Port->BSRR) = cs1_Pin;  // cs1=1 126ns
    TIMING_DELAY();
    cart_setDirection_a(0);
}

void cart_romWrite(uint32_t addr, const uint16_t *buf, uint16_t len)
{
    // latch base address
    cart_setDirection_a(1);
    cart_setDirection_ad(1);

    cart_writeBus_a((addr & 0x00ff0000) >> 16);
    cart_writeBus_ad((addr & 0x0000ffff));

    VOLATILE_32(cs1_GPIO_Port->BSRR) = cs1_Pin << 16;  // cs1=0 126ns
    TIMING_DELAY();

    // write bus
    for (int i = 0; i < len; i++) {
        cart_writeBus_ad(*buf);

        VOLATILE_32(wr_GPIO_Port->BSRR) = wr_Pin << 16;
        TIMING_DELAY();  // data setup 30ns, we low 25ns, address hold 45ns
        VOLATILE_32(wr_GPIO_Port->BSRR) = wr_Pin;
        TIMING_DELAY();

        buf++;
    }

    // release bus
    VOLATILE_32(cs1_GPIO_Port->BSRR) = cs1_Pin;
    TIMING_DELAY();
    cart_setDirection_a(0);
    cart_setDirection_ad(0);
}

void cart_ramRead(uint16_t addr, uint8_t *buf, uint16_t len)
{
    cart_setDirection_a(0);
    cart_setDirection_ad(1);

    VOLATILE_32(cs2_GPIO_Port->BSRR) = cs2_Pin << 16;  // cs2=0 126ns
    TIMING_DELAY();

    // read bus
    for (int i = 0; i < len; i++) {
        cart_writeBus_ad(addr);

        VOLATILE_32(rd_GPIO_Port->BSRR) = rd_Pin << 16;  // rd=0 126ns
        TIMING_DELAY();                                  // address to dq 105ns, oe to dq 25ns

        *buf = cart_readBus_a();

        VOLATILE_32(rd_GPIO_Port->BSRR) = rd_Pin;  // rd=1 126ns
        TIMING_DELAY();

        addr++;
        buf++;
    }

    // release bus
    VOLATILE_32(cs2_GPIO_Port->BSRR) = cs2_Pin;  // cs2=1 126ns
    TIMING_DELAY();
    cart_setDirection_ad(0);
}

void cart_ramWrite(uint16_t addr, const uint8_t *buf, uint16_t len)
{
    cart_setDirection_a(1);
    cart_setDirection_ad(1);

    VOLATILE_32(cs2_GPIO_Port->BSRR) = cs2_Pin << 16;  // cs2=0 126ns
    TIMING_DELAY();

    // write bus
    for (int i = 0; i < len; i++) {
        cart_writeBus_ad(addr);
        cart_writeBus_a(*buf);

        VOLATILE_32(wr_GPIO_Port->BSRR) = wr_Pin << 16;
        TIMING_DELAY();  // address hold 70ns, data setup 20ns, write cycle 105ns
        VOLATILE_32(wr_GPIO_Port->BSRR) = wr_Pin;
        TIMING_DELAY();

        addr++;
        buf++;
    }

    // release bus
    VOLATILE_32(cs2_GPIO_Port->BSRR) = cs2_Pin;
    TIMING_DELAY();
    cart_setDirection_a(0);
    cart_setDirection_ad(0);
}

//
// for gb/gbc
//

void cart_gbcRead(uint16_t addr, uint8_t *buf, uint16_t len)
{
    cart_setDirection_a(0);
    cart_setDirection_ad(1);

    VOLATILE_32(cs1_GPIO_Port->BSRR) = cs1_Pin << 16;  // cs1=0 126ns
    TIMING_DELAY();

    // read bus
    for (int i = 0; i < len; i++) {
        cart_writeBus_ad(addr);

        VOLATILE_32(rd_GPIO_Port->BSRR) = rd_Pin << 16;  // rd=0 126ns
        TIMING_DELAY();                                  // address to dq 105ns, oe to dq 25ns

        *buf = cart_readBus_a();
        TIMING_DELAY();

        VOLATILE_32(rd_GPIO_Port->BSRR) = rd_Pin;  // rd=1 126ns
        TIMING_DELAY();

        addr++;
        buf++;
    }

    // release bus
    VOLATILE_32(cs1_GPIO_Port->BSRR) = cs1_Pin;  // cs1=1 126ns
    TIMING_DELAY();
    cart_setDirection_ad(0);
}

void cart_gbcWrite(uint16_t addr, const uint8_t *buf, uint16_t len)
{
    cart_setDirection_a(1);
    cart_setDirection_ad(1);

    VOLATILE_32(cs1_GPIO_Port->BSRR) = cs1_Pin << 16;  // cs1=0 126ns
    TIMING_DELAY();

    // write bus
    for (int i = 0; i < len; i++) {
        cart_writeBus_ad(addr);
        cart_writeBus_a(*buf);

        VOLATILE_32(wr_GPIO_Port->BSRR) = wr_Pin << 16;
        TIMING_DELAY();  // address hold 70ns, data setup 20ns, write cycle 105ns

        VOLATILE_32(wr_GPIO_Port->BSRR) = wr_Pin;
        TIMING_DELAY();

        addr++;
        buf++;
    }

    // release bus
    VOLATILE_32(cs1_GPIO_Port->BSRR) = cs1_Pin;
    TIMING_DELAY();

    cart_setDirection_a(0);
    cart_setDirection_ad(0);
}
