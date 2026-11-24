/*!
 * Flashcart profile data based on ChisFlash-Tools-Exp (https://github.com/ChisLightyear/ChisFlash-Tools-Exp)
 * using the FlashGBX (https://github.com/Lesserkuma/FlashGBX) profile schema.
 * Copyright (C) Lesserkuma — Licensed under GNU General Public License v3.0 (GPL-3.0).
 */
/* eslint-disable */
import type { FlashcartProfile } from '@/types/flashcart-profile';

export const FLASHCART_PROFILES_LICENSE_NOTICE = "Flashcart profile data based on ChisFlash-Tools-Exp (https://github.com/ChisLightyear/ChisFlash-Tools-Exp)\nusing the FlashGBX (https://github.com/Lesserkuma/FlashGBX) profile schema.\nCopyright (C) Lesserkuma — Licensed under GNU General Public License v3.0 (GPL-3.0).";

export const DMG_FLASHCART_PROFILES: readonly FlashcartProfile[] = [
  {
    "id": "DMG_ChisFlash-MBC5-8M_MX29GL640E_B",
    "sourceFile": "fc_DMG_ChisFlash-MBC5-8M_MX29GL640E_B.txt",
    "type": "DMG",
    "names": [
      "ChisFlash-MBC5 (8 MiB) (MX29GL640E T/B Bottom)"
    ],
    "flash_id_offsets": [
      0,
      2,
      28,
      30
    ],
    "flash_ids": [
      [
        194,
        126,
        16,
        0
      ]
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "flash_size": 8388608,
    "buffer_size": 32,
    "start_addr": 0,
    "first_bank": 0,
    "write_pin": "WR",
    "sector_size": [
      [
        8192,
        8
      ],
      [
        65536,
        127
      ]
    ],
    "chip_erase_timeout": 180,
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
    "id": "DMG_ChisFlash-MBC5-8M_MX29GL640E_T",
    "sourceFile": "fc_DMG_ChisFlash-MBC5-8M_MX29GL640E_T.txt",
    "type": "DMG",
    "names": [
      "ChisFlash-MBC5 (8 MiB) (MX29GL640E T/B Top)"
    ],
    "flash_id_offsets": [
      0,
      2,
      28,
      30
    ],
    "flash_ids": [
      [
        194,
        126,
        16,
        1
      ]
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "flash_size": 8388608,
    "buffer_size": 32,
    "start_addr": 0,
    "first_bank": 0,
    "write_pin": "WR",
    "sector_size": [
      [
        65536,
        127
      ],
      [
        8192,
        8
      ]
    ],
    "chip_erase_timeout": 180,
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
    "id": "DMG_ChisFlash-MBC5-8M_MX29GL640E_U",
    "sourceFile": "fc_DMG_ChisFlash-MBC5-8M_MX29GL640E_U.txt",
    "type": "DMG",
    "names": [
      "ChisFlash-MBC5 (8 MiB) (MX29GL640E H/L)"
    ],
    "flash_id_offsets": [
      0,
      2,
      28,
      30
    ],
    "flash_ids": [
      [
        194,
        126,
        12,
        1
      ]
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "flash_size": 8388608,
    "buffer_size": 32,
    "start_addr": 0,
    "first_bank": 0,
    "write_pin": "WR",
    "sector_size": 65536,
    "chip_erase_timeout": 180,
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
    "id": "DMG_ChisFlash-MBC5-8M_MX29LV640EB",
    "sourceFile": "fc_DMG_ChisFlash-MBC5-8M_MX29LV640EB.txt",
    "type": "DMG",
    "names": [
      "ChisFlash-MBC5 (8 MiB) (MX29LV640EB)"
    ],
    "flash_id_offsets": [
      0,
      2
    ],
    "flash_ids": [
      [
        194,
        203
      ]
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "flash_size": 8388608,
    "start_addr": 0,
    "first_bank": 0,
    "write_pin": "WR",
    "sector_size": [
      [
        8192,
        8
      ],
      [
        65536,
        127
      ]
    ],
    "chip_erase_timeout": 180,
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
    "id": "DMG_ChisFlash-MBC5-8M_MX29LV640ET",
    "sourceFile": "fc_DMG_ChisFlash-MBC5-8M_MX29LV640ET.txt",
    "type": "DMG",
    "names": [
      "ChisFlash-MBC5 (8 MiB) (MX29LV640ET)"
    ],
    "flash_id_offsets": [
      0,
      2
    ],
    "flash_ids": [
      [
        194,
        201
      ]
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "flash_size": 8388608,
    "start_addr": 0,
    "first_bank": 0,
    "write_pin": "WR",
    "sector_size": [
      [
        65536,
        127
      ],
      [
        8192,
        8
      ]
    ],
    "chip_erase_timeout": 180,
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
    "id": "DMG_ChisFlash-MBC5-8M_S29GL064N_B",
    "sourceFile": "fc_DMG_ChisFlash-MBC5-8M_S29GL064N_B.txt",
    "type": "DMG",
    "names": [
      "ChisFlash-MBC5 (8 MiB) (S29GL064N Model 04)"
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
        16,
        0
      ]
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "flash_size": 8388608,
    "buffer_size": 32,
    "start_addr": 0,
    "first_bank": 0,
    "write_pin": "WR",
    "sector_size": [
      [
        8192,
        8
      ],
      [
        65536,
        127
      ]
    ],
    "chip_erase_timeout": 180,
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
    "id": "DMG_ChisFlash-MBC5-8M_S29GL064N_T",
    "sourceFile": "fc_DMG_ChisFlash-MBC5-8M_S29GL064N_T.txt",
    "type": "DMG",
    "names": [
      "ChisFlash-MBC5 (8 MiB) (S29GL064N Model 03)"
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
        16,
        1
      ]
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "flash_size": 8388608,
    "buffer_size": 32,
    "start_addr": 0,
    "first_bank": 0,
    "write_pin": "WR",
    "sector_size": [
      [
        65536,
        127
      ],
      [
        8192,
        8
      ]
    ],
    "chip_erase_timeout": 180,
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
    "id": "DMG_ChisFlash-MBC5-8M_S29GL064N_U",
    "sourceFile": "fc_DMG_ChisFlash-MBC5-8M_S29GL064N_U.txt",
    "type": "DMG",
    "names": [
      "ChisFlash-MBC5 (8 MiB) (S29GL064N 01/02/V1/V2)",
      "ChisFlash-MBC5 (8 MiB) (S29GL064N 06/07/V6/V7)"
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
        12,
        1
      ],
      [
        1,
        126,
        19,
        1
      ]
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "flash_size": 8388608,
    "buffer_size": 32,
    "start_addr": 0,
    "first_bank": 0,
    "write_pin": "WR",
    "sector_size": 65536,
    "chip_erase_timeout": 180,
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
    "id": "DMG_ChisFlash-MBC5-MAX_28EW256A",
    "sourceFile": "fc_DMG_ChisFlash-MBC5-MAX_28EW256A.txt",
    "type": "DMG",
    "names": [
      "ChisFlash-MBC5 MAX (32 MiB) (JS28F256M29EWL/EWH / MT28EW256ABA)"
    ],
    "flash_id_offsets": [
      0,
      2,
      28,
      30
    ],
    "flash_ids": [
      [
        137,
        126,
        34,
        1
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
    "id": "DMG_ChisFlash-MBC5-MAX_IS29GL256",
    "sourceFile": "fc_DMG_ChisFlash-MBC5-MAX_IS29GL256.txt",
    "type": "DMG",
    "names": [
      "ChisFlash-MBC5 MAX (32 MiB) (IS29GL256)"
    ],
    "flash_id_offsets": [
      0,
      2,
      28,
      30
    ],
    "flash_ids": [
      [
        157,
        126,
        34,
        1
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
    "id": "DMG_ChisFlash-MBC5-MAX_M29W256G",
    "sourceFile": "fc_DMG_ChisFlash-MBC5-MAX_M29W256G.txt",
    "type": "DMG",
    "names": [
      "ChisFlash-MBC5 MAX (32 MiB) (M29W256GH/GL)"
    ],
    "flash_id_offsets": [
      0,
      2,
      28,
      30
    ],
    "flash_ids": [
      [
        32,
        126,
        34,
        1
      ]
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "flash_size": 33554432,
    "buffer_size": 64,
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
    "id": "DMG_ChisFlash-MBC5-MAX_MX29GL256E",
    "sourceFile": "fc_DMG_ChisFlash-MBC5-MAX_MX29GL256E.txt",
    "type": "DMG",
    "names": [
      "ChisFlash-MBC5 MAX (32 MiB) (MX29GL256E/F)"
    ],
    "flash_id_offsets": [
      0,
      2,
      28,
      30
    ],
    "flash_ids": [
      [
        194,
        126,
        34,
        1
      ]
    ],
    "voltage": 3.3,
    "voltage_variants": true,
    "flash_size": 33554432,
    "buffer_size": 64,
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
    "id": "DMG_ChisFlash-MBC5-MAX_S29GL256N",
    "sourceFile": "fc_DMG_ChisFlash-MBC5-MAX_S29GL256N.txt",
    "type": "DMG",
    "names": [
      "ChisFlash-MBC5 MAX (32 MiB) (S29GL256N/P)"
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
        34,
        1
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
  }
];
