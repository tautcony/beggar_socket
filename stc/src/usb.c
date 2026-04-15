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

/***
 *
 * stc usb phy 驱动
 *
 */

#include "main.h"
#include "usb.h"
#include "usb_req_std.h"
#include "usb_req_class.h"

#include "uart.h"

SETUP Setup; // setup包的内容

uint8_t DeviceState;
EPSTATE Ep0State;
uint8_t InEpState;
uint8_t OutEpState;

BOOL ep1Busy = 0;

void usb_init()
{
    P3M0 &= ~0x03;
    P3M1 |= 0x03; // p3.0 3.1 高阻输入

    IRC48MCR = 0x80; // 使能内部 48M 的 USB 专用 IRC
    while (!(IRC48MCR & 0x01))
        ;

    USBCLK = 0x00; // 禁用pll
    USBCON = 0x90; // 使能usb 使能上拉1.5k

    usb_write_reg(FADDR, 0x00);     // 清除主机分配的地址
    usb_write_reg(POWER, 0x08);     // 复位usb总线
    usb_write_reg(INTRIN1E, 0x3f);  // 使能所有端点in中断
    usb_write_reg(INTROUT1E, 0x3f); // 使能所有端点out中断
    usb_write_reg(INTRUSBE, 0x07);  // 使能复位、恢复、挂起中断
    usb_write_reg(POWER, 0x00);     // 取消总线复位？

    DeviceState = DEVSTATE_DEFAULT;
    Ep0State.bState = EPSTATE_IDLE;
    InEpState = 0x00;
    OutEpState = 0x00;

    IE2 |= EUSB; // 打开usb中断
}

// 读usb外设间接寄存器
uint8_t usb_read_reg(uint8_t addr)
{
    uint8_t dat;

    while (USBADR & 0x80) // USB外设正在USBDAT
        ;
    USBADR = addr | 0x80; // 开始读取间接寄存器
    while (USBADR & 0x80) // 等待USBDAT数据有效
        ;
    dat = USBDAT;

    return dat;
}

// 写usb外设间接寄存器
void usb_write_reg(uint8_t addr, uint8_t dat)
{
    while (USBADR & 0x80) // USB外设正在读取USBDAT
        ;
    USBADR = addr & 0x7f;
    USBDAT = dat;
}

uint8_t usb_read_fifo0(uint8_t fifo, uint8_t *pdat)
{
    uint8_t cnt;
    uint8_t ret;

    ret = cnt = usb_read_reg(COUNT0); // 端点0 out包数据长度
    while (cnt--)
    {
        *pdat++ = usb_read_reg(fifo);
    }

    return ret; // 返回包数据长度
}

void usb_write_fifo(uint8_t fifo, uint8_t *pdat, uint8_t cnt)
{
    while (cnt--)
    {
        usb_write_reg(fifo, *pdat++);
    }
}

// usb中断入口
void usb_isr() interrupt 25
{
    uint8_t intrusb;
    uint8_t intrin;
    uint8_t introut;

    intrusb = usb_read_reg(INTRUSB);  // 总线中断标志 sof 复位 挂起 恢复
    intrin = usb_read_reg(INTRIN1);   // 端点in中断标志
    introut = usb_read_reg(INTROUT1); // 端点out中断标志

    // 总线挂起
    // 实测进不了这个中断，暂不知原因
    if (intrusb & SUSIF)
    {
        usb_suspend(); // 空的
    }
    // 总线恢复
    if (intrusb & RSUIF)
    {
        usb_resume(); // 空的
    }
    // 总线复位
    if (intrusb & RSTIF)
    {
        usb_reset();
    }

    // ep0
    if (intrin & EP0IF)
        usb_setup(); // setup包

    // ep12345 in
    // 下面的函数不涉及数据，只是清除下标志位
#ifdef EN_EP1IN
    if (intrin & EP1INIF)
        usb_in_ep1(); // 主机获取数据
#endif
#ifdef EN_EP2IN
    if (intrin & EP2INIF)
        usb_in_ep2(); // cdc此端点无功能，只清除标志
#endif
#ifdef EN_EP3IN
    if (intrin & EP3INIF)
        usb_in_ep3();
#endif
#ifdef EN_EP4IN
    if (intrin & EP4INIF)
        usb_in_ep4();
#endif
#ifdef EN_EP5IN
    if (intrin & EP5INIF)
        usb_in_ep5();
#endif

    // ep12345 out
#ifdef EN_EP1OUT
    if (introut & EP1OUTIF)
        usb_out_ep1(); // 主机输出数据
#endif
#ifdef EN_EP2OUT
    if (introut & EP2OUTIF)
        usb_out_ep2();
#endif
#ifdef EN_EP3OUT
    if (introut & EP3OUTIF)
        usb_out_ep3();
#endif
#ifdef EN_EP4OUT
    if (introut & EP4OUTIF)
        usb_out_ep4();
#endif
#ifdef EN_EP5OUT
    if (introut & EP5OUTIF)
        usb_out_ep5();
#endif
}

