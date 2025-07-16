#ifndef __UART_H
#define __UART_H

#ifdef __cplusplus
extern "C" {
#endif

/* Includes ------------------------------------------------------------------*/
#include "stm32f1xx_hal.h"

void uart_setControlLine(uint8_t rts, uint8_t dtr);
void uart_cmdRecv(const uint8_t *buf, uint32_t len);
void uart_cmdHandler(void);

#ifdef __cplusplus
}
#endif

#endif /* __UART_H */
