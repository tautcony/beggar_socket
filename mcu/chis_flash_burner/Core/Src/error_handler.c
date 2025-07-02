#include "error_handler.h"
#include "main.h"

/**
 * @brief  集中式错误处理函数
 * @param  error_code 错误代码，用于标识错误来源
 * @retval None - 此函数不返回，程序将hang住
 */
void Error_Handler_With_Code(uint8_t error_code)
{
    /* 禁用全局中断，确保错误显示不被打断 */
    __disable_irq();

    /* 根据错误代码闪烁不同次数的LED来标识错误来源 */
    uint8_t flash_count = error_code;
    if (flash_count == 0 || flash_count > 20) {
        flash_count = 20; // 限制闪烁次数，避免过长
    }

    /* 无限循环显示错误 */
    while(1) {
        /* 显示错误代码 - 快速闪烁N次 */
        for(int i = 0; i < flash_count; i++) {
            HAL_GPIO_WritePin(led_GPIO_Port, led_Pin, 0);  // LED on
            for(volatile int j = 0; j < 300000; j++);      // 短暂延时
            HAL_GPIO_WritePin(led_GPIO_Port, led_Pin, 1);  // LED off
            for(volatile int j = 0; j < 300000; j++);      // 短暂延时
        }

        /* 长暂停，区分错误代码和重复 */
        for(volatile int i = 0; i < 2000000; i++);

        /* 3次慢闪表示"错误"，然后重复 */
        for(int i = 0; i < 3; i++) {
            HAL_GPIO_WritePin(led_GPIO_Port, led_Pin, 0);  // LED on
            for(volatile int j = 0; j < 800000; j++);      // 长延时
            HAL_GPIO_WritePin(led_GPIO_Port, led_Pin, 1);  // LED off  
            for(volatile int j = 0; j < 800000; j++);      // 长延时
        }

        /* 超长暂停，然后重复整个错误显示 */
        for(volatile int i = 0; i < 4000000; i++);
    }
}

/**
 * @brief  兼容性错误处理函数 - 调用新的错误处理函数
 * @retval None
 */
void Error_Handler(void)
{
    Error_Handler_With_Code(ERROR_CODE_UNKNOWN);
}
