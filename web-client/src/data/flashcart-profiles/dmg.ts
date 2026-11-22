/*!
 * Flashcart profile data converted from FlashGBX (https://github.com/Lesserkuma/FlashGBX).
 * Copyright (C) Lesserkuma — Licensed under GNU General Public License v3.0 (GPL-3.0).
 */
/* eslint-disable */
import type { FlashcartProfile } from '@/types/flashcart-profile';

export const FLASHCART_PROFILES_LICENSE_NOTICE = "Flashcart profile data converted from FlashGBX (https://github.com/Lesserkuma/FlashGBX).\nCopyright (C) Lesserkuma — Licensed under GNU General Public License v3.0 (GPL-3.0).";

export const DMG_FLASHCART_PROFILES: readonly FlashcartProfile[] = [
  {
    "id": "DMG_256M29EWH",
    "sourceFile": "fc_DMG_256M29EWH.txt",
    "type": "DMG",
    "names": [
      "256M29EWH (no PCB text)",
      "512M29EWH (no PCB text)"
    ],
    "flash_ids": [
      [
        138,
        138,
        125,
        125
      ],
      [
        138,
        138,
        125,
        125
      ]
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "flash_size": 33554432,
    "start_addr": 0,
    "first_bank": 1,
    "chip_erase_timeout": 300,
    "sector_size_from_cfi": true,
    "buffer_size": 256,
    "reset_every": 8388608,
    "mbc": 513,
    "write_pin": "WR",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          144
        ]
      ],
      "read_cfi": [
        [
          170,
          152
        ]
      ],
      "chip_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          128,
          128
        ]
      ],
      "buffer_write": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          "SA",
          38
        ],
        [
          "SA",
          "BS"
        ],
        [
          "PA",
          "PD"
        ],
        [
          "SA",
          42
        ]
      ],
      "buffer_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          "PD",
          255
        ]
      ],
      "single_write": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_26LV160BTC",
    "sourceFile": "fc_DMG_26LV160BTC.txt",
    "type": "DMG",
    "names": [
      "SD007_BV5_V3 with 26LV160BTC"
    ],
    "flash_ids": [
      [
        193,
        0,
        74,
        33
      ]
    ],
    "voltage": 5,
    "voltage_variants": true,
    "flash_size": 2097152,
    "start_addr": 0,
    "first_bank": 1,
    "chip_erase_timeout": 300,
    "write_pin": "WR",
    "sector_size": [
      [
        16384,
        1
      ],
      [
        8192,
        2
      ],
      [
        32768,
        1
      ],
      [
        65536,
        31
      ]
    ],
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_28F016S5",
    "sourceFile": "fc_DMG_28F016S5.txt",
    "type": "DMG",
    "names": [
      "DIY cart with 28F016S5 @ AUDIO"
    ],
    "flash_ids": [
      [
        137,
        170
      ]
    ],
    "voltage": 5,
    "flash_size": 2097152,
    "sector_size": 65536,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "AUDIO",
    "mbc": "manual",
    "command_set": "INTEL",
    "commands": {
      "reset": [
        [
          0,
          255
        ]
      ],
      "read_identifier": [
        [
          0,
          144
        ]
      ],
      "sector_erase": [
        [
          16384,
          32
        ],
        [
          16384,
          208
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          16384,
          128,
          128
        ]
      ],
      "single_write": [
        [
          "PA",
          112
        ],
        [
          "PA",
          64
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          0,
          128,
          128
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_29DL161TD-90",
    "sourceFile": "fc_DMG_29DL161TD-90.txt",
    "type": "DMG",
    "names": [
      "SD007_48BALL_64M_V3 with 29DL161TD-90",
      "SD007_TSOP_48BALL_V9 with 29LV160CBTC-70G",
      "SD007_TSOP_64BALL_SOP28 with EN29LV160AB-70TCP",
      "SD007_TSOP_48BALL_V10 with 29DL164BE-70P",
      "SD007_TSOP_64BALL_SOJ28 with 29DL164BE-70P"
    ],
    "flash_ids": [
      [
        4,
        4,
        53,
        53
      ],
      [
        193,
        193,
        74,
        74
      ],
      [
        127,
        127,
        74,
        74
      ],
      [
        4,
        4,
        54,
        54
      ],
      [
        4,
        4,
        54,
        54
      ]
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "flash_size": 2097152,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "sector_size_from_cfi": true,
    "chip_erase_timeout": 120,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_29DL163BD-90",
    "sourceFile": "fc_DMG_29DL163BD-90.txt",
    "type": "DMG",
    "names": [
      "SD007_48BALL_64M_V5 with 29DL163BD-90",
      "SD007_48BALL_64M_V6 with 29DL163BD-90"
    ],
    "flash_ids": [
      [
        4,
        4,
        43,
        43
      ],
      [
        4,
        4,
        43,
        43
      ]
    ],
    "voltage": 3.3,
    "flash_size": 2097152,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "sector_size": [
      [
        8192,
        8
      ],
      [
        65536,
        31
      ]
    ],
    "chip_erase_timeout": 120,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_29DL32TF-70",
    "sourceFile": "fc_DMG_29DL32TF-70.txt",
    "type": "DMG",
    "names": [
      "ES29LV160_DRV with 29DL32TF-70"
    ],
    "flash_ids": [
      [
        4,
        4,
        125,
        125
      ]
    ],
    "voltage": 3.3,
    "flash_size": 2097152,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "sector_size_from_cfi": true,
    "chip_erase_timeout": 50,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_29LV160DB",
    "sourceFile": "fc_DMG_29LV160DB.txt",
    "type": "DMG",
    "names": [
      "29LV Series Flash BOY with 29LV160DB"
    ],
    "flash_ids": [
      [
        194,
        194,
        73,
        73
      ]
    ],
    "voltage": 5,
    "flash_size": 2097152,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "sector_size_from_cfi": true,
    "chip_erase_timeout": 120,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_29LV320DB",
    "sourceFile": "fc_DMG_29LV320DB.txt",
    "type": "DMG",
    "names": [
      "DRV with 29LV320DB and ALTERA CPLD"
    ],
    "flash_ids": [
      [
        193,
        193,
        168,
        168
      ]
    ],
    "voltage": 3.3,
    "flash_size": 4194304,
    "start_addr": 16384,
    "first_bank": 0,
    "write_pin": "WR",
    "sector_size_from_cfi": true,
    "chip_erase_timeout": 120,
    "mbc": "manual",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          16384,
          240
        ]
      ],
      "read_identifier": [
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          19114,
          144
        ]
      ],
      "read_cfi": [
        [
          19114,
          152
        ]
      ],
      "chip_erase": [
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          19114,
          128
        ],
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          19114,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          19114,
          128
        ],
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "buffer_write": [
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          "SA",
          38
        ],
        [
          "SA",
          "BS"
        ],
        [
          "PA",
          "PD"
        ],
        [
          "SA",
          42
        ]
      ],
      "buffer_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          "PD",
          65535
        ]
      ],
      "single_write": [
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          19114,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_36VF3204",
    "sourceFile": "fc_DMG_36VF3204.txt",
    "type": "DMG",
    "names": [
      "SD007_48BALL_64M_V5 with 36VF3204",
      "SD007_48BALL_64M_V6 with 36VF3204",
      "SD007_TSOP_48BALL with 36VF3204",
      "SD007_48BALL_64M_V5 with 36VF3203"
    ],
    "flash_ids": [
      [
        191,
        0,
        83,
        115
      ],
      [
        191,
        0,
        83,
        115
      ],
      [
        191,
        0,
        83,
        115
      ],
      [
        191,
        0,
        84,
        115
      ]
    ],
    "voltage": 3.3,
    "flash_size": 4194304,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 5,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          144
        ]
      ],
      "read_cfi": [
        [
          2730,
          152
        ]
      ],
      "chip_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_36VF3204_2",
    "sourceFile": "fc_DMG_36VF3204_2.txt",
    "type": "DMG",
    "names": [
      "36VF3204 and ALTERA CPLD (no PCB text)"
    ],
    "flash_ids": [
      [
        191,
        0,
        83,
        115
      ]
    ],
    "voltage": 3.3,
    "flash_size": 4194304,
    "start_addr": 16384,
    "first_bank": 0,
    "write_pin": "WR",
    "chip_erase_timeout": 5,
    "read_identifier_at": 16384,
    "mbc": "manual",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          16384,
          240
        ]
      ],
      "read_identifier": [
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          19114,
          144
        ]
      ],
      "read_cfi": [
        [
          19114,
          152
        ]
      ],
      "chip_erase": [
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          19114,
          128
        ],
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          19114,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          19114,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_39SF020A",
    "sourceFile": "fc_DMG_39SF020A.txt",
    "type": "DMG",
    "names": [
      "insideGadgets MegaDuck 32K"
    ],
    "flash_ids": [
      [
        191,
        182
      ]
    ],
    "voltage": 5,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 30,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          144
        ]
      ],
      "chip_erase": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          128
        ],
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_39VF1681",
    "sourceFile": "fc_DMG_39VF1681.txt",
    "type": "DMG",
    "names": [
      "ModRetro Chromatic Cartridge with 39VF1681",
      "ModRetro Chromatic Cartridge with 39VF1682"
    ],
    "flash_ids": [
      [
        191,
        200
      ],
      [
        191,
        201
      ]
    ],
    "flash_size": 2097152,
    "voltage": 3.3,
    "voltage_variants": true,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 30,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "read_cfi": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          152
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          65535,
          65535
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_39VF6401B",
    "sourceFile": "fc_DMG_39VF6401B.txt",
    "type": "DMG",
    "names": [
      "SD007_T40_6401B*CD_71_TS28 with 39VF6401B"
    ],
    "flash_ids": [
      [
        191,
        110
      ]
    ],
    "voltage": 3.3,
    "flash_size": 2097152,
    "start_addr": 16384,
    "first_bank": 0,
    "sector_size": 32768,
    "write_pin": "WR",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          16384,
          240
        ]
      ],
      "read_identifier": [
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          1365,
          144
        ]
      ],
      "read_cfi": [
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          1365,
          152
        ]
      ],
      "sector_erase": [
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          1365,
          128
        ],
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          1365,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_AM29F010_AUDIO",
    "sourceFile": "fc_DMG_AM29F010_AUDIO.txt",
    "type": "DMG",
    "names": [
      "DIY cart with AM29F010 @ AUDIO"
    ],
    "flash_ids": [
      [
        1,
        32
      ]
    ],
    "voltage": 5,
    "flash_size": 131072,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "AUDIO",
    "chip_erase_timeout": 60,
    "mbc": "manual",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          144
        ]
      ],
      "read_cfi": [
        [
          1365,
          152
        ]
      ],
      "chip_erase": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          128
        ],
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_AM29F010_WR",
    "sourceFile": "fc_DMG_AM29F010_WR.txt",
    "type": "DMG",
    "names": [
      "DIY cart with AM29F010 @ WR"
    ],
    "flash_ids": [
      [
        1,
        32
      ]
    ],
    "voltage": 5,
    "flash_size": 131072,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 60,
    "mbc": "manual",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          144
        ]
      ],
      "read_cfi": [
        [
          1365,
          152
        ]
      ],
      "chip_erase": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          128
        ],
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_AM29F016_AUDIO",
    "sourceFile": "fc_DMG_AM29F016_AUDIO.txt",
    "type": "DMG",
    "names": [
      "DIY cart with AM29F016 @ AUDIO"
    ],
    "flash_ids": [
      [
        1,
        173
      ],
      [
        4,
        173
      ]
    ],
    "voltage": 5,
    "flash_size": 2097152,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "AUDIO",
    "sector_size": 65536,
    "chip_erase_timeout": 60,
    "mbc": "manual",
    "command_set": "AMD",
    "enable_pullup_wr": true,
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          144
        ]
      ],
      "read_cfi": [
        [
          1365,
          152
        ]
      ],
      "chip_erase": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          128
        ],
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          128
        ],
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_AM29F016_WR",
    "sourceFile": "fc_DMG_AM29F016_WR.txt",
    "type": "DMG",
    "names": [
      "DIY cart with AM29F016 @ WR",
      "insideGadgets 2 MiB, 32 KiB FRAM, v1.0"
    ],
    "flash_ids": [
      [
        1,
        173
      ],
      [
        4,
        173
      ]
    ],
    "voltage": 5,
    "flash_size": 2097152,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "sector_size": 65536,
    "chip_erase_timeout": 60,
    "mbc": "manual",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          144
        ]
      ],
      "read_cfi": [
        [
          1365,
          152
        ]
      ],
      "chip_erase": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          128
        ],
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          128
        ],
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_AM29F032_AUDIO",
    "sourceFile": "fc_DMG_AM29F032_AUDIO.txt",
    "type": "DMG",
    "names": [
      "insideGadgets 4 MiB, 32 KiB FRAM, MBC3+RTC",
      "DIY cart with AM29F032 @ AUDIO",
      "DIY cart with M29F032D @ AUDIO",
      "DIY cart with MBM29F033C @ AUDIO",
      "DIY cart with MX29F040 @ AUDIO"
    ],
    "flash_ids": [
      [
        4,
        212
      ],
      [
        4,
        212
      ],
      [
        32,
        172
      ],
      [
        4,
        212
      ],
      [
        1,
        65
      ],
      [
        1,
        212
      ],
      [
        194,
        164
      ]
    ],
    "voltage": 5,
    "flash_size": 4194304,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "AUDIO",
    "chip_erase_timeout": 90,
    "sector_size": 65536,
    "mbc": "manual",
    "command_set": "AMD",
    "enable_pullup_wr": true,
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          144
        ]
      ],
      "read_cfi": [
        [
          1365,
          152
        ]
      ],
      "chip_erase": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          128
        ],
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          128
        ],
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_AM29F032_WR",
    "sourceFile": "fc_DMG_AM29F032_WR.txt",
    "type": "DMG",
    "names": [
      "DIY cart with AM29F032 @ WR",
      "DIY cart with MBM29F033C @ WR",
      "DIY cart with MX29F040 @ WR"
    ],
    "flash_ids": [
      [
        4,
        212
      ],
      [
        4,
        212
      ],
      [
        194,
        164
      ]
    ],
    "voltage": 5,
    "flash_size": 4194304,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 90,
    "sector_size": 65536,
    "mbc": "manual",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          144
        ]
      ],
      "read_cfi": [
        [
          1365,
          152
        ]
      ],
      "chip_erase": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          128
        ],
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          128
        ],
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_AM29F040_AUDIO",
    "sourceFile": "fc_DMG_AM29F040_AUDIO.txt",
    "type": "DMG",
    "names": [
      "DIY cart with AM29F040 @ AUDIO"
    ],
    "flash_ids": [
      [
        1,
        164
      ]
    ],
    "voltage": 5,
    "flash_size": 524288,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "AUDIO",
    "chip_erase_timeout": 15,
    "mbc": "manual",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          144
        ]
      ],
      "read_cfi": [
        [
          1365,
          152
        ]
      ],
      "chip_erase": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          128
        ],
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_AM29F040_WR",
    "sourceFile": "fc_DMG_AM29F040_WR.txt",
    "type": "DMG",
    "names": [
      "DIY cart with AM29F040 @ WR"
    ],
    "flash_ids": [
      [
        1,
        164
      ]
    ],
    "voltage": 5,
    "flash_size": 524288,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 15,
    "mbc": "manual",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          144
        ]
      ],
      "read_cfi": [
        [
          1365,
          152
        ]
      ],
      "chip_erase": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          128
        ],
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_AM29F080_AUDIO",
    "sourceFile": "fc_DMG_AM29F080_AUDIO.txt",
    "type": "DMG",
    "names": [
      "DIY cart with AM29F080 @ AUDIO"
    ],
    "flash_ids": [
      [
        32,
        241
      ],
      [
        1,
        213
      ]
    ],
    "voltage": 5,
    "flash_size": 1048576,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "AUDIO",
    "chip_erase_timeout": 60,
    "mbc": "manual",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          144
        ]
      ],
      "read_cfi": [
        [
          1365,
          152
        ]
      ],
      "chip_erase": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          128
        ],
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_AM29F080_WR",
    "sourceFile": "fc_DMG_AM29F080_WR.txt",
    "type": "DMG",
    "names": [
      "DIY cart with AM29F080 @ WR"
    ],
    "flash_ids": [
      [
        32,
        241
      ],
      [
        1,
        213
      ]
    ],
    "voltage": 5,
    "flash_size": 1048576,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 60,
    "mbc": "manual",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          144
        ]
      ],
      "read_cfi": [
        [
          1365,
          152
        ]
      ],
      "chip_erase": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          128
        ],
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_AM29LV160DB",
    "sourceFile": "fc_DMG_AM29LV160DB.txt",
    "type": "DMG",
    "names": [
      "DRV with AM29LV160DB and ALTERA CPLD"
    ],
    "flash_ids": [
      [
        2,
        2,
        74,
        74
      ]
    ],
    "voltage": 3.3,
    "flash_size": 2097152,
    "start_addr": 16384,
    "first_bank": 0,
    "write_pin": "WR",
    "sector_size_from_cfi": true,
    "chip_erase_timeout": 120,
    "mbc": "manual",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          16384,
          240
        ]
      ],
      "read_identifier": [
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          19114,
          144
        ]
      ],
      "read_cfi": [
        [
          19114,
          152
        ]
      ],
      "chip_erase": [
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          19114,
          128
        ],
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          19114,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          19114,
          128
        ],
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "buffer_write": [
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          "SA",
          38
        ],
        [
          "SA",
          "BS"
        ],
        [
          "PA",
          "PD"
        ],
        [
          "SA",
          42
        ]
      ],
      "buffer_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          "PD",
          65535
        ]
      ],
      "single_write": [
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          19114,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_AM29LV160DT",
    "sourceFile": "fc_DMG_AM29LV160DT.txt",
    "type": "DMG",
    "names": [
      "DRV with AM29LV160DT and ALTERA CPLD"
    ],
    "flash_ids": [
      [
        2,
        2,
        196,
        196
      ]
    ],
    "voltage": 3.3,
    "flash_size": 2097152,
    "start_addr": 16384,
    "first_bank": 0,
    "write_pin": "WR",
    "sector_size": [
      [
        65536,
        31
      ],
      [
        32768,
        1
      ],
      [
        8192,
        2
      ],
      [
        16384,
        1
      ]
    ],
    "chip_erase_timeout": 120,
    "mbc": "manual",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          16384,
          240
        ]
      ],
      "read_identifier": [
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          19114,
          144
        ]
      ],
      "read_cfi": [
        [
          19114,
          152
        ]
      ],
      "chip_erase": [
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          19114,
          128
        ],
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          19114,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          19114,
          128
        ],
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "buffer_write": [
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          "SA",
          38
        ],
        [
          "SA",
          "BS"
        ],
        [
          "PA",
          "PD"
        ],
        [
          "SA",
          42
        ]
      ],
      "buffer_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          "PD",
          65535
        ]
      ],
      "single_write": [
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          19114,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_AM29LV160MB",
    "sourceFile": "fc_DMG_AM29LV160MB.txt",
    "type": "DMG",
    "names": [
      "SD007_BV5_V3 with AM29LV160MB",
      "SD007_TSOP_48BALL with L160DB12VI",
      "SD007_TSOP_48BALL with AM29LV160DB",
      "2006_TSOP_64BALL_QFP48 with AL016J55FFAR2",
      "SD007_TSOP_64BALL_SOP28 with unlabeled flash chip",
      "SD007_TSOP_29LV017D with L017D70VC",
      "SD007_TSOP_48BALL with AM29LV160DT",
      "SD007_TSOP_64BALL_SOJ28 with unlabeled flash chip"
    ],
    "flash_ids": [
      [
        2,
        2,
        74,
        74
      ],
      [
        2,
        2,
        74,
        74
      ],
      [
        2,
        2,
        74,
        74
      ],
      [
        2,
        2,
        74,
        74
      ],
      [
        2,
        2,
        74,
        74
      ],
      [
        2,
        200,
        0,
        0
      ],
      [
        2,
        2,
        196,
        196
      ],
      [
        2,
        2,
        74,
        74
      ]
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "flash_size": 2097152,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 70,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_AT49F040_AUDIO",
    "sourceFile": "fc_DMG_AT49F040_AUDIO.txt",
    "type": "DMG",
    "names": [
      "DIY cart with AT49F040 @ AUDIO"
    ],
    "flash_ids": [
      [
        31,
        19
      ]
    ],
    "voltage": 5,
    "flash_size": 524288,
    "start_addr": 0,
    "first_bank": 1,
    "flash_commands_on_bank_1": true,
    "write_pin": "AUDIO",
    "chip_erase_timeout": 15,
    "mbc": "manual",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          144
        ]
      ],
      "chip_erase": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          128
        ],
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_AT49F040_WR",
    "sourceFile": "fc_DMG_AT49F040_WR.txt",
    "type": "DMG",
    "names": [
      "DIY cart with AT49F040 @ WR"
    ],
    "flash_ids": [
      [
        31,
        19
      ]
    ],
    "voltage": 5,
    "flash_size": 524288,
    "start_addr": 0,
    "first_bank": 1,
    "flash_commands_on_bank_1": true,
    "write_pin": "WR",
    "chip_erase_timeout": 15,
    "mbc": "manual",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          144
        ]
      ],
      "chip_erase": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          128
        ],
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_ActionReplay",
    "sourceFile": "fc_DMG_ActionReplay.txt",
    "type": "DMG",
    "names": [
      "Action Replay (Datel Orbit V2)",
      "GameShark (Datel Orbit V2)"
    ],
    "flash_ids": [
      [
        191,
        181,
        255,
        255
      ]
    ],
    "voltage": 5,
    "flash_size": 131072,
    "first_bank": 1,
    "start_addr": 16384,
    "mbc": 517,
    "write_pin": "WR",
    "chip_erase_timeout": 10,
    "read_identifier_at": 16384,
    "command_set": "DATEL_ORBITV2",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "unlock_read": [
        [
          257,
          1,
          1
        ],
        [
          264,
          1,
          1
        ],
        [
          257,
          1,
          1
        ]
      ],
      "unlock": [
        [
          32737,
          2,
          1
        ]
      ],
      "bank_switch": [
        [
          32737,
          "ID"
        ]
      ],
      "read_identifier": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          144
        ]
      ],
      "chip_erase": [
        [
          32737,
          2
        ],
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          128
        ],
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [],
      "single_write_wait_for": []
    }
  },
  {
    "id": "DMG_BV_MBC3000",
    "sourceFile": "fc_DMG_BV_MBC3000.txt",
    "type": "DMG",
    "names": [
      "BennVenn MBC3000 v4 RTC cart"
    ],
    "flash_ids": [
      [
        194,
        194,
        203,
        203
      ],
      [
        194,
        194,
        126,
        126
      ]
    ],
    "voltage": 5,
    "flash_size": 8388608,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "sector_size_from_cfi": true,
    "chip_erase_timeout": 60,
    "mbc": "manual",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "read_cfi": [
        [
          2730,
          152
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_BV_MBC3000_ROM2",
    "sourceFile": "fc_DMG_BV_MBC3000_ROM2.txt",
    "type": "DMG",
    "names": [
      "BennVenn MBC3000 v4 RTC cart (ROM2)"
    ],
    "flash_ids": [
      [
        194,
        194,
        203,
        203
      ],
      [
        194,
        194,
        126,
        126
      ]
    ],
    "voltage": 5,
    "flash_size": 4194304,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "sector_size": 65536,
    "mbc": "manual",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "read_cfi": [
        [
          2730,
          152
        ]
      ],
      "sector_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_ChisFlash-MBC5-MAX_28EW256A",
    "sourceFile": "fc_DMG_ChisFlash-MBC5-MAX_28EW256A.txt",
    "type": "DMG",
    "names": [
      "ChisFlash-MBC5 MAX (32 MiB) (28EW256A)"
    ],
    "flash_id_offsets": [
      0,
      2,
      28
    ],
    "flash_ids": [
      [
        137,
        126,
        34
      ]
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "flash_size": 33554432,
    "buffer_size": 256,
    "start_addr": 0,
    "first_bank": 0,
    "write_pin": "WR",
    "sector_size": 131072,
    "chip_erase_timeout": 1100,
    "mbc": "manual",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "read_cfi": [
        [
          2730,
          152
        ]
      ],
      "sector_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "buffer_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          37
        ],
        [
          "SA",
          "BS"
        ],
        [
          "PA",
          "PD"
        ],
        [
          "SA",
          41
        ]
      ],
      "buffer_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          "PD",
          255
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_ChisFlash-MBC5-MAX_S29GL256N",
    "sourceFile": "fc_DMG_ChisFlash-MBC5-MAX_S29GL256N.txt",
    "type": "DMG",
    "names": [
      "ChisFlash-MBC5 MAX (32 MiB) (S29GL256N)"
    ],
    "flash_id_offsets": [
      0,
      2,
      28
    ],
    "flash_ids": [
      [
        1,
        126,
        34
      ]
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "flash_size": 33554432,
    "buffer_size": 32,
    "start_addr": 0,
    "first_bank": 0,
    "write_pin": "WR",
    "sector_size": 131072,
    "chip_erase_timeout": 600,
    "mbc": "manual",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "read_cfi": [
        [
          2730,
          152
        ]
      ],
      "sector_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "buffer_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          37
        ],
        [
          "SA",
          "BS"
        ],
        [
          "PA",
          "PD"
        ],
        [
          "SA",
          41
        ]
      ],
      "buffer_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          "PD",
          255
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_ChisFlash-MBC5-PLUS",
    "sourceFile": "fc_DMG_ChisFlash-MBC5-PLUS.txt",
    "type": "DMG",
    "names": [
      "ChisFlash-MBC5 PLUS v1.21"
    ],
    "flash_ids": [
      [
        194,
        194,
        126,
        126
      ]
    ],
    "voltage": 3.3,
    "flash_size": 33554432,
    "start_addr": 16384,
    "first_bank": 0,
    "write_pin": "WR",
    "sector_size_from_cfi": true,
    "chip_erase_timeout": 120,
    "mbc": 518,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "buffer_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          37
        ],
        [
          "SA",
          "BS"
        ],
        [
          "PA",
          "PD"
        ],
        [
          "SA",
          41
        ]
      ],
      "buffer_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          "PD",
          65535
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_Dev_E201264",
    "sourceFile": "fc_DMG_Dev_E201264.txt",
    "type": "DMG",
    "names": [
      "DMG-MBC5-32M-FLASH (G/A) Development Cartridge"
    ],
    "flash_ids": [
      [
        176,
        136
      ]
    ],
    "voltage": 5,
    "mbc": 27,
    "flash_size": 4194304,
    "start_addr": 16384,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 100,
    "sector_size": 65536,
    "wait_read_status_register": true,
    "read_identifier_at": 16384,
    "dmg-mbc5-32m-flash": true,
    "set_audio_high": true,
    "command_set": "DMG-MBC5-32M-FLASH",
    "commands": {
      "unlock": [
        [
          8192,
          0,
          1
        ],
        [
          12288,
          0,
          1
        ]
      ],
      "reset": [
        [
          16384,
          255
        ]
      ],
      "read_status_register": [
        [
          16384,
          112
        ]
      ],
      "read_identifier": [
        [
          16384,
          144
        ]
      ],
      "sector_erase": [
        [
          "SA",
          32
        ],
        [
          "SA",
          208
        ],
        [
          "SA",
          112
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          128,
          128
        ]
      ]
    }
  },
  {
    "id": "DMG_Dev_E201264_2",
    "sourceFile": "fc_DMG_Dev_E201264_2.txt",
    "type": "DMG",
    "names": [
      "DMG-MBC5-32M-FLASH (G/A-I) Development Cartridge"
    ],
    "flash_ids": [
      [
        137,
        137,
        20,
        20
      ]
    ],
    "voltage": 5,
    "mbc": 27,
    "flash_size": 4194304,
    "start_addr": 16384,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 100,
    "sector_size": 131072,
    "dmg-mbc5-32m-flash": true,
    "set_audio_high": true,
    "buffer_size": 32,
    "command_set": "INTEL",
    "commands": {
      "unlock": [
        [
          8192,
          0,
          1
        ],
        [
          12288,
          0,
          1
        ]
      ],
      "reset": [
        [
          16384,
          255
        ]
      ],
      "read_status_register": [
        [
          16384,
          112
        ]
      ],
      "read_identifier": [
        [
          16384,
          144
        ]
      ],
      "read_cfi": [
        [
          16384,
          152
        ]
      ],
      "sector_erase": [
        [
          "SA",
          96
        ],
        [
          "SA",
          208
        ],
        [
          "SA",
          32
        ],
        [
          "SA",
          208
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          "SA",
          128,
          255
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          128,
          255
        ]
      ],
      "buffer_write": [
        [
          "SA",
          232
        ],
        [
          "SA",
          "BS"
        ],
        [
          "PA",
          "PD"
        ],
        [
          "SA",
          208
        ],
        [
          "SA",
          255
        ]
      ],
      "buffer_write_wait_for": [
        [
          "SA",
          128,
          255
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          128,
          255
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_Dev_MBC3-FLASH",
    "sourceFile": "fc_DMG_Dev_MBC3-FLASH.txt",
    "type": "DMG",
    "names": [
      "DMG-MBC3-16M-FLASH Development Cartridge"
    ],
    "flash_ids": [
      [
        0,
        [
          176,
          176,
          208,
          208
        ],
        4194304,
        [
          176,
          176,
          208,
          208
        ]
      ]
    ],
    "voltage": 5,
    "mbc": 16,
    "flash_size": 2097152,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 100,
    "sector_size": 65536,
    "dmg-mbc5-32m-flash": true,
    "set_audio_high": true,
    "audio_gates_flash_write": true,
    "status_register_mask": 176,
    "status_register_value": 128,
    "buffer_size": 32,
    "command_set": "INTEL",
    "commands": {
      "unlock": [
        [
          8192,
          0,
          1
        ],
        [
          12288,
          0,
          1
        ]
      ],
      "reset": [
        [
          16384,
          255
        ]
      ],
      "read_status_register": [
        [
          16384,
          112
        ]
      ],
      "read_identifier": [
        [
          16384,
          144
        ]
      ],
      "read_cfi": [
        [
          16384,
          152
        ]
      ],
      "sector_erase": [
        [
          "SA",
          96
        ],
        [
          "SA",
          208
        ],
        [
          "SA",
          32
        ],
        [
          "SA",
          208
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          "SA",
          128,
          255
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          128,
          255
        ]
      ],
      "buffer_write": [
        [
          "SA",
          232
        ],
        [
          "SA",
          "BS"
        ],
        [
          "PA",
          "PD"
        ],
        [
          "SA",
          208
        ],
        [
          "SA",
          255
        ]
      ],
      "buffer_write_wait_for": [
        [
          "SA",
          128,
          255
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          128,
          255
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_Dev_MBC5-32M-R-FLASH",
    "sourceFile": "fc_DMG_Dev_MBC5-32M-R-FLASH.txt",
    "type": "DMG",
    "names": [
      "DMG-MBC5-32M-R-FLASH Development Cartridge"
    ],
    "flash_ids": [
      [
        0,
        [
          176,
          176,
          208,
          208
        ]
      ]
    ],
    "voltage": 5,
    "mbc": 30,
    "flash_size": 4194304,
    "start_addr": 16384,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 100,
    "sector_size": 65536,
    "wait_read_status_register": true,
    "dmg-mbc5-32m-flash": true,
    "set_audio_high": true,
    "status_register_mask": 176,
    "status_register_value": 128,
    "buffer_size": 32,
    "command_set": "INTEL",
    "commands": {
      "unlock": [
        [
          8192,
          0,
          1
        ],
        [
          12288,
          0,
          1
        ]
      ],
      "reset": [
        [
          16384,
          255
        ]
      ],
      "read_status_register": [
        [
          16384,
          112
        ]
      ],
      "read_identifier": [
        [
          16384,
          144
        ]
      ],
      "read_cfi": [
        [
          16384,
          152
        ]
      ],
      "sector_erase": [
        [
          "SA",
          32
        ],
        [
          "SA",
          208
        ],
        [
          "SA",
          112
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          128,
          176
        ]
      ],
      "buffer_write": [
        [
          "SA",
          232
        ],
        [
          "SA",
          "BS"
        ],
        [
          "PA",
          "PD"
        ],
        [
          "SA",
          208
        ],
        [
          "SA",
          255
        ]
      ],
      "buffer_write_wait_for": [
        [
          "SA",
          128,
          176
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          128,
          176
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_Doctor_GB_Card_16M",
    "sourceFile": "fc_DMG_Doctor_GB_Card_16M.txt",
    "type": "DMG",
    "names": [
      "BUNG Doctor GB Card 16M"
    ],
    "flash_ids": [
      [
        194,
        0,
        241,
        0
      ]
    ],
    "voltage": 5,
    "flash_size": 2097152,
    "start_addr": 0,
    "first_bank": 1,
    "mbc": 27,
    "flash_commands_on_bank_1": true,
    "sector_size": 16384,
    "write_pin": "AUDIO",
    "chip_erase_timeout": 15,
    "status_register_mask": 255,
    "status_register_value": 128,
    "command_set": "BUNG_16M",
    "commands": {}
  },
  {
    "id": "DMG_Doctor_GB_Card_4M",
    "sourceFile": "fc_DMG_Doctor_GB_Card_4M.txt",
    "type": "DMG",
    "names": [
      "BUNG Doctor GB Card 4M"
    ],
    "flash_ids": [
      [
        218,
        70
      ]
    ],
    "voltage": 5,
    "flash_size": 524288,
    "start_addr": 0,
    "first_bank": 1,
    "mbc": 27,
    "flash_commands_on_bank_1": true,
    "sector_size": 16384,
    "write_pin": "AUDIO",
    "enable_pullup_wr": true,
    "chip_erase_timeout": 15,
    "command_set": "EEPROM",
    "commands": {
      "reset": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          240
        ]
      ],
      "read_identifier": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          144
        ]
      ],
      "sector_erase": [],
      "sector_erase_wait_for": [],
      "single_write": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_Doctor_GB_Card_64M",
    "sourceFile": "fc_DMG_Doctor_GB_Card_64M.txt",
    "type": "DMG",
    "names": [
      "BUNG Doctor GB Card 64M",
      "Mr Flash 64M"
    ],
    "flash_ids": [
      [
        137,
        137,
        21,
        21
      ],
      [
        137,
        137,
        21,
        21
      ]
    ],
    "voltage": 5,
    "flash_size": 8388608,
    "sector_size": 131072,
    "start_addr": 0,
    "first_bank": 1,
    "mbc": 27,
    "write_pin": "AUDIO",
    "buffer_size": 32,
    "command_set": "INTEL",
    "commands": {
      "reset": [
        [
          0,
          255
        ]
      ],
      "read_identifier": [
        [
          0,
          144
        ]
      ],
      "sector_erase": [
        [
          16384,
          32
        ],
        [
          16384,
          208
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          16384,
          128,
          128
        ]
      ],
      "buffer_write": [
        [
          "SA",
          232
        ],
        [
          "SA",
          "BS"
        ],
        [
          "PA",
          "PD"
        ],
        [
          "SA",
          208
        ],
        [
          "SA",
          255
        ]
      ],
      "buffer_write_wait_for": [
        [
          "SA",
          128,
          255
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          128,
          255
        ],
        [
          null,
          null,
          null
        ]
      ],
      "single_write": [
        [
          "PA",
          112
        ],
        [
          "PA",
          16
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          0,
          128,
          128
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_ES29LV160ET",
    "sourceFile": "fc_DMG_ES29LV160ET.txt",
    "type": "DMG",
    "names": [
      "0883_DRV with ES29LV160ET"
    ],
    "flash_ids": [
      [
        73,
        196,
        0,
        1
      ]
    ],
    "voltage": 3.3,
    "flash_size": 1048576,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 120,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          1365,
          144
        ]
      ],
      "read_cfi": [
        [
          1365,
          152
        ]
      ],
      "chip_erase": [
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          1365,
          128
        ],
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          1365,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          1365,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_FerranteCrafts_32KB",
    "sourceFile": "fc_DMG_FerranteCrafts_32KB.txt",
    "type": "DMG",
    "names": [
      "Ferrante Crafts cart 32 KB",
      "Catskull 32k Gameboy Flash Cart"
    ],
    "flash_ids": [
      [
        191,
        181
      ]
    ],
    "voltage": 5,
    "flash_size": 32768,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "AUDIO",
    "chip_erase_timeout": 20,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          144
        ]
      ],
      "chip_erase": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          128
        ],
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_FerranteCrafts_32KB_2",
    "sourceFile": "fc_DMG_FerranteCrafts_32KB_2.txt",
    "type": "DMG",
    "names": [
      "Ferrante Crafts cart 32 KB V2",
      "marv17 32 KiB Homebrew Flashcard (SST39SF040)"
    ],
    "flash_ids": [
      [
        191,
        255,
        37,
        255
      ],
      [
        191,
        183
      ]
    ],
    "voltage": 5,
    "flash_size": 32768,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 20,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          144
        ]
      ],
      "chip_erase": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          128
        ],
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_FerranteCrafts_64KB",
    "sourceFile": "fc_DMG_FerranteCrafts_64KB.txt",
    "type": "DMG",
    "names": [
      "Ferrante Crafts cart 64 KB"
    ],
    "flash_ids": [
      [
        191,
        181
      ]
    ],
    "voltage": 5,
    "flash_size": 65536,
    "start_addr": 0,
    "first_bank": 1,
    "flash_commands_on_bank_1": true,
    "write_pin": "AUDIO",
    "chip_erase_timeout": 20,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          144
        ]
      ],
      "chip_erase": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          128
        ],
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_GBFlash_MBCX_256M",
    "sourceFile": "fc_DMG_GBFlash_MBCX_256M.txt",
    "type": "DMG",
    "names": [
      "GBFlash MBCX (32 MiB)"
    ],
    "flash_id_offsets": [
      0,
      2,
      28
    ],
    "flash_ids": [
      [
        1,
        126,
        34
      ]
    ],
    "voltage": 3.3,
    "flash_size": 33554432,
    "start_addr": 16384,
    "first_bank": 0,
    "write_pin": "WR",
    "sector_size_from_cfi": true,
    "chip_erase_timeout": 600,
    "mbc": 518,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "buffer_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          37
        ],
        [
          "SA",
          "BS"
        ],
        [
          "PA",
          "PD"
        ],
        [
          "SA",
          41
        ]
      ],
      "buffer_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          "PD",
          65535
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_GBFlash_MBCX_64M",
    "sourceFile": "fc_DMG_GBFlash_MBCX_64M.txt",
    "type": "DMG",
    "names": [
      "GBFlash MBCX (8 MiB)"
    ],
    "flash_id_offsets": [
      0,
      2,
      28
    ],
    "flash_ids": [
      [
        1,
        126,
        16
      ]
    ],
    "voltage": 3.3,
    "flash_size": 8388608,
    "start_addr": 16384,
    "first_bank": 0,
    "write_pin": "WR",
    "sector_size_from_cfi": true,
    "chip_erase_timeout": 240,
    "mbc": 518,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "buffer_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          37
        ],
        [
          "SA",
          "BS"
        ],
        [
          "PA",
          "PD"
        ],
        [
          "SA",
          41
        ]
      ],
      "buffer_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          "PD",
          65535
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_GB_Memory",
    "sourceFile": "fc_DMG_GB_Memory.txt",
    "type": "DMG",
    "names": [
      "NP GB-Memory Cartridge (DMG-MMSA-JPN)"
    ],
    "flash_ids": [
      [
        194,
        137
      ]
    ],
    "voltage": 5,
    "mbc": 261,
    "flash_size": 1048576,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "unlock_before_rom_dump": true,
    "hidden_sector_size": 128,
    "chip_erase_timeout": 10,
    "dmg-mmsa-jpn": true,
    "status_register_mask": 178,
    "status_register_value": 128,
    "command_set": "GBMEMORY",
    "commands": {
      "reset": [
        [
          8448,
          1
        ],
        [
          288,
          2
        ],
        [
          288,
          15
        ],
        [
          293,
          64
        ],
        [
          294,
          128
        ],
        [
          295,
          240
        ],
        [
          319,
          165
        ],
        [
          288,
          4
        ],
        [
          319,
          165
        ],
        [
          288,
          8
        ],
        [
          319,
          165
        ]
      ],
      "unlock": [
        [
          8448,
          1,
          1
        ],
        [
          288,
          9,
          1
        ],
        [
          289,
          170,
          1
        ],
        [
          290,
          85,
          1
        ],
        [
          319,
          165,
          1
        ],
        [
          288,
          17,
          1
        ],
        [
          319,
          165,
          1
        ],
        [
          288,
          10,
          1
        ],
        [
          293,
          98,
          1
        ],
        [
          294,
          4,
          1
        ],
        [
          319,
          165,
          1
        ],
        [
          288,
          2,
          1
        ],
        [
          319,
          165,
          1
        ]
      ],
      "read_identifier": [
        [
          8448,
          1
        ],
        [
          288,
          15
        ],
        [
          293,
          85
        ],
        [
          294,
          85
        ],
        [
          295,
          170
        ],
        [
          319,
          165
        ],
        [
          288,
          15
        ],
        [
          293,
          42
        ],
        [
          294,
          170
        ],
        [
          295,
          85
        ],
        [
          319,
          165
        ],
        [
          288,
          15
        ],
        [
          293,
          85
        ],
        [
          294,
          85
        ],
        [
          295,
          144
        ],
        [
          319,
          165
        ]
      ],
      "read_hidden_sector": [
        [
          8448,
          1
        ],
        [
          288,
          15
        ],
        [
          293,
          85
        ],
        [
          294,
          85
        ],
        [
          295,
          170
        ],
        [
          319,
          165
        ],
        [
          288,
          15
        ],
        [
          293,
          42
        ],
        [
          294,
          170
        ],
        [
          295,
          85
        ],
        [
          319,
          165
        ],
        [
          288,
          15
        ],
        [
          293,
          85
        ],
        [
          294,
          85
        ],
        [
          295,
          119
        ],
        [
          319,
          165
        ],
        [
          288,
          15
        ],
        [
          293,
          85
        ],
        [
          294,
          85
        ],
        [
          295,
          170
        ],
        [
          319,
          165
        ],
        [
          288,
          15
        ],
        [
          293,
          42
        ],
        [
          294,
          170
        ],
        [
          295,
          85
        ],
        [
          319,
          165
        ],
        [
          288,
          15
        ],
        [
          293,
          85
        ],
        [
          294,
          85
        ],
        [
          295,
          119
        ],
        [
          319,
          165
        ]
      ]
    }
  },
  {
    "id": "DMG_GB_Smart_32M",
    "sourceFile": "fc_DMG_GB_Smart_32M.txt",
    "type": "DMG",
    "names": [
      "GB Smart 32M"
    ],
    "flash_ids": [
      [
        137,
        137,
        20,
        20
      ]
    ],
    "voltage": 5,
    "flash_size": 4194304,
    "sector_size": 131072,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "AUDIO",
    "buffer_size": 32,
    "command_set": "INTEL",
    "commands": {
      "reset": [
        [
          0,
          255
        ]
      ],
      "read_identifier": [
        [
          0,
          144
        ]
      ],
      "sector_erase": [
        [
          16384,
          32
        ],
        [
          16384,
          208
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          16384,
          128,
          128
        ]
      ],
      "buffer_write": [
        [
          "SA",
          232
        ],
        [
          "SA",
          "BS"
        ],
        [
          "PA",
          "PD"
        ],
        [
          "SA",
          208
        ],
        [
          "SA",
          255
        ]
      ],
      "buffer_write_wait_for": [
        [
          "SA",
          128,
          255
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          128,
          255
        ],
        [
          null,
          null,
          null
        ]
      ],
      "single_write": [
        [
          "PA",
          112
        ],
        [
          "PA",
          16
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          0,
          128,
          128
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_GL032M11BAIR4",
    "sourceFile": "fc_DMG_GL032M11BAIR4.txt",
    "type": "DMG",
    "names": [
      "SD007_48BALL_64M with GL032M11BAIR4",
      "SD007_48BALL_64M_V2 with GL032M11BAIR4",
      "S29GL032N90T and ALTERA CPLD (MBC5)",
      "29LV320TE and ALTERA CPLD (no PCB text)",
      "SD007_TSOP_64BALL_SOP28_V2 with unlabeled flash chip"
    ],
    "flash_ids": [
      [
        2,
        2,
        125,
        125
      ],
      [
        2,
        2,
        125,
        125
      ],
      [
        2,
        2,
        125,
        125
      ],
      [
        4,
        4,
        245,
        245
      ],
      [
        2,
        2,
        125,
        125
      ]
    ],
    "voltage": 3.3,
    "flash_size": 4194304,
    "start_addr": 16384,
    "first_bank": 0,
    "write_pin": "WR",
    "sector_size_from_cfi": true,
    "chip_erase_timeout": 120,
    "mbc": 27,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          16384,
          240
        ]
      ],
      "read_identifier": [
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          19114,
          144
        ]
      ],
      "read_cfi": [
        [
          19114,
          152
        ]
      ],
      "chip_erase": [
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          19114,
          128
        ],
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          19114,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          19114,
          128
        ],
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "buffer_write": [
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          "SA",
          38
        ],
        [
          "SA",
          "BS"
        ],
        [
          "PA",
          "PD"
        ],
        [
          "SA",
          42
        ]
      ],
      "buffer_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          "PD",
          65535
        ]
      ],
      "single_write": [
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          19114,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_Generic_AUDIO_555_A9",
    "sourceFile": "fc_DMG_Generic_AUDIO_555_A9.txt",
    "type": "DMG",
    "names": [
      "Generic Flash Cartridge (AUDIO/555/A9)"
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "AUDIO",
    "chip_erase_timeout": 120,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          1365,
          144
        ]
      ],
      "read_cfi": [
        [
          1365,
          152
        ]
      ],
      "chip_erase": [
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          1365,
          128
        ],
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          1365,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          1365,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_Generic_AUDIO_555_AA",
    "sourceFile": "fc_DMG_Generic_AUDIO_555_AA.txt",
    "type": "DMG",
    "names": [
      "Generic Flash Cartridge (AUDIO/555/AA)"
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "AUDIO",
    "chip_erase_timeout": 120,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          144
        ]
      ],
      "read_cfi": [
        [
          1365,
          152
        ]
      ],
      "chip_erase": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          128
        ],
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_Generic_AUDIO_AAA_A9",
    "sourceFile": "fc_DMG_Generic_AUDIO_AAA_A9.txt",
    "type": "DMG",
    "names": [
      "Generic Flash Cartridge (AUDIO/AAA/A9)"
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "AUDIO",
    "chip_erase_timeout": 120,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          144
        ]
      ],
      "read_cfi": [
        [
          2730,
          152
        ]
      ],
      "chip_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_Generic_AUDIO_AAA_AA",
    "sourceFile": "fc_DMG_Generic_AUDIO_AAA_AA.txt",
    "type": "DMG",
    "names": [
      "Generic Flash Cartridge (AUDIO/AAA/AA)"
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "AUDIO",
    "chip_erase_timeout": 120,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "read_cfi": [
        [
          2730,
          152
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_Generic_WR_555_A9",
    "sourceFile": "fc_DMG_Generic_WR_555_A9.txt",
    "type": "DMG",
    "names": [
      "Generic Flash Cartridge (WR/555/A9)"
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 120,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          1365,
          144
        ]
      ],
      "read_cfi": [
        [
          1365,
          152
        ]
      ],
      "chip_erase": [
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          1365,
          128
        ],
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          1365,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          1365,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_Generic_WR_555_AA",
    "sourceFile": "fc_DMG_Generic_WR_555_AA.txt",
    "type": "DMG",
    "names": [
      "Generic Flash Cartridge (WR/555/AA)"
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 120,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          144
        ]
      ],
      "read_cfi": [
        [
          1365,
          152
        ]
      ],
      "chip_erase": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          128
        ],
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_Generic_WR_AAA_A9",
    "sourceFile": "fc_DMG_Generic_WR_AAA_A9.txt",
    "type": "DMG",
    "names": [
      "Generic Flash Cartridge (WR/AAA/A9)"
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 120,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          144
        ]
      ],
      "read_cfi": [
        [
          2730,
          152
        ]
      ],
      "chip_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_Generic_WR_AAA_AA",
    "sourceFile": "fc_DMG_Generic_WR_AAA_AA.txt",
    "type": "DMG",
    "names": [
      "Generic Flash Cartridge (WR/AAA/AA)"
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 120,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "read_cfi": [
        [
          2730,
          152
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_HDR_GBD",
    "sourceFile": "fc_DMG_HDR_GBD.txt",
    "type": "DMG",
    "names": [
      "HDR Game Boy Camera Flashcart with AM29F016"
    ],
    "voltage": 5,
    "flash_size": 1048576,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "sector_size": 65536,
    "mbc": 252,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          144
        ]
      ],
      "read_cfi": [
        [
          1365,
          152
        ]
      ],
      "sector_erase": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          128
        ],
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          1365,
          170
        ],
        [
          682,
          85
        ],
        [
          1365,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_HY29F800_AUDIO",
    "sourceFile": "fc_DMG_HY29F800_AUDIO.txt",
    "type": "DMG",
    "names": [
      "DIY cart with HY29F800 @ AUDIO"
    ],
    "voltage": 5,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "AUDIO",
    "chip_erase_timeout": 120,
    "mbc": "manual",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_HY29F800_WR",
    "sourceFile": "fc_DMG_HY29F800_WR.txt",
    "type": "DMG",
    "names": [
      "DIY cart with HY29F800 @ WR"
    ],
    "voltage": 5,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 120,
    "mbc": "manual",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_HY29LV160TT",
    "sourceFile": "fc_DMG_HY29LV160TT.txt",
    "type": "DMG",
    "names": [
      "SD007_BV5_V2 with HY29LV160TT",
      "SD007_TSOP_48BALL_V8 with A29L160HTV-70",
      "SD007_BV5_V3 with HY29LV160BT",
      "SD007_BV5_V3 with 29LV160BE-90PFTN",
      "SD007_TSOP_48BALL with M29W160ET",
      "SD007_48BALL_64M_V2 with M29W160ET",
      "SD007_48BALL_64M_V8 with M29W160ET",
      "SD007_BV5 with 29LV160TE-70PFTN"
    ],
    "flash_ids": [
      [
        174,
        174,
        196,
        196
      ],
      [
        174,
        174,
        196,
        196
      ],
      [
        174,
        174,
        74,
        74
      ],
      [
        4,
        4,
        74,
        74
      ],
      [
        32,
        32,
        196,
        196
      ],
      [
        32,
        32,
        196,
        196
      ],
      [
        32,
        32,
        196,
        196
      ],
      [
        4,
        4,
        196,
        196
      ]
    ],
    "voltage": 3.3,
    "flash_size": 2097152,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 60,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_K8D3216UBC",
    "sourceFile": "fc_DMG_K8D3216UBC.txt",
    "type": "DMG",
    "names": [
      "SD007_TSOP_48BALL with K8D3216UBC"
    ],
    "flash_ids": [
      [
        236,
        236,
        161,
        161
      ]
    ],
    "voltage": 3.3,
    "flash_size": 4194304,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "sector_size": [
      [
        8192,
        8
      ],
      [
        65536,
        63
      ]
    ],
    "chip_erase_timeout": 70,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_K8D3216UTC",
    "sourceFile": "fc_DMG_K8D3216UTC.txt",
    "type": "DMG",
    "names": [
      "SD007_TSOP_48BALL with K8D3216UTC"
    ],
    "flash_ids": [
      [
        236,
        236,
        160,
        160
      ]
    ],
    "voltage": 3.3,
    "flash_size": 4194304,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "sector_size": [
      [
        65536,
        63
      ],
      [
        8192,
        8
      ]
    ],
    "chip_erase_timeout": 70,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_M29W160EB",
    "sourceFile": "fc_DMG_M29W160EB.txt",
    "type": "DMG",
    "names": [
      "GB-M968 with M29W160EB",
      "GB-M968 with 29LV160DB"
    ],
    "flash_ids": [
      [
        32,
        32,
        73,
        73
      ],
      [
        194,
        194,
        196,
        196
      ]
    ],
    "voltage": 3.3,
    "flash_size": 2097152,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "sector_size": [
      [
        16384,
        1
      ],
      [
        8192,
        2
      ],
      [
        32768,
        1
      ],
      [
        65536,
        31
      ]
    ],
    "chip_erase_timeout": 30,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_cfi": [
        [
          170,
          152
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_M29W320CB",
    "sourceFile": "fc_DMG_M29W320CB.txt",
    "type": "DMG",
    "names": [
      "DVP DRV with MX29LV320CB",
      "DVP DRV with MX29LV320CT"
    ],
    "_flash_ids": [
      [
        194,
        194,
        168,
        168
      ],
      [
        194,
        194,
        167,
        167
      ]
    ],
    "voltage": 3.3,
    "flash_size": 4194304,
    "start_addr": 16384,
    "first_bank": 0,
    "write_pin": "WR",
    "read_identifier_at": 16384,
    "enable_pullup_wr": true,
    "sector_size_from_cfi": true,
    "chip_erase_timeout": 60,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          16384,
          240
        ]
      ],
      "read_identifier": [
        [
          19114,
          170
        ],
        [
          17749,
          85
        ],
        [
          19114,
          144
        ]
      ],
      "read_cfi": [
        [
          16554,
          152
        ]
      ],
      "chip_erase": [
        [
          19114,
          170
        ],
        [
          17749,
          85
        ],
        [
          19114,
          128
        ],
        [
          19114,
          170
        ],
        [
          17749,
          85
        ],
        [
          19114,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          19114,
          170
        ],
        [
          17749,
          85
        ],
        [
          19114,
          128
        ],
        [
          19114,
          170
        ],
        [
          17749,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          19114,
          170
        ],
        [
          17749,
          85
        ],
        [
          19114,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_M29W320DT",
    "sourceFile": "fc_DMG_M29W320DT.txt",
    "type": "DMG",
    "names": [
      "SD007_TSOP_29LV017D with M29W320DT",
      "SD007_TSOP_48BALL_V10 with M29W320DT",
      "SD007_TSOP_48BALL_V10 with GL032M10BFIR3",
      "SD007_TSOP_48BALL_V9 with 29LV320CBTC-70G",
      "SD007_TSOP_48BALL_V10 with 29DL32TF-70",
      "SD007_48BALL_SOP28 with M29W320ET"
    ],
    "flash_ids": [
      [
        2,
        2,
        125,
        125
      ],
      [
        32,
        32,
        201,
        201
      ],
      [
        2,
        2,
        125,
        125
      ],
      [
        2,
        2,
        125,
        125
      ],
      [
        4,
        4,
        125,
        125
      ],
      [
        32,
        32,
        85,
        85
      ]
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "flash_size": 4194304,
    "start_addr": 16384,
    "first_bank": 0,
    "write_pin": "WR",
    "sector_size_from_cfi": true,
    "chip_erase_timeout": 120,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          144
        ]
      ],
      "read_cfi": [
        [
          170,
          152
        ]
      ],
      "chip_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_M29W320DT_2",
    "sourceFile": "fc_DMG_M29W320DT_2.txt",
    "type": "DMG",
    "names": [
      "SD007_BV5_DRV with S29GL032M90TFIR4",
      "GB-M968 with MX29LV320ABTC",
      "SD007_BV5_DRV with M29W320DT",
      "Gamebank-web DMG-29W-04 with M29W320ET",
      "Gamebank-web DMG-29W-04 with M29W320EB",
      "Gamebank-web DMG-29W-04 with M29W320DB"
    ],
    "flash_id_offsets": [
      0,
      1,
      2,
      3,
      28,
      30
    ],
    "flash_ids": [
      [
        1,
        1,
        126,
        126,
        26,
        0
      ],
      [
        194,
        194,
        168,
        168
      ],
      [
        32,
        32,
        202,
        202
      ],
      [
        32,
        32,
        86,
        86
      ],
      [
        32,
        32,
        87,
        87
      ],
      [
        32,
        32,
        203,
        203
      ]
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "flash_size": 4194304,
    "start_addr": 16384,
    "first_bank": 0,
    "write_pin": "WR",
    "enable_pullup_wr": true,
    "sector_size_from_cfi": true,
    "chip_erase_timeout": 240,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "buffer_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          37
        ],
        [
          "SA",
          "BS"
        ],
        [
          "PA",
          "PD"
        ],
        [
          "SA",
          41
        ]
      ],
      "buffer_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          "PD",
          65535
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_M29W640",
    "sourceFile": "fc_DMG_M29W640.txt",
    "type": "DMG",
    "names": [
      "SD007_48BALL_64M with M29W640",
      "SD007_BGA48_71TV_T28_DEEP with M29W640",
      "SD007_T40_48BALL_71_TV_TS28 with M29W640"
    ],
    "flash_ids": [
      [
        32,
        0,
        125,
        0
      ],
      [
        32,
        0,
        125,
        0
      ],
      [
        32,
        0,
        125,
        0
      ]
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "flash_size": 4194304,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "sector_size_from_cfi": true,
    "m29w640": true,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          144
        ]
      ],
      "read_cfi": [
        [
          170,
          152
        ]
      ],
      "_chip_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          16
        ]
      ],
      "sector_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "buffer_write": [
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          "SA",
          38
        ],
        [
          "SA",
          "BS"
        ],
        [
          "PA",
          "PD"
        ],
        [
          "SA",
          42
        ]
      ],
      "buffer_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          "PD",
          65535
        ]
      ],
      "single_write": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_M29W640_2",
    "sourceFile": "fc_DMG_M29W640_2.txt",
    "type": "DMG",
    "names": [
      "HC007-BGA-V2 with M29W640"
    ],
    "flash_ids": [
      [
        32,
        0,
        125,
        0
      ]
    ],
    "voltage": 3.3,
    "flash_size": 8388608,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "sector_size_from_cfi": true,
    "m29w640": true,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          144
        ]
      ],
      "read_cfi": [
        [
          170,
          152
        ]
      ],
      "_chip_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          16
        ]
      ],
      "sector_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "buffer_write": [
        [
          19114,
          169
        ],
        [
          17749,
          86
        ],
        [
          "SA",
          38
        ],
        [
          "SA",
          "BS"
        ],
        [
          "PA",
          "PD"
        ],
        [
          "SA",
          42
        ]
      ],
      "buffer_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          "PD",
          65535
        ]
      ],
      "single_write": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_MSP54LV512",
    "sourceFile": "fc_DMG_MSP54LV512.txt",
    "type": "DMG",
    "names": [
      "MSP54LV512 (no PCB text)"
    ],
    "flash_ids": [
      [
        2,
        125,
        0,
        9
      ]
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "flash_size": 33554432,
    "start_addr": 0,
    "first_bank": 1,
    "buffer_size": 32,
    "sector_size": 65536,
    "reset_every": 8388608,
    "mbc": 513,
    "write_pin": "WR",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          1365,
          144
        ]
      ],
      "sector_erase": [
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          1365,
          128
        ],
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "buffer_write": [
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          "SA",
          38
        ],
        [
          "SA",
          "BS"
        ],
        [
          "PA",
          "PD"
        ],
        [
          "SA",
          42
        ]
      ],
      "buffer_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          "PD",
          65535
        ]
      ],
      "single_write": [
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          1365,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_MSP55LV512",
    "sourceFile": "fc_DMG_MSP55LV512.txt",
    "type": "DMG",
    "names": [
      "SD008-6810-512S with MSP55LV512",
      "SD008_512ND_4M with epoxy flash chip",
      "Nameless PCB with epoxy flash chip"
    ],
    "flash_ids": [
      [
        2,
        125,
        0,
        8
      ],
      [
        2,
        125,
        0,
        152
      ],
      [
        4,
        125,
        0,
        152
      ]
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "flash_size": 33554432,
    "start_addr": 0,
    "first_bank": 1,
    "sector_size": 65536,
    "reset_every": 8388608,
    "mbc": 513,
    "write_pin": "WR",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          1365,
          144
        ]
      ],
      "sector_erase": [
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          1365,
          128
        ],
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          1365,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_MX29CL256FH",
    "sourceFile": "fc_DMG_MX29CL256FH.txt",
    "type": "DMG",
    "names": [
      "SD008-6810-V5 with MX29CL256FH"
    ],
    "flash_ids": [
      [
        193,
        193,
        125,
        125
      ]
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "flash_size": 33554432,
    "start_addr": 0,
    "first_bank": 1,
    "chip_erase_timeout": 120,
    "sector_size_from_cfi": true,
    "reset_every": 8388608,
    "mbc": 513,
    "write_pin": "WR",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          144
        ]
      ],
      "read_cfi": [
        [
          170,
          152
        ]
      ],
      "chip_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "buffer_write": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          "SA",
          38
        ],
        [
          "SA",
          "BS"
        ],
        [
          "PA",
          "PD"
        ],
        [
          "SA",
          42
        ]
      ],
      "buffer_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          "PD",
          65535
        ]
      ],
      "single_write": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_MX29GL256EL",
    "sourceFile": "fc_DMG_MX29GL256EL.txt",
    "type": "DMG",
    "names": [
      "SD008-6810-V4 with MX29GL256EL"
    ],
    "flash_ids": [
      [
        243,
        195,
        0,
        1
      ],
      [
        138,
        138,
        0,
        0
      ]
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "flash_size": 33554432,
    "start_addr": 0,
    "first_bank": 1,
    "chip_erase_timeout": 120,
    "reset_every": 8388608,
    "mbc": 513,
    "write_pin": "WR",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_MX29LV160CT",
    "sourceFile": "fc_DMG_MX29LV160CT.txt",
    "type": "DMG",
    "names": [
      "SD007_K8D3216_32M with MX29LV160CT"
    ],
    "flash_ids": [
      [
        193,
        193,
        196,
        196
      ]
    ],
    "voltage": 3.3,
    "flash_size": 2097152,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "sector_size": [
      [
        65536,
        31
      ],
      [
        32768,
        1
      ],
      [
        8192,
        2
      ],
      [
        16384,
        1
      ]
    ],
    "chip_erase_timeout": 60,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_MX29LV320BTC",
    "sourceFile": "fc_DMG_MX29LV320BTC.txt",
    "type": "DMG",
    "names": [
      "SD007_BV5_V2 with MX29LV320BTC",
      "SD007_TSOP_48BALL_V8 with 29LV320CTTC",
      "SD007_TSOP_48BALL_V10 with 29LV320CTXEI"
    ],
    "flash_ids": [
      [
        193,
        193,
        168,
        168
      ],
      [
        193,
        193,
        167,
        167
      ],
      [
        193,
        193,
        167,
        167
      ]
    ],
    "voltage": 3.3,
    "flash_size": 4194304,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 70,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_MX29LV320EB",
    "sourceFile": "fc_DMG_MX29LV320EB.txt",
    "type": "DMG",
    "names": [
      "GBFlash RTC with MX29LV320EB"
    ],
    "flash_id_offsets": [
      0,
      2
    ],
    "flash_ids": [
      [
        194,
        168
      ]
    ],
    "voltage": 5,
    "flash_size": 4194304,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "enable_pullup_wr": true,
    "sector_size": [
      [
        8192,
        8
      ],
      [
        65536,
        63
      ]
    ],
    "chip_erase_timeout": 60,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_MX29LV320ET",
    "sourceFile": "fc_DMG_MX29LV320ET.txt",
    "type": "DMG",
    "names": [
      "DMG-DHCN-20 with MX29LV320ET",
      "DMG-GBRW-50 with MX29LV320ET",
      "BennVenn MBC3000 v5 RTC cart"
    ],
    "flash_ids": [
      [
        194,
        194,
        167,
        167
      ],
      [
        194,
        194,
        167,
        167
      ],
      [
        194,
        194,
        167,
        167
      ]
    ],
    "voltage": 3.3,
    "flash_size": 4194304,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "sector_size": [
      [
        65536,
        63
      ],
      [
        8192,
        8
      ]
    ],
    "chip_erase_timeout": 60,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_MX29LV320ET_2MB",
    "sourceFile": "fc_DMG_MX29LV320ET_2MB.txt",
    "type": "DMG",
    "names": [
      "DMG-GBRW-20 with 29LV320ETMI-70G"
    ],
    "flash_ids": [
      [
        194,
        194,
        167,
        167
      ]
    ],
    "voltage": 3.3,
    "flash_size": 2097152,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "sector_size": [
      [
        65536,
        31
      ],
      [
        8192,
        8
      ]
    ],
    "chip_erase_timeout": 60,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_MX29LV640_AUDIO",
    "sourceFile": "fc_DMG_MX29LV640_AUDIO.txt",
    "type": "DMG",
    "names": [
      "DIY cart with MX29LV640 @ AUDIO"
    ],
    "flash_ids": [
      [
        194,
        194,
        203,
        203
      ]
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "flash_size": 8388608,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "AUDIO",
    "sector_size_from_cfi": true,
    "chip_erase_timeout": 200,
    "mbc": "manual",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "read_cfi": [
        [
          2730,
          152
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_MX29LV640_WR",
    "sourceFile": "fc_DMG_MX29LV640_WR.txt",
    "type": "DMG",
    "names": [
      "DIY cart with MX29LV640 @ WR"
    ],
    "flash_ids": [
      [
        194,
        194,
        203,
        203
      ]
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "flash_size": 8388608,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "sector_size_from_cfi": true,
    "chip_erase_timeout": 200,
    "mbc": "manual",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "read_cfi": [
        [
          2730,
          152
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_S29GL032M90T",
    "sourceFile": "fc_DMG_S29GL032M90T.txt",
    "type": "DMG",
    "names": [
      "SD007_TSOP_29LV017D with S29GL032M90T",
      "SD007_TSOP_48BALL_V9 with 32M29EWB"
    ],
    "flash_ids": [
      [
        2,
        2,
        125,
        125
      ],
      [
        138,
        138,
        125,
        125
      ]
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "flash_size": 4194304,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "sector_size_from_cfi": true,
    "chip_erase_timeout": 120,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          144
        ]
      ],
      "read_cfi": [
        [
          2730,
          152
        ]
      ],
      "chip_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          128
        ],
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "buffer_write": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          "SA",
          38
        ],
        [
          "SA",
          "BS"
        ],
        [
          "PA",
          "PD"
        ],
        [
          "SA",
          42
        ]
      ],
      "buffer_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          "PD",
          65535
        ]
      ],
      "single_write": [
        [
          2730,
          169
        ],
        [
          1365,
          86
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_S29GL032N90T_MBC1",
    "sourceFile": "fc_DMG_S29GL032N90T_MBC1.txt",
    "type": "DMG",
    "names": [
      "S29GL032N90T and ALTERA CPLD (MBC1)"
    ],
    "manual_select": true,
    "voltage": 3.3,
    "flash_size": 524288,
    "start_addr": 16384,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 40,
    "mbc": 3,
    "pulse_reset_after_write": true,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          28672,
          240
        ]
      ],
      "read_identifier": [
        [
          31402,
          169
        ],
        [
          30037,
          86
        ],
        [
          31402,
          144
        ]
      ],
      "read_cfi": [
        [
          31402,
          152
        ]
      ],
      "chip_erase": [
        [
          31402,
          169
        ],
        [
          30037,
          86
        ],
        [
          31402,
          128
        ],
        [
          31402,
          169
        ],
        [
          30037,
          86
        ],
        [
          31402,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          31402,
          169
        ],
        [
          30037,
          86
        ],
        [
          31402,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_S29GL032_B",
    "sourceFile": "fc_DMG_S29GL032_B.txt",
    "type": "DMG",
    "names": [
      "GBFlash RTC with S29GL032 (bottom boot)"
    ],
    "flash_id_offsets": [
      0,
      2,
      28,
      30
    ],
    "flash_ids": [
      [
        1,
        126,
        26,
        0
      ]
    ],
    "voltage": 5,
    "flash_size": 4194304,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "enable_pullup_wr": true,
    "sector_size": [
      [
        8192,
        8
      ],
      [
        65536,
        63
      ]
    ],
    "chip_erase_timeout": 120,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_S29JL032J_B",
    "sourceFile": "fc_DMG_S29JL032J_B.txt",
    "type": "DMG",
    "names": [
      "ModRetro Chromatic Cartridge with S29JL032J (bottom boot)"
    ],
    "flash_id_offsets": [
      0,
      2,
      28,
      30
    ],
    "flash_ids": [
      [
        1,
        126,
        10,
        0
      ],
      [
        1,
        86
      ],
      [
        1,
        83
      ],
      [
        1,
        95
      ]
    ],
    "voltage": 5,
    "flash_size": 4194304,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "enable_pullup_wr": true,
    "sector_size": [
      [
        8192,
        8
      ],
      [
        65536,
        63
      ]
    ],
    "chip_erase_timeout": 60,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_S29JL032J_T",
    "sourceFile": "fc_DMG_S29JL032J_T.txt",
    "type": "DMG",
    "names": [
      "ModRetro Chromatic Cartridge with S29JL032J (top boot)"
    ],
    "flash_id_offsets": [
      0,
      2,
      28,
      30
    ],
    "flash_ids": [
      [
        1,
        126,
        10,
        1
      ],
      [
        1,
        85
      ],
      [
        1,
        80
      ],
      [
        1,
        92
      ]
    ],
    "voltage": 5,
    "flash_size": 4194304,
    "start_addr": 16384,
    "first_bank": 0,
    "write_pin": "WR",
    "sector_size_from_cfi": true,
    "chip_erase_timeout": 60,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "buffer_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          37
        ],
        [
          "SA",
          "BS"
        ],
        [
          "PA",
          "PD"
        ],
        [
          "SA",
          41
        ]
      ],
      "buffer_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          "PD",
          65535
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_SST39SF020_AUDIO",
    "sourceFile": "fc_DMG_SST39SF020_AUDIO.txt",
    "type": "DMG",
    "names": [
      "DIY cart with SST39SF020 @ AUDIO",
      "GB-CART32K-A with SST39SF020A"
    ],
    "flash_ids": [
      [
        191,
        182
      ]
    ],
    "voltage": 5,
    "flash_size": 65536,
    "start_addr": 0,
    "first_bank": 1,
    "flash_commands_on_bank_1": true,
    "write_pin": "AUDIO",
    "chip_erase_timeout": 20,
    "mbc": "manual",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          144
        ]
      ],
      "chip_erase": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          128
        ],
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_SST39SF040_AUDIO",
    "sourceFile": "fc_DMG_SST39SF040_AUDIO.txt",
    "type": "DMG",
    "names": [
      "DIY cart with SST39SF040 @ AUDIO",
      "Ferrante Crafts cart 512 KB"
    ],
    "flash_ids": [
      [
        191,
        183
      ]
    ],
    "voltage": 5,
    "flash_size": 524288,
    "start_addr": 0,
    "first_bank": 1,
    "flash_commands_on_bank_1": true,
    "write_pin": "AUDIO",
    "chip_erase_timeout": 30,
    "mbc": "manual",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          144
        ]
      ],
      "chip_erase": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          128
        ],
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_Sillyhatday_4MB_2x29F016",
    "sourceFile": "fc_DMG_Sillyhatday_4MB_2x29F016.txt",
    "type": "DMG",
    "names": [
      "Sillyhatday MBC5-DUAL-FLASH-4MB"
    ],
    "voltage": 5,
    "flash_size": 8388608,
    "start_addr": 16384,
    "first_bank": 0,
    "write_pin": "AUDIO",
    "chip_erase_timeout": 120,
    "mbc": 27,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          16384,
          240
        ]
      ],
      "read_identifier": [
        [
          17749,
          170
        ],
        [
          17066,
          85
        ],
        [
          17749,
          144
        ]
      ],
      "read_cfi": [
        [
          19114,
          152
        ]
      ],
      "chip_erase": [
        [
          8448,
          0,
          "WR"
        ],
        [
          17749,
          170
        ],
        [
          17066,
          85
        ],
        [
          17749,
          128
        ],
        [
          17749,
          170
        ],
        [
          17066,
          85
        ],
        [
          17749,
          16
        ],
        [
          8448,
          128,
          "WR"
        ],
        [
          17749,
          170
        ],
        [
          17066,
          85
        ],
        [
          17749,
          128
        ],
        [
          17749,
          170
        ],
        [
          17066,
          85
        ],
        [
          17749,
          16
        ],
        [
          8448,
          0,
          "WR"
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          16384,
          255,
          255
        ],
        [
          16384,
          255,
          255
        ]
      ],
      "single_write": [
        [
          17749,
          170
        ],
        [
          17066,
          85
        ],
        [
          17749,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_Sillyhatday_8MB_4x29F016",
    "sourceFile": "fc_DMG_Sillyhatday_8MB_4x29F016.txt",
    "type": "DMG",
    "names": [
      "Sillyhatday MBC5-QUAD-FLASH-8MB"
    ],
    "voltage": 5,
    "flash_size": 8388608,
    "start_addr": 16384,
    "first_bank": 0,
    "write_pin": "AUDIO",
    "chip_erase_timeout": 120,
    "mbc": 27,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          16384,
          240
        ]
      ],
      "read_identifier": [
        [
          17749,
          170
        ],
        [
          17066,
          85
        ],
        [
          17749,
          144
        ]
      ],
      "read_cfi": [
        [
          19114,
          152
        ]
      ],
      "chip_erase": [
        [
          12288,
          0,
          "WR"
        ],
        [
          8448,
          0,
          "WR"
        ],
        [
          17749,
          170
        ],
        [
          17066,
          85
        ],
        [
          17749,
          128
        ],
        [
          17749,
          170
        ],
        [
          17066,
          85
        ],
        [
          17749,
          16
        ],
        [
          12288,
          0,
          "WR"
        ],
        [
          8448,
          128,
          "WR"
        ],
        [
          17749,
          170
        ],
        [
          17066,
          85
        ],
        [
          17749,
          128
        ],
        [
          17749,
          170
        ],
        [
          17066,
          85
        ],
        [
          17749,
          16
        ],
        [
          12288,
          1,
          "WR"
        ],
        [
          8448,
          0,
          "WR"
        ],
        [
          17749,
          170
        ],
        [
          17066,
          85
        ],
        [
          17749,
          128
        ],
        [
          17749,
          170
        ],
        [
          17066,
          85
        ],
        [
          17749,
          16
        ],
        [
          12288,
          1,
          "WR"
        ],
        [
          8448,
          128,
          "WR"
        ],
        [
          17749,
          170
        ],
        [
          17066,
          85
        ],
        [
          17749,
          128
        ],
        [
          17749,
          170
        ],
        [
          17066,
          85
        ],
        [
          17749,
          16
        ],
        [
          12288,
          0,
          "WR"
        ],
        [
          8448,
          0,
          "WR"
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          16384,
          255,
          255
        ],
        [
          null,
          null,
          null
        ],
        [
          16384,
          255,
          255
        ]
      ],
      "single_write": [
        [
          17749,
          170
        ],
        [
          17066,
          85
        ],
        [
          17749,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_Squareboi_4MB_2x2",
    "sourceFile": "fc_DMG_Squareboi_4MB_2x2.txt",
    "type": "DMG",
    "names": [
      "Squareboi 4 MiB (2× 2 MiB)"
    ],
    "voltage": 5,
    "flash_size": 4194304,
    "start_addr": 16384,
    "first_bank": 0,
    "write_pin": "AUDIO",
    "chip_erase_timeout": 120,
    "mbc": 27,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          16384,
          240
        ]
      ],
      "read_identifier": [
        [
          19114,
          170
        ],
        [
          17749,
          85
        ],
        [
          19114,
          144
        ]
      ],
      "read_cfi": [
        [
          19114,
          152
        ]
      ],
      "chip_erase": [
        [
          8448,
          0,
          "WR"
        ],
        [
          19114,
          170
        ],
        [
          17749,
          85
        ],
        [
          19114,
          128
        ],
        [
          19114,
          170
        ],
        [
          17749,
          85
        ],
        [
          19114,
          16
        ],
        [
          8448,
          128,
          "WR"
        ],
        [
          19114,
          170
        ],
        [
          17749,
          85
        ],
        [
          19114,
          128
        ],
        [
          19114,
          170
        ],
        [
          17749,
          85
        ],
        [
          19114,
          16
        ],
        [
          8448,
          0,
          "WR"
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          16384,
          255,
          255
        ],
        [
          16384,
          255,
          255
        ]
      ],
      "single_write": [
        [
          19114,
          170
        ],
        [
          17749,
          85
        ],
        [
          19114,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_TC58FVB016FT",
    "sourceFile": "fc_DMG_TC58FVB016FT.txt",
    "type": "DMG",
    "names": [
      "SD007_T40_64BALL_TSOP28 with TC58FVB016FT-85",
      "SD007_T40_64BALL_S71_TV_TS28 with TC58FVB016FT-85",
      "SD007_T40_64BALL_SOJ28 with 29LV016T",
      "SD007_T40_64BALL_TSOP28 with 29LV016T"
    ],
    "flash_ids": [
      [
        152,
        69,
        0,
        42
      ],
      [
        152,
        69,
        0,
        42
      ],
      [
        4,
        199,
        0,
        0
      ],
      [
        4,
        199,
        0,
        0
      ]
    ],
    "voltage": 5,
    "flash_size": 2097152,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 60,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          1365,
          144
        ]
      ],
      "chip_erase": [
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          1365,
          128
        ],
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          1365,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          1365,
          169
        ],
        [
          682,
          86
        ],
        [
          1365,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_XploderGB",
    "sourceFile": "fc_DMG_XploderGB.txt",
    "type": "DMG",
    "names": [
      "BLAZE Xploder GB"
    ],
    "flash_ids": [
      [
        191,
        16,
        255,
        255
      ]
    ],
    "voltage": 5,
    "flash_size": 262144,
    "start_addr": 16384,
    "first_bank": 1,
    "flash_commands_on_bank_1": true,
    "mbc": 515,
    "write_pin": "WR",
    "read_identifier_at": 16384,
    "sector_size": 16384,
    "command_set": "BLAZE_XPLODER",
    "commands": {
      "reset": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          240
        ]
      ],
      "unlock_read": [
        [
          258,
          1,
          1
        ]
      ],
      "unlock": [
        [
          6,
          1,
          1
        ]
      ],
      "bank_switch": [
        [
          6,
          "ID"
        ]
      ],
      "read_identifier": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          144
        ]
      ],
      "sector_erase": [],
      "sector_erase_wait_for": [],
      "single_write": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_iG_1MB",
    "sourceFile": "fc_DMG_iG_1MB.txt",
    "type": "DMG",
    "names": [
      "insideGadgets 1 MiB, 128 KiB SRAM"
    ],
    "flash_ids": [
      [
        194,
        194,
        88,
        88
      ],
      [
        194,
        194,
        214,
        214
      ]
    ],
    "voltage": 5,
    "flash_size": 1048576,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 120,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_iG_1MB_2",
    "sourceFile": "fc_DMG_iG_1MB_2.txt",
    "type": "DMG",
    "names": [
      "insideGadgets 1 MiB, 32 KiB FRAM v2.0"
    ],
    "flash_ids": [],
    "voltage": 5,
    "flash_size": 1048576,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 120,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_iG_2MB",
    "sourceFile": "fc_DMG_iG_2MB.txt",
    "type": "DMG",
    "names": [
      "insideGadgets 2 MiB, 128 KiB SRAM/32 KiB FRAM"
    ],
    "flash_ids": [
      [
        1,
        1,
        210,
        210
      ]
    ],
    "voltage": 5,
    "flash_size": 2097152,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 120,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_iG_2MB_2",
    "sourceFile": "fc_DMG_iG_2MB_2.txt",
    "type": "DMG",
    "names": [
      "insideGadgets 2 MiB, 128 KiB SRAM/32 KiB FRAM (2)"
    ],
    "flash_ids": [
      [
        1,
        1,
        216,
        216
      ]
    ],
    "voltage": 5,
    "flash_size": 2097152,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "sector_size": [
      [
        16384,
        1
      ],
      [
        8192,
        2
      ],
      [
        32768,
        1
      ],
      [
        65536,
        31
      ]
    ],
    "chip_erase_timeout": 120,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_iG_2MB_WT",
    "sourceFile": "fc_DMG_iG_2MB_WT.txt",
    "type": "DMG",
    "names": [
      "insideGadgets 2 MiB, Wisdom Tree"
    ],
    "voltage": 5,
    "flash_size": 2097152,
    "start_addr": 0,
    "first_bank": 0,
    "mbc": 514,
    "write_pin": "AUDIO",
    "chip_erase_timeout": 120,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_iG_32KB",
    "sourceFile": "fc_DMG_iG_32KB.txt",
    "type": "DMG",
    "names": [
      "insideGadgets 32 KiB"
    ],
    "flash_ids": [
      [
        191,
        181,
        1,
        255
      ]
    ],
    "voltage": 5,
    "flash_size": 32768,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 20,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          144
        ]
      ],
      "chip_erase": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          128
        ],
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_iG_4MB",
    "sourceFile": "fc_DMG_iG_4MB.txt",
    "type": "DMG",
    "names": [
      "insideGadgets 4 MiB (S29GL032M)",
      "ModRetro Chromatic Cartridge with IS29GL032"
    ],
    "flash_id_offsets": [
      0,
      2,
      28
    ],
    "flash_ids": [
      [
        1,
        126,
        28
      ],
      [
        1,
        126,
        29
      ],
      [
        1,
        126,
        26
      ],
      [
        157,
        126,
        29
      ],
      [
        157,
        126,
        26
      ]
    ],
    "voltage": 5,
    "flash_size": 4194304,
    "start_addr": 16384,
    "first_bank": 0,
    "write_pin": "WR",
    "sector_size_from_cfi": true,
    "chip_erase_timeout": 150,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "buffer_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          37
        ],
        [
          "SA",
          "BS"
        ],
        [
          "PA",
          "PD"
        ],
        [
          "SA",
          41
        ]
      ],
      "buffer_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          "PD",
          65535
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_iG_4MB_2",
    "sourceFile": "fc_DMG_iG_4MB_2.txt",
    "type": "DMG",
    "names": [
      "insideGadgets 4 MiB (S29JL032J)"
    ],
    "flash_ids": [
      [
        1,
        1,
        86,
        86
      ]
    ],
    "voltage": 5,
    "flash_size": 4194304,
    "start_addr": 16384,
    "first_bank": 0,
    "write_pin": "WR",
    "sector_size_from_cfi": true,
    "chip_erase_timeout": 60,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_iG_4MB_2x2",
    "sourceFile": "fc_DMG_iG_4MB_2x2.txt",
    "type": "DMG",
    "names": [
      "insideGadgets 4 MiB (2× 2 MiB), 32 KiB FRAM, MBC5"
    ],
    "voltage": 5,
    "flash_size": 4194304,
    "start_addr": 16384,
    "first_bank": 0,
    "write_pin": "WR",
    "chip_erase_timeout": 120,
    "mbc": 27,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          16384,
          240
        ]
      ],
      "read_identifier": [
        [
          19114,
          170
        ],
        [
          17749,
          85
        ],
        [
          19114,
          144
        ]
      ],
      "chip_erase": [
        [
          8448,
          0
        ],
        [
          19114,
          170
        ],
        [
          17749,
          85
        ],
        [
          19114,
          128
        ],
        [
          19114,
          170
        ],
        [
          17749,
          85
        ],
        [
          19114,
          16
        ],
        [
          8448,
          128
        ],
        [
          19114,
          170
        ],
        [
          17749,
          85
        ],
        [
          19114,
          128
        ],
        [
          19114,
          170
        ],
        [
          17749,
          85
        ],
        [
          19114,
          16
        ],
        [
          8448,
          0
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          16384,
          255,
          255
        ],
        [
          16384,
          255,
          255
        ]
      ],
      "single_write": [
        [
          19114,
          170
        ],
        [
          17749,
          85
        ],
        [
          19114,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_iG_4MB_3",
    "sourceFile": "fc_DMG_iG_4MB_3.txt",
    "type": "DMG",
    "names": [
      "insideGadgets 4 MiB (MX29LV320ET)"
    ],
    "flash_ids": [
      [
        194,
        194,
        167,
        167
      ]
    ],
    "voltage": 5,
    "flash_size": 4194304,
    "start_addr": 0,
    "first_bank": 1,
    "write_pin": "WR",
    "chip_erase_timeout": 60,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_iG_512KB",
    "sourceFile": "fc_DMG_iG_512KB.txt",
    "type": "DMG",
    "names": [
      "insideGadgets 128/256/512 KiB"
    ],
    "flash_ids": [
      [
        191,
        181
      ],
      [
        191,
        182
      ],
      [
        191,
        183
      ]
    ],
    "voltage": 5,
    "start_addr": 0,
    "first_bank": 1,
    "flash_commands_on_bank_1": true,
    "write_pin": "AUDIO",
    "chip_erase_timeout": 30,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          144
        ]
      ],
      "chip_erase": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          128
        ],
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "single_write": [
        [
          21845,
          170
        ],
        [
          10922,
          85
        ],
        [
          21845,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_iG_8MB",
    "sourceFile": "fc_DMG_iG_8MB.txt",
    "type": "DMG",
    "names": [
      "insideGadgets 8 MiB",
      "FunnyPlaying MidnightTrace Flash Cart"
    ],
    "flash_id_offsets": [
      0,
      2,
      28
    ],
    "flash_ids": [
      [
        1,
        126,
        16
      ]
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "flash_size": 8388608,
    "start_addr": 16384,
    "first_bank": 0,
    "write_pin": "WR",
    "sector_size_from_cfi": true,
    "chip_erase_timeout": 240,
    "mbc": "manual",
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          240
        ]
      ],
      "read_identifier": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          144
        ]
      ],
      "chip_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          16
        ]
      ],
      "chip_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          0,
          255,
          255
        ]
      ],
      "sector_erase": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          128
        ],
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          48
        ]
      ],
      "sector_erase_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          255,
          255
        ]
      ],
      "buffer_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          "SA",
          37
        ],
        [
          "SA",
          "BS"
        ],
        [
          "PA",
          "PD"
        ],
        [
          "SA",
          41
        ]
      ],
      "buffer_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          "PD",
          65535
        ]
      ],
      "single_write": [
        [
          2730,
          170
        ],
        [
          1365,
          85
        ],
        [
          2730,
          160
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ]
      ]
    }
  },
  {
    "id": "DMG_iG_Power_Cart",
    "sourceFile": "fc_DMG_iG_Power_Cart.txt",
    "type": "DMG",
    "names": [
      "insideGadgets Power Cart 1 MiB, 128 KiB SRAM"
    ],
    "voltage": 5,
    "write_pin": "",
    "command_set": "",
    "commands": {}
  }
];
