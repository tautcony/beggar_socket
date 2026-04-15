#include <string.h>
#include "main.h"
#include "usb.h"
#include "uart.h"
#include "cart_adapter.h"

#define SIZE_CMD_HEADER 3
#define SIZE_RESPON_HEADER 2
#define SIZE_BASE_ADDRESS 4
#define SIZE_BYTE_COUNT 2
#define SIZE_CRC 2
#define SIZE_BUFF_SIZE 2
#define SIZE_LATENCY 1

// // 命令头
// typedef struct
// {
//     uint16_t cmdSize;
//     uint8_t cmdCode;
//     uint8_t payload[]; // 最后两个字节是crc
// } Desc_cmdHeader_t;

// // 命令身 写
// typedef struct
// {
//     uint32_t baseAddress;
//     uint8_t payload[]; // 最后两个字节是crc
// } Desc_cmdBody_write_t;

// // 命令身 读
// typedef struct
// {
//     uint32_t baseAddress;
//     uint16_t readSize;
//     uint16_t crc16;
// } Desc_cmdBody_read_t;

// // 响应包
// typedef struct
// {
//     uint16_t crc16;
//     uint8_t payload[];
// } Desc_respon_t;

uint16_t cmdBuf_i_wr = 0;
uint16_t cmdBuf_i_rd = 0;
uint8_t xdata cmdBuf[5500];

uint8_t xdata responCrc[2] = {0, 0};
uint8_t xdata responBuf[EP1IN_SIZE];

BOOL cmdEnd = 0;
BOOL currentRts = 0;
BOOL currentDtr = 0;

// Desc_cmdHeader_t *uart_cmd[0] = (Desc_cmdHeader_t *)cmdBuf;
void endpointClear();

void romGetID();
void romEraseChip();
// void romEraseBlock();
// void romEraseSector();
void romProgram();
void romWrite();
void romRead();
void ramWrite();
void ramRead();
void ramProgramFlash();
void ramWrite_forFram();
void ramRead_forFram();

void gbcWrite();
void gbcRead();
void gbcRomProgram();
void gbcWrite_forFram();
void gbcRead_forFram();

void cart_power();
void cart_phi();

// 流控回调
void uart_setControlLine(BOOL rts, BOOL dtr)
{
    if (((currentRts == 0) && (rts != 0)) ||
        ((currentDtr == 0) && (dtr != 0)))
    {
        cmdBuf_i_wr = 0;
        cmdBuf_i_rd = 0;
        // memset(cmdBuf, 0, sizeof(cmdBuf));
        LED_RD = 1;
        LED_WR = 1;
        CART_CS1 = 1;
        CART_CS2 = 1;
        CART_RD = 1;
        CART_WR = 1;
        cmdEnd = 1;

        usb_write_reg(INDEX, 1);
        usb_write_reg(OUTCSR1, 0);
    }

    currentRts = rts;
    currentDtr = dtr;
}

// usb 接收回调
void uart_cmdRecv()
{
    uint8_t cnt1, cnt2;
    uint16_t cnt;
    uint16_t remainSize;
    uint16_t packSize;

    remainSize = sizeof(cmdBuf) - cmdBuf_i_wr;

    cnt1 = usb_read_reg(OUTCOUNT1);
    cnt2 = usb_read_reg(OUTCOUNT2);
    cnt = ((cnt2 & 0x07) << 8) | cnt1;

    if (cnt > remainSize)
        return;

    while (cnt--)
    {
        cmdBuf[cmdBuf_i_wr] = usb_read_reg(FIFO1);
        cmdBuf_i_wr++;
    }

    if (cmdBuf_i_wr > 2)
    {
        ((uint8_t *)&packSize)[0] = *(cmdBuf + 1);
        ((uint8_t *)&packSize)[1] = *(cmdBuf + 0);
        // 命令还没接收完
        if (cmdBuf_i_wr < packSize)
            endpointClear();
    }
}

void endpointClear()
{
    usb_write_reg(INDEX, 1);
    usb_write_reg(OUTCSR1, 0); // 可以接收下一个数据包
}

void uart_responAck()
{
    uint8_t csr;

    // 禁用 USB 中断
    IE2 &= ~EUSB;

    usb_write_reg(INDEX, 1);
    // 等待fifo已空
    do
    {
        csr = usb_read_reg(INCSR1);
    } while ((csr & INFIFONE) != 0);

    usb_write_reg(FIFO1, 0xaa);     // ack
    usb_write_reg(INCSR1, INIPRDY); // in端点数据包就绪

    // 使能 USB 中断
    IE2 |= EUSB;
}

void uart_responData(uint8_t *dat, uint8_t len)
{
    // 等待上一个数据包发送
    while (ep1Busy)
        ;

    // 禁用 USB 中断
    IE2 &= ~EUSB;

    usb_write_reg(INDEX, 1);
    while (len--)
    {
        usb_write_reg(FIFO1, *dat);
        dat++;
    }
    usb_write_reg(INCSR1, INIPRDY); // in端点数据包就绪

    ep1Busy = 1;

    // 使能 USB 中断
    IE2 |= EUSB;
}

