#include <string.h>
#include <stdint.h>
#include <stdbool.h>

#include "bootloader.h"
#include "usbd_cdc_if.h"
// #include "usbd_def.h"
// #include "usbd_cdc.h"

#include "uart.h"
#include "iap.h"
#include "morse_code.h"
#include "version.h"
#include "modbus_crc.h"

#define BATCH_SIZE_RW 512
#define BATCH_SIZE_RESPON 512

#define SIZE_CRC 2

/* 摩尔斯电码状态变量 */
static uint32_t morse_tick = 0;
static uint8_t morse_index = 0;
static uint8_t morse_bit_index = 0;
static uint8_t morse_led_state = 0;
static const char morse_message[] = "BOOTLOADER ";

typedef enum {
    UART_SUCCESS = 0,
    UART_ERROR_INVALID_PARAM = 1,
    UART_ERROR_BUFFER_FULL = 2,
    UART_ERROR_CRC_MISMATCH = 3,
    UART_ERROR_UNKNOWN_CMD = 4,
    UART_ERROR_SIZE_MISMATCH = 5
} uart_result_t;

// 命令头
typedef struct __attribute__((packed))
{
    uint16_t cmdSize;
    uint8_t cmdCode;
    uint8_t payload[]; // 最后两个字节是crc
} Desc_cmdHeader_t;

// 命令身 写
typedef struct __attribute__((packed))
{
    uint32_t baseAddress;
    uint8_t payload[]; // 最后两个字节是crc
} Desc_cmdBody_write_t;

// 响应包
typedef struct __attribute__((packed))
{
    uint16_t crc16;
    uint8_t payload[];
} Desc_respon_t;

uint16_t cmdBuf_p = 0;
uint8_t cmdBuf[1536];

// uint16_t responBuf_p = 0;
uint8_t responBuf[256];

Desc_cmdHeader_t *uart_cmd = (Desc_cmdHeader_t *)cmdBuf;
Desc_respon_t *uart_respon = (Desc_respon_t *)responBuf;

volatile uint8_t busy = 0;

extern USBD_HandleTypeDef hUsbDeviceFS;

void iapGetVersion();
void iapEraseFlash(); 
void iapProgramFlash();
void iapUpgradeStart();
void iapUpgradeData();
void iapUpgradeFinish();
void iapJumpToApp();

void uart_responData(uint8_t *dat, uint16_t len)
{
    uart_respon->crc16 = modbusCRC16_lut(dat, len);

    if (dat != NULL && uart_respon->payload != dat)
        memcpy(uart_respon->payload, dat, len);

    USBD_CDC_HandleTypeDef *hcdc = (USBD_CDC_HandleTypeDef *)hUsbDeviceFS.pClassData;

    // 分批发送
    uint16_t packSize = SIZE_CRC + len;
    uint16_t transCount = 0;
    while (transCount < packSize)
    {
        uint16_t transLen = packSize - transCount;
        if (transLen > BATCH_SIZE_RESPON)
            transLen = BATCH_SIZE_RESPON;

        while (hcdc->TxState != 0)
            ;
        CDC_Transmit_FS(responBuf + transCount, transLen);

        transCount += transLen;
    }
}

void uart_responAck(bool success)
{
    USBD_CDC_HandleTypeDef *hcdc = (USBD_CDC_HandleTypeDef *)hUsbDeviceFS.pClassData;

    while (hcdc->TxState != 0)
        ;

    // 无数据的状态返回，不需要CRC，只发送状态字节
    uint8_t status = success ? 0xaa : 0xFF;
    CDC_Transmit_FS(&status, 1);
}

void uart_sendError(uint8_t errorCode)
{
    USBD_CDC_HandleTypeDef *hcdc = (USBD_CDC_HandleTypeDef *)hUsbDeviceFS.pClassData;

    while (hcdc->TxState != 0)
        ;

    // 错误响应，不需要CRC，只发送错误标志和错误码
    uint8_t errorData[2] = {0xFF, errorCode}; // 0xFF为错误标志
    CDC_Transmit_FS(errorData, 2);
}

/* UART Callback */
void uart_setControlLine(uint8_t rts, uint8_t dtr)
{
    static uint8_t currentRts = 0;
    static uint8_t currentDtr = 0;

    if (((currentRts == 0) && (rts != 0)) ||
        ((currentDtr == 0) && (dtr != 0)))
    {
        cmdBuf_p = 0;
        memset(cmdBuf, 0, sizeof(cmdBuf));
    }

    currentRts = rts;
    currentDtr = dtr;
}

void uart_cmdRecv(uint8_t *buf, uint32_t len)
{
    if (busy)
        return;

    uint16_t remainSize = sizeof(cmdBuf) - cmdBuf_p;
    if (len > remainSize)
        return;

    memcpy(cmdBuf + cmdBuf_p, buf, len);
    cmdBuf_p += len;
}

