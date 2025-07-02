#ifndef __ERROR_HANDLER_H_
#define __ERROR_HANDLER_H_

#include <stdint.h>

/* 错误代码定义 */
#define ERROR_CODE_OSC_CONFIG       1  // HSI振荡器配置失败
#define ERROR_CODE_CLOCK_CONFIG     2  // 系统时钟配置失败
#define ERROR_CODE_USB_CLOCK        3  // USB时钟配置失败
#define ERROR_CODE_USB_INIT         4  // USB设备初始化失败
#define ERROR_CODE_USB_REGISTER     5  // USB类注册失败
#define ERROR_CODE_USB_CDC_REG      6  // USB CDC接口注册失败
#define ERROR_CODE_USB_START        7  // USB启动失败
#define ERROR_CODE_USB_RESET        8  // USB复位回调失败
#define ERROR_CODE_USB_PCD_INIT     9  // USB PCD初始化失败
#define ERROR_CODE_IAP_INVALID     10  // IAP参数无效
#define ERROR_CODE_IAP_FLASH       11  // IAP Flash操作失败
#define ERROR_CODE_IAP_VERIFY      12  // IAP校验失败
#define ERROR_CODE_IAP_TIMEOUT     13  // IAP超时
#define ERROR_CODE_CART_INIT       14  // 卡带适配器初始化失败
#define ERROR_CODE_CART_COMM       15  // 卡带通信失败
#define ERROR_CODE_UNKNOWN         99  // 未知错误

/* 函数声明 */
void Error_Handler_With_Code(uint8_t error_code);
void Error_Handler(void);

#endif /* __ERROR_HANDLER_H_ */
