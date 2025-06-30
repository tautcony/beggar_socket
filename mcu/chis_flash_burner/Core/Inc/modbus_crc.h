#ifndef MODBUS_CRC_H
#define MODBUS_CRC_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Modbus CRC16计算函数
 * @param buf - 输入数据缓冲区
 * @param len - 数据长度
 * @return 计算得到的CRC16值
 */
uint16_t modbusCRC16(const uint8_t * restrict buf, uint16_t len);

/**
 * 基于查找表的Modbus CRC16计算函数
 * @param buf - 输入数据缓冲区
 * @param len - 数据长度
 * @return 计算得到的CRC16值
 */
uint16_t modbusCRC16_lut(const uint8_t * restrict buf, uint16_t len);

#ifdef __cplusplus
}
#endif

#endif // MODBUS_CRC_H
