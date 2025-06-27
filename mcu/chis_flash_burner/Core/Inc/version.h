#ifndef __VERSION_H_
#define __VERSION_H_

#include <stdint.h>

/* 版本信息定义 */
#define FIRMWARE_VERSION_MAJOR  1
#define FIRMWARE_VERSION_MINOR  0
#define FIRMWARE_VERSION_PATCH  0
#define FIRMWARE_BUILD_NUMBER   1

/* 版本信息结构体 */
typedef struct {
    uint8_t major;
    uint8_t minor;
    uint8_t patch;
    uint16_t build;
    uint32_t timestamp;  // 编译时间戳
} version_info_t;

/* 获取版本信息 */
void version_get_info(version_info_t* version_info);
const char* version_get_string(void);

#endif /* __VERSION_H_ */
