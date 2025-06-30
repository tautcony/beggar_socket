#ifndef __VERSION_H_
#define __VERSION_H_

#include <stdint.h>
#include <stdbool.h>

/* Bootloader 版本信息定义 */
#define BOOTLOADER_VERSION_MAJOR  1
#define BOOTLOADER_VERSION_MINOR  0
#define BOOTLOADER_VERSION_PATCH  0
#define BOOTLOADER_BUILD_NUMBER   1

/* Application 版本信息定义 */
#define APPLICATION_VERSION_MAJOR  1
#define APPLICATION_VERSION_MINOR  0
#define APPLICATION_VERSION_PATCH  0
#define APPLICATION_BUILD_NUMBER   1

/* 版本类型枚举 */
typedef enum {
    VERSION_TYPE_BOOTLOADER = 0,
    VERSION_TYPE_APPLICATION = 1
} version_type_t;

/* 版本信息结构体 */
typedef struct {
    uint8_t major;
    uint8_t minor;
    uint8_t patch;
    uint16_t build;
    uint32_t timestamp;  // 编译时间戳
    version_type_t type;  // 版本类型
} version_info_t;

/* 获取版本信息 */
void version_get_info(version_info_t* version_info, version_type_t type);
const char* version_get_string(version_type_t type);

/* 获取当前运行的版本信息（bootloader 模式下获取 bootloader 版本，app 模式下获取 app 版本）*/
void version_get_current_info(version_info_t* version_info);
const char* version_get_current_string(void);

/* 检查应用程序版本信息（从 flash 中读取已安装的 app 版本）*/
bool version_get_app_info_from_flash(version_info_t* version_info);

#endif /* __VERSION_H_ */
