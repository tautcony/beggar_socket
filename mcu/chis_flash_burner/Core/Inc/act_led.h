#ifndef __ACT_LED_H
#define __ACT_LED_H

#ifdef __cplusplus
extern "C" {
#endif

#include "stm32f1xx_hal.h"

void act_led_init(void);
void act_led_update(void);
void act_led_signal_activity(void);
void act_led_force_on(void);
void act_led_force_off(void);
void act_led_blink_blocking(uint32_t blink_count, uint32_t on_delay_cycles, uint32_t off_delay_cycles);

#ifdef __cplusplus
}
#endif

#endif /* __ACT_LED_H */