void uart_clearRecvBuf()
{
    cmdBuf_i_wr = 0;
    cmdBuf_i_rd = 0;
    // memset(cmdBuf, 0, sizeof(cmdBuf));
}

void uart_cmdHandler()
{
    uint8_t cmdCode;

    // 判断命令结束
    if (cmdBuf_i_wr > 3)
    {
        LED_RUN = 1;
        cmdEnd = 0;

        cmdCode = cmdBuf[2];
        switch (cmdCode)
        {
        case 0xf0: // rom id获取
            romGetID();
            break;

        case 0xf1: // rom chip擦除
            romEraseChip();
            break;

            // case 0xf2: // rom blcok擦除
            //     romEraseBlock();
            //     break;

            // case 0xf3: // rom sector擦除
            //     romEraseSector();
            //     break;

        case 0xf4: // rom program
            romProgram();
            break;

        case 0xf5: // rom 写入透传
            romWrite();
            break;

        case 0xf6: // rom 读取透传
            romRead();
            break;

        case 0xf7: // ram 写入透传
            ramWrite();
            break;

        case 0xf8: // ram 读取透传
            ramRead();
            break;

        case 0xf9: // 编程flash存档
            ramProgramFlash();
            break;

            // case 0xe7: // ram 带延迟写入
            //     ramWrite_forFram();
            //     break;

            // case 0xe8: // ram 带延迟读取
            //     ramRead_forFram();
            //     break;

        case 0xfa: // gbc 写入透传
            gbcWrite();
            break;

        case 0xfb: // gbc 读取透传
            gbcRead();
            break;

        case 0xfc: // gbc rom编程
            gbcRomProgram();
            break;

        case 0xea: // gbc 带延迟写入
            gbcWrite_forFram();
            break;

        case 0xeb: // gbc 带延迟读取
            gbcRead_forFram();
            break;

        case 0xa0: // 卡带电源
            cart_power();
            break;

        case 0xa1: // phi分频输出
            cart_phi();
            break;

        default:
            break;
        }

        LED_RUN = 0;
    }
}

void romWaitForDone(uint32_t addr, uint16_t expectedValue)
{
    uint16_t value;
    while (1)
    {
        cart_romRead(addr, (uint8_t *)(&value), 1);
        value = reverse2(value);

        if ((value & 0x0080) == (expectedValue & 0x0080))
        {
            cart_romRead(addr, (uint8_t *)(&value), 1);
            return;
        }

        if (cmdEnd)
            return;
    }
}

// 获取rom id
// i 2B.包大小 0xf0 2B.CRC
//   05 00 f0 61 85
// o 2B.CRC 8B.数据
void romGetID()
{
    uint8_t id[8];
    uint8_t cmd[2] = {0, 0};
    uint16_t packSize;

    ((uint8_t *)&packSize)[0] = *(cmdBuf + 1);
    ((uint8_t *)&packSize)[1] = *(cmdBuf + 0);
    // 等待命令接收完成
    while (cmdBuf_i_wr < packSize)
        ;
    endpointClear();

    /* Issue Autoselect Command Sequence */
    cmd[0] = 0xaa;
    cart_romWrite(0x555, cmd, 1);
    cmd[0] = 0x55;
    cart_romWrite(0x2aa, cmd, 1);
    cmd[0] = 0x90;
    cart_romWrite(0x555, cmd, 1);

    //                                   e.g        S29GL256S  JS28F256
    cart_romRead(0x00, id + 0, 1); // Manufacture ID  0001h      0089h
    cart_romRead(0x01, id + 2, 1); // Device ID       227Eh      227Eh
    cart_romRead(0x0e, id + 4, 1); // Device ID       2222h      2222h = 256 Mb
    cart_romRead(0x0f, id + 6, 1); // Device ID       2201h      2201h

    /* Write Software RESET command */
    cmd[0] = 0xf0;
    cart_romWrite(0, cmd, 1);

    uart_clearRecvBuf();
    uart_responData(responCrc, 2);
    uart_responData(id, 8);
}

// 全片抹除
// i 2B.包大小 0xf1 2B.CRC
//   05 00 f1 a0 45
// o 0xaa
void romEraseChip()
{
    uint8_t cmd[2] = {0, 0};
    uint16_t packSize;

    ((uint8_t *)&packSize)[0] = *(cmdBuf + 1);
    ((uint8_t *)&packSize)[1] = *(cmdBuf + 0);
    // 等待命令接收完成
    while (cmdBuf_i_wr < packSize)
        ;
    endpointClear();

    /* Issue inlock sequence command */
    cmd[0] = 0xaa;
    cart_romWrite(0x555, cmd, 1);
    cmd[0] = 0x55;
    cart_romWrite(0x2aa, cmd, 1);
    cmd[0] = 0x80;
    cart_romWrite(0x555, cmd, 1);
    cmd[0] = 0xaa;
    cart_romWrite(0x555, cmd, 1);
    cmd[0] = 0x55;
    cart_romWrite(0x2aa, cmd, 1);
    /* Write Chip Erase Command to Base Address */
    cmd[0] = 0x10;
    cart_romWrite(0x555, cmd, 1);

    uart_clearRecvBuf();
    uart_responAck();
}

