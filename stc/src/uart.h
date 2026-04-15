#ifndef __UART_H_
#define __UART_H_

void uart_setControlLine(BOOL rts, BOOL dtr);
void uart_cmdRecv();
void uart_cmdHandler();

#endif