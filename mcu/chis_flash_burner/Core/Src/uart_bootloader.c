#include <string.h>
#include <stdint.h>

#include "bootloader.h"
#include "usbd_cdc_if.h"
// #include "usbd_def.h"
// #include "usbd_cdc.h"

#include "uart.h"
#include "version.h"
#include "iap.h"

#define BATCH_SIZE_RW 512
#define BATCH_SIZE_RESPON 512

#define SIZE_CMD_HEADER 3
#define SIZE_RESPON_HEADER 2
#define SIZE_BASE_ADDRESS 4
#define SIZE_CRC 2
#define SIZE_BUFF_SIZE 2

/* 摩尔斯电码相关定义 */
#define MORSE_DOT_TIME    100   // 点的持续时间(ms)
#define MORSE_DASH_TIME   300   // 划的持续时间(ms)
#define MORSE_GAP_TIME    100   // 符号间隔时间(ms)
#define MORSE_LETTER_GAP  300   // 字母间隔时间(ms)
#define MORSE_WORD_GAP    700   // 单词间隔时间(ms)

/* 摩尔斯电码表 */
typedef struct {
    char character;
    const char* code;
} morse_code_t;

static const morse_code_t morse_table[] = {
    {'A', ".-"},    {'B', "-..."},  {'C', "-.-."},  {'D', "-.."},   {'E', "."},
    {'F', "..-."},  {'G', "--."},   {'H', "...."},  {'I', ".."},    {'J', ".---"},
    {'K', "-.-"},   {'L', ".-.."},  {'M', "--"},    {'N', "-."},    {'O', "---"},
    {'P', ".--."},  {'Q', "--.-"},  {'R', ".-."},   {'S', "..."},   {'T', "-"},
    {'U', "..-"},   {'V', "...-"},  {'W', ".--"},   {'X', "-..-"},  {'Y', "-.--"},
    {'Z', "--.."},  {' ', " "}
};

/* 摩尔斯电码状态变量 */
static uint32_t morse_tick = 0;
static uint8_t morse_index = 0;
static uint8_t morse_bit_index = 0;
static uint8_t morse_led_state = 0;
static const char morse_message[] = "BOOTLOADER ";

// 命令头
typedef struct __attribute__((packed))
{
    uint16_t cmdSize;
    uint8_t cmdCode;
    uint8_t payload[]; // 最后两个字节是crc
} Desc_cmdHeader_t;

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

uint16_t modbusCRC16(uint8_t *buf, uint16_t len)
{
    uint16_t crc = 0xffff;

    for (int i = 0; i < len; i++)
    {
        crc = crc ^ buf[i];
        for (int ii = 0; ii < 8; ii++)
        {
            uint16_t temp = crc & 0x0001;
            crc = crc >> 1;
            crc = crc & 0x7fff;
            if (temp)
                crc = crc ^ 0xa001;
        }
    }

    return crc;
}

void uart_responData(uint8_t *dat, uint16_t len)
{
    // uart_respon->crc16 = modbusCRC16(dat, len); // 计算crc

    if (dat != NULL)
        memcpy(uart_respon->payload, dat, len); // 填充数据

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

void uart_responAck(int success)
{
    USBD_CDC_HandleTypeDef *hcdc = (USBD_CDC_HandleTypeDef *)hUsbDeviceFS.pClassData;

    while (hcdc->TxState != 0)
        ;

    uart_respon->crc16 = 0;
    uart_respon->payload[0] = success ? 0xaa : 0xFF;

    uint16_t totalLen = SIZE_RESPON_HEADER + 1;
    uint16_t crc = modbusCRC16(responBuf + 2, totalLen - 2);
    uart_respon->crc16 = crc;

    CDC_Transmit_FS(responBuf, totalLen);
}

void uart_sendError(uint8_t errorCode)
{
    uart_respon->crc16 = 0;
    uart_respon->payload[0] = 0xFF; // 错误标志
    uart_respon->payload[1] = errorCode;

    uint16_t totalLen = SIZE_RESPON_HEADER + 2;
    uint16_t crc = modbusCRC16(responBuf + 2, totalLen - 2);
    uart_respon->crc16 = crc;

    CDC_Transmit_FS(responBuf, totalLen);
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
            // check crc
            /*
            uint16_t cmdCrc = *((uint16_t *)(cmdBuf + uart_cmd->cmdSize - 2));
            uint16_t localCrc = modbusCRC16(cmdBuf, uart_cmd->cmdSize - 2);

            if (cmdCrc != localCrc)
            {
                uart_clearRecvBuf();
                uart_sendError(0x02); // CRC错误
                return;
            }
            */

            busy = 1;
            HAL_GPIO_WritePin(led_GPIO_Port, led_Pin, 0);

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
                            uart_sendError(0x03); // 不支持的命令
                            break;
                    }
                    break;
                }
            default:
                uart_sendError(0x03); // 不支持的命令
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
    version_get_info(&version_info);

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

    // 版本字符串
    const char* version_str = version_get_string();
    uint8_t str_len = strlen(version_str);
    if (str_len > 50) str_len = 50;  // 限制长度

    payload[9] = str_len;
    memcpy(&payload[10], version_str, str_len);

    uint16_t total_len = 10 + str_len;
    uart_respon->crc16 = modbusCRC16(uart_respon->payload, total_len);

    CDC_Transmit_FS((uint8_t*)uart_respon, total_len + SIZE_RESPON_HEADER);
}

