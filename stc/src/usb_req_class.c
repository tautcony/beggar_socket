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
/* 如果要在程序中使用此代码,请在程序中注明使用了STC的资料及程序             */
/*---------------------------------------------------------------------*/

/**
 *
 * cdc 类特殊请求处理函数
 *
 */

#include "main.h"
#include "usb.h"
#include "usb_req_class.h"
#include "uart.h"

LINECODING LineCoding;

void usb_req_class()
{
    switch (Setup.bRequest)
    {
    case SET_LINE_CODING:
        // 设置波特率，校验，停止位...
        usb_set_line_coding();
        break;
    case GET_LINE_CODING:
        // 获取波特率，校验，停止位
        usb_get_line_coding();
        break;
    case SET_CONTROL_LINE_STATE:
        // 流控
        usb_set_ctrl_line_state();
        break;
    default:
        usb_setup_stall();
        return;
    }
}

// 设置波特率，校验，停止位...
void usb_set_line_coding()
{
    if ((DeviceState != DEVSTATE_CONFIGURED) ||
        (Setup.bmRequestType != (OUT_DIRECT | CLASS_REQUEST | INTERFACE_RECIPIENT)))
    {
        usb_setup_stall();
        return;
    }

    Ep0State.pData = (uint8_t *)&LineCoding;
    Ep0State.wSize = Setup.wLength;

    usb_setup_out();
}

// 获取波特率，校验，停止位
void usb_get_line_coding()
{
    if ((DeviceState != DEVSTATE_CONFIGURED) ||
        (Setup.bmRequestType != (IN_DIRECT | CLASS_REQUEST | INTERFACE_RECIPIENT)))
    {
        usb_setup_stall();
        return;
    }

    Ep0State.pData = (uint8_t *)&LineCoding;
    Ep0State.wSize = Setup.wLength;

    usb_setup_in();
}

// 流控
void usb_set_ctrl_line_state()
{
    BOOL rts, dtr;

    if ((DeviceState != DEVSTATE_CONFIGURED) ||
        (Setup.bmRequestType != (OUT_DIRECT | CLASS_REQUEST | INTERFACE_RECIPIENT)))
    {
        usb_setup_stall();
        return;
    }

    rts = ((Setup.wValueL & 0x02) != 0);
    dtr = ((Setup.wValueL & 0x01) != 0);
    uart_setControlLine(rts, dtr);

    usb_write_reg(INDEX, 0);
    usb_setup_status();
}
