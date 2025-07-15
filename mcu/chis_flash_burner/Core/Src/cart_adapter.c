#include <stdint.h>

#include "main.h"
#include "cart_adapter.h"

void cart_setDirection_ad(uint8_t dir)
{
    volatile GPIO_TypeDef* gpio = GPIOB;
    if (dir == 0)
    {
        gpio->CRH = 0x88888888; // 8-15 上下拉输入
        gpio->CRL = 0x88888888; // 7-0  上下拉输入
        gpio->ODR = 0x0000ffff; // 15-0 上拉
    }
    else
    {
        gpio->CRH = 0x33333333; // 8-15 推挽输出, 50mhz
        gpio->CRL = 0x33333333; // 7-0  推挽输出, 50mhz
    }
    MEMORY_BARRIER();
}

void cart_setDirection_a(uint8_t dir)
{
    volatile GPIO_TypeDef* gpio = GPIOA;
    if (dir == 0)
    {
        gpio->CRL = 0x88888888;  // 7-0 上下拉输入
        gpio->BSRR = 0x000000ff; // 7-0 上拉
    }
    else
    {
        gpio->CRL = 0x33333333; // 7-0 推挽输出, 50mhz
    }
    MEMORY_BARRIER();
}

uint16_t cart_readBus_ad()
{
    volatile uint16_t result = (GPIOB->IDR) & 0x0000ffff;
    MEMORY_BARRIER();
    return result;
}

uint8_t cart_readBus_a()
{
    volatile uint8_t result = (GPIOA->IDR) & 0x000000ff;
    MEMORY_BARRIER();
    return result;
}

void cart_writeBus_ad(uint16_t value)
{
    volatile GPIO_TypeDef* gpio = GPIOB;
    gpio->ODR = value;
    MEMORY_BARRIER();
}

void cart_writeBus_a(uint8_t value)
{
    volatile GPIO_TypeDef* gpio = GPIOA;
    volatile uint32_t temp = gpio->ODR;
    gpio->ODR = (temp & 0xffffff00) | value;
    MEMORY_BARRIER();
}

void cart_romRead(uint32_t addr, uint16_t *buf, uint16_t len)
{
    // latch base address
    cart_setDirection_a(1);
    cart_setDirection_ad(1);

    cart_writeBus_a((addr & 0x00ff0000) >> 16);
    cart_writeBus_ad((addr & 0x0000ffff));

    cs1_GPIO_Port->BSRR = cs1_Pin << 16; // cs1=0 126ns
    TIMING_DELAY();

    // read bus
    cart_setDirection_ad(0);
    for (int i = 0; i < len; i++)
    {
        rd_GPIO_Port->BSRR = rd_Pin << 16; // rd=0 126ns
        TIMING_DELAY(); // Ensure timing requirements

        // tOE >25ns, tACC >110ns
        *buf = cart_readBus_ad();
        MEMORY_BARRIER();
        
        rd_GPIO_Port->BSRR = rd_Pin; // rd=1 126ns
        TIMING_DELAY(); // Ensure timing requirements

        buf++;
    }

    // release bus
    cs1_GPIO_Port->BSRR = cs1_Pin; // cs1=1 126ns
    cart_setDirection_a(0);
}

void cart_romWrite(uint32_t addr, uint16_t *buf, uint16_t len)
{
    // latch base address
    cart_setDirection_a(1);
    cart_setDirection_ad(1);

    cart_writeBus_a((addr & 0x00ff0000) >> 16);
    cart_writeBus_ad((addr & 0x0000ffff));

    cs1_GPIO_Port->BSRR = cs1_Pin << 16; // cs1=0 126ns
    TIMING_DELAY();

    // write bus
    for (int i = 0; i < len; i++)
    {
        cart_writeBus_ad(*buf);
        MEMORY_BARRIER();

        wr_GPIO_Port->BSRR = wr_Pin << 16;
        TIMING_DELAY(); // data setup 30ns, we low 25ns, address hold 45ns
        wr_GPIO_Port->BSRR = wr_Pin;
        MEMORY_BARRIER();

        buf++;
    }

    // release bus
    cs1_GPIO_Port->BSRR = cs1_Pin;
    cart_setDirection_a(0);
    cart_setDirection_ad(0);
}

