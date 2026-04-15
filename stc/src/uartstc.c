/*---------------------------------------------------------------------*/
/* --- STC MCU Limited ------------------------------------------------*/
/* --- STC 1T Series MCU Demo Programme -------------------------------*/
/* --- Mobile: (86)13922805190 ----------------------------------------*/
/* --- Fax: 86-0513-55012956,55012947,55012969 ------------------------*/
/* --- Tel: 86-0513-55012928,55012929,55012966 ------------------------*/
/* --- Web: www.STCAI.com ---------------------------------------------*/
/* --- Web: www.STCMCUDATA.com  ---------------------------------------*/
/* --- BBS: www.STCAIMCU.com  -----------------------------------------*/
/* --- QQ:  800003751 -------------------------------------------------*/
/* 如果要在程序中使用此代码,请在程序中注明使用了STC的资料及程序        */
/*---------------------------------------------------------------------*/

#include "main.h"
#include "uartstc.h"
#include "usb.h"
#include "usb_req_class.h"

// uart_polling 函数用于轮询处理 UART 与 USB 之间的数据收发。
void uart_polling()
{
    uint8_t csr;
    // uint8_t dat;
    uint8_t cnt;

    if (DeviceState != DEVSTATE_CONFIGURED)
    {
        return;
    }

    // 环回测试
    if (RxRptr != RxWptr)
    {
        // 选中端点1
        usb_write_reg(INDEX, 1);
        csr = usb_read_reg(INCSR1);

        // fifo已空
        if ((csr & INFIFONE) == 0)
        {
            // 禁用 USB 中断
            IE2 &= ~EUSB;

            cnt = 0;
            while (RxRptr != RxWptr)
            {
                usb_write_reg(FIFO1, RxBuffer[RxRptr++]);
                cnt++;
                if (cnt == EP1IN_SIZE)
                    break;
            }

            // 数据包准备完毕
            usb_write_reg(INCSR1, INIPRDY);

            // 使能 USB 中断
            IE2 |= EUSB;
        }
    }

    // // USB IN 端点数据发送
    // //
    // // 应该还要判断上一个数据包是否已发送
    // // incsr1 -> IPRDY， 发送结束后硬件会清0
    // if (!UsbInBusy && (TxRptr != TxWptr))
    // {
    //     UsbInBusy = 1;

    //     // 禁用 USB 中断
    //     IE2 &= ~EUSB;

    //     // 选中端点1
    //     usb_write_reg(INDEX, 1);

    //     // 填充 in fifo
    //     cnt = 0;
    //     while (TxRptr != TxWptr)
    //     {
    //         usb_write_reg(FIFO1, TxBuffer[TxRptr++]);
    //         cnt++;
    //         if (cnt == EP1IN_SIZE)
    //             break;
    //     }

    //     // 数据包准备完毕
    //     usb_write_reg(INCSR1, INIPRDY);

    //     // 使能 USB 中断
    //     IE2 |= 0x80;
    // }

    // // UART 数据发送
    // // 不要了
    // if (!UartBusy && (RxRptr != RxWptr))
    // {
    //     dat = RxBuffer[RxRptr++];
    //     UartBusy = 1;
    //     switch (LineCoding.bParityType)
    //     {
    //     case NONE_PARITY:
    //     case SPACE_PARITY:
    //         S2CON &= ~0x08; // 无奇偶校验
    //         break;
    //     case ODD_PARITY:
    //         ACC = dat;
    //         if (P)
    //             S2CON &= ~0x08; // 奇校验
    //         else
    //             S2CON |= 0x08;
    //         break;
    //     case EVEN_PARITY:
    //         ACC = dat;
    //         if (P)
    //             S2CON |= 0x08; // 偶校验
    //         else
    //             S2CON &= ~0x08;
    //         break;
    //     case MARK_PARITY:
    //         S2CON |= 0x08; // 标记校验
    //         break;
    //     }
    //     S2BUF = dat; // 发送数据

    //     while (UartBusy)
    //         ; // 等待发送完成
    // }

    // // USB OUT 缓冲区不足了
    // if (UsbOutBusy)
    // {
    //     // 禁用 USB 中断
    //     IE2 &= ~0x80;
    //     // 缓冲区空间又够了
    //     if (RxWptr - RxRptr < 256 - EP1OUT_SIZE)
    //     {
    //         UsbOutBusy = 0;
    //         usb_write_reg(INDEX, 1);   // 选择端点1
    //         usb_write_reg(OUTCSR1, 0); // 端点可以接收了
    //     }
    //     // 使能 USB 中断
    //     IE2 |= 0x80;
    // }
}
