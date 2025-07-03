#include "iap.h"
// #include "main.h"
#include <string.h>
#include "error_handler.h"
#include "usb_device.h"
#include "usbd_core.h"

/* 外部变量声明 */
extern USBD_HandleTypeDef hUsbDeviceFS;

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
    /* 使用volatile确保写入操作不被优化 */
    volatile uint32_t *flag_addr = (volatile uint32_t*)IAP_FLAG_ADDR;
    *flag_addr = IAP_FLAG_VALUE;

    /* 确保写入操作完成 */
    __DSB();
}

/**
 * @brief 检查 IAP 升级标志
 * @return 1-存在升级标志，0-无升级标志
 */
uint8_t iap_check_upgrade_flag(void)
{
    volatile uint32_t *flag_addr = (volatile uint32_t*)IAP_FLAG_ADDR;
    return (*flag_addr == IAP_FLAG_VALUE) ? 1 : 0;
}

/**
 * @brief 清除 IAP 升级标志
 */
void iap_clear_upgrade_flag(void)
{
    volatile uint32_t *flag_addr = (volatile uint32_t*)IAP_FLAG_ADDR;
    *flag_addr = 0;

    /* 确保写入操作完成 */
    __DSB();
}

/**
 * @brief 跳转到应用程序
 */
void iap_jump_to_app(void)
{
    uint32_t app_stack_addr = *((uint32_t*)IAP_APPLICATION_BASE_ADDR);
    uint32_t app_reset_addr = *((uint32_t*)(IAP_APPLICATION_BASE_ADDR + 4));

    /* 检查栈指针是否合法 (RAM区域: 0x20000000 - 0x20004FFF, 实际有效范围) */
    if ((app_stack_addr & 0x2FFE0000) == 0x20000000 && 
        app_stack_addr >= 0x20000000 && 
        app_stack_addr <= 0x20004FFF) {

        /* 检查复位向量地址是否合法 (Application区域: 0x08006000 - 0x0800FFFF) */
        if (app_reset_addr >= IAP_APPLICATION_BASE_ADDR && 
            app_reset_addr < (IAP_APPLICATION_BASE_ADDR + IAP_APPLICATION_SIZE)) {

            /* 定义跳转函数类型 */
            typedef void (*app_func_t)(void);
            app_func_t app_func;

            /* 全局关闭中断 */
            __disable_irq();

            /* 关闭SysTick */
            SysTick->CTRL = 0;
            SysTick->LOAD = 0;
            SysTick->VAL = 0;

            /* 禁用所有中断 */
            for (int i = 0; i < 8; i++) {
                NVIC->ICER[i] = 0xFFFFFFFF;  /* 禁用中断 */
                NVIC->ICPR[i] = 0xFFFFFFFF;  /* 清除pending中断 */
            }

            /* 复位系统控制寄存器 */
            SCB->ICSR |= SCB_ICSR_PENDSTCLR_Msk;  /* 清除SysTick pending */

            /* 复位所有外设（在禁用中断后） */
            HAL_DeInit();

            /* 强制重置关键外设并等待稳定 */
            /* 重置USB外设 */
            __HAL_RCC_USB_FORCE_RESET();
            for(volatile int i = 0; i < 1000; i++); /* 等待重置生效 */
            __HAL_RCC_USB_RELEASE_RESET();

            /* 重置所有GPIO */
            __HAL_RCC_GPIOA_FORCE_RESET();
            for(volatile int i = 0; i < 100; i++); 
            __HAL_RCC_GPIOA_RELEASE_RESET();
            __HAL_RCC_GPIOB_FORCE_RESET();
            for(volatile int i = 0; i < 100; i++);
            __HAL_RCC_GPIOB_RELEASE_RESET();
            __HAL_RCC_GPIOC_FORCE_RESET();
            for(volatile int i = 0; i < 100; i++);
            __HAL_RCC_GPIOC_RELEASE_RESET();

            /* 重置时钟系统到默认状态 */
            HAL_RCC_DeInit();

            /* 重要：等待所有操作完成 */
            __DSB();  /* 数据同步屏障 */
            __ISB();  /* 指令同步屏障 */

            /* 设置向量表偏移到应用程序 */
            SCB->VTOR = IAP_APPLICATION_BASE_ADDR;

            /* 确保向量表设置生效 */
            __DSB();
            __ISB();

            /* 设置主栈指针 */
            __set_MSP(app_stack_addr);

            /* 确保栈指针设置生效 */
            __DSB();
            __ISB();

            /* 准备跳转函数 */
            app_func = (app_func_t)app_reset_addr;

            /* 跳转到应用程序 - 使用更健壮的汇编跳转 */
            __asm volatile (
                "cpsid i\n\t"              /* 再次禁用中断 */
                "mov r3, %0\n\t"           /* 将栈指针保存到r3 */
                "mov r4, %1\n\t"           /* 将复位地址保存到r4 */
                "msr msp, r3\n\t"          /* 设置主栈指针 */
                "dsb\n\t"                  /* 数据同步屏障 */
                "isb\n\t"                  /* 指令同步屏障 */
                "mov lr, #0xFFFFFFFF\n\t"  /* 清除链接寄存器 */
                "mov r0, #0\n\t"           /* 清除r0寄存器 */
                "mov r1, #0\n\t"           /* 清除r1寄存器 */
                "mov r2, #0\n\t"           /* 清除r2寄存器 */
                "bx r4\n\t"                /* 跳转到应用程序 */
                :
                : "r" (app_stack_addr), "r" (app_reset_addr)
                : "r0", "r1", "r2", "r3", "r4", "lr", "memory"
            );

            /* 如果跳转失败，这里会执行到（不应该发生） */
            while(1) {
                __NOP();
            }
        }
    }
}

