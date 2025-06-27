/* USER CODE BEGIN Header */
/**
  ******************************************************************************
  * @file           : main.h
  * @brief          : Header for main.c file.
  *                   This file contains the common defines of the application.
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

/* Define to prevent recursive inclusion -------------------------------------*/
#ifndef __MAIN_H
#define __MAIN_H

#ifdef __cplusplus
extern "C" {
#endif

/* Includes ------------------------------------------------------------------*/
#include "stm32f1xx_hal.h"

/* Private includes ----------------------------------------------------------*/
/* USER CODE BEGIN Includes */
#include "version.h"
#include "iap.h"
/* USER CODE END Includes */

/* Exported types ------------------------------------------------------------*/
/* USER CODE BEGIN ET */

/* USER CODE END ET */

/* Exported constants --------------------------------------------------------*/
/* USER CODE BEGIN EC */

/* USER CODE END EC */

/* Exported macro ------------------------------------------------------------*/
/* USER CODE BEGIN EM */

/* USER CODE END EM */

/* Exported functions prototypes ---------------------------------------------*/
void Error_Handler(void);

/* USER CODE BEGIN EFP */

/* USER CODE END EFP */

/* Private defines -----------------------------------------------------------*/
#define cs2_Pin GPIO_PIN_13
#define cs2_GPIO_Port GPIOC
#define led_Pin GPIO_PIN_14
#define led_GPIO_Port GPIOC
#define a16_Pin GPIO_PIN_0
#define a16_GPIO_Port GPIOA
#define a17_Pin GPIO_PIN_1
#define a17_GPIO_Port GPIOA
#define a18_Pin GPIO_PIN_2
#define a18_GPIO_Port GPIOA
#define a19_Pin GPIO_PIN_3
#define a19_GPIO_Port GPIOA
#define a20_Pin GPIO_PIN_4
#define a20_GPIO_Port GPIOA
#define a21_Pin GPIO_PIN_5
#define a21_GPIO_Port GPIOA
#define a22_Pin GPIO_PIN_6
#define a22_GPIO_Port GPIOA
#define a23_Pin GPIO_PIN_7
#define a23_GPIO_Port GPIOA
#define ad0_Pin GPIO_PIN_0
#define ad0_GPIO_Port GPIOB
#define ad1_Pin GPIO_PIN_1
#define ad1_GPIO_Port GPIOB
#define ad2_Pin GPIO_PIN_2
#define ad2_GPIO_Port GPIOB
#define ad10_Pin GPIO_PIN_10
#define ad10_GPIO_Port GPIOB
#define ad11_Pin GPIO_PIN_11
#define ad11_GPIO_Port GPIOB
#define ad12_Pin GPIO_PIN_12
#define ad12_GPIO_Port GPIOB
#define ad13_Pin GPIO_PIN_13
#define ad13_GPIO_Port GPIOB
#define ad14_Pin GPIO_PIN_14
#define ad14_GPIO_Port GPIOB
#define ad15_Pin GPIO_PIN_15
#define ad15_GPIO_Port GPIOB
#define cs1_Pin GPIO_PIN_8
#define cs1_GPIO_Port GPIOA
#define rd_Pin GPIO_PIN_9
#define rd_GPIO_Port GPIOA
#define wr_Pin GPIO_PIN_10
#define wr_GPIO_Port GPIOA
#define ad3_Pin GPIO_PIN_3
#define ad3_GPIO_Port GPIOB
#define ad4_Pin GPIO_PIN_4
#define ad4_GPIO_Port GPIOB
#define ad5_Pin GPIO_PIN_5
#define ad5_GPIO_Port GPIOB
#define ad6_Pin GPIO_PIN_6
#define ad6_GPIO_Port GPIOB
#define ad7_Pin GPIO_PIN_7
#define ad7_GPIO_Port GPIOB
#define ad8_Pin GPIO_PIN_8
#define ad8_GPIO_Port GPIOB
#define ad9_Pin GPIO_PIN_9
#define ad9_GPIO_Port GPIOB

/* USER CODE BEGIN Private defines */

/* USER CODE END Private defines */

#ifdef __cplusplus
}
#endif

#endif /* __MAIN_H */
