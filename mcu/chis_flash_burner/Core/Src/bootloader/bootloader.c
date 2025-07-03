/* USER CODE BEGIN Header */
/**
 ******************************************************************************
 * @file           : bootloader.c
 * @brief          : Bootloader main program body
 ******************************************************************************
 * @attention
 *
 * Copyright (c) 2024 STMicroelectronics.
 * All rights reserved.
 *
 * This software is licensed under terms that can be found in the LICENSE file
 * in the root directory of this software component.
 * If no LICENSE file comes with this software, it is provided AS-IS.
 *
 ******************************************************************************
 */
/* USER CODE END Header */
/* Includes ------------------------------------------------------------------*/
#include "bootloader.h"
#include "usb_device.h"

/* Private includes ----------------------------------------------------------*/
/* USER CODE BEGIN Includes */
#include "uart.h"
#include "error_handler.h"
#include "iap.h"
/* USER CODE END Includes */

/* Private typedef -----------------------------------------------------------*/
/* USER CODE BEGIN PTD */

/* USER CODE END PTD */

/* Private define ------------------------------------------------------------*/
/* USER CODE BEGIN PD */

/* USER CODE END PD */

/* Private macro -------------------------------------------------------------*/
/* USER CODE BEGIN PM */

/* USER CODE END PM */

/* Private variables ---------------------------------------------------------*/

/* USER CODE BEGIN PV */

/* USER CODE END PV */

/* Private function prototypes -----------------------------------------------*/
void SystemClock_Config(void);
static void MX_GPIO_Init(void);
void debug_state_output(void);
/* USER CODE BEGIN PFP */

/* USER CODE END PFP */

/* Private user code ---------------------------------------------------------*/
/* USER CODE BEGIN 0 */

/* USER CODE END 0 */

/**
  * @brief  The bootloader entry point.
  * @retval int
  */
int main(void)
{
  /* USER CODE BEGIN 1 */
  
  /* 首先设置向量表偏移 - 确保应用程序能正确运行 */
  SCB->VTOR = IAP_BOOTLOADER_BASE_ADDR;
  __DSB();  /* 数据同步屏障 */
  __ISB();  /* 指令同步屏障 */

  /* IAP环境下必须首先使能全局中断 */
  __enable_irq();

  /* 确保SysTick被正确复位 */
  
  SysTick->CTRL = 0;      /* 禁用SysTick */
  SysTick->LOAD = 0;      /* 清除重载值 */
  SysTick->VAL = 0;       /* 清除当前值 */

  /* 检查是否需要跳转到应用程序 */
  uint8_t iap_upgrade_flag = iap_check_upgrade_flag();
  if (!iap_upgrade_flag && iap_check_app_valid()) {
      /* 没有升级标志且应用程序有效，跳转到应用程序 */
      iap_jump_to_app();
  }
  /* 清除升级标志，继续运行 */
  iap_clear_upgrade_flag();

  /* USER CODE END 1 */

  /* MCU Configuration--------------------------------------------------------*/

  /* Reset of all peripherals, Initializes the Flash interface and the Systick. */
  HAL_Init();

  /* USER CODE BEGIN Init */

  /* USER CODE END Init */

  /* Configure the system clock */
  SystemClock_Config();

  /* USER CODE BEGIN SysInit */

  /* USER CODE END SysInit */

  /* Initialize all configured peripherals */
  MX_GPIO_Init();

  /* USB初始化 */
  MX_USB_DEVICE_Init();
  MX_USB_DEVICE_ReInit();
  /* USER CODE BEGIN 2 */

  /* 测试LED - 立即翻转几次确认工作状态 */
  for(int i = 0; i < 3; i++) {
    HAL_GPIO_WritePin(led_GPIO_Port, led_Pin, 0);  // LED on (假设低电平有效)
    HAL_Delay(100);
    HAL_GPIO_WritePin(led_GPIO_Port, led_Pin, 1);  // LED off
    HAL_Delay(100);
  }

#ifdef DEBUG
  debug_state_output();
#endif

  /* USER CODE END 2 */

  /* Infinite loop */
  /* USER CODE BEGIN WHILE */

  while (1)
  {
    /* USER CODE END WHILE */

    /* USER CODE BEGIN 3 */

    uart_cmdHandler();
    // morse_handler();
  }
  /* USER CODE END 3 */
}