void iapEraseFlash()
{
    // 从命令中获取地址和大小
    if (uart_cmd->cmdSize < SIZE_CMD_HEADER + SIZE_BASE_ADDRESS + SIZE_BUFF_SIZE + SIZE_CRC)
    {
        uart_sendError(0x04); // 参数不足
        return;
    }

    uint32_t address = *(uint32_t*)uart_cmd->payload;
    uint32_t size = *(uint32_t*)(uart_cmd->payload + 4);

    // 执行擦除
    iap_status_t result = iap_flash_erase(address, size);

    uart_responAck(result == IAP_OK);
}

void iapProgramFlash()
{
    // 从命令中获取地址和数据
    if (uart_cmd->cmdSize < SIZE_CMD_HEADER + SIZE_BASE_ADDRESS + 1 + SIZE_CRC)
    {
        uart_sendError(0x04); // 参数不足
        return;
    }

    uint32_t address = *(uint32_t*)uart_cmd->payload;
    uint32_t dataLen = uart_cmd->cmdSize - SIZE_CMD_HEADER - SIZE_BASE_ADDRESS - SIZE_CRC;
    uint8_t *data = uart_cmd->payload + SIZE_BASE_ADDRESS;

    // 执行编程
    iap_status_t result = iap_flash_write(address, data, dataLen);

    uart_responAck(result == IAP_OK);
}

// IAP 跳转到app模式
// i 2B.包大小 0xfe 0x04 2B.CRC
// o 2B.CRC 1B.status
void iapJumpToApp()
{
    uart_clearRecvBuf();
    uart_responAck(1);

    // 等待数据发送完成
    HAL_Delay(100);

    // 跳转到应用程序
    iap_jump_to_app();
}

/* IAP升级流程函数实现 */

// 开始升级流程
// i 2B.包大小 0xff 0x10 4B.app_size 4B.app_crc 2B.CRC
// o 2B.CRC 1B.status
void iapUpgradeStart()
{
    // 检查参数长度
    if (uart_cmd->cmdSize < SIZE_CMD_HEADER + 1 + 8 + SIZE_CRC) {
        uart_sendError(0x04); // 参数不足
        return;
    }

    uint32_t app_size = *(uint32_t*)(uart_cmd->payload + 1);
    uint32_t app_crc = *(uint32_t*)(uart_cmd->payload + 5);

    // 检查应用程序大小是否合理
    if (app_size == 0 || app_size > IAP_APPLICATION_SIZE) {
        uart_sendError(0x05); // 大小无效
        return;
    }

    // 开始升级流程
    iap_upgrade_start(app_size, app_crc);

    uart_responAck(1); // 成功
}

// 升级数据传输
// i 2B.包大小 0xff 0x11 4B.packet_num nB.data 2B.CRC
// o 2B.CRC 1B.status
void iapUpgradeData()
{
    // 检查参数长度
    if (uart_cmd->cmdSize < SIZE_CMD_HEADER + 1 + 4 + 1 + SIZE_CRC) {
        uart_sendError(0x04); // 参数不足
        return;
    }

    uint32_t packet_num = *(uint32_t*)(uart_cmd->payload + 1);
    uint32_t data_len = uart_cmd->cmdSize - SIZE_CMD_HEADER - 1 - 4 - SIZE_CRC;
    uint8_t *data = uart_cmd->payload + 5;

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
 * @brief 查找字符对应的摩尔斯电码
 * @param c 字符
 * @return 摩尔斯电码字符串，NULL表示未找到
 */
static const char* morse_get_code(char c)
{
    for (int i = 0; i < sizeof(morse_table) / sizeof(morse_table[0]); i++) {
        if (morse_table[i].character == c) {
            return morse_table[i].code;
        }
    }
    return NULL;
}

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
