#include "act_led.h"

#include "main.h"

#define ACT_LED_ACTIVITY_HOLD_MS 75u
#define ACT_LED_BLINK_PERIOD_MS 120u

static uint32_t act_led_deadline_tick = 0u;
static GPIO_PinState act_led_state = GPIO_PIN_SET;
static uint8_t act_led_forced = 0u;

static void act_led_apply(GPIO_PinState state)
{
    act_led_state = state;
    HAL_GPIO_WritePin(led_GPIO_Port, led_Pin, state);
}

void act_led_init(void)
{
    act_led_deadline_tick = 0u;
    act_led_forced = 0u;
    act_led_apply(GPIO_PIN_SET);
}

static GPIO_PinState act_led_get_activity_phase(uint32_t now)
{
    return (((now / ACT_LED_BLINK_PERIOD_MS) & 0x1u) == 0u) ? GPIO_PIN_RESET : GPIO_PIN_SET;
}

void act_led_update(void)
{
    uint32_t now = HAL_GetTick();

    if (act_led_forced != 0u) {
        return;
    }

    if (now >= act_led_deadline_tick) {
        act_led_apply(GPIO_PIN_SET);
        return;
    }

    act_led_apply(act_led_get_activity_phase(now));
}

void act_led_signal_activity(void)
{
    uint32_t now = HAL_GetTick();

    if (act_led_forced != 0u) {
        return;
    }

    act_led_deadline_tick = now + ACT_LED_ACTIVITY_HOLD_MS;
    act_led_apply(act_led_get_activity_phase(now));
}

void act_led_force_on(void)
{
    act_led_forced = 1u;
    act_led_apply(GPIO_PIN_RESET);
}

void act_led_force_off(void)
{
    act_led_forced = 0u;
    act_led_deadline_tick = 0u;
    act_led_apply(GPIO_PIN_SET);
}

void act_led_blink_blocking(uint32_t blink_count, uint32_t on_delay_cycles, uint32_t off_delay_cycles)
{
    act_led_forced = 1u;

    for (uint32_t i = 0u; i < blink_count; ++i) {
        act_led_apply(GPIO_PIN_RESET);
        for (volatile uint32_t j = 0u; j < on_delay_cycles; ++j) {
            __NOP();
        }

        act_led_apply(GPIO_PIN_SET);
        for (volatile uint32_t j = 0u; j < off_delay_cycles; ++j) {
            __NOP();
        }
    }

    act_led_forced = 0u;
    act_led_deadline_tick = 0u;
    act_led_apply(GPIO_PIN_SET);
}