void usb_resume()
{
}

void usb_reset()
{
    usb_write_reg(FADDR, 0x00); // 清除主机分配的地址
    DeviceState = DEVSTATE_DEFAULT;
    Ep0State.bState = EPSTATE_IDLE;

#ifdef EN_EP1IN
    usb_write_reg(INDEX, 1);
    usb_write_reg(INCSR1, INCLRDT | INFLUSH); // 清除端点stall，取消数据包传输
#endif
#ifdef EN_EP2IN
    usb_write_reg(INDEX, 2);
    usb_write_reg(INCSR1, INCLRDT | INFLUSH);
#endif
#ifdef EN_EP3IN
    usb_write_reg(INDEX, 3);
    usb_write_reg(INCSR1, INCLRDT | INFLUSH);
#endif
#ifdef EN_EP4IN
    usb_write_reg(INDEX, 4);
    usb_write_reg(INCSR1, INCLRDT | INFLUSH);
#endif
#ifdef EN_EP5IN
    usb_write_reg(INDEX, 5);
    usb_write_reg(INCSR1, INCLRDT | INFLUSH);
#endif
#ifdef EN_EP1OUT
    usb_write_reg(INDEX, 1);
    usb_write_reg(OUTCSR1, OUTCLRDT | OUTFLUSH); // 清除端点stall，取消数据包传输
#endif
#ifdef EN_EP2OUT
    usb_write_reg(INDEX, 2);
    usb_write_reg(OUTCSR1, OUTCLRDT | OUTFLUSH);
#endif
#ifdef EN_EP3OUT
    usb_write_reg(INDEX, 3);
    usb_write_reg(OUTCSR1, OUTCLRDT | OUTFLUSH);
#endif
#ifdef EN_EP4OUT
    usb_write_reg(INDEX, 4);
    usb_write_reg(OUTCSR1, OUTCLRDT | OUTFLUSH);
#endif
#ifdef EN_EP5OUT
    usb_write_reg(INDEX, 5);
    usb_write_reg(OUTCSR1, OUTCLRDT | OUTFLUSH);
#endif
    usb_write_reg(INDEX, 0);
}

void usb_suspend()
{
    TIMER4_Run(); // 让led run闪
}

void usb_setup()
{
    uint8_t csr;

    usb_write_reg(INDEX, 0);
    csr = usb_read_reg(CSR0); // 端点0状态

    // 被主机stall
    if (csr & STSTL)
    {
        usb_write_reg(CSR0, csr & ~STSTL); // 对自己写 0 清除标志位
        Ep0State.bState = EPSTATE_IDLE;
    }

    // setup包传输结束
    if (csr & SUEND)
    {
        usb_write_reg(CSR0, csr | SSUEND); // 对 SSUEND 写 1 清除 SUEND 标志位
    }

    // 控制传输状态机
    switch (Ep0State.bState)
    {
    // 建立阶段
    case EPSTATE_IDLE:
        // 收到了out包
        if (csr & OPRDY)
        {
            usb_read_fifo0(FIFO0, (uint8_t *)&Setup);
            Setup.wLength = reverse2_forIRQ(Setup.wLength);
            switch (Setup.bmRequestType & REQUEST_MASK)
            {
            case STANDARD_REQUEST: // 标准请求
                usb_req_std();
                break;
            case CLASS_REQUEST: // 类特殊请求
                usb_req_class();
                break;
            case VENDOR_REQUEST: // 厂家特殊请求
                usb_setup_stall();
                break;
            default:
                usb_setup_stall();
                return;
            }
        }
        break;
    // 数据阶段 in
    case EPSTATE_DATAIN:
        usb_ctrl_in(); // 返回数据
        break;
    // 数据阶段 out
    case EPSTATE_DATAOUT:
        usb_ctrl_out(); // 接收数据
        break;
    }
}

