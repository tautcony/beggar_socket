#ifndef __UART_H_
#define __UART_H_

void uart_setControlLine(uint8_t rts, uint8_t dtr);
void uart_cmdRecv(uint8_t *buf, uint32_t len);
void uart_cmdHandler();

#endif