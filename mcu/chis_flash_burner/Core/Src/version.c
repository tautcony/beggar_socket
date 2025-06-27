#include "version.h"
#include <stdio.h>
#include <string.h>

/* 编译时间戳 (Unix timestamp) */
#ifndef BUILD_TIMESTAMP
#define BUILD_TIMESTAMP 0
#endif

/* 静态版本字符串缓冲区 */
static char version_string[64];

/**
 * @brief 获取版本信息结构体
 * @param version_info 版本信息结构体指针
 */
void version_get_info(version_info_t* version_info)
{
    if (version_info != NULL) {
        version_info->major = FIRMWARE_VERSION_MAJOR;
        version_info->minor = FIRMWARE_VERSION_MINOR;
        version_info->patch = FIRMWARE_VERSION_PATCH;
        version_info->build = FIRMWARE_BUILD_NUMBER;
        version_info->timestamp = BUILD_TIMESTAMP;
    }
}

/**
 * @brief 获取版本字符串
 * @return 版本字符串指针
 */
const char* version_get_string(void)
{
    snprintf(version_string, sizeof(version_string), 
             "ChisFlashBurner v%d.%d.%d (Build %d)",
             FIRMWARE_VERSION_MAJOR,
             FIRMWARE_VERSION_MINOR, 
             FIRMWARE_VERSION_PATCH,
             FIRMWARE_BUILD_NUMBER);
    
    return version_string;
}
