#include "main.h"
#include "cart_adapter.h"

void cart_setDirection_ad(uint8_t dir)
{
    if (dir == 0)
    {
        SetP2nQuasiMode(PIN_ALL); // ad h
        SetP7nQuasiMode(PIN_ALL); // ad l 准双向
        PORT_AD_L = 0xff;
        PORT_AD_H = 0xff;
    }
    else
    {
        SetP2nPushPullMode(PIN_ALL); // ad h
        SetP7nPushPullMode(PIN_ALL); // ad l 推挽
    }
}

void cart_setDirection_a(uint8_t dir)
{
    if (dir == 0)
    {
        SetP0nQuasiMode(PIN_ALL);
        PORT_A = 0xff;
    }
    else
    {
        SetP0nPushPullMode(PIN_ALL);
    }
}

// uint16_t cart_readBus_ad()
// {
//     // return (GPIOB->IDR) & 0x0000ffff;
// }

// uint8_t cart_readBus_a()
// {
//     // return (GPIOA->IDR) & 0x000000ff;
// }

// void cart_writeBus_ad(uint16_t value)
// {
//     // GPIOB->ODR = value;
// }

// void cart_writeBus_a(uint8_t value)
// {
//     // uint32_t _ = GPIOA->ODR;
//     // GPIOA->ODR = (_ & 0xffffff00) | value;
// }
void cart_gbaRomAddrSetup(uint32_t addr)
{
    // latch base address
    cart_setDirection_a(1);
    cart_setDirection_ad(1);

    PORT_AD_L = ((uint8_t *)&addr)[3];
    PORT_AD_H = ((uint8_t *)&addr)[2];
    PORT_A = ((uint8_t *)&addr)[1];

    NOP2();       // 44ns
    CART_CS1 = 0; // cs1=0
}

void cart_romRead_continuous(uint8_t *buf, uint16_t len)
{
    uint16_t i;
    // read bus
    cart_setDirection_ad(0);
    for (i = 0; i < len; i++)
    {
        NOP6(); // tACC >110ns 132ns

        CART_RD = 0; // rd=0
        NOP2();      // tOE >25ns, 44ns

        *buf = PORT_AD_L;
        buf++;
        *buf = PORT_AD_H;
        buf++;

        CART_RD = 1; // rd=1
    }
}

void cart_romRead(uint32_t addr, uint8_t *buf, uint16_t len)
{
    LED_RD = 0;

    cart_gbaRomAddrSetup(addr);
    cart_romRead_continuous(buf, len);

    // release bus
    CART_CS1 = 1; // cs1=1
    LED_RD = 1;
    cart_setDirection_a(0);
}

void cart_romWrite_continuous(uint8_t *buf, uint16_t len)
{
    uint16_t i;
    // write bus
    NOP5(); // twc >100ns 110ns
    for (i = 0; i < len; i++)
    {
        PORT_AD_L = *buf;
        buf++;
        PORT_AD_H = *buf;
        buf++;

        CART_WR = 0;
        NOP3(); // data setup >45ns 66ns
        NOP2(); // twp >35ns 44ns
        CART_WR = 1;
        NOP5(); // twc >100ns 110ns
    }
}

void cart_romWrite(uint32_t addr, uint8_t *buf, uint16_t len)
{
    LED_WR = 0;

    cart_gbaRomAddrSetup(addr);
    cart_romWrite_continuous(buf, len);

    // release bus
    CART_CS1 = 1; // cs1=1
    LED_WR = 1;
    cart_setDirection_a(0);
    cart_setDirection_ad(0);
}

void cart_ramRead(uint16_t addr, uint8_t *buf, uint16_t len)
{
    uint16_t i;

    LED_RD = 0;

    cart_setDirection_a(0);
    cart_setDirection_ad(1);

    // read bus
    for (i = 0; i < len; i++)
    {
        PORT_AD_L = ((uint8_t *)&addr)[1];
        PORT_AD_H = ((uint8_t *)&addr)[0];

        CART_CS2 = 0; // cs2=0
        CART_RD = 0;  // rd=0

        // taa 105ns toe 25ns
        NOP20(); // 440ns

        *buf = PORT_A;

        CART_RD = 1;  // rd=1
        CART_CS2 = 1; // cs2=1

        addr++;
        buf++;
    }
    cart_setDirection_ad(0);
    LED_RD = 1;
}

void cart_ramWrite(uint16_t addr, uint8_t *buf, uint16_t len)
{
    uint16_t i;

    LED_WR = 0;

    cart_setDirection_a(0);
    cart_setDirection_ad(1);

    // write bus
    for (i = 0; i < len; i++)
    {
        PORT_AD_L = ((uint8_t *)&addr)[1];
        PORT_AD_H = ((uint8_t *)&addr)[0];
        PORT_A = *buf;

        CART_CS2 = 0; // cs2=0
        CART_WR = 0;

        addr++;
        buf++;
        NOP20(); // 440ns

        CART_WR = 1;
        CART_CS2 = 1;
    }

    cart_setDirection_a(0);
    cart_setDirection_ad(0);
    LED_WR = 1;
}

//
// for gb/gbc
//

// void cart_gbcRead(uint16_t addr, uint8_t *buf, uint16_t len)
// {
//     LED_RD = 0;
//     // cart_setDirection_a(0);
//     // cart_setDirection_ad(1);

//     // cs1_GPIO_Port->BSRR = cs1_Pin << 16; // cs1=0 126ns

//     // // read bus
//     // for (int i = 0; i < len; i++)
//     // {
//     //     cart_writeBus_ad(addr);

//     //     rd_GPIO_Port->BSRR = rd_Pin << 16; // rd=0 126ns

//     //     // address to dq 105ns, oe to dq 25ns
//     //     *buf = cart_readBus_a();

//     //     rd_GPIO_Port->BSRR = rd_Pin; // rd=1 126ns

//     //     addr++;
//     //     buf++;
//     // }

//     // cs1_GPIO_Port->BSRR = cs1_Pin; // cs1=1 126ns

//     // cart_setDirection_ad(0);
//     LED_RD = 1;
// }

// void cart_gbcWrite(uint16_t addr, uint8_t *buf, uint16_t len)
// {
//     LED_WR = 0;
//     // cart_setDirection_a(1);
//     // cart_setDirection_ad(1);

//     // cs1_GPIO_Port->BSRR = cs1_Pin << 16;

//     // // write bus
//     // for (int i = 0; i < len; i++)
//     // {
//     //     cart_writeBus_ad(addr);
//     //     cart_writeBus_a(*buf);

//     //     wr_GPIO_Port->BSRR = wr_Pin << 16;
//     //     wr_GPIO_Port->BSRR = wr_Pin;

//     //     addr++;
//     //     buf++;
//     // }

//     // cs1_GPIO_Port->BSRR = cs1_Pin;

//     // cart_setDirection_a(0);
//     // cart_setDirection_ad(0);
//     LED_WR = 1;
// }