/**
  * @brief System Clock Configuration
  * @retval None
  */
void SystemClock_Config(void)
{
  RCC_OscInitTypeDef RCC_OscInitStruct = {0};
  RCC_ClkInitTypeDef RCC_ClkInitStruct = {0};
  RCC_PeriphCLKInitTypeDef PeriphClkInit = {0};

  /** Initializes the RCC Oscillators according to the specified parameters
  * in the RCC_OscInitTypeDef structure.
  */
  RCC_OscInitStruct.OscillatorType = RCC_OSCILLATORTYPE_HSI;
  RCC_OscInitStruct.HSIState = RCC_HSI_ON;
  RCC_OscInitStruct.HSICalibrationValue = RCC_HSICALIBRATION_DEFAULT;
  RCC_OscInitStruct.PLL.PLLState = RCC_PLL_ON;
  RCC_OscInitStruct.PLL.PLLSource = RCC_PLLSOURCE_HSI_DIV2;
  RCC_OscInitStruct.PLL.PLLMUL = RCC_PLL_MUL12;
  if (HAL_RCC_OscConfig(&RCC_OscInitStruct) != HAL_OK)
  {
    Error_Handler();
  }

  /** Initializes the CPU, AHB and APB buses clocks
  */
  RCC_ClkInitStruct.ClockType = RCC_CLOCKTYPE_HCLK|RCC_CLOCKTYPE_SYSCLK
                              |RCC_CLOCKTYPE_PCLK1|RCC_CLOCKTYPE_PCLK2;
  RCC_ClkInitStruct.SYSCLKSource = RCC_SYSCLKSOURCE_PLLCLK;
  RCC_ClkInitStruct.AHBCLKDivider = RCC_SYSCLK_DIV1;
  RCC_ClkInitStruct.APB1CLKDivider = RCC_HCLK_DIV2;
  RCC_ClkInitStruct.APB2CLKDivider = RCC_HCLK_DIV1;

  if (HAL_RCC_ClockConfig(&RCC_ClkInitStruct, FLASH_LATENCY_1) != HAL_OK)
  {
    Error_Handler();
  }
  PeriphClkInit.PeriphClockSelection = RCC_PERIPHCLK_USB;
  PeriphClkInit.UsbClockSelection = RCC_USBCLKSOURCE_PLL;
  if (HAL_RCCEx_PeriphCLKConfig(&PeriphClkInit) != HAL_OK)
  {
    Error_Handler();
  }
}

/**
  * @brief GPIO Initialization Function
  * @param None
  * @retval None
  */
static void MX_GPIO_Init(void)
{
  GPIO_InitTypeDef GPIO_InitStruct = {0};
/* USER CODE BEGIN MX_GPIO_Init_1 */
/* USER CODE END MX_GPIO_Init_1 */

  /* GPIO Ports Clock Enable */
  __HAL_RCC_GPIOC_CLK_ENABLE();

  /*Configure GPIO pin Output Level */
  HAL_GPIO_WritePin(GPIOC, cs2_Pin|led_Pin, GPIO_PIN_SET);

  /*Configure GPIO pin Output Level */
  /*Configure GPIO pins : cs2_Pin led_Pin */
  GPIO_InitStruct.Pin = cs2_Pin|led_Pin;
  GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;
  GPIO_InitStruct.Pull = GPIO_PULLUP;
  GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_HIGH;
  HAL_GPIO_Init(GPIOC, &GPIO_InitStruct);
/* USER CODE BEGIN MX_GPIO_Init_2 */
/* USER CODE END MX_GPIO_Init_2 */
}

/* USER CODE BEGIN 4 */

