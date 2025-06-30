#include "iap.h"
#include "main.h"
#include <string.h>

/* 全局变量 */
static iap_upgrade_info_t upgrade_info;
static uint32_t write_addr;

/**
 * @brief 初始化硬件CRC计算单元
 */
static void iap_crc32_init(void)
{
    /* 使能CRC外设时钟 */
    __HAL_RCC_CRC_CLK_ENABLE();

    /* 复位CRC计算单元 */
    CRC->CR = CRC_CR_RESET;
}

/**
 * @brief 计算 CRC32 校验值（使用硬件CRC计算单元）
 * @param data 数据指针
 * @param size 数据大小
 * @return CRC32 值
 */
uint32_t iap_crc32(uint8_t *data, uint32_t size)
{
    uint32_t i;
    uint32_t word_count;
    uint32_t remaining_bytes;
    uint32_t temp_word;
    uint32_t *word_ptr = (uint32_t*)data;

    /* 初始化CRC计算单元 */
    iap_crc32_init();

    /* 计算4字节对齐的字数 */
    word_count = size / 4;
    remaining_bytes = size % 4;

    /* 按32位字进行CRC计算 - 检查地址是否4字节对齐 */
    if ((uint32_t)data % 4 == 0) {
        /* 地址对齐，直接按字访问 */
        for (i = 0; i < word_count; i++) {
            CRC->DR = word_ptr[i];
        }
    } else {
        /* 地址未对齐，按字节组装 */
        for (i = 0; i < word_count; i++) {
            temp_word = (data[i*4 + 3] << 24) | (data[i*4 + 2] << 16) | 
                        (data[i*4 + 1] << 8) | data[i*4];
            CRC->DR = temp_word;
        }
    }

    /* 处理剩余字节 */
    if (remaining_bytes > 0) {
        temp_word = 0;
        for (i = 0; i < remaining_bytes; i++) {
            temp_word |= (data[word_count*4 + i] << (i * 8));
        }
        CRC->DR = temp_word;
    }

    return CRC->DR;
}

/**
 * @brief 擦除 Flash 指定区域
 * @param start_addr 起始地址
 * @param size 擦除大小
 * @return IAP 状态
 */
__RAM_FUNC iap_status_t iap_flash_erase(uint32_t start_addr, uint32_t size)
{
    HAL_StatusTypeDef status;
    FLASH_EraseInitTypeDef erase_init;
    uint32_t page_error;

    /* 检查地址合法性 */
    if (start_addr < IAP_APPLICATION_BASE_ADDR || 
        (start_addr + size) > (IAP_FLASH_BASE_ADDR + IAP_FLASH_SIZE)) {
        return IAP_ERROR_INVALID_ADDR;
    }

    /* 解锁 Flash */
    HAL_FLASH_Unlock();

    /* 配置擦除参数 */
    erase_init.TypeErase = FLASH_TYPEERASE_PAGES;
    erase_init.PageAddress = start_addr;
    erase_init.NbPages = (size + IAP_PAGE_SIZE - 1) / IAP_PAGE_SIZE;

    /* 执行擦除 */
    status = HAL_FLASHEx_Erase(&erase_init, &page_error);

    /* 锁定 Flash */
    HAL_FLASH_Lock();

    return (status == HAL_OK) ? IAP_OK : IAP_ERROR_FLASH_ERASE;
}

/**
 * @brief 写入数据到 Flash
 * @param addr Flash 地址
 * @param data 数据指针
 * @param size 数据大小
 * @return IAP 状态
 */
__RAM_FUNC iap_status_t iap_flash_write(uint32_t addr, uint8_t *data, uint32_t size)
{
    HAL_StatusTypeDef status = HAL_OK;
    uint32_t i;

    /* 检查地址合法性 */
    if (addr < IAP_APPLICATION_BASE_ADDR || 
        (addr + size) > (IAP_FLASH_BASE_ADDR + IAP_FLASH_SIZE)) {
        return IAP_ERROR_INVALID_ADDR;
    }

    /* 解锁 Flash */
    HAL_FLASH_Unlock();

    /* 按半字(16bit)写入数据 */
    for (i = 0; i < size; i += 2) {
        uint16_t half_word;

        if (i + 1 < size) {
            half_word = (data[i + 1] << 8) | data[i];
        } else {
            half_word = 0xFF00 | data[i];  /* 奇数字节时，高字节填充0xFF */
        }

        status = HAL_FLASH_Program(FLASH_TYPEPROGRAM_HALFWORD, addr + i, half_word);
        if (status != HAL_OK) {
            break;
        }
    }

    /* 锁定 Flash */
    HAL_FLASH_Lock();

    return (status == HAL_OK) ? IAP_OK : IAP_ERROR_FLASH_WRITE;
}

/**
 * @brief 从 Flash 读取数据
 * @param addr Flash 地址
 * @param data 数据指针
 * @param size 数据大小
 * @return IAP 状态
 */
