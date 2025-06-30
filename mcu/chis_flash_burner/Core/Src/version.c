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
 * @brief 获取指定类型的版本信息结构体
 * @param version_info 版本信息结构体指针
 * @param type 版本类型 (bootloader 或 application)
 */
void version_get_info(version_info_t* version_info, version_type_t type)
{
    if (version_info != NULL) {
        version_info->type = type;
        version_info->timestamp = BUILD_TIMESTAMP;

        if (type == VERSION_TYPE_BOOTLOADER) {
            version_info->major = BOOTLOADER_VERSION_MAJOR;
            version_info->minor = BOOTLOADER_VERSION_MINOR;
            version_info->patch = BOOTLOADER_VERSION_PATCH;
            version_info->build = BOOTLOADER_BUILD_NUMBER;
        } else {
            version_info->major = APPLICATION_VERSION_MAJOR;
            version_info->minor = APPLICATION_VERSION_MINOR;
            version_info->patch = APPLICATION_VERSION_PATCH;
            version_info->build = APPLICATION_BUILD_NUMBER;
        }
    }
}

/**
 * @brief 获取指定类型的版本字符串
 * @param type 版本类型 (bootloader 或 application)
 * @return 版本字符串指针
 */
const char* version_get_string(version_type_t type)
{
    if (type == VERSION_TYPE_BOOTLOADER) {
        snprintf(version_string, sizeof(version_string), 
                 "ChisFlashBurner Bootloader v%d.%d.%d (Build %d)",
                 BOOTLOADER_VERSION_MAJOR,
                 BOOTLOADER_VERSION_MINOR, 
                 BOOTLOADER_VERSION_PATCH,
                 BOOTLOADER_BUILD_NUMBER);
    } else {
        snprintf(version_string, sizeof(version_string), 
                 "ChisFlashBurner App v%d.%d.%d (Build %d)",
                 APPLICATION_VERSION_MAJOR,
                 APPLICATION_VERSION_MINOR, 
                 APPLICATION_VERSION_PATCH,
                 APPLICATION_BUILD_NUMBER);
    }

    return version_string;
}

/**
 * @brief 获取当前运行环境的版本信息
 * @param version_info 版本信息结构体指针
 */
void version_get_current_info(version_info_t* version_info)
{
    // 通过检查程序计数器地址来判断当前运行环境
    // Bootloader通常在低地址空间，Application在较高地址空间
    uint32_t pc = (uint32_t)__builtin_return_address(0);
    
    // 假设bootloader在0x08000000-0x08007FFF，app在0x08008000及以上
    // 这个地址需要根据你的实际Flash布局调整
    if (pc < 0x08008000) {
        // 在 bootloader 中运行，返回 bootloader 版本
        version_get_info(version_info, VERSION_TYPE_BOOTLOADER);
    } else {
        // 在 application 中运行，返回 application 版本
        version_get_info(version_info, VERSION_TYPE_APPLICATION);
    }
}

/**
 * @brief 获取当前运行环境的版本字符串
 * @return 版本字符串指针
 */
const char* version_get_current_string(void)
{
    // 通过检查程序计数器地址来判断当前运行环境
    uint32_t pc = (uint32_t)__builtin_return_address(0);
    
    if (pc < 0x08008000) {
        // 在 bootloader 中运行，返回 bootloader 版本
        return version_get_string(VERSION_TYPE_BOOTLOADER);
    } else {
        // 在 application 中运行，返回 application 版本
        return version_get_string(VERSION_TYPE_APPLICATION);
    }
}

/**
 * @brief 从 Flash 中读取已安装的应用程序版本信息
 * @param version_info 版本信息结构体指针
 * @return true 如果成功读取，false 如果读取失败或应用程序不存在
 */
bool version_get_app_info_from_flash(version_info_t* version_info)
{
    // TODO: 实现从 Flash 指定地址读取应用程序版本信息

    // 暂时返回默认应用程序版本信息
    if (version_info != NULL) {
        version_get_info(version_info, VERSION_TYPE_APPLICATION);
        return true;
    }

    return false;
}
