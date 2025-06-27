#include <string.h>
#include <stdint.h>

#include "bootloader.h"
#include "usbd_cdc_if.h"

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

// 命令头
typedef struct __attribute__((packed))
{
    uint16_t cmdSize;
    uint8_t cmdCode;
    uint8_t payload[]; // 最后两个字节是crc
} Desc_cmdHeader_t;

// 回复头
typedef struct __attribute__((packed))
{
    uint16_t crc16;
    uint8_t payload[];
} Desc_respon_t;

uint16_t cmdBuf_p = 0;
uint8_t cmdBuf[1024];  // bootloader中缓冲区较小

// uint16_t responBuf_p = 0;
uint8_t responBuf[1024];  // bootloader中缓冲区较小

Desc_cmdHeader_t *uart_cmd = (Desc_cmdHeader_t *)cmdBuf;
Desc_respon_t *uart_respon = (Desc_respon_t *)responBuf;

volatile uint8_t busy = 0;

extern USBD_HandleTypeDef hUsbDeviceFS;

// BootLoader 专用功能函数声明
void iapGetVersion();
void iapEraseFlash(); 
void iapProgramFlash();
void iapJumpToApp();
void uart_processCommand();

// CRC16 计算函数
uint16_t crc16_ccitt(const uint8_t *data, size_t length);

// 错误处理函数
void uart_sendError(uint8_t errorCode);

// usb 接收回调
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
            HAL_GPIO_WritePin(led_GPIO_Port, led_Pin, 0);
            
            // 处理命令
            uart_processCommand();
            
            HAL_GPIO_WritePin(led_GPIO_Port, led_Pin, 1);
            uart_clearRecvBuf();
        }
    }
}

void uart_processCommand()
{
    uint16_t cmdSize = uart_cmd->cmdSize;
    uint8_t cmdCode = uart_cmd->cmdCode;
    
    // 验证CRC
    uint16_t receivedCrc = *(uint16_t*)(cmdBuf + cmdSize - 2);
    uint16_t calculatedCrc = crc16_ccitt(cmdBuf, cmdSize - 2);
    
    if (receivedCrc != calculatedCrc)
    {
        uart_sendError(0x02); // CRC错误
        return;
    }
    
    // 处理bootloader支持的命令
    switch (cmdCode)
    {
        case 0x01: // 获取版本信息
            iapGetVersion();
            break;
        case 0x02: // 擦除Flash
            iapEraseFlash();
            break;
        case 0x03: // 编程Flash
            iapProgramFlash();
            break;
        case 0x04: // 跳转到应用程序
            iapJumpToApp();
            break;
        default:
            uart_sendError(0x03); // 不支持的命令
            break;
    }
}

void iapGetVersion()
{
    version_info_t version_info;
    version_get_info(&version_info);
    
    // 构造回复
    uart_respon->crc16 = 0; // 先设为0
    
    // 复制版本信息到payload
    uint8_t *payload = uart_respon->payload;
    memcpy(payload, &version_info, sizeof(version_info_t));
    
    uint16_t totalLen = SIZE_RESPON_HEADER + sizeof(version_info_t);
    uint16_t crc = crc16_ccitt(responBuf + 2, totalLen - 2);
    uart_respon->crc16 = crc;
    
    // 发送回复
    CDC_Transmit_FS(responBuf, totalLen);
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
    
    // 构造回复
    uart_respon->crc16 = 0;
    uart_respon->payload[0] = (result == IAP_OK) ? 0x00 : 0xFF;
    
    uint16_t totalLen = SIZE_RESPON_HEADER + 1;
    uint16_t crc = crc16_ccitt(responBuf + 2, totalLen - 2);
    uart_respon->crc16 = crc;
    
    CDC_Transmit_FS(responBuf, totalLen);
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
    
    // 构造回复
    uart_respon->crc16 = 0;
    uart_respon->payload[0] = (result == IAP_OK) ? 0x00 : 0xFF;
    
    uint16_t totalLen = SIZE_RESPON_HEADER + 1;
    uint16_t crc = crc16_ccitt(responBuf + 2, totalLen - 2);
    uart_respon->crc16 = crc;
    
    CDC_Transmit_FS(responBuf, totalLen);
}

void iapJumpToApp()
{
    // 构造回复
    uart_respon->crc16 = 0;
    uart_respon->payload[0] = 0x00; // 成功
    
    uint16_t totalLen = SIZE_RESPON_HEADER + 1;
    uint16_t crc = crc16_ccitt(responBuf + 2, totalLen - 2);
    uart_respon->crc16 = crc;
    
    CDC_Transmit_FS(responBuf, totalLen);
    
    // 等待数据发送完成
    HAL_Delay(100);
    
    // 跳转到应用程序
    iap_jump_to_app();
}

void uart_sendError(uint8_t errorCode)
{
    uart_respon->crc16 = 0;
    uart_respon->payload[0] = 0xFF; // 错误标志
    uart_respon->payload[1] = errorCode;
    
    uint16_t totalLen = SIZE_RESPON_HEADER + 2;
    uint16_t crc = crc16_ccitt(responBuf + 2, totalLen - 2);
    uart_respon->crc16 = crc;
    
    CDC_Transmit_FS(responBuf, totalLen);
}

// USB CDC 控制线设置函数 (bootloader 精简版)
void uart_setControlLine(uint8_t rts, uint8_t dtr) {
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

uint16_t crc16_ccitt(const uint8_t *data, size_t length)
{
    uint16_t crc = 0xFFFF;
    
    for (size_t i = 0; i < length; i++)
    {
        crc ^= (uint16_t)data[i] << 8;
        for (int j = 0; j < 8; j++)
        {
            if (crc & 0x8000)
                crc = (crc << 1) ^ 0x1021;
            else
                crc <<= 1;
        }
    }
    
    return crc;
}