void debug_state_output(void)
{
  /* 调试：检查程序运行地址和IAP状态 */
  {
    uint32_t current_addr = (uint32_t)main;
    uint32_t vtor_value = SCB->VTOR;  // 读取向量表偏移寄存器
    uint32_t current_pc;

    // 获取当前程序计数器值
    __asm volatile ("mov %0, pc" : "=r" (current_pc));

    uint8_t is_app_valid = iap_check_app_valid();
    uint8_t is_bootloader_valid = iap_check_bootloader_valid();
    uint8_t upgrade_flag = iap_check_upgrade_flag();

    // 检查USB状态
    extern USBD_HandleTypeDef hUsbDeviceFS;
    uint8_t usb_state = hUsbDeviceFS.dev_state;
    uint8_t usb_configured = (usb_state == USBD_STATE_CONFIGURED) ? 1 : 0;

    // 检查编译宏状态
    uint8_t is_bootloader_build = 0;
    uint8_t is_app_build = 0;

#ifdef IAP_BOOTLOADER_BUILD
    is_bootloader_build = 1;
#endif

#ifdef IAP_APPLICATION_BUILD
    is_app_build = 1;
#endif

    // 通过LED闪烁次数来指示状态：
    // 01次：main函数在app区域（不应该发生）
    // 02次：PC在app区域（不应该发生）
    // 03次：main函数在bootloader区域，USB状态为USBD_STATE_DEFAULT
    // 04次：main函数在bootloader区域，USB状态为USBD_STATE_ADDRESSED  
    // 05次：main函数在bootloader区域，USB状态为USBD_STATE_CONFIGURED (正常)
    // 06次：main函数在bootloader区域，USB状态为USBD_STATE_SUSPENDED
    // 07次：main函数在bootloader区域，USB状态为其他未知状态
    // 08次：向量表偏移错误
    // 09次：存在升级标志
    // 10次：编译宏错误（IAP_APPLICATION_BUILD在bootloader中被定义）
    // 11次：没有定义任何编译宏
    // 12次：在bootloader区域但没有定义IAP_BOOTLOADER_BUILD宏
    uint8_t flash_count = 0;

    if (current_addr >= 0x08006000) {
      flash_count = 1; // main函数在app区域（异常）
    } else if (current_pc >= 0x08006000) {
      flash_count = 2; // PC在app区域（异常）
    } else {
      // 在bootloader区域，根据USB状态分类
      switch(usb_state) {
        case USBD_STATE_DEFAULT:
          flash_count = 3;
          break;
        case USBD_STATE_ADDRESSED:
          flash_count = 4;
          break;
        case USBD_STATE_CONFIGURED:
          flash_count = 5; // 正常状态
          break;
        case USBD_STATE_SUSPENDED:
          flash_count = 6;
          break;
        default:
          flash_count = 7; // 未知状态
          break;
      }
    }

    if (vtor_value != IAP_BOOTLOADER_BASE_ADDR) {
      flash_count = 8; // 向量表偏移错误
    }

    if (upgrade_flag) {
      flash_count = 9; // 存在升级标志
    }

    if (is_app_build && current_addr < 0x08006000) {
      flash_count = 10; // 编译宏错误：在bootloader区域但定义了app宏
    }

    if (!is_bootloader_build && !is_app_build) {
      flash_count = 11; // 没有定义任何编译宏
    }

    // 额外检查：如果程序在bootloader区域但没有定义IAP_BOOTLOADER_BUILD
    if (current_addr < 0x08006000 && !is_bootloader_build) {
      flash_count = 12; // 在bootloader区域但没有定义IAP_BOOTLOADER_BUILD宏
    }

    // 用LED闪烁指示状态
    HAL_Delay(1000);
    for(int i = 0; i < flash_count; i++) {
      HAL_GPIO_WritePin(led_GPIO_Port, led_Pin, 0);  // LED on
      HAL_Delay(300);
      HAL_GPIO_WritePin(led_GPIO_Port, led_Pin, 1);  // LED off
      HAL_Delay(300);
    }
    HAL_Delay(1000);
  }

}

/* USER CODE END 4 */

#ifdef  USE_FULL_ASSERT
/**
  * @brief  Reports the name of the source file and the source line number
  *         where the assert_param error has occurred.
  * @param  file: pointer to the source file name
  * @param  line: assert_param error line source number
  * @retval None
  */
void assert_failed(uint8_t *file, uint32_t line)
{
  /* USER CODE BEGIN 6 */
  /* User can add his own implementation to report the file name and line number,
     ex: printf("Wrong parameters value: file %s on line %d\r\n", file, line) */
  /* USER CODE END 6 */
}
#endif /* USE_FULL_ASSERT */
