#include "iap.h"
#include "main.h"
#include <string.h>

/* 全局变量 */
static iap_upgrade_info_t upgrade_info;
static uint32_t write_addr;

/* CRC32 查找表 */
static const uint32_t crc32_table[256] = {
    0x00000000, 0x77073096, 0xEE0E612C, 0x990951BA, 0x076DC419, 0x706AF48F, 0xE963A535, 0x9E6495A3,
    0x0EDB8832, 0x79DCB8A4, 0xE0D5E91E, 0x97D2D988, 0x09B64C2B, 0x7EB17CBD, 0xE7B82D07, 0x90BF1D91,
    0x1DB71064, 0x6AB020F2, 0xF3B97148, 0x84BE41DE, 0x1ADAD47D, 0x6DDDE4EB, 0xF4D4B551, 0x83D385C7,
    0x136C9856, 0x646BA8C0, 0xFD62F97A, 0x8A65C9EC, 0x14015C4F, 0x63066CD9, 0xFA0F3D63, 0x8D080DF5,
    0x3B6E20C8, 0x4C69105E, 0xD56041E4, 0xA2677172, 0x3C03E4D1, 0x4B04D447, 0xD20D85FD, 0xA50AB56B,
    0x35B5A8FA, 0x42B2986C, 0xDBBBC9D6, 0xACBCF940, 0x32D86CE3, 0x45DF5C75, 0xDCD60DCF, 0xABD13D59,
    0x26D930AC, 0x51DE003A, 0xC8D75180, 0xBFD06116, 0x21B4F4B5, 0x56B3C423, 0xCFBA9599, 0xB8BDA50F,
    0x2802B89E, 0x5F058808, 0xC60CD9B2, 0xB10BE924, 0x2F6F7C87, 0x58684C11, 0xC1611DAB, 0xB6662D3D,
    0x76DC4190, 0x01DB7106, 0x98D220BC, 0xEFD5102A, 0x71B18589, 0x06B6B51F, 0x9FBFE4A5, 0xE8B8D433,
    0x7807C9A2, 0x0F00F934, 0x9609A88E, 0xE10E9818, 0x7F6A0DBB, 0x086D3D2D, 0x91646C97, 0xE6635C01,
    0x6B6B51F4, 0x1C6C6162, 0x856530D8, 0xF262004E, 0x6C0695ED, 0x1B01A57B, 0x8208F4C1, 0xF50FC457,
    0x65B0D9C6, 0x12B7E950, 0x8BBEB8EA, 0xFCB9887C, 0x62DD1DDF, 0x15DA2D49, 0x8CD37CF3, 0xFBD44C65,
    0x4DB26158, 0x3AB551CE, 0xA3BC0074, 0xD4BB30E2, 0x4ADFA541, 0x3DD895D7, 0xA4D1C46D, 0xD3D6F4FB,
    0x4369E96A, 0x346ED9FC, 0xAD678846, 0xDA60B8D0, 0x44042D73, 0x33031DE5, 0xAA0A4C5F, 0xDD0D7CC9,
    0x5005713C, 0x270241AA, 0xBE0B1010, 0xC90C2086, 0x5768B525, 0x206F85B3, 0xB966D409, 0xCE61E49F,
    0x5EDEF90E, 0x29D9C998, 0xB0D09822, 0xC7D7A8B4, 0x59B33D17, 0x2EB40D81, 0xB7BD5C3B, 0xC0BA6CAD,
    0xEDB88320, 0x9ABFB3B6, 0x03B6E20C, 0x74B1D29A, 0xEAD54739, 0x9DD277AF, 0x04DB2615, 0x73DC1683,
    0xE3630B12, 0x94643B84, 0x0D6D6A3E, 0x7A6A5AA8, 0xE40ECF0B, 0x9309FF9D, 0x0A00AE27, 0x7D079EB1,
    0xF00F9344, 0x8708A3D2, 0x1E01F268, 0x6906C2FE, 0xF762575D, 0x806567CB, 0x196C3671, 0x6E6B06E7,
    0xFED41B76, 0x89D32BE0, 0x10DA7A5A, 0x67DD4ACC, 0xF9B9DF6F, 0x8EBEEFF9, 0x17B7BE43, 0x60B08ED5,
    0xD6D6A3E8, 0xA1D1937E, 0x38D8C2C4, 0x4FDFF252, 0xD1BB67F1, 0xA6BC5767, 0x3FB506DD, 0x48B2364B,
    0xD80D2BDA, 0xAF0A1B4C, 0x36034AF6, 0x41047A60, 0xDF60EFC3, 0xA867DF55, 0x316E8EEF, 0x4669BE79,
    0xCB61B38C, 0xBC66831A, 0x256FD2A0, 0x5268E236, 0xCC0C7795, 0xBB0B4703, 0x220216B9, 0x5505262F,
    0xC5BA3BBE, 0xB2BD0B28, 0x2BB45A92, 0x5CB36A04, 0xC2D7FFA7, 0xB5D0CF31, 0x2CD99E8B, 0x5BDEAE1D,
    0x9B64C2B0, 0xEC63F226, 0x756AA39C, 0x026D930A, 0x9C0906A9, 0xEB0E363F, 0x72076785, 0x05005713,
    0x95BF4A82, 0xE2B87A14, 0x7BB12BAE, 0x0CB61B38, 0x92D28E9B, 0xE5D5BE0D, 0x7CDCEFB7, 0x0BDBDF21,
    0x86D3D2D4, 0xF1D4E242, 0x68DDB3F8, 0x1FDA836E, 0x81BE16CD, 0xF6B9265B, 0x6FB077E1, 0x18B74777,
    0x88085AE6, 0xFF0F6A70, 0x66063BCA, 0x11010B5C, 0x8F659EFF, 0xF862AE69, 0x616BFFD3, 0x166CCF45,
    0xA00AE278, 0xD70DD2EE, 0x4E048354, 0x3903B3C2, 0xA7672661, 0xD06016F7, 0x4969474D, 0x3E6E77DB,
    0xAED16A4A, 0xD9D65ADC, 0x40DF0B66, 0x37D83BF0, 0xA9BCAE53, 0xDEBB9EC5, 0x47B2CF7F, 0x30B5FFE9,
    0xBDBDF21C, 0xCABAC28A, 0x53B39330, 0x24B4A3A6, 0xBAD03605, 0xCDD70693, 0x54DE5729, 0x23D967BF,
    0xB3667A2E, 0xC4614AB8, 0x5D681B02, 0x2A6F2B94, 0xB40BBE37, 0xC30C8EA1, 0x5A05DF1B, 0x2D02EF8D
};

/**
 * @brief 计算 CRC32 校验值
 * @param data 数据指针
 * @param size 数据大小
 * @return CRC32 值
 */
uint32_t iap_crc32(uint8_t *data, uint32_t size)
{
    uint32_t crc = 0xFFFFFFFF;

    for (uint32_t i = 0; i < size; i++) {
        crc = crc32_table[(crc ^ data[i]) & 0xFF] ^ (crc >> 8);
    }

    return crc ^ 0xFFFFFFFF;
}

/**
 * @brief 擦除 Flash 指定区域
 * @param start_addr 起始地址
 * @param size 擦除大小
 * @return IAP 状态
 */
iap_status_t iap_flash_erase(uint32_t start_addr, uint32_t size)
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
iap_status_t iap_flash_write(uint32_t addr, uint8_t *data, uint32_t size)
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