// 阻塞端点
void usb_setup_stall()
{
    Ep0State.bState = EPSTATE_STALL;
    usb_write_reg(CSR0, SOPRDY | SDSTL);
}

// 已处理setup包，进入数据阶段in
void usb_setup_in()
{
    Ep0State.bState = EPSTATE_DATAIN;
    usb_write_reg(CSR0, SOPRDY);
    usb_ctrl_in();
}

// 已处理setup包，进入数据阶段out
void usb_setup_out()
{
    Ep0State.bState = EPSTATE_DATAOUT;
    usb_write_reg(CSR0, SOPRDY);
}

// 返回0长度数据包
// 用于没有数据阶段，直接到状态阶段
void usb_setup_status()
{
    Ep0State.bState = EPSTATE_IDLE;
    usb_write_reg(CSR0, SOPRDY | DATEND);
}

// 数据阶段返回数据
void usb_ctrl_in()
{
    uint8_t csr;
    uint8_t cnt;

    usb_write_reg(INDEX, 0);
    csr = usb_read_reg(CSR0);

    // 主机还没取上一份数据
    if (csr & IPRDY)
        return;

    // 分包发送
    cnt = Ep0State.wSize > EP0_SIZE ? EP0_SIZE : Ep0State.wSize;
    usb_write_fifo(FIFO0, Ep0State.pData, cnt);
    Ep0State.wSize -= cnt;
    Ep0State.pData += cnt;

    if (Ep0State.wSize == 0)
    {
        usb_write_reg(CSR0, IPRDY | DATEND); // fifo已填充好数据 进入状态阶段
        Ep0State.bState = EPSTATE_IDLE;
    }
    else
    {
        usb_write_reg(CSR0, IPRDY); // fifo已填充好数据
    }
}

// 数据阶段接收数据
void usb_ctrl_out()
{
    uint8_t csr;
    uint8_t cnt;

    usb_write_reg(INDEX, 0);
    csr = usb_read_reg(CSR0);

    // 没收到数据包
    if (!(csr & OPRDY))
        return;

    // 分包读出
    cnt = usb_read_fifo0(FIFO0, Ep0State.pData);
    Ep0State.wSize -= cnt;
    Ep0State.pData += cnt;

    if (Ep0State.wSize == 0)
    {
        usb_write_reg(CSR0, SOPRDY | DATEND); // 已处理数据包 进入状态阶段
        Ep0State.bState = EPSTATE_IDLE;
        // 接收完数据，理论上这里应该有个回调
    }
    else
    {
        usb_write_reg(CSR0, SOPRDY); // 已处理数据包
    }

    // SET_LINE_CODING 命令修改波特率停止校验位之类的，不应该这样写吧？
    // usb_uart_settings();
}

/***
 *
 * in 端点处理函数
 *
 */

#ifdef EN_EP1IN
void usb_in_ep1()
{
    uint8_t csr;

    usb_write_reg(INDEX, 1);
    csr = usb_read_reg(INCSR1);

    // 端点返回了 stall
    if (csr & INSTSTL) // bit5
    {
        usb_write_reg(INCSR1, INCLRDT);
    }

    // 数据不足，返回了nak
    if (csr & INUNDRUN) // bit2
    {
        usb_write_reg(INCSR1, 0);
    }

    ep1Busy = 0;
}
#endif