void uart_clearRecvBuf()
{
    cmdBuf_p = 0;
    memset(cmdBuf, 0, sizeof(cmdBuf));
    busy = 0;
}

void uart_cmdHandler()
{
    // 判断命令结束
    if (cmdBuf_p > 2)
    {
        if (uart_cmd->cmdSize == cmdBuf_p)
        {
            busy = 1;
            HAL_GPIO_WritePin(led_GPIO_Port, led_Pin, GPIO_PIN_RESET);

            // execute cmd
            switch (uart_cmd->cmdCode)
            {
            case 0xff: // IAP 相关命令
                {
                    uint8_t iap_cmd = uart_cmd->payload[0];

                    switch (iap_cmd) {
                        case 0x00: // 获取版本信息
                            iapGetVersion();
                            break;
                        case 0x01: // 擦除Flash
                            iapEraseFlash();
                            break;
                        case 0x02: // 编程Flash
                            iapProgramFlash();
                            break;
                        case 0x10: // 开始升级流程
                            iapUpgradeStart();
                            break;
                        case 0x11: // 升级数据传输
                            iapUpgradeData();
                            break;
                        case 0x12: // 完成升级流程
                            iapUpgradeFinish();
                            break;
                        case 0xff: // 跳转到应用程序
                            iapJumpToApp();
                            break;
                        default:
                            uart_sendError(UART_ERROR_UNKNOWN_CMD);
                            break;
                    }
                    break;
                }
            default:
                uart_sendError(UART_ERROR_UNKNOWN_CMD);
                break;
            }

            HAL_GPIO_WritePin(led_GPIO_Port, led_Pin, 1);
            // 统一清除busy和缓冲区
            cmdBuf_p = 0;
            memset(cmdBuf, 0, sizeof(cmdBuf));
            busy = 0;
        }
    }
}

/* IAP Command Implement */

// 获取版本信息
// i 2B.包大小 0xfd 2B.CRC
// o 2B.CRC 版本信息数据
void iapGetVersion()
{
    version_info_t version_info;
    version_get_current_info(&version_info);

    // 构建响应数据
    uint8_t *payload = uart_respon->payload;

    // 版本号
    payload[0] = version_info.major;
    payload[1] = version_info.minor;
    payload[2] = version_info.patch;

    // 构建号 (16位)
    payload[3] = (uint8_t)(version_info.build & 0xFF);
    payload[4] = (uint8_t)((version_info.build >> 8) & 0xFF);

    // 时间戳 (32位)
    payload[5] = (uint8_t)(version_info.timestamp & 0xFF);
    payload[6] = (uint8_t)((version_info.timestamp >> 8) & 0xFF);
    payload[7] = (uint8_t)((version_info.timestamp >> 16) & 0xFF);
    payload[8] = (uint8_t)((version_info.timestamp >> 24) & 0xFF);

    // 版本类型 (1位)
    payload[9] = (uint8_t)version_info.type;

    // 版本字符串
    const char* version_str = version_get_current_string();
    uint8_t str_len = strlen(version_str);
    if (str_len > 45) str_len = 45;

    payload[10] = str_len;
    memcpy(&payload[11], version_str, str_len);

    uint16_t total_len = 11 + str_len;

    uart_responData(uart_respon->payload, total_len);
}

void iapEraseFlash()
{
    // 从命令中获取地址和大小
    if (uart_cmd->cmdSize < 3 + 4 + 4 + 2) // cmdSize + cmdCode + subCmd + address + size + CRC
    {
        uart_sendError(0x04); // 参数不足
        return;
    }

    Desc_cmdBody_write_t *desc_write = (Desc_cmdBody_write_t *)(uart_cmd->payload + 1);
    uint32_t address = desc_write->baseAddress;
    uint32_t size = *((uint32_t*)(desc_write->payload));

    // 执行擦除
    iap_status_t result = iap_flash_erase(address, size);

    uart_responAck(result == IAP_OK);
}

void iapProgramFlash()
{
    // 从命令中获取地址和数据
    if (uart_cmd->cmdSize < 3 + 4 + 1 + 2) // cmdSize + cmdCode + subCmd + address + data(至少1字节) + CRC
    {
        uart_sendError(0x04); // 参数不足
        return;
    }

    Desc_cmdBody_write_t *desc_write = (Desc_cmdBody_write_t *)(uart_cmd->payload + 1);
    uint32_t address = desc_write->baseAddress;
    uint8_t *data = desc_write->payload;
    uint32_t data_len = uart_cmd->cmdSize - 3 - 4 - 2; // 总长度 - 头 - 地址 - CRC

    // 执行编程
    iap_status_t result = iap_flash_write(address, data, data_len);

    uart_responAck(result == IAP_OK);
}

// IAP 跳转到app模式
// i 2B.包大小 0xfe 0x04 2B.CRC
// o 2B.CRC 1B.status
void iapJumpToApp()
{
    uart_clearRecvBuf();
    uart_responAck(true);

    // 等待数据发送完成
    HAL_Delay(100);

    // 跳转到应用程序
    iap_jump_to_app();
}