// rom program
// i 2B.包大小 0xf4 4B.始地址 2B.buffer大小 nB.数据 2B.CRC
// o 0xaa
void romProgram()
{
    uint16_t packSize;
    uint32_t baseAddress;
    uint16_t byteCount;
    uint16_t bufferWriteBytes;
    uint8_t *dataBuf;
    uint16_t wrLen, writtenCount;
    uint8_t cmd[2] = {0, 0};

    ((uint8_t *)&packSize)[0] = *(cmdBuf + 1);
    ((uint8_t *)&packSize)[1] = *(cmdBuf + 0);

    // 等待命令头接收完成
    while (cmdBuf_i_wr < (SIZE_CMD_HEADER + SIZE_BASE_ADDRESS + SIZE_BUFF_SIZE))
        ;

    // 基地址
    baseAddress = reverse4(*((uint32_t *)(cmdBuf + SIZE_CMD_HEADER)));
    // 写入总数量
    byteCount = reverse2(*((uint16_t *)(cmdBuf))) - SIZE_CMD_HEADER - SIZE_BASE_ADDRESS - SIZE_BUFF_SIZE - SIZE_CRC;
    // 编程buff大小
    bufferWriteBytes = reverse2(*((uint16_t *)(cmdBuf + SIZE_CMD_HEADER + SIZE_BASE_ADDRESS)));
    // 数据
    dataBuf = cmdBuf + SIZE_CMD_HEADER + SIZE_BASE_ADDRESS + SIZE_BUFF_SIZE;

    cmdBuf_i_rd = SIZE_CMD_HEADER + SIZE_BASE_ADDRESS + SIZE_BUFF_SIZE;
    writtenCount = 0;

    do
    {
        // 不能多字节编程
        if (bufferWriteBytes == 0)
        {
            // 剩余有效数据不足 1 word
            for (wrLen = 0; wrLen < 2;)
            {
                IE2 &= ~EUSB;                      // 禁用 USB 中断
                wrLen = cmdBuf_i_wr - cmdBuf_i_rd; // 8位单片机处理16位数据过程中遇上中断，被修改后回来，结果就可能异常，TMD
                IE2 |= EUSB;                       // 使能 USB 中断

                // 命令包收完了
                if (cmdBuf_i_wr == packSize)
                    break;

                // 被主机复位了
                if (cmdEnd)
                {
                    cmdEnd = 0;
                    return;
                }
            }

            /* Issue Load Write Buffer Command Sequence */
            /* Issue unlock command sequence */
            cmd[0] = 0xaa;
            cart_romWrite(0x555, cmd, 1);
            cmd[0] = 0x55;
            cart_romWrite(0x2aa, cmd, 1);
            /* Write Program Command */
            cmd[0] = 0xa0;
            cart_romWrite(0x555, cmd, 1);

            cart_romWrite(baseAddress >> 1,
                          dataBuf,
                          1);

            romWaitForDone(baseAddress >> 1,
                           reverse2(*((uint16_t *)dataBuf)));

            baseAddress += 2;
            dataBuf += 2;
            writtenCount += 2;
            cmdBuf_i_rd += 2;
        }
        // 可以多字节编程
        else
        {
            // 剩余数据不够1个write buffer
            for (wrLen = 0; wrLen < bufferWriteBytes;)
            {
                IE2 &= ~EUSB;                      // 禁用 USB 中断
                wrLen = cmdBuf_i_wr - cmdBuf_i_rd; // 8位单片机处理16位数据过程中遇上中断，被修改后回来，结果就可能异常，TMD
                IE2 |= EUSB;                       // 使能 USB 中断

                // 命令包收完了
                if (cmdBuf_i_wr == packSize)
                    break;

                // 被主机复位了
                if (cmdEnd)
                {
                    cmdEnd = 0;
                    return;
                }
            }

            wrLen = min(wrLen, byteCount - writtenCount);
            wrLen = min(wrLen, bufferWriteBytes);

            /* Issue Load Write Buffer Command Sequence */
            /* Issue unlock command sequence */
            cmd[0] = 0xaa;
            cart_romWrite(0x555, cmd, 1);
            cmd[0] = 0x55;
            cart_romWrite(0x2aa, cmd, 1);
            /* Issue Write to Buffer Command at Sector Address */
            cmd[0] = 0x25;
            cart_romWrite(baseAddress >> 1, cmd, 1);

            /* Write Number of Locations to program */
            *((uint16_t *)cmd) = reverse2(wrLen / 2 - 1);
            cart_romWrite(baseAddress >> 1, cmd, 1);

            /* Load Data into Buffer */
            cart_romWrite(baseAddress >> 1,
                          dataBuf,
                          wrLen / 2);

            /* Issue Program Buffer to Flash command */
            cmd[0] = 0x29;
            cart_romWrite(baseAddress >> 1, cmd, 1);

            romWaitForDone(
                (baseAddress + wrLen - 2) >> 1,
                reverse2(*((uint16_t *)(dataBuf + wrLen - 2))));

            baseAddress += wrLen;
            dataBuf += wrLen;
            writtenCount += wrLen;
            cmdBuf_i_rd += wrLen;
        }
    } while (writtenCount < byteCount);

    // 回复ack
    uart_responAck();
    uart_clearRecvBuf();
    endpointClear();
}