#ifdef EN_EP2IN
void usb_in_ep2()
{
    uint8_t csr;

    usb_write_reg(INDEX, 2);
    csr = usb_read_reg(INCSR1);

    // 当 IN 端点由于被重新配置或者被 STALL 而需要将数据切换位复位到“ 0”时，
    // 软件需要向此数据位写“ 1”。
    if (csr & INSTSTL)
    {
        usb_write_reg(INCSR1, INCLRDT);
    }

    // 中断/批量方式：当使用 NAK 作为对一个 IN 令牌的应答时，该位被置“ 1”
    if (csr & INUNDRUN)
    {
        usb_write_reg(INCSR1, 0);
    }
}
#endif

#ifdef EN_EP3IN
void usb_in_ep3()
{
    uint8_t csr;

    usb_write_reg(INDEX, 3);
    csr = usb_read_reg(INCSR1);
    if (csr & INSTSTL)
    {
        usb_write_reg(INCSR1, INCLRDT);
    }
    if (csr & INUNDRUN)
    {
        usb_write_reg(INCSR1, 0);
    }
}
#endif

#ifdef EN_EP4IN
void usb_in_ep4()
{
    uint8_t csr;

    usb_write_reg(INDEX, 4);
    csr = usb_read_reg(INCSR1);
    if (csr & INSTSTL)
    {
        usb_write_reg(INCSR1, INCLRDT);
    }
    if (csr & INUNDRUN)
    {
        usb_write_reg(INCSR1, 0);
    }
}
#endif

#ifdef EN_EP5IN
void usb_in_ep5()
{
    uint8_t csr;

    usb_write_reg(INDEX, 5);
    csr = usb_read_reg(INCSR1);
    if (csr & INSTSTL)
    {
        usb_write_reg(INCSR1, INCLRDT);
    }
    if (csr & INUNDRUN)
    {
        usb_write_reg(INCSR1, 0);
    }
}
#endif

/***
 *
 * out 端点处理函数
 *
 */

#ifdef EN_EP1OUT
void usb_out_ep1()
{
    uint8_t csr;

    usb_write_reg(INDEX, 1);
    csr = usb_read_reg(OUTCSR1);

    // 端点发送了stall
    if (csr & OUTSTSTL)
    {
        usb_write_reg(OUTCSR1, OUTCLRDT);
    }

    // 数据包接收完毕
    if (csr & OUTOPRDY)
    {
        uart_cmdRecv();

        // usb_write_reg(OUTCSR1, 0); // 可以接收下一个数据包
    }
}
#endif

#ifdef EN_EP2OUT
void usb_out_ep2()
{
    uint8_t csr;

    usb_write_reg(INDEX, 2);
    csr = usb_read_reg(OUTCSR1);
    if (csr & OUTSTSTL)
    {
        usb_write_reg(OUTCSR1, OUTCLRDT);
    }
    if (csr & OUTOPRDY)
    {
        usb_bulk_intr_out(Ep2OutBuffer, 2);
    }
}
#endif

#ifdef EN_EP3OUT
void usb_out_ep3()
{
    uint8_t csr;

    usb_write_reg(INDEX, 3);
    csr = usb_read_reg(OUTCSR1);
    if (csr & OUTSTSTL)
    {
        usb_write_reg(OUTCSR1, OUTCLRDT);
    }
    if (csr & OUTOPRDY)
    {
        usb_bulk_intr_out(Ep3OutBuffer, 3);
    }
}
#endif

#ifdef EN_EP4OUT
void usb_out_ep4()
{
    uint8_t csr;

    usb_write_reg(INDEX, 4);
    csr = usb_read_reg(OUTCSR1);
    if (csr & OUTSTSTL)
    {
        usb_write_reg(OUTCSR1, OUTCLRDT);
    }
    if (csr & OUTOPRDY)
    {
        usb_bulk_intr_out(Ep4OutBuffer, 4);
    }
}
#endif

#ifdef EN_EP5OUT
void usb_out_ep5()
{
    uint8_t csr;

    usb_write_reg(INDEX, 5);
    csr = usb_read_reg(OUTCSR1);
    if (csr & OUTSTSTL)
    {
        usb_write_reg(OUTCSR1, OUTCLRDT);
    }
    if (csr & OUTOPRDY)
    {
        usb_bulk_intr_out(Ep5OutBuffer, 5);
    }
}
#endif