/**
 * @brief 检查应用程序是否有效
 * @return 1-有效，0-无效
 */
uint8_t iap_check_app_valid(void)
{
    uint32_t app_stack_addr = *((uint32_t*)IAP_APPLICATION_BASE_ADDR);
    uint32_t app_reset_addr = *((uint32_t*)(IAP_APPLICATION_BASE_ADDR + 4));

    /* 检查是否为全0xFF（未编程状态） */
    if (app_stack_addr == 0xFFFFFFFF || app_reset_addr == 0xFFFFFFFF) {
        return 0;
    }

    /* 检查是否为全0（无效状态） */
    if (app_stack_addr == 0x00000000 || app_reset_addr == 0x00000000) {
        return 0;
    }

    /* 检查栈指针是否指向 RAM 区域 (0x20000000 - 0x20004FFF, 实际有效范围) */
    if ((app_stack_addr & 0x2FFE0000) != 0x20000000 || 
        app_stack_addr < 0x20000000 || 
        app_stack_addr > 0x20004FFF) {
        return 0;
    }

    /* 检查复位向量地址是否在Application区域 */
    if (app_reset_addr < IAP_APPLICATION_BASE_ADDR || 
        app_reset_addr >= (IAP_APPLICATION_BASE_ADDR + IAP_APPLICATION_SIZE)) {
        return 0;
    }

    /* 检查复位向量是否为Thumb指令 (最低位必须为1) */
    if ((app_reset_addr & 0x01) == 0) {
        return 0;
    }

    return 1;
}


/**
 * @brief 跳转到bootloader程序
 */
void iap_jump_to_bootloader(void)
{
    uint32_t bootloader_stack_addr = *((uint32_t*)IAP_BOOTLOADER_BASE_ADDR);
    uint32_t bootloader_reset_addr = *((uint32_t*)(IAP_BOOTLOADER_BASE_ADDR + 4));

    /* 检查bootloader是否有效 */
    if (!iap_check_bootloader_valid()) {
        return;  /* bootloader无效，直接返回 */
    }

    /* 定义跳转函数类型 */
    typedef void (*bootloader_func_t)(void);
    bootloader_func_t bootloader_func;

    /* 全局关闭中断 */
    __disable_irq();
    /* 关闭SysTick */
    SysTick->CTRL = 0;
    SysTick->LOAD = 0;
    SysTick->VAL = 0;


    /* 禁用所有中断 */
    for (int i = 0; i < 8; i++) {
        NVIC->ICER[i] = 0xFFFFFFFF;  /* 禁用中断 */
        NVIC->ICPR[i] = 0xFFFFFFFF;  /* 清除pending中断 */
    }

    /* 复位系统控制寄存器 */
    SCB->ICSR |= SCB_ICSR_PENDSTCLR_Msk;  /* 清除SysTick pending */

    /* 复位所有外设（在禁用中断后） */
    HAL_DeInit();

    /* 强制重置关键外设并等待稳定 */
    /* 重置USB外设 */
    __HAL_RCC_USB_FORCE_RESET();
    for(volatile int i = 0; i < 1000; i++); /* 等待重置生效 */
    __HAL_RCC_USB_RELEASE_RESET();

    /* 重置所有GPIO */
    __HAL_RCC_GPIOA_FORCE_RESET();
    for(volatile int i = 0; i < 100; i++); 
    __HAL_RCC_GPIOA_RELEASE_RESET();
    __HAL_RCC_GPIOB_FORCE_RESET();
    for(volatile int i = 0; i < 100; i++);
    __HAL_RCC_GPIOB_RELEASE_RESET();
    __HAL_RCC_GPIOC_FORCE_RESET();
    for(volatile int i = 0; i < 100; i++);
    __HAL_RCC_GPIOC_RELEASE_RESET();

    /* 重置时钟系统到默认状态 */
    HAL_RCC_DeInit();

    /* 重要：等待所有操作完成 */
    __DSB();  /* 数据同步屏障 */
    __ISB();  /* 指令同步屏障 */

    /* 设置向量表偏移到bootloader */
    SCB->VTOR = IAP_BOOTLOADER_BASE_ADDR;

    /* 确保向量表设置生效 */
    __DSB();
    __ISB();

    /* 设置主栈指针 */
    __set_MSP(bootloader_stack_addr);

    /* 确保栈指针设置生效 */
    __DSB();
    __ISB();

    /* 准备跳转函数 */
    bootloader_func = (bootloader_func_t)bootloader_reset_addr;

    /* 设置升级标志 - 在跳转前最后设置，让bootloader知道这是从app跳转过来的 */
    iap_set_upgrade_flag();

    /* 跳转到bootloader - 使用更健壮的汇编跳转 */
    __asm volatile (
        "cpsid i\n\t"              /* 再次禁用中断 */
        "mov r3, %0\n\t"           /* 将栈指针保存到r3 */
        "mov r4, %1\n\t"           /* 将复位地址保存到r4 */
        "msr msp, r3\n\t"          /* 设置主栈指针 */
        "dsb\n\t"                  /* 数据同步屏障 */
        "isb\n\t"                  /* 指令同步屏障 */
        "mov lr, #0xFFFFFFFF\n\t"  /* 清除链接寄存器 */
        "mov r0, #0\n\t"           /* 清除r0寄存器 */
        "mov r1, #0\n\t"           /* 清除r1寄存器 */
        "mov r2, #0\n\t"           /* 清除r2寄存器 */
        "bx r4\n\t"                /* 跳转到bootloader */
        :
        : "r" (bootloader_stack_addr), "r" (bootloader_reset_addr)
        : "r0", "r1", "r2", "r3", "r4", "lr", "memory"
    );

    /* 如果跳转失败，这里会执行到（不应该发生） */
    while(1) {
        __NOP();
    }
}