// rom写入透传
// i 2B.包大小 0xf5 4B.始地址 nB.数据 2B.CRC
// o 0xaa
void romWrite()
{
    uint32_t baseAddress;
    uint16_t byteCount;
    uint16_t wrLen, writtenCount;
    uint8_t *dataBuf;
    uint16_t packSize;

    ((uint8_t *)&packSize)[0] = *(cmdBuf + 1);
    ((uint8_t *)&packSize)[1] = *(cmdBuf + 0);

    // 基地址
    baseAddress = reverse4(*((uint32_t *)(cmdBuf + SIZE_CMD_HEADER)));
    // 写入总数量
    byteCount = reverse2(*((uint16_t *)(cmdBuf))) - SIZE_CMD_HEADER - SIZE_BASE_ADDRESS - SIZE_CRC;
    // 数据
    dataBuf = cmdBuf + SIZE_CMD_HEADER + SIZE_BASE_ADDRESS;

    LED_WR = 0;

    cmdBuf_i_rd = SIZE_CMD_HEADER + SIZE_BASE_ADDRESS;
    writtenCount = 0;

    cart_gbaRomAddrSetup(baseAddress);
    do
    {
        // 剩余有效数据不足 1 word，等下一个usb数据包
        for (wrLen = 0; wrLen < 2;)
        {
            IE2 &= ~EUSB;
            wrLen = cmdBuf_i_wr - cmdBuf_i_rd;
            IE2 |= EUSB;

            // 命令包收完了
            if (cmdBuf_i_wr == packSize)
                break;

            // 被主机复位了
            if (cmdEnd)
            {
                cmdEnd = 0;
                return;
            }
        }

        wrLen = min(wrLen, byteCount - writtenCount);
        wrLen = wrLen & 0xfffe; // 按word对齐

        cart_romWrite_continuous(baseAddress,
                                 dataBuf,
                                 wrLen / 2);

        baseAddress += wrLen / 2;
        dataBuf += wrLen;
        writtenCount += wrLen;
        cmdBuf_i_rd += wrLen;
    } while (writtenCount < byteCount); // 数据还没发完

    LED_WR = 1;
    CART_CS1 = 1;

    // 回复ack
    uart_responAck();
    uart_clearRecvBuf();
    endpointClear();
}

// rom 读取透传
// i 2B.包大小 0xf6 4B.始地址 2B.读取数量 2B.CRC
// o 2B.CRC nB.数据
void romRead()
{
    uint32_t baseAddress; // 基地址
    uint16_t byteCount;   // 读取总数量
    uint16_t rdLen, i;
    uint16_t packSize;

    ((uint8_t *)&packSize)[0] = *(cmdBuf + 1);
    ((uint8_t *)&packSize)[1] = *(cmdBuf + 0);

    // 等待命令接收完成
    while (cmdBuf_i_wr < packSize)
        ;
    uart_responData(responCrc, 2);

    // 基地址
    baseAddress = reverse4(*((uint32_t *)(cmdBuf + SIZE_CMD_HEADER)));
    // 读取总数量
    byteCount = reverse2(*((uint16_t *)(cmdBuf + SIZE_CMD_HEADER + SIZE_BASE_ADDRESS)));

    for (i = 0; i < byteCount;)
    {
        rdLen = byteCount - i;
        rdLen = min(rdLen, (sizeof(responBuf) - 2)); // 把端点fifo写满会发不出去，原因未知

        cart_romRead(
            (baseAddress + i) >> 1,
            responBuf,
            rdLen / 2);

        uart_responData(responBuf, rdLen);

        i += rdLen;
    }

    uart_clearRecvBuf();
    endpointClear();
}