void cart_ramRead(uint16_t addr, uint8_t *buf, uint16_t len)
{
    cart_setDirection_a(0);
    cart_setDirection_ad(1);

    cs2_GPIO_Port->BSRR = cs2_Pin << 16; // cs2=0 126ns
    TIMING_DELAY();

    // read bus
    for (int i = 0; i < len; i++)
    {
        cart_writeBus_ad(addr);
        MEMORY_BARRIER();

        rd_GPIO_Port->BSRR = rd_Pin << 16; // rd=0 126ns
        TIMING_DELAY(); // address to dq 105ns, oe to dq 25ns

        *buf = cart_readBus_a();
        MEMORY_BARRIER();

        rd_GPIO_Port->BSRR = rd_Pin; // rd=1 126ns
        TIMING_DELAY();

        addr++;
        buf++;
    }

    // release bus
    cs2_GPIO_Port->BSRR = cs2_Pin; // cs2=1 126ns
    cart_setDirection_ad(0);
}

void cart_ramWrite(uint16_t addr, uint8_t *buf, uint16_t len)
{
    cart_setDirection_a(1);
    cart_setDirection_ad(1);

    cs2_GPIO_Port->BSRR = cs2_Pin << 16; // cs2=0 126ns
    TIMING_DELAY();

    // write bus
    for (int i = 0; i < len; i++)
    {
        cart_writeBus_ad(addr);
        cart_writeBus_a(*buf);
        MEMORY_BARRIER();

        wr_GPIO_Port->BSRR = wr_Pin << 16;
        TIMING_DELAY(); // address hold 70ns, data setup 20ns, write cycle 105ns
        wr_GPIO_Port->BSRR = wr_Pin;
        MEMORY_BARRIER();

        addr++;
        buf++;
    }

    // release bus
    cs2_GPIO_Port->BSRR = cs2_Pin;
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

    cs1_GPIO_Port->BSRR = cs1_Pin << 16; // cs1=0 126ns
    TIMING_DELAY();

    // read bus
    for (int i = 0; i < len; i++)
    {
        cart_writeBus_ad(addr);
        MEMORY_BARRIER();

        rd_GPIO_Port->BSRR = rd_Pin << 16; // rd=0 126ns
        TIMING_DELAY(); // address to dq 105ns, oe to dq 25ns

        *buf = cart_readBus_a();
        MEMORY_BARRIER();

        rd_GPIO_Port->BSRR = rd_Pin; // rd=1 126ns
        TIMING_DELAY();

        addr++;
        buf++;
    }

    // release bus
    cs1_GPIO_Port->BSRR = cs1_Pin; // cs1=1 126ns
    cart_setDirection_ad(0);
}

void cart_gbcWrite(uint16_t addr, uint8_t *buf, uint16_t len)
{

    cart_setDirection_a(1);
    cart_setDirection_ad(1);

    cs1_GPIO_Port->BSRR = cs1_Pin << 16; // cs2=0 126ns
    TIMING_DELAY();

    // write bus
    for (int i = 0; i < len; i++)
    {
        cart_writeBus_ad(addr);
        cart_writeBus_a(*buf);
        MEMORY_BARRIER();

        wr_GPIO_Port->BSRR = wr_Pin << 16;
        TIMING_DELAY(); // address hold 70ns, data setup 20ns, write cycle 105ns
        wr_GPIO_Port->BSRR = wr_Pin;
        MEMORY_BARRIER();

        addr++;
        buf++;
    }

    // release bus
    cs1_GPIO_Port->BSRR = cs1_Pin;
    cart_setDirection_a(0);
    cart_setDirection_ad(0);
}