/**
 * @brief 检查bootloader程序是否有效
 * @return 1-有效，0-无效
 */
uint8_t iap_check_bootloader_valid(void)
{
    uint32_t bootloader_stack_addr = *((uint32_t*)IAP_BOOTLOADER_BASE_ADDR);
    uint32_t bootloader_reset_addr = *((uint32_t*)(IAP_BOOTLOADER_BASE_ADDR + 4));

    /* 检查是否为全0xFF（未编程状态） */
    if (bootloader_stack_addr == 0xFFFFFFFF || bootloader_reset_addr == 0xFFFFFFFF) {
        return 0;
    }

    /* 检查是否为全0（无效状态） */
    if (bootloader_stack_addr == 0x00000000 || bootloader_reset_addr == 0x00000000) {
        return 0;
    }

    /* 检查栈指针是否指向 RAM 区域 (0x20000000 - 0x20004FFF) */
    if ((bootloader_stack_addr & 0x2FFE0000) != 0x20000000 || 
        bootloader_stack_addr < 0x20000000 || 
        bootloader_stack_addr > 0x20004FFF) {
        return 0;
    }

    /* 检查复位地址是否在Bootloader区域 */
    if (bootloader_reset_addr < IAP_BOOTLOADER_BASE_ADDR || 
        bootloader_reset_addr >= (IAP_BOOTLOADER_BASE_ADDR + IAP_BOOTLOADER_SIZE)) {
        return 0;
    }

    /* 检查复位向量是否为Thumb指令 (最低位必须为1) */
    if ((bootloader_reset_addr & 0x01) == 0) {
        return 0;
    }

    return 1;
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

/**
 * @brief 调试函数：检查bootloader信息
 * @param stack_addr 输出栈地址
 * @param reset_addr 输出复位地址
 * @return 检查结果的详细状态码
 */
uint32_t iap_debug_bootloader_info(uint32_t *stack_addr, uint32_t *reset_addr)
{
    uint32_t bootloader_stack_addr = *((uint32_t*)IAP_BOOTLOADER_BASE_ADDR);
    uint32_t bootloader_reset_addr = *((uint32_t*)(IAP_BOOTLOADER_BASE_ADDR + 4));
    uint32_t result = 0;

    if (stack_addr) *stack_addr = bootloader_stack_addr;
    if (reset_addr) *reset_addr = bootloader_reset_addr;

    /* 检查各种条件并设置相应的位 */
    if (bootloader_stack_addr == 0xFFFFFFFF) result |= (1 << 0);  /* 栈地址全FF */
    if (bootloader_reset_addr == 0xFFFFFFFF) result |= (1 << 1);  /* 复位地址全FF */
    if (bootloader_stack_addr == 0x00000000) result |= (1 << 2);  /* 栈地址全0 */
    if (bootloader_reset_addr == 0x00000000) result |= (1 << 3);  /* 复位地址全0 */

    /* 栈指针范围检查 */
    if ((bootloader_stack_addr & 0x2FFE0000) != 0x20000000) result |= (1 << 4);
    if (bootloader_stack_addr < 0x20000000) result |= (1 << 5);
    if (bootloader_stack_addr > 0x20004FFF) result |= (1 << 6);

    /* 复位地址范围检查 */
    if (bootloader_reset_addr < IAP_BOOTLOADER_BASE_ADDR) result |= (1 << 7);
    if (bootloader_reset_addr >= (IAP_BOOTLOADER_BASE_ADDR + IAP_BOOTLOADER_SIZE)) result |= (1 << 8);

    /* Thumb指令检查 */
    if ((bootloader_reset_addr & 0x01) == 0) result |= (1 << 9);

    return result;  /* 返回0表示所有检查都通过 */
}