// ram写入
// i 2B.包大小 0xf7 4B.基地址 nB.写入数据 2B.CRC
// o 0xaa
void ramWrite()
{
    uint32_t baseAddress;
    uint16_t byteCount;
    uint16_t wrLen, writtenCount;
    uint8_t *dataBuf;
    uint16_t packSize;

    ((uint8_t *)&packSize)[0] = *(cmdBuf + 1);
    ((uint8_t *)&packSize)[1] = *(cmdBuf + 0);

    // 基地址
    baseAddress = reverse4(*((uint32_t *)(cmdBuf + SIZE_CMD_HEADER)));
    // 写入总数量
    byteCount = reverse2(*((uint16_t *)(cmdBuf))) - SIZE_CMD_HEADER - SIZE_BASE_ADDRESS - SIZE_CRC;
    // 数据
    dataBuf = cmdBuf + SIZE_CMD_HEADER + SIZE_BASE_ADDRESS;

    cmdBuf_i_rd = SIZE_CMD_HEADER + SIZE_BASE_ADDRESS;
    writtenCount = 0;

    do
    {
        // 剩余有效数据不足 1 byte，等下一个usb数据包
        for (wrLen = 0; wrLen < 1;)
        {
            IE2 &= ~EUSB;
            wrLen = cmdBuf_i_wr - cmdBuf_i_rd;
            IE2 |= EUSB;

            // 命令包收完了
            if (cmdBuf_i_wr == packSize)
                break;

            // 被主机复位了
            if (cmdEnd)
            {
                cmdEnd = 0;
                return;
            }
        }

        wrLen = min(wrLen, byteCount - writtenCount);

        cart_ramWrite(baseAddress, dataBuf, wrLen);

        baseAddress += wrLen;
        dataBuf += wrLen;
        writtenCount += wrLen;
        cmdBuf_i_rd += wrLen;
    } while (writtenCount < byteCount); // 数据还没发完

    // 回复ack
    uart_responAck();
    uart_clearRecvBuf();
    endpointClear();
}

// ram 读取
// i 2B.包大小 0xf8 4B.基地址 2B.读取数量 2B.CRC
// o 2B.CRC nB.数据
void ramRead()
{
    uint32_t baseAddress; // 基地址
    uint16_t byteCount;   // 读取总数量
    uint16_t rdLen, i;
    uint16_t packSize;

    ((uint8_t *)&packSize)[0] = *(cmdBuf + 1);
    ((uint8_t *)&packSize)[1] = *(cmdBuf + 0);

    // 等待命令接收完成
    while (cmdBuf_i_wr < packSize)
        ;
    uart_responData(responCrc, 2);

    // 基地址
    baseAddress = reverse4(*((uint32_t *)(cmdBuf + SIZE_CMD_HEADER)));
    // 读取总数量
    byteCount = reverse2(*((uint16_t *)(cmdBuf + SIZE_CMD_HEADER + SIZE_BASE_ADDRESS)));

    for (i = 0; i < byteCount;)
    {
        rdLen = byteCount - i;
        rdLen = min(rdLen, (sizeof(responBuf) - 1)); // 把端点fifo写满会发不出去，原因未知

        cart_ramRead(baseAddress, responBuf, rdLen);

        uart_responData(responBuf, rdLen);

        baseAddress += rdLen;
        i += rdLen;
    }

    uart_clearRecvBuf();
    endpointClear();
}

void ramProgramFlash()
{
    uint16_t packSize;
    uint32_t baseAddress;
    uint16_t byteCount;
    uint8_t *dataBuf;
    uint16_t wrLen, writtenCount;
    uint8_t cmd;

    ((uint8_t *)&packSize)[0] = *(cmdBuf + 1);
    ((uint8_t *)&packSize)[1] = *(cmdBuf + 0);

    // 等待命令头接收完成
    while (cmdBuf_i_wr < (SIZE_CMD_HEADER + SIZE_BASE_ADDRESS))
        ;

    // 基地址
    baseAddress = reverse4(*((uint32_t *)(cmdBuf + SIZE_CMD_HEADER)));
    // 写入总数量
    byteCount = reverse2(*((uint16_t *)(cmdBuf))) - SIZE_CMD_HEADER - SIZE_BASE_ADDRESS - SIZE_CRC;
    // 数据
    dataBuf = cmdBuf + SIZE_CMD_HEADER + SIZE_BASE_ADDRESS;

    cmdBuf_i_rd = SIZE_CMD_HEADER + SIZE_BASE_ADDRESS + SIZE_BUFF_SIZE;
    writtenCount = 0;

    do
    {
        // 剩余有效数据不足 1 byte
        for (wrLen = 0; wrLen < 1;)
        {
            IE2 &= ~EUSB;
            wrLen = cmdBuf_i_wr - cmdBuf_i_rd;
            IE2 |= EUSB;

            // 命令包收完了
            if (cmdBuf_i_wr == packSize)
                break;

            // 被主机复位了
            if (cmdEnd)
            {
                cmdEnd = 0;
                return;
            }
        }

        cmd = 0xaa;
        cart_ramWrite(0x5555, &cmd, 1);
        cmd = 0x55;
        cart_ramWrite(0x2aaa, &cmd, 1);
        cmd = 0xa0;
        cart_ramWrite(0x5555, &cmd, 1); // FLASH_COMMAND_PROGRAM
        cart_ramWrite((uint16_t)(baseAddress), dataBuf, 1);

        // wait for done
        do
        {
            cart_ramRead((uint16_t)(baseAddress), &cmd, 1);
            if (cmdEnd)
            {
                cmdEnd = 0;
                return;
            }
        } while (cmd != *dataBuf);

        baseAddress++;
        dataBuf++;
        writtenCount++;
        cmdBuf_i_rd++;
    } while (writtenCount < byteCount);

    uart_responAck();
    uart_clearRecvBuf();
    endpointClear();
}