iap_status_t iap_flash_read(uint32_t addr, uint8_t *data, uint32_t size)
{
    /* 检查地址合法性 */
    if (addr < IAP_FLASH_BASE_ADDR || 
        (addr + size) > (IAP_FLASH_BASE_ADDR + IAP_FLASH_SIZE)) {
        return IAP_ERROR_INVALID_ADDR;
    }

    /* 直接从 Flash 读取数据 */
    memcpy(data, (uint8_t*)addr, size);

    return IAP_OK;
}

/**
 * @brief 验证 Flash 中的数据
 * @param addr Flash 地址
 * @param data 待验证的数据
 * @param size 数据大小
 * @return 1-验证成功，0-验证失败
 */
uint8_t iap_flash_verify(uint32_t addr, uint8_t *data, uint32_t size)
{
    return (memcmp((uint8_t*)addr, data, size) == 0) ? 1 : 0;
}

/**
 * @brief 设置 IAP 升级标志
 */
void iap_set_upgrade_flag(void)
{
    *((uint32_t*)IAP_FLAG_ADDR) = IAP_FLAG_VALUE;
}

/**
 * @brief 检查 IAP 升级标志
 * @return 1-存在升级标志，0-无升级标志
 */
uint8_t iap_check_upgrade_flag(void)
{
    return (*((uint32_t*)IAP_FLAG_ADDR) == IAP_FLAG_VALUE) ? 1 : 0;
}

/**
 * @brief 清除 IAP 升级标志
 */
void iap_clear_upgrade_flag(void)
{
    *((uint32_t*)IAP_FLAG_ADDR) = 0;
}

/**
 * @brief 跳转到应用程序
 */
void iap_jump_to_app(void)
{
    uint32_t app_stack_addr = *((uint32_t*)IAP_APPLICATION_BASE_ADDR);
    uint32_t app_reset_addr = *((uint32_t*)(IAP_APPLICATION_BASE_ADDR + 4));

    /* 检查栈指针是否合法 */
    if ((app_stack_addr & 0x2FFE0000) == 0x20000000) {
        /* 关闭中断 */
        __disable_irq();

        /* 复位所有外设 */
        HAL_DeInit();

        /* 设置栈指针 */
        __set_MSP(app_stack_addr);

        /* 跳转到应用程序 */
        ((void(*)(void))app_reset_addr)();
    }
}

/**
 * @brief 检查应用程序是否有效
 * @return 1-有效，0-无效
 */
uint8_t iap_check_app_valid(void)
{
    uint32_t app_stack_addr = *((uint32_t*)IAP_APPLICATION_BASE_ADDR);

    /* 检查栈指针是否指向 RAM 区域 */
    return ((app_stack_addr & 0x2FFE0000) == 0x20000000) ? 1 : 0;
}

/**
 * @brief 开始 IAP 升级
 * @param app_size 应用程序大小
 * @param app_crc 应用程序 CRC32 值
 */
void iap_upgrade_start(uint32_t app_size, uint32_t app_crc)
{
    /* 初始化升级信息 */
    upgrade_info.app_size = app_size;
    upgrade_info.app_crc = app_crc;
    upgrade_info.packet_size = 512;  /* 默认包大小 */
    upgrade_info.total_packets = (app_size + upgrade_info.packet_size - 1) / upgrade_info.packet_size;
    upgrade_info.current_packet = 0;

    /* 设置写入地址 */
    write_addr = IAP_APPLICATION_BASE_ADDR;

    /* 擦除应用程序区域 */
    iap_flash_erase(IAP_APPLICATION_BASE_ADDR, app_size);
}

/**
 * @brief 接收升级数据包
 * @param packet_num 包序号
 * @param data 数据指针
 * @param size 数据大小
 * @return IAP 状态
 */
iap_status_t iap_upgrade_data(uint32_t packet_num, uint8_t *data, uint32_t size)
{
    iap_status_t status;

    /* 检查包序号 */
    if (packet_num != upgrade_info.current_packet) {
        return IAP_ERROR_INVALID_SIZE;
    }

    /* 写入数据到 Flash */
    status = iap_flash_write(write_addr, data, size);
    if (status != IAP_OK) {
        return status;
    }

    /* 验证写入的数据 */
    if (!iap_flash_verify(write_addr, data, size)) {
        return IAP_ERROR_FLASH_VERIFY;
    }

    /* 更新地址和包序号 */
    write_addr += size;
    upgrade_info.current_packet++;

    return IAP_OK;
}

/**
 * @brief 完成 IAP 升级
 * @return IAP 状态
 */
iap_status_t iap_upgrade_finish(void)
{
    uint8_t *app_data;
    uint32_t calculated_crc;

    /* 分配内存读取应用程序数据进行 CRC 校验 */
    app_data = (uint8_t*)IAP_APPLICATION_BASE_ADDR;

    /* 计算 CRC32 */
    calculated_crc = iap_crc32(app_data, upgrade_info.app_size);

    /* 验证 CRC */
    if (calculated_crc != upgrade_info.app_crc) {
        return IAP_ERROR_CRC_FAIL;
    }

    /* 清除升级标志 */
    iap_clear_upgrade_flag();

    return IAP_OK;
}