/* IAP升级流程函数实现 */

// 开始升级流程
// i 2B.包大小 0xff 0x10 4B.app_size 4B.app_crc 2B.CRC
// o 1B.status
void iapUpgradeStart()
{
    // 检查参数长度
    if (uart_cmd->cmdSize < 3 + 4 + 4 + 2) { // cmdSize + cmdCode + subCmd + app_size + app_crc + CRC
        uart_sendError(0x04); // 参数不足
        return;
    }

    uint32_t app_size = *((uint32_t*)(uart_cmd->payload + 1));
    uint32_t app_crc = *((uint32_t*)(uart_cmd->payload + 5));

    // 检查应用程序大小是否合理
    if (app_size == 0 || app_size > IAP_APPLICATION_SIZE) {
        uart_sendError(0x05); // 大小无效
        return;
    }

    // 开始升级流程
    iap_upgrade_start(app_size, app_crc);

    uart_responAck(true);
}

// 升级数据传输
// i 2B.包大小 0xff 0x11 4B.packet_num nB.data 2B.CRC
// o 1B.status
void iapUpgradeData()
{
    // 检查参数长度
    if (uart_cmd->cmdSize < 3 + 4 + 2) { // cmdSize + cmdCode + subCmd + packet_num + CRC (至少)
        uart_sendError(0x04); // 参数不足
        return;
    }

    uint32_t packet_num = *((uint32_t*)(uart_cmd->payload + 1));
    uint8_t *data = uart_cmd->payload + 5; // 跳过subCmd(1字节) + packet_num(4字节)
    uint32_t data_len = uart_cmd->cmdSize - 3 - 4 - 2; // 总长度 - 头 - packet_num - CRC

    // 传输数据
    iap_status_t result = iap_upgrade_data(packet_num, data, data_len);

    uart_responAck(result == IAP_OK);
}

// 完成升级流程
// i 2B.包大小 0xff 0x12 2B.CRC
// o 2B.CRC 1B.status
void iapUpgradeFinish()
{
    // 完成升级并验证
    iap_status_t result = iap_upgrade_finish();

    uart_responAck(result == IAP_OK);
}

/* 摩尔斯电码相关函数 */

/**
 * @brief 摩尔斯电码LED控制
 * @param state 1-点亮LED, 0-熄灭LED
 */
static void morse_led_control(uint8_t state)
{
    HAL_GPIO_WritePin(led_GPIO_Port, led_Pin, state ? GPIO_PIN_RESET : GPIO_PIN_SET);
}

/**
 * @brief 摩尔斯电码处理函数
 */
void morse_handler(void)
{
    // 如果系统忙碌，停止摩尔斯电码输出
    if (busy) {
        morse_led_control(0);
        return;
    }

    uint32_t current_tick = HAL_GetTick();

    // 获取当前字符
    char current_char = morse_message[morse_index];
    if (current_char == '\0') {
        // 消息结束，等待单词间隔后重新开始
        morse_led_control(0);
        if (current_tick - morse_tick >= MORSE_WORD_GAP) {
            morse_index = 0;
            morse_bit_index = 0;
            morse_led_state = 0;
            morse_tick = current_tick;
        }
        return;
    }

    // 处理空格（单词间隔）
    if (current_char == ' ') {
        morse_led_control(0);
        if (current_tick - morse_tick >= MORSE_WORD_GAP) {
            morse_index++;
            morse_bit_index = 0;
            morse_led_state = 0;
            morse_tick = current_tick;
        }
        return;
    }

    // 获取摩尔斯电码
    const char* code = morse_get_code(current_char);
    if (code == NULL) {
        // 未知字符，跳过
        morse_index++;
        morse_bit_index = 0;
        morse_led_state = 0;
        morse_tick = current_tick;
        morse_led_control(0);
        return;
    }

    // 检查当前字符的摩尔斯电码是否发送完毕
    if (morse_bit_index >= strlen(code)) {
        // 字符间隔
        morse_led_control(0);
        if (current_tick - morse_tick >= MORSE_LETTER_GAP) {
            morse_index++;
            morse_bit_index = 0;
            morse_led_state = 0;
            morse_tick = current_tick;
        }
        return;
    }

    // 发送当前位
    char current_bit = code[morse_bit_index];

    if (morse_led_state == 0) {
        // 开始发送新的位
        morse_led_control(1);
        morse_led_state = 1;
        morse_tick = current_tick;
    } else {
        // 正在发送位，检查时间
        uint32_t bit_time = (current_bit == '.') ? MORSE_DOT_TIME : MORSE_DASH_TIME;
        if (current_tick - morse_tick >= bit_time) {
            // 位发送完毕，进入间隔
            morse_led_control(0);
            morse_led_state = 0;
            morse_bit_index++;
            morse_tick = current_tick;
        }
    }
}