////////////////////////////////////////////////////////////
/// 下面是gbc的功能
////////////////////////////////////////////////////////////

void gbcWrite()
{
    uint32_t baseAddress;
    uint16_t byteCount;
    uint16_t wrLen, writtenCount;
    uint8_t *dataBuf;
    uint16_t packSize;

    ((uint8_t *)&packSize)[0] = *(cmdBuf + 1);
    ((uint8_t *)&packSize)[1] = *(cmdBuf + 0);

    // 基地址
    baseAddress = reverse4(*((uint32_t *)(cmdBuf + SIZE_CMD_HEADER)));
    // 写入总数量
    byteCount = reverse2(*((uint16_t *)(cmdBuf))) - SIZE_CMD_HEADER - SIZE_BASE_ADDRESS - SIZE_CRC;
    // 数据
    dataBuf = cmdBuf + SIZE_CMD_HEADER + SIZE_BASE_ADDRESS;

    LED_WR = 0;

    cmdBuf_i_rd = SIZE_CMD_HEADER + SIZE_BASE_ADDRESS;
    writtenCount = 0;

    do
    {
        // 剩余有效数据不足 1 byte，等下一个usb数据包
        for (wrLen = 0; wrLen < 1;)
        {
            IE2 &= ~EUSB;
            wrLen = cmdBuf_i_wr - cmdBuf_i_rd;
            IE2 |= EUSB;

            // 命令包收完了
            if (cmdBuf_i_wr == packSize)
                break;

            // 被主机复位了
            if (cmdEnd)
            {
                cmdEnd = 0;
                return;
            }
        }

        wrLen = min(wrLen, byteCount - writtenCount);

        cart_gbcWrite(baseAddress, dataBuf, wrLen);

        baseAddress += wrLen;
        dataBuf += wrLen;
        writtenCount += wrLen;
        cmdBuf_i_rd += wrLen;
    } while (writtenCount < byteCount); // 数据还没发完

    // 回复ack
    uart_responAck();
    uart_clearRecvBuf();
    endpointClear();
}

void gbcRead()
{
    uint32_t baseAddress; // 基地址
    uint16_t byteCount;   // 读取总数量
    uint16_t rdLen, i;
    uint16_t packSize;

    ((uint8_t *)&packSize)[0] = *(cmdBuf + 1);
    ((uint8_t *)&packSize)[1] = *(cmdBuf + 0);

    // 等待命令接收完成
    while (cmdBuf_i_wr < packSize)
        ;
    uart_responData(responCrc, 2);

    // 基地址
    baseAddress = reverse4(*((uint32_t *)(cmdBuf + SIZE_CMD_HEADER)));
    // 读取总数量
    byteCount = reverse2(*((uint16_t *)(cmdBuf + SIZE_CMD_HEADER + SIZE_BASE_ADDRESS)));

    for (i = 0; i < byteCount;)
    {
        rdLen = byteCount - i;
        rdLen = min(rdLen, (sizeof(responBuf) - 1)); // 把端点fifo写满会发不出去，原因未知

        cart_gbcRead(baseAddress, responBuf, rdLen);

        uart_responData(responBuf, rdLen);

        baseAddress += rdLen;
        i += rdLen;
    }

    // 返回数据
    uart_clearRecvBuf();
    endpointClear();
}

void gbcRomProgram()
{
    uint16_t packSize;
    uint32_t baseAddress;
    uint16_t byteCount;
    uint16_t bufferWriteBytes;
    uint8_t *dataBuf;
    uint16_t wrLen, writtenCount;
    uint8_t cmd;

    ((uint8_t *)&packSize)[0] = *(cmdBuf + 1);
    ((uint8_t *)&packSize)[1] = *(cmdBuf + 0);

    // 等待命令头接收完成
    while (cmdBuf_i_wr < (SIZE_CMD_HEADER + SIZE_BASE_ADDRESS + SIZE_BUFF_SIZE))
        ;

    // 基地址
    baseAddress = reverse4(*((uint32_t *)(cmdBuf + SIZE_CMD_HEADER)));
    // 写入总数量
    byteCount = reverse2(*((uint16_t *)(cmdBuf))) - SIZE_CMD_HEADER - SIZE_BASE_ADDRESS - SIZE_BUFF_SIZE - SIZE_CRC;
    // 编程buff大小
    bufferWriteBytes = reverse2(*((uint16_t *)(cmdBuf + SIZE_CMD_HEADER + SIZE_BASE_ADDRESS)));
    // 数据
    dataBuf = cmdBuf + SIZE_CMD_HEADER + SIZE_BASE_ADDRESS + SIZE_BUFF_SIZE;

    cmdBuf_i_rd = SIZE_CMD_HEADER + SIZE_BASE_ADDRESS + SIZE_BUFF_SIZE;
    writtenCount = 0;

    do
    {
        // 不能多字节编程编程
        if (bufferWriteBytes == 0)
        {
            // 剩余有效数据不足 1 byte
            for (wrLen = 0; wrLen < 1;)
            {
                IE2 &= ~EUSB;                      // 禁用 USB 中断
                wrLen = cmdBuf_i_wr - cmdBuf_i_rd; // 8位单片机处理16位数据过程中遇上中断，被修改后回来，结果就可能异常，TMD
                IE2 |= EUSB;                       // 使能 USB 中断

                // 命令包收完了
                if (cmdBuf_i_wr == packSize)
                    break;

                // 被主机复位了
                if (cmdEnd)
                {
                    cmdEnd = 0;
                    return;
                }
            }

            cmd = 0xaa;
            cart_gbcWrite(0xaaa, &cmd, 1);
            cmd = 0x55;
            cart_gbcWrite(0x555, &cmd, 1);
            cmd = 0xa0;
            cart_gbcWrite(0xaaa, &cmd, 1); // FLASH_COMMAND_PROGRAM
            cart_gbcWrite(baseAddress, dataBuf, 1);

            // wait for done
            do
            {
                cart_gbcRead(baseAddress, &cmd, 1);

                // 被主机复位了
                if (cmdBuf_i_wr == 0)
                {
                    return;
                }
            } while (cmd != *dataBuf);

            baseAddress += 1;
            dataBuf += 1;
            writtenCount += 1;
            cmdBuf_i_rd += 1;
        }
        // 可以多字节编程
        else
        {
            // 剩余数据不够1个write buffer
            for (wrLen = 0; wrLen < bufferWriteBytes;)
            {
                IE2 &= ~EUSB;                      // 禁用 USB 中断
                wrLen = cmdBuf_i_wr - cmdBuf_i_rd; // 8位单片机处理16位数据过程中遇上中断，被修改后回来，结果就可能异常，TMD
                IE2 |= EUSB;                       // 使能 USB 中断

                // 命令包收完了
                if (cmdBuf_i_wr == packSize)
                    break;

                // 被主机复位了
                if (cmdEnd)
                {
                    cmdEnd = 0;
                    return;
                }
            }

            wrLen = min(wrLen, byteCount - writtenCount);
            wrLen = min(wrLen, bufferWriteBytes);

            cmd = 0xaa;
            cart_gbcWrite(0xaaa, &cmd, 1);
            cmd = 0x55;
            cart_gbcWrite(0x555, &cmd, 1);
            cmd = 0x25;
            cart_gbcWrite(baseAddress, &cmd, 1);

            cmd = wrLen - 1;
            cart_gbcWrite(baseAddress, &cmd, 1);

            cart_gbcWrite(baseAddress,
                          dataBuf,
                          wrLen);

            cmd = 0x29;
            cart_gbcWrite(baseAddress, &cmd, 1);

            // wait for done
            do
            {
                cart_gbcRead(baseAddress + wrLen - 1, &cmd, 1);

                // 被主机复位了
                if (cmdBuf_i_wr == 0)
                {
                    return;
                }
            } while (cmd != *(dataBuf + wrLen - 1));

            baseAddress += wrLen;
            dataBuf += wrLen;
            writtenCount += wrLen;
            cmdBuf_i_rd += wrLen;
        }

    } while (writtenCount < byteCount);

    // 回复ack
    uart_responAck();
    uart_clearRecvBuf();
    endpointClear();
}

void gbcWrite_forFram()
{
    uint32_t baseAddress;
    uint16_t byteCount;
    uint16_t wrLen, writtenCount;
    uint8_t *dataBuf;
    uint16_t packSize;
    uint8_t latency, ii;

    ((uint8_t *)&packSize)[0] = *(cmdBuf + 1);
    ((uint8_t *)&packSize)[1] = *(cmdBuf + 0);

    // 等待命令头接收完成
    while (cmdBuf_i_wr < (SIZE_CMD_HEADER + SIZE_BASE_ADDRESS + SIZE_LATENCY))
        ;

    // 基地址
    baseAddress = reverse4(*((uint32_t *)(cmdBuf + SIZE_CMD_HEADER)));
    // 写入总数量
    byteCount = reverse2(*((uint16_t *)(cmdBuf))) - SIZE_CMD_HEADER - SIZE_BASE_ADDRESS - SIZE_LATENCY - SIZE_CRC;
    // 延迟周期
    latency = *(cmdBuf + SIZE_CMD_HEADER + SIZE_BASE_ADDRESS);
    // 数据
    dataBuf = cmdBuf + SIZE_CMD_HEADER + SIZE_BASE_ADDRESS + SIZE_LATENCY;

    cmdBuf_i_rd = SIZE_CMD_HEADER + SIZE_BASE_ADDRESS + SIZE_LATENCY;
    writtenCount = 0;
    do
    {
        // 剩余有效数据不足 1 byte，等下一个usb数据包
        for (wrLen = 0; wrLen < 1;)
        {
            IE2 &= ~EUSB;
            wrLen = cmdBuf_i_wr - cmdBuf_i_rd;
            IE2 |= EUSB;

            // 命令包收完了
            if (cmdBuf_i_wr == packSize)
                break;

            // 被主机复位了
            if (cmdEnd)
            {
                cmdEnd = 0;
                return;
            }
        }

        wrLen = min(wrLen, byteCount - writtenCount);

        cart_gbcWrite(baseAddress, dataBuf, 1); // 逐个字节写
        for (ii = 0; ii < latency; ii++)
            NOP(1);

        baseAddress++;
        dataBuf++;
        writtenCount++;
        cmdBuf_i_rd++;
    } while (writtenCount < byteCount); // 数据还没发完

    // 回复ack
    uart_responAck();
    uart_clearRecvBuf();
    endpointClear();
}

void gbcRead_forFram()
{
    uint32_t baseAddress;
    uint16_t byteCount;
    uint16_t rdLen, readCount, i;
    uint16_t packSize;
    uint8_t latency, ii;

    ((uint8_t *)&packSize)[0] = *(cmdBuf + 1);
    ((uint8_t *)&packSize)[1] = *(cmdBuf + 0);

    // 等待命令接收完成
    while (cmdBuf_i_wr < packSize)
        ;
    uart_responData(responCrc, 2);

    // 基地址
    baseAddress = reverse4(*((uint32_t *)(cmdBuf + SIZE_CMD_HEADER)));
    // 读取总数量
    byteCount = reverse2(*((uint16_t *)(cmdBuf + SIZE_CMD_HEADER + SIZE_BASE_ADDRESS)));
    // 延迟周期
    latency = *(cmdBuf + SIZE_CMD_HEADER + SIZE_BASE_ADDRESS + SIZE_BYTE_COUNT);

    for (readCount = 0; readCount < byteCount;)
    {
        rdLen = byteCount - readCount;
        rdLen = min(rdLen, (sizeof(responBuf) - 1)); // 把端点fifo写满会发不出去，原因未知

        for (i = 0; i < rdLen; i++)
        {
            cart_gbcRead(baseAddress, responBuf + i, 1); // 逐个字节读
            for (ii = 0; ii < latency; ii++)
                NOP(1);
            baseAddress++;
        }

        uart_responData(responBuf, rdLen);

        readCount += rdLen;
    }

    uart_clearRecvBuf();
    endpointClear();
}

// 卡带电源
// i 2B.包大小 0xa0 1B.pwr 2B.CRC
//   06 00 a0 xx 00 00
// o 无返回
void cart_power()
{
    uint16_t packSize;
    uint8_t val;

    ((uint8_t *)&packSize)[0] = *(cmdBuf + 1);
    ((uint8_t *)&packSize)[1] = *(cmdBuf + 0);

    // 等待命令接收完成
    while (cmdBuf_i_wr < packSize)
        ;

    val = cmdBuf[3];

    // 3.3v 输出
    if (val == 1)
    {
        PWR_CART = 1;
        PWR_5V = 0;
    }
    // 5v 输出
    else if (val == 2)
    {
        PWR_CART = 1;
        PWR_5V = 1;
    }
    // 断电
    else
    {
        PWR_CART = 0;
        PWR_5V = 0;
    }

    uart_clearRecvBuf();
    endpointClear();
}

// phi分频输出
// i 2B.包大小 0xa1 1B.div 2B.CRC
//   06 00 a1 xx 00 00
// o 无返回
void cart_phi()
{
    uint16_t packSize;
    uint8_t val;

    ((uint8_t *)&packSize)[0] = *(cmdBuf + 1);
    ((uint8_t *)&packSize)[1] = *(cmdBuf + 0);

    // 等待命令接收完成
    while (cmdBuf_i_wr < packSize)
        ;

    val = cmdBuf[3];

    CLK_SYSCLKO_Divider(val); // 分频系数 0~127, 0:不输出

    uart_clearRecvBuf();
    endpointClear();
}