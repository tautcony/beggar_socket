/*!
 * Flashcart profile data converted from FlashGBX (https://github.com/Lesserkuma/FlashGBX).
 * Copyright (C) Lesserkuma — Licensed under GNU General Public License v3.0 (GPL-3.0).
 */
/* eslint-disable */
import type { FlashcartProfile } from '@/types/flashcart-profile';

export const FLASHCART_PROFILES_LICENSE_NOTICE = "Flashcart profile data converted from FlashGBX (https://github.com/Lesserkuma/FlashGBX).\nCopyright (C) Lesserkuma — Licensed under GNU General Public License v3.0 (GPL-3.0).";

export const AGB_FLASHCART_PROFILES: readonly FlashcartProfile[] = [
  {
    "id": "AGB_128W30B",
    "sourceFile": "fc_AGB_128W30B.txt",
    "type": "AGB",
    "names": [
      "GE28F128W30 with 128W30B"
    ],
    "flash_ids": [
      [
        138,
        0,
        87,
        136
      ]
    ],
    "voltage": 3.3,
    "flash_size": 16777216,
    "sector_size": [
      [
        8192,
        8
      ],
      [
        65536,
        255
      ]
    ],
    "reset_every": 524288,
    "command_set": "INTEL",
    "commands": {
      "reset": [
        [
          0,
          80
        ],
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
          null,
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
          65535
        ]
      ],
      "single_write": [
        [
          0,
          112
        ],
        [
          0,
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
    "id": "AGB_256L30B",
    "sourceFile": "fc_AGB_256L30B.txt",
    "type": "AGB",
    "names": [
      "28F256L03B-DRV with 256L30B",
      "4400 with 4400L0ZDQ0",
      "4444-39VF512 with 4444LLZBBO"
    ],
    "flash_ids": [
      [
        138,
        0,
        21,
        136
      ],
      [
        138,
        0,
        21,
        136
      ],
      [
        138,
        0,
        21,
        136
      ]
    ],
    "voltage": 3.3,
    "flash_size": 33554432,
    "sector_size": [
      [
        32768,
        4
      ],
      [
        131072,
        255
      ]
    ],
    "reset_every": 2097152,
    "command_set": "INTEL",
    "commands": {
      "reset": [
        [
          0,
          80
        ],
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
      "read_cfi": [
        [
          0,
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
          null,
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
          65535
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
          65535
        ],
        [
          null,
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
          65535
        ],
        [
          null,
          null,
          null
        ]
      ],
      "single_write": [
        [
          0,
          112
        ],
        [
          0,
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
    "id": "AGB_26L6420MC-90",
    "sourceFile": "fc_AGB_26L6420MC-90.txt",
    "type": "AGB",
    "names": [
      "B11 with 26L6420MC-90"
    ],
    "flash_ids": [
      [
        194,
        0,
        252,
        34
      ]
    ],
    "voltage": 3.3,
    "flash_size": 8388608,
    "chip_erase_timeout": 200,
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
          170,
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
    "id": "AGB_29GL128F",
    "sourceFile": "fc_AGB_29GL128F.txt",
    "type": "AGB",
    "names": [
      "AGB-E05-01 with MX29GL128FHT2I-90G"
    ],
    "flash_ids": [
      [
        193,
        125,
        34,
        34,
        34
      ]
    ],
    "flash_id_offsets": [
      0,
      2,
      3,
      28,
      29
    ],
    "voltage": 3.3,
    "flash_size": 16777216,
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
          65535,
          65535
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
          65535,
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
    "id": "AGB_29GL256E",
    "sourceFile": "fc_AGB_29GL256E.txt",
    "type": "AGB",
    "names": [
      "AGB-E05-01 with MX29GL256EHT2I-90Q"
    ],
    "flash_ids": [
      [
        193,
        125,
        34,
        33,
        34
      ]
    ],
    "flash_id_offsets": [
      0,
      2,
      3,
      28,
      29
    ],
    "voltage": 3.3,
    "flash_size": 33554432,
    "sector_size_from_cfi": true,
    "chip_erase_timeout": 300,
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
          65535,
          65535
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
          65535,
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
    "id": "AGB_29LV128DB",
    "sourceFile": "fc_AGB_29LV128DB.txt",
    "type": "AGB",
    "names": [
      "29LV128DBT2C-90Q and ALTERA CPLD"
    ],
    "flash_ids": [
      [
        194,
        0,
        122,
        34
      ]
    ],
    "voltage": 3.3,
    "flash_size": 16777216,
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
      "read_cfi": [
        [
          170,
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
          65535,
          65535
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
    "id": "AGB_29LV128DT",
    "sourceFile": "fc_AGB_29LV128DT.txt",
    "type": "AGB",
    "names": [
      "AGB-E08-09 with 29LV128DTMC-90Q",
      "AGB-E05-06L with 29LV128DBT2C-90Q"
    ],
    "flash_ids": [
      [
        193,
        0,
        125,
        34
      ],
      [
        193,
        0,
        121,
        34
      ]
    ],
    "voltage": 3.3,
    "flash_size": 16777216,
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
          65535,
          65535
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
          65535,
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
    "id": "AGB_3DMemory",
    "sourceFile": "fc_AGB_3DMemory.txt",
    "type": "AGB",
    "names": [
      "3D Memory Cartridge (GBA Video)"
    ],
    "voltage": 3.3,
    "3d_memory": true,
    "command_set": "3DMEMORY",
    "commands": {}
  },
  {
    "id": "AGB_4050M0Y0Q0",
    "sourceFile": "fc_AGB_4050M0Y0Q0.txt",
    "type": "AGB",
    "names": [
      "4050M0Y0Q0-39VF512 with 4050M0Y0Q0",
      "0121 with 0121M0Y0BE"
    ],
    "flash_ids": [
      [
        138,
        0,
        2,
        137
      ],
      [
        138,
        0,
        125,
        136
      ]
    ],
    "voltage": 3.3,
    "flash_size": 33554432,
    "reset_every": 4194304,
    "sector_size_from_cfi": true,
    "command_set": "INTEL",
    "commands": {
      "reset": [
        [
          0,
          80
        ],
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
          null,
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
          "SA",
          234
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
        ],
        [
          "SA",
          128,
          128
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
    "id": "AGB_6600M0U0BE",
    "sourceFile": "fc_AGB_6600M0U0BE.txt",
    "type": "AGB",
    "names": [
      "100BS6600_48BALL_V4 with 6600M0U0BE",
      "F0088_2G_BGA48 with F0088H0"
    ],
    "flash_ids": [
      [
        138,
        0,
        176,
        136
      ],
      [
        138,
        0,
        176,
        136
      ]
    ],
    "voltage": 3.3,
    "flash_size": 268435456,
    "flash_bank_size": 33554432,
    "flash_bank_select_type": 1,
    "sector_size": 262144,
    "reset_every": 4194304,
    "buffer_size": 1024,
    "command_set": "INTEL",
    "commands": {
      "reset": [
        [
          0,
          80
        ],
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
          null,
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
          "SA",
          234
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
        ],
        [
          "SA",
          128,
          128
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
    "id": "AGB_AR_SST39VF800A",
    "sourceFile": "fc_AGB_AR_SST39VF800A.txt",
    "type": "AGB",
    "names": [
      "Action Replay Ultimate Codes (SST39VF800A)"
    ],
    "flash_ids": [
      [
        191,
        0,
        129,
        39
      ]
    ],
    "voltage": 3.3,
    "flash_size": 1048576,
    "chip_erase_timeout": 10,
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
          43690,
          170
        ],
        [
          21845,
          85
        ],
        [
          43690,
          144
        ]
      ],
      "read_cfi": [
        [
          43690,
          170
        ],
        [
          21845,
          85
        ],
        [
          43690,
          152
        ]
      ],
      "chip_erase": [
        [
          43690,
          170
        ],
        [
          21845,
          85
        ],
        [
          43690,
          128
        ],
        [
          43690,
          170
        ],
        [
          21845,
          85
        ],
        [
          43690,
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
          43690,
          170
        ],
        [
          21845,
          85
        ],
        [
          43690,
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
    "id": "AGB_Dev_E201629_128M",
    "sourceFile": "fc_AGB_Dev_E201629_128M.txt",
    "type": "AGB",
    "names": [
      "Development AGB Cartridge 64M Flash, E201629 (128M)"
    ],
    "flash_ids": [
      [
        176,
        0,
        226,
        0
      ]
    ],
    "voltage": 3.3,
    "flash_size": 16777216,
    "chip_erase_timeout": 100,
    "wait_read_status_register": true,
    "set_irq_high": true,
    "reset_every": 4194304,
    "command_set": "SHARP",
    "commands": {
      "reset": [
        [
          0,
          80
        ],
        [
          0,
          255
        ]
      ],
      "read_status_register": [
        [
          0,
          112
        ]
      ],
      "read_identifier": [
        [
          0,
          144
        ]
      ],
      "chip_erase": [
        [
          0,
          48
        ],
        [
          0,
          208
        ],
        [
          4194304,
          48
        ],
        [
          4194304,
          208
        ],
        [
          8388608,
          48
        ],
        [
          8388608,
          208
        ],
        [
          12582912,
          48
        ],
        [
          12582912,
          208
        ],
        [
          0,
          112
        ],
        [
          4194304,
          112
        ],
        [
          8388608,
          112
        ],
        [
          12582912,
          112
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
          0,
          128,
          255
        ],
        [
          4194304,
          128,
          255
        ],
        [
          8388608,
          128,
          255
        ],
        [
          12582912,
          128,
          255
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
          "PA",
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
        ]
      ]
    }
  },
  {
    "id": "AGB_Dev_E201843",
    "sourceFile": "fc_AGB_Dev_E201843.txt",
    "type": "AGB",
    "names": [
      "Development AGB Cartridge 64M Flash S, E201843",
      "Development AGB Cartridge 64M Flash, E201629"
    ],
    "flash_ids": [
      [
        176,
        0,
        226,
        0
      ],
      [
        176,
        0,
        226,
        0
      ]
    ],
    "voltage": 3.3,
    "flash_size": 8388608,
    "chip_erase_timeout": 100,
    "sector_size": [
      [
        65536,
        63
      ],
      [
        8192,
        8
      ],
      [
        65536,
        63
      ],
      [
        8192,
        8
      ]
    ],
    "wait_read_status_register": true,
    "set_irq_high": true,
    "reset_every": 4194304,
    "command_set": "SHARP",
    "commands": {
      "reset": [
        [
          0,
          80
        ],
        [
          0,
          255
        ]
      ],
      "read_status_register": [
        [
          0,
          112
        ]
      ],
      "read_identifier": [
        [
          0,
          144
        ]
      ],
      "chip_erase": [
        [
          0,
          48
        ],
        [
          0,
          208
        ],
        [
          4194304,
          48
        ],
        [
          4194304,
          208
        ],
        [
          0,
          112
        ],
        [
          4194304,
          112
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
          0,
          128,
          255
        ],
        [
          4194304,
          128,
          255
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
          112
        ],
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
          "PA",
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
        ]
      ]
    }
  },
  {
    "id": "AGB_Dev_E201850",
    "sourceFile": "fc_AGB_Dev_E201850.txt",
    "type": "AGB",
    "names": [
      "Development AGB Cartridge 128M Flash S, E201850",
      "Development AGB Cartridge 128M Flash Case Iri, E201736"
    ],
    "flash_ids": [
      [
        176,
        0,
        226,
        0
      ],
      [
        176,
        0,
        226,
        0
      ]
    ],
    "voltage": 3.3,
    "flash_size": 16777216,
    "chip_erase_timeout": 100,
    "sector_size": [
      [
        65536,
        63
      ],
      [
        8192,
        8
      ],
      [
        65536,
        63
      ],
      [
        8192,
        8
      ],
      [
        65536,
        63
      ],
      [
        8192,
        8
      ],
      [
        65536,
        63
      ],
      [
        8192,
        8
      ]
    ],
    "wait_read_status_register": true,
    "set_irq_high": true,
    "reset_every": 4194304,
    "command_set": "SHARP",
    "commands": {
      "reset": [
        [
          0,
          80
        ],
        [
          0,
          255
        ]
      ],
      "read_status_register": [
        [
          0,
          112
        ]
      ],
      "read_identifier": [
        [
          0,
          144
        ]
      ],
      "chip_erase": [
        [
          0,
          48
        ],
        [
          0,
          208
        ],
        [
          4194304,
          48
        ],
        [
          4194304,
          208
        ],
        [
          8388608,
          48
        ],
        [
          8388608,
          208
        ],
        [
          12582912,
          48
        ],
        [
          12582912,
          208
        ],
        [
          0,
          112
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
          0,
          128,
          255
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
          112
        ],
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
          "PA",
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
        ]
      ]
    }
  },
  {
    "id": "AGB_Dev_E201868",
    "sourceFile": "fc_AGB_Dev_E201868.txt",
    "type": "AGB",
    "names": [
      "Development AGB Cartridge 256M Flash S, E201868"
    ],
    "flash_ids": [
      [
        176,
        0,
        176,
        0
      ]
    ],
    "voltage": 3.3,
    "flash_size": 33554432,
    "sector_size": [
      [
        65536,
        127
      ],
      [
        8192,
        8
      ],
      [
        65536,
        127
      ],
      [
        8192,
        8
      ],
      [
        65536,
        127
      ],
      [
        8192,
        8
      ],
      [
        65536,
        127
      ],
      [
        8192,
        8
      ]
    ],
    "wait_read_status_register": true,
    "set_irq_high": true,
    "reset_every": 2097152,
    "command_set": "SHARP",
    "commands": {
      "reset": [
        [
          0,
          80
        ],
        [
          0,
          255
        ]
      ],
      "read_status_register": [
        [
          0,
          112
        ]
      ],
      "read_identifier": [
        [
          0,
          144
        ]
      ],
      "read_cfi": [
        [
          0,
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
          112
        ],
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
          32896,
          65535
        ],
        [
          null,
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
          32896,
          65535
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
          null,
          null,
          null
        ],
        [
          null,
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
          32896,
          65535
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
          64
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "single_write_wait_for": [
        [
          "PA",
          32896,
          32896
        ],
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
    "id": "AGB_F0095H0",
    "sourceFile": "fc_AGB_F0095H0.txt",
    "type": "AGB",
    "names": [
      "F0095_4G_V1 with F0095H0"
    ],
    "flash_ids": [
      [
        138,
        0,
        176,
        136
      ]
    ],
    "voltage": 3.3,
    "flash_size": 536870912,
    "flash_bank_size": 33554432,
    "flash_bank_select_type": 1,
    "sector_size": 262144,
    "reset_every": 4194304,
    "buffer_size": 1024,
    "command_set": "INTEL",
    "commands": {
      "reset": [
        [
          0,
          80
        ],
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
          null,
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
          "SA",
          234
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
        ],
        [
          "SA",
          128,
          128
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
    "id": "AGB_Flash2Advance_128M",
    "sourceFile": "fc_AGB_Flash2Advance_128M.txt",
    "type": "AGB",
    "names": [
      "Flash2Advance 128M with 2× 28F640J3A120"
    ],
    "flash_ids": [
      [
        137,
        0,
        137,
        0,
        23,
        0,
        23,
        0
      ]
    ],
    "voltage": 3.3,
    "flash_size": 16777216,
    "sector_size": 262144,
    "buffer_size": 64,
    "command_set": "INTEL",
    "commands": {
      "unlock": [
        [
          19983528,
          21332,
          1
        ],
        [
          29509258,
          42330,
          1
        ],
        [
          19983528,
          21332,
          1
        ],
        [
          31606410,
          37907,
          1
        ]
      ],
      "reset": [
        [
          0,
          255
        ],
        [
          2,
          255
        ]
      ],
      "read_identifier": [
        [
          2,
          144
        ],
        [
          0,
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
          "SA+2",
          32
        ],
        [
          "SA+2",
          208
        ],
        [
          null,
          null
        ],
        [
          null,
          null
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
          "SA",
          128,
          65535
        ],
        [
          "SA+2",
          128,
          65535
        ]
      ],
      "buffer_write": [
        [
          "SA",
          232
        ],
        [
          "SA+2",
          232
        ],
        [
          "SA",
          "BS"
        ],
        [
          "SA+2",
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
          "SA+2",
          208
        ],
        [
          null,
          null
        ],
        [
          null,
          null
        ]
      ],
      "buffer_write_wait_for": [
        [
          0,
          128,
          32896
        ],
        [
          2,
          128,
          32896
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
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
          128,
          65535
        ],
        [
          2,
          128,
          65535
        ]
      ]
    }
  },
  {
    "id": "AGB_Flash2Advance_256M",
    "sourceFile": "fc_AGB_Flash2Advance_256M.txt",
    "type": "AGB",
    "names": [
      "Flash2Advance 256M with 2× 28F128J3A150",
      "Flash Advance Pro 256M with 2× 28F128J3A150"
    ],
    "flash_ids": [
      [
        137,
        0,
        137,
        0,
        24,
        0,
        24,
        0
      ]
    ],
    "voltage": 3.3,
    "flash_size": 33554432,
    "sector_size": 262144,
    "buffer_size": 64,
    "command_set": "INTEL",
    "commands": {
      "unlock": [
        [
          19983528,
          21332,
          1
        ],
        [
          29509258,
          42330,
          1
        ],
        [
          19983528,
          21332,
          1
        ],
        [
          31606410,
          37907,
          1
        ]
      ],
      "reset": [
        [
          0,
          255
        ],
        [
          2,
          255
        ]
      ],
      "read_identifier": [
        [
          2,
          144
        ],
        [
          0,
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
          "SA+2",
          32
        ],
        [
          "SA+2",
          208
        ],
        [
          null,
          null
        ],
        [
          null,
          null
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
          "SA",
          128,
          65535
        ],
        [
          "SA+2",
          128,
          65535
        ]
      ],
      "buffer_write": [
        [
          "SA",
          232
        ],
        [
          "SA+2",
          232
        ],
        [
          "SA",
          "BS"
        ],
        [
          "SA+2",
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
          "SA+2",
          208
        ],
        [
          null,
          null
        ],
        [
          null,
          null
        ]
      ],
      "buffer_write_wait_for": [
        [
          0,
          128,
          32896
        ],
        [
          2,
          128,
          32896
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
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
          128,
          65535
        ],
        [
          2,
          128,
          65535
        ]
      ]
    }
  },
  {
    "id": "AGB_Flash2Advance_Ultra_256M",
    "sourceFile": "fc_AGB_Flash2Advance_Ultra_256M.txt",
    "type": "AGB",
    "names": [
      "Flash2Advance Ultra 256M with 8× 3204C3B100"
    ],
    "flash_ids": [
      [
        137,
        0,
        137,
        0,
        197,
        136,
        197,
        136
      ]
    ],
    "voltage": 3.3,
    "flash_size": 33554432,
    "sector_size": [
      [
        16384,
        8
      ],
      [
        131072,
        63
      ],
      [
        16384,
        8
      ],
      [
        131072,
        63
      ],
      [
        16384,
        8
      ],
      [
        131072,
        63
      ],
      [
        16384,
        8
      ],
      [
        131072,
        63
      ]
    ],
    "reset_every": 8388608,
    "command_set": "INTEL",
    "commands": {
      "unlock": [
        [
          19983528,
          21332,
          1
        ],
        [
          29509258,
          42330,
          1
        ],
        [
          19983528,
          21332,
          1
        ],
        [
          31606410,
          37907,
          1
        ]
      ],
      "reset": [
        [
          0,
          255
        ],
        [
          2,
          255
        ]
      ],
      "read_identifier": [
        [
          2,
          144
        ],
        [
          0,
          144
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
        ],
        [
          "SA+2",
          96
        ],
        [
          "SA+2",
          208
        ],
        [
          "SA+2",
          32
        ],
        [
          "SA+2",
          208
        ],
        [
          null,
          null
        ],
        [
          null,
          null
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
          null,
          null,
          null
        ],
        [
          null,
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
          65535
        ],
        [
          "SA+2",
          128,
          65535
        ]
      ],
      "single_write": [
        [
          0,
          112
        ],
        [
          0,
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
    "id": "AGB_Flash2Advance_Ultra_2G",
    "sourceFile": "fc_AGB_Flash2Advance_Ultra_2G.txt",
    "type": "AGB",
    "names": [
      "Flash2Advance Ultra 2G with 4× 4400L0YDQ0"
    ],
    "flash_ids": [
      [
        137,
        0,
        137,
        0,
        16,
        136,
        16,
        136
      ]
    ],
    "flash_ids_banks": [
      [
        137,
        0,
        137,
        0,
        16,
        136,
        16,
        136
      ],
      [
        137,
        0,
        137,
        0,
        16,
        136,
        16,
        136
      ],
      [
        137,
        0,
        137,
        0,
        13,
        136,
        13,
        136
      ],
      [
        137,
        0,
        137,
        0,
        13,
        136,
        13,
        136
      ],
      [
        137,
        0,
        137,
        0,
        16,
        136,
        16,
        136
      ],
      [
        137,
        0,
        137,
        0,
        16,
        136,
        16,
        136
      ],
      [
        137,
        0,
        137,
        0,
        13,
        136,
        13,
        136
      ],
      [
        137,
        0,
        137,
        0,
        13,
        136,
        13,
        136
      ]
    ],
    "voltage": 3.3,
    "flash_size": 268435456,
    "flash_bank_size": 33554432,
    "flash_bank_select_type": 2,
    "sector_size": [
      [
        65536,
        4
      ],
      [
        262144,
        255
      ],
      [
        262144,
        255
      ],
      [
        65536,
        4
      ],
      [
        65536,
        4
      ],
      [
        262144,
        255
      ],
      [
        262144,
        255
      ],
      [
        65536,
        4
      ]
    ],
    "buffer_size": 64,
    "reset_every": 4194304,
    "command_set": "INTEL",
    "commands": {
      "unlock": [
        [
          19983528,
          21332,
          1
        ],
        [
          29509258,
          42330,
          1
        ],
        [
          19983528,
          21332,
          1
        ],
        [
          31606410,
          37907,
          1
        ]
      ],
      "reset": [
        [
          0,
          255
        ],
        [
          2,
          255
        ]
      ],
      "read_identifier": [
        [
          2,
          144
        ],
        [
          0,
          144
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
        ],
        [
          "SA+2",
          96
        ],
        [
          "SA+2",
          208
        ],
        [
          "SA+2",
          32
        ],
        [
          "SA+2",
          208
        ],
        [
          null,
          null
        ],
        [
          null,
          null
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
          null,
          null,
          null
        ],
        [
          null,
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
          65535
        ],
        [
          "SA+2",
          128,
          65535
        ]
      ],
      "buffer_write": [
        [
          "SA",
          232
        ],
        [
          "SA+2",
          232
        ],
        [
          "SA",
          "BS"
        ],
        [
          "SA+2",
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
          "SA+2",
          208
        ],
        [
          null,
          null
        ],
        [
          null,
          null
        ]
      ],
      "buffer_write_wait_for": [
        [
          0,
          128,
          32896
        ],
        [
          2,
          128,
          32896
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
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
          128,
          65535
        ],
        [
          2,
          128,
          65535
        ]
      ],
      "single_write": [
        [
          0,
          112
        ],
        [
          0,
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
    "id": "AGB_Flash2Advance_Ultra_64M",
    "sourceFile": "fc_AGB_Flash2Advance_Ultra_64M.txt",
    "type": "AGB",
    "names": [
      "Flash2Advance Ultra 64M with 2× 28F320C3B"
    ],
    "flash_ids": [
      [
        137,
        0,
        137,
        0,
        197,
        136,
        197,
        136
      ]
    ],
    "voltage": 3.3,
    "flash_size": 8388608,
    "sector_size": [
      [
        16384,
        8
      ],
      [
        131072,
        63
      ]
    ],
    "command_set": "INTEL",
    "commands": {
      "unlock": [
        [
          19983528,
          21332,
          1
        ],
        [
          29509258,
          42330,
          1
        ],
        [
          19983528,
          21332,
          1
        ],
        [
          31606410,
          37907,
          1
        ]
      ],
      "reset": [
        [
          0,
          255
        ],
        [
          2,
          255
        ]
      ],
      "read_identifier": [
        [
          2,
          144
        ],
        [
          0,
          144
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
        ],
        [
          "SA+2",
          96
        ],
        [
          "SA+2",
          208
        ],
        [
          "SA+2",
          32
        ],
        [
          "SA+2",
          208
        ],
        [
          null,
          null
        ],
        [
          null,
          null
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
          null,
          null,
          null
        ],
        [
          null,
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
          65535
        ],
        [
          "SA+2",
          128,
          65535
        ]
      ],
      "single_write": [
        [
          0,
          112
        ],
        [
          0,
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
    "id": "AGB_FlashAdvance_64M",
    "sourceFile": "fc_AGB_FlashAdvance_64M.txt",
    "type": "AGB",
    "names": [
      "Flash Advance Card 64M with 28F640J3A120"
    ],
    "flash_ids": [
      [
        137,
        0,
        23,
        0
      ]
    ],
    "voltage": 3.3,
    "flash_size": 8388608,
    "sector_size": 131072,
    "buffer_size": 32,
    "wait_read_status_register": true,
    "command_set": "INTEL",
    "commands": {
      "unlock": [
        [
          19983528,
          21332,
          1
        ],
        [
          29509258,
          42330,
          1
        ],
        [
          19983528,
          21332,
          1
        ],
        [
          31606410,
          37907,
          1
        ]
      ],
      "reset": [
        [
          0,
          80
        ],
        [
          0,
          255
        ]
      ],
      "read_status_register": [
        [
          0,
          112
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
          65535
        ],
        [
          null,
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
          65535
        ],
        [
          null,
          null,
          null
        ]
      ],
      "single_write": [
        [
          0,
          112
        ],
        [
          0,
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
    "id": "AGB_GA-07",
    "sourceFile": "fc_AGB_GA-07.txt",
    "type": "AGB",
    "names": [
      "GA-07 with unlabeled flash chip"
    ],
    "flash_ids": [
      [
        28,
        0,
        43,
        0
      ]
    ],
    "voltage": 3.3,
    "flash_size": 8388608,
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
    "command_set": "INTEL",
    "commands": {
      "reset": [
        [
          0,
          80
        ],
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
          null,
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
          65535
        ]
      ],
      "single_write": [
        [
          0,
          112
        ],
        [
          0,
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
    "id": "AGB_GBAMP",
    "sourceFile": "fc_AGB_GBAMP.txt",
    "type": "AGB",
    "names": [
      "GBA Movie Player v2 CF (SST39VF400A)"
    ],
    "flash_ids": [
      [
        191,
        0,
        128,
        39
      ]
    ],
    "voltage": 3.3,
    "power_cycle": true,
    "flash_size": 524288,
    "chip_erase_timeout": 10,
    "sector_size": 16384,
    "command_set": "GBAMP",
    "commands": {
      "reset": [
        [
          272260,
          170
        ],
        [
          137338,
          85
        ],
        [
          272260,
          240
        ]
      ],
      "unlock_read": [
        [
          308,
          2,
          1
        ],
        [
          212,
          2,
          1
        ],
        [
          324,
          2,
          1
        ],
        [
          236,
          2,
          1
        ],
        [
          484,
          2,
          1
        ],
        [
          392,
          2,
          1
        ],
        [
          500,
          2,
          1
        ],
        [
          468,
          2,
          1
        ]
      ],
      "read_identifier": [
        [
          272260,
          170
        ],
        [
          137338,
          85
        ],
        [
          272260,
          144
        ]
      ],
      "chip_erase": [
        [
          272260,
          170
        ],
        [
          137338,
          85
        ],
        [
          272260,
          128
        ],
        [
          272260,
          170
        ],
        [
          137338,
          85
        ],
        [
          272260,
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
          15646,
          128,
          128
        ]
      ],
      "sector_erase": [
        [
          272260,
          170
        ],
        [
          137338,
          85
        ],
        [
          272260,
          128
        ],
        [
          272260,
          170
        ],
        [
          137338,
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
          128,
          128
        ]
      ],
      "single_write": [
        [
          272260,
          170
        ],
        [
          137338,
          85
        ],
        [
          272260,
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
    "id": "AGB_GL04GR00FHCR2",
    "sourceFile": "fc_AGB_GL04GR00FHCR2.txt",
    "type": "AGB",
    "names": [
      "ACAM_GL04G10_2G_204 with GL04GR00FHCR2"
    ],
    "flash_ids": [
      [
        2,
        0,
        125,
        34
      ]
    ],
    "voltage": 3.3,
    "flash_size": 268435456,
    "flash_bank_size": 33554432,
    "flash_bank_select_type": 1,
    "buffer_size": 512,
    "sector_size": 131072,
    "reset_every": 4194304,
    "chip_erase_timeout": 2000,
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
          65535,
          65535
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
          65535,
          65535
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
    "id": "AGB_GL256S",
    "sourceFile": "fc_AGB_GL256S.txt",
    "type": "AGB",
    "names": [
      "BX2006_TSOP_64BALL with GL256S",
      "BGA64B-71-TV-DEEP with 256M29EML",
      "FunnyPlaying MidnightTrace 32 MiB Flash Cart",
      "MXP54_16D_046 with MSP54LV256"
    ],
    "flash_ids": [
      [
        2,
        0,
        125,
        34
      ],
      [
        138,
        0,
        125,
        34
      ],
      [
        2,
        0,
        125,
        34
      ],
      [
        2,
        0,
        125,
        34
      ]
    ],
    "voltage": 3.3,
    "flash_size": 33554432,
    "sector_size": 131072,
    "chip_erase_timeout": 300,
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
          65535,
          65535
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
          65535,
          65535
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
    "id": "AGB_Generic_0_90",
    "sourceFile": "fc_AGB_Generic_0_90.txt",
    "type": "AGB",
    "names": [
      "Generic Flash Cartridge (0/90)"
    ],
    "voltage": 3.3,
    "sector_size_from_cfi": true,
    "command_set": "INTEL",
    "commands": {
      "reset": [
        [
          0,
          80
        ],
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
          65535
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          128,
          65535
        ]
      ],
      "single_write": [
        [
          0,
          112
        ],
        [
          0,
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
    "id": "AGB_Generic_AAA_A9",
    "sourceFile": "fc_AGB_Generic_AAA_A9.txt",
    "type": "AGB",
    "names": [
      "Generic Flash Cartridge (AAA/A9)"
    ],
    "voltage": 3.3,
    "chip_erase_timeout": 300,
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
          65535,
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
    "id": "AGB_Generic_AAA_AA",
    "sourceFile": "fc_AGB_Generic_AAA_AA.txt",
    "type": "AGB",
    "names": [
      "Generic Flash Cartridge (AAA/AA)"
    ],
    "voltage": 3.3,
    "chip_erase_timeout": 300,
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
          170,
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
    "id": "AGB_K5L2833ATA",
    "sourceFile": "fc_AGB_K5L2833ATA.txt",
    "type": "AGB",
    "names": [
      "K5L2BX_32D_16D_V2 with K5L2833ATA"
    ],
    "flash_ids": [
      [
        236,
        0,
        1,
        36
      ]
    ],
    "voltage": 3.3,
    "flash_size": 16777216,
    "sector_size": [
      [
        65536,
        255
      ],
      [
        8192,
        8
      ]
    ],
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
      "sector_erase": [
        [
          "SA",
          96
        ],
        [
          "SA",
          96
        ],
        [
          "SA+132",
          96
        ],
        [
          0,
          240
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
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
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
          65535,
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
    "id": "AGB_K8D6316UTM-PI07",
    "sourceFile": "fc_AGB_K8D6316UTM-PI07.txt",
    "type": "AGB",
    "names": [
      "BX2006_TSOPBGA_0106 with K8D6316UTM-PI07"
    ],
    "flash_ids": [
      [
        236,
        0,
        224,
        34
      ]
    ],
    "voltage": 3.3,
    "flash_size": 8388608,
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
          65535,
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
    "id": "AGB_M29W128GH",
    "sourceFile": "fc_AGB_M29W128GH.txt",
    "type": "AGB",
    "names": [
      "AGB-E20-30 with M29W128GH",
      "MX29GL128EHT2I and ALTERA CPLD"
    ],
    "flash_ids": [
      [
        32,
        0,
        126,
        34
      ],
      [
        194,
        0,
        126,
        34
      ]
    ],
    "voltage": 3.3,
    "flash_size": 16777216,
    "sector_size": 131072,
    "chip_erase_timeout": 300,
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
          170,
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
          65535,
          65535
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
    "id": "AGB_M29W640",
    "sourceFile": "fc_AGB_M29W640.txt",
    "type": "AGB",
    "names": [
      "BX2006_TSOPBGA_0106 with M29W640",
      "BX2006_TSOPBGA_6108 with M29W640"
    ],
    "flash_ids": [
      [
        32,
        0,
        125,
        34
      ]
    ],
    "voltage": 3.3,
    "flash_size": 8388608,
    "sector_size_from_cfi": true,
    "chip_erase_timeout": 120,
    "enable_pullups": true,
    "m29w640": true,
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
          65535,
          65535
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
          65535,
          65535
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
    "id": "AGB_M36L0R705",
    "sourceFile": "fc_AGB_M36L0R705.txt",
    "type": "AGB",
    "names": [
      "4455_4400_4000_4350_36L0R_V3 with M36L0R7050T",
      "4050_4400_4000_4350_36L0R_V5 with M36L0R7050T",
      "4050_4400_4000_4350_36L0R_6108 with M36L0R7050B",
      "4000L0ZBQ0 DRV with 3000L0YBQ0",
      "F864-3 with M36L0R7050B"
    ],
    "flash_ids": [
      [
        32,
        0,
        196,
        136
      ],
      [
        32,
        0,
        196,
        136
      ],
      [
        32,
        0,
        198,
        136
      ],
      [
        138,
        0,
        15,
        136
      ],
      [
        32,
        0,
        197,
        136
      ]
    ],
    "voltage": 3.3,
    "flash_size": 16777216,
    "sector_size_from_cfi": true,
    "reset_every": 1048576,
    "command_set": "INTEL",
    "commands": {
      "reset": [
        [
          0,
          80
        ],
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
          null,
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
          65535
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
          65535
        ],
        [
          null,
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
          65535
        ],
        [
          null,
          null,
          null
        ]
      ],
      "single_write": [
        [
          0,
          112
        ],
        [
          0,
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
    "id": "AGB_M36L0R806",
    "sourceFile": "fc_AGB_M36L0R806.txt",
    "type": "AGB",
    "names": [
      "36L0R8-39VF512 with M36L0R8060B",
      "4350Q2 with 4350LLYBQ2",
      "4050_4400_4000_4350_36L0R_V5 with M36L0R8060T",
      "36L0R8-39VF512 with M36L0R8060T",
      "4050_4400_4000_4350_36L0R_V5 with 4050L0YTQ2",
      "4350Q2 with 4050V0YBQ1",
      "M36XXX_T32_32D_16D with M36L0R8060T",
      "2006-36-71_V2 with M36L0R8060B"
    ],
    "flash_ids": [
      [
        32,
        0,
        13,
        136
      ],
      [
        138,
        0,
        16,
        136
      ],
      [
        32,
        0,
        14,
        136
      ],
      [
        32,
        0,
        14,
        136
      ],
      [
        138,
        0,
        14,
        136
      ],
      [
        138,
        0,
        28,
        136
      ],
      [
        32,
        0,
        14,
        136
      ],
      [
        32,
        0,
        13,
        136
      ]
    ],
    "voltage": 3.3,
    "flash_size": 33554432,
    "sector_size_from_cfi": true,
    "reset_every": 1048576,
    "command_set": "INTEL",
    "commands": {
      "reset": [
        [
          0,
          80
        ],
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
      "read_cfi": [
        [
          170,
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
          null,
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
          65535
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
          65535
        ],
        [
          null,
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
          65535
        ],
        [
          null,
          null,
          null
        ]
      ],
      "single_write": [
        [
          0,
          112
        ],
        [
          0,
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
    "id": "AGB_M36L0R806_2",
    "sourceFile": "fc_AGB_M36L0R806_2.txt",
    "type": "AGB",
    "names": [
      "M36XXX_32A_EARTH with M36L0R8060B",
      "M36XXX_32A_EARTH with M36L0R8060T"
    ],
    "flash_ids": [
      [
        32,
        0,
        13,
        136
      ],
      [
        32,
        0,
        14,
        136
      ]
    ],
    "voltage": 3.3,
    "flash_size": 33554432,
    "sector_size_from_cfi": true,
    "reset_every": 1048576,
    "status_register_mask": 64,
    "status_register_value": 64,
    "command_set": "INTEL",
    "commands": {
      "reset": [
        [
          0,
          80
        ],
        [
          0,
          255
        ]
      ],
      "read_identifier": [
        [
          0,
          80
        ]
      ],
      "read_cfi": [
        [
          170,
          88
        ]
      ],
      "sector_erase": [
        [
          "SA",
          160
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
          null,
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
          64,
          64
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
          64,
          64
        ],
        [
          null,
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
          64,
          64
        ],
        [
          null,
          null,
          null
        ]
      ],
      "single_write": [
        [
          0,
          176
        ],
        [
          0,
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
          64,
          64
        ],
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
    "id": "AGB_M36W0R603",
    "sourceFile": "fc_AGB_M36W0R603.txt",
    "type": "AGB",
    "names": [
      "AA1030_TSOP88BALL with M36W0R603"
    ],
    "flash_ids": [
      [
        32,
        0,
        16,
        136
      ]
    ],
    "voltage": 3.3,
    "flash_size": 8388608,
    "sector_size_from_cfi": true,
    "reset_every": 524288,
    "command_set": "INTEL",
    "commands": {
      "reset": [
        [
          0,
          80
        ],
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
          null,
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
          65535
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
          65535
        ],
        [
          null,
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
          65535
        ],
        [
          null,
          null,
          null
        ]
      ],
      "single_write": [
        [
          0,
          112
        ],
        [
          0,
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
    "id": "AGB_M5M29G130AN",
    "sourceFile": "fc_AGB_M5M29G130AN.txt",
    "type": "AGB",
    "names": [
      "M5M29G130AN (no PCB text)"
    ],
    "flash_ids": [
      [
        28,
        0,
        61,
        0
      ]
    ],
    "voltage": 3.3,
    "flash_size": 16777216,
    "sector_size": [
      [
        65536,
        255
      ],
      [
        8192,
        8
      ]
    ],
    "command_set": "INTEL",
    "commands": {
      "reset": [
        [
          0,
          80
        ],
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
          null,
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
          65535
        ]
      ],
      "single_write": [
        [
          0,
          112
        ],
        [
          0,
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
    "id": "AGB_M5M29HD528",
    "sourceFile": "fc_AGB_M5M29HD528.txt",
    "type": "AGB",
    "names": [
      "M5M29-39VF512 with M5M29HD528"
    ],
    "flash_ids": [
      [
        28,
        0,
        250,
        0
      ]
    ],
    "voltage": 3.3,
    "flash_size": 33554432,
    "buffer_size": 256,
    "sector_size": [
      [
        16384,
        8
      ],
      [
        131072,
        255
      ]
    ],
    "command_set": "INTEL",
    "commands": {
      "reset": [
        [
          0,
          80
        ],
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
          null,
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
          65535
        ]
      ],
      "page_write": [
        [
          0,
          112
        ],
        [
          0,
          65
        ],
        [
          "PA",
          "PD"
        ]
      ],
      "page_write_wait_for": [
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
      ],
      "single_write": [
        [
          0,
          112
        ],
        [
          0,
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
    "id": "AGB_M6MGJ927",
    "sourceFile": "fc_AGB_M6MGJ927.txt",
    "type": "AGB",
    "names": [
      "M6MGJ927 (no PCB text)"
    ],
    "flash_ids": [
      [
        28,
        0,
        185,
        0
      ]
    ],
    "voltage": 3.3,
    "flash_size": 8388608,
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
    "command_set": "INTEL",
    "commands": {
      "reset": [
        [
          0,
          80
        ],
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
          null,
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
          65535
        ]
      ],
      "single_write": [
        [
          0,
          112
        ],
        [
          0,
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
    "id": "AGB_MSP54LV100",
    "sourceFile": "fc_AGB_MSP54LV100.txt",
    "type": "AGB",
    "names": [
      "SUN100S_MSP54XXX with MSP54LV100"
    ],
    "flash_ids": [
      [
        2,
        0,
        125,
        34
      ]
    ],
    "voltage": 3.3,
    "flash_size": 134217728,
    "flash_bank_size": 33554432,
    "flash_bank_select_type": 1,
    "buffer_size": 64,
    "sector_size": 131072,
    "reset_every": 4194304,
    "chip_erase_timeout": 2000,
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
          65535,
          65535
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
          65535,
          65535
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
    "id": "AGB_MSP54LV256",
    "sourceFile": "fc_AGB_MSP54LV256.txt",
    "type": "AGB",
    "names": [
      "MXP54_16D_ERATH with MSP54LV256"
    ],
    "flash_ids": [
      [
        2,
        0,
        189,
        34
      ]
    ],
    "voltage": 3.3,
    "flash_size": 33554432,
    "sector_size_from_cfi": true,
    "status_register_mask": 64,
    "status_register_value": 64,
    "chip_erase_timeout": 300,
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
          105
        ],
        [
          1365,
          150
        ],
        [
          2730,
          80
        ]
      ],
      "read_cfi": [
        [
          170,
          88
        ]
      ],
      "sector_erase": [
        [
          2730,
          105
        ],
        [
          1365,
          150
        ],
        [
          2730,
          64
        ],
        [
          2730,
          105
        ],
        [
          1365,
          150
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
          65535,
          65535
        ]
      ],
      "chip_erase": [
        [
          2730,
          105
        ],
        [
          1365,
          150
        ],
        [
          2730,
          64
        ],
        [
          2730,
          105
        ],
        [
          1365,
          150
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
      "buffer_write": [
        [
          2730,
          105
        ],
        [
          1365,
          150
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
          105
        ],
        [
          1365,
          150
        ],
        [
          2730,
          96
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
    "id": "AGB_MSP55LV100G",
    "sourceFile": "fc_AGB_MSP55LV100G.txt",
    "type": "AGB",
    "names": [
      "AGB-E05-01 with MSP55LV100G",
      "DV15 with MSP55LV100G"
    ],
    "flash_ids": [
      [
        2,
        1,
        2,
        1,
        125,
        126,
        125,
        126
      ],
      [
        2,
        1,
        2,
        1,
        125,
        126,
        125,
        126
      ]
    ],
    "voltage": 3.3,
    "flash_size": 33554432,
    "buffer_size": 32,
    "double_die": true,
    "sector_size": 262144,
    "reset_every": 4194304,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          61680
        ]
      ],
      "read_identifier": [
        [
          21845,
          43689
        ],
        [
          10922,
          21846
        ],
        [
          21845,
          37008
        ]
      ],
      "sector_erase": [
        [
          21845,
          43689
        ],
        [
          10922,
          21846
        ],
        [
          21845,
          32896
        ],
        [
          21845,
          43689
        ],
        [
          10922,
          21846
        ],
        [
          "SA",
          12336
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
          65535,
          65535
        ]
      ],
      "buffer_write": [
        [
          21845,
          43689
        ],
        [
          10922,
          21846
        ],
        [
          "SA",
          9510
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
          10538
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
      "fast_write": [
        [
          21845,
          43689
        ],
        [
          10922,
          21846
        ],
        [
          21845,
          8224
        ],
        [
          "PA",
          41120
        ],
        [
          0,
          61680
        ]
      ],
      "fast_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "PA",
          "PD",
          65535
        ],
        [
          null,
          null,
          null
        ]
      ],
      "single_write": [
        [
          21845,
          43689
        ],
        [
          10922,
          21846
        ],
        [
          21845,
          41120
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
          "PA",
          "PD",
          65535
        ]
      ]
    }
  },
  {
    "id": "AGB_MSP55LV100S",
    "sourceFile": "fc_AGB_MSP55LV100S.txt",
    "type": "AGB",
    "names": [
      "100SOP with MSP55LV100S"
    ],
    "flash_ids": [
      [
        2,
        1,
        125,
        126
      ]
    ],
    "voltage": 3.3,
    "flash_size": 67108864,
    "flash_bank_size": 33554432,
    "flash_bank_select_type": 1,
    "buffer_size": 32,
    "double_die": true,
    "sector_size": 131072,
    "reset_every": 4194304,
    "command_set": "AMD",
    "commands": {
      "reset": [
        [
          0,
          61680
        ]
      ],
      "read_identifier": [
        [
          2730,
          43689
        ],
        [
          1365,
          21846
        ],
        [
          2730,
          37008
        ]
      ],
      "read_cfi": [
        [
          170,
          39064
        ]
      ],
      "sector_erase": [
        [
          2730,
          43689
        ],
        [
          1365,
          21846
        ],
        [
          2730,
          32896
        ],
        [
          2730,
          43689
        ],
        [
          1365,
          21846
        ],
        [
          "SA",
          12336
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
          65535,
          65535
        ]
      ],
      "buffer_write": [
        [
          2730,
          43689
        ],
        [
          1365,
          21846
        ],
        [
          "SA",
          9510
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
          10538
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
      "fast_write": [
        [
          2730,
          43689
        ],
        [
          1365,
          21846
        ],
        [
          2730,
          8224
        ],
        [
          "PA",
          41120
        ],
        [
          0,
          61680
        ]
      ],
      "fast_write_wait_for": [
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          null,
          null,
          null
        ],
        [
          "PA",
          "PD",
          65535
        ],
        [
          null,
          null,
          null
        ]
      ],
      "single_write": [
        [
          2730,
          43689
        ],
        [
          1365,
          21846
        ],
        [
          2730,
          41120
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
          "PA",
          "PD",
          65535
        ]
      ]
    }
  },
  {
    "id": "AGB_MSP55LV128",
    "sourceFile": "fc_AGB_MSP55LV128.txt",
    "type": "AGB",
    "names": [
      "AGB-SD-E05 with MSP55LV128"
    ],
    "flash_ids": [
      [
        4,
        0,
        125,
        34
      ]
    ],
    "voltage": 3.3,
    "flash_size": 16777216,
    "sector_size": 65536,
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
          65535,
          65535
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
    "id": "AGB_MSP55LV128M",
    "sourceFile": "fc_AGB_MSP55LV128M.txt",
    "type": "AGB",
    "names": [
      "AGB-E05-01 with MSP55LV128M",
      "AGB-E05-01 with GL128S",
      "BX2006_0106_NEW with S29GL128N10TFI01",
      "BX2006_TSOP_64BALL with GL128S",
      "AGB-E05-02 with M29W128GH",
      "AGB-E05-02 with M29W128FH",
      "2006_TSOP_64BALL_6106 with W29GL128SH9B",
      "AGB-E05-02 with JS28F128",
      "AGB-E05-03H with M29W128GH"
    ],
    "flash_ids": [
      [
        2,
        0,
        125,
        34
      ],
      [
        2,
        0,
        125,
        34
      ],
      [
        2,
        0,
        125,
        34
      ],
      [
        2,
        0,
        125,
        34
      ],
      [
        32,
        0,
        125,
        34
      ],
      [
        32,
        0,
        125,
        34
      ],
      [
        239,
        0,
        125,
        34
      ],
      [
        138,
        0,
        125,
        34
      ],
      [
        32,
        0,
        125,
        34
      ]
    ],
    "voltage": 3.3,
    "flash_size": 16777216,
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
          65535,
          65535
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
          65535,
          65535
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
    "id": "AGB_MSP55LV128_2",
    "sourceFile": "fc_AGB_MSP55LV128_2.txt",
    "type": "AGB",
    "names": [
      "B104 with MSP55LV128"
    ],
    "flash_ids": [
      [
        4,
        0,
        126,
        34
      ]
    ],
    "voltage": 3.3,
    "flash_size": 16777216,
    "sector_size": 65536,
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
          170,
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
          65535,
          65535
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
    "id": "AGB_MX29LV320ET",
    "sourceFile": "fc_AGB_MX29LV320ET.txt",
    "type": "AGB",
    "names": [
      "B54 with MX29LV320ET",
      "B100 with MX29LV640ET",
      "Unknown 29LV320 variant (no PCB text)"
    ],
    "flash_ids": [
      [
        194,
        0,
        167,
        34
      ],
      [
        194,
        0,
        201,
        34
      ],
      [
        4,
        0,
        246,
        34
      ]
    ],
    "voltage": 3.3,
    "flash_size": 4194304,
    "chip_erase_timeout": 200,
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
          170,
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
    "id": "AGB_S29GL032",
    "sourceFile": "fc_AGB_S29GL032.txt",
    "type": "AGB",
    "names": [
      "AGB-E05-02 with S29GL032"
    ],
    "flash_ids": [
      [
        2,
        0,
        250,
        34
      ]
    ],
    "voltage": 3.3,
    "flash_size": 4194304,
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
          65535,
          65535
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
    "id": "AGB_S29GL064",
    "sourceFile": "fc_AGB_S29GL064.txt",
    "type": "AGB",
    "names": [
      "AGB-E05-01 with S29GL064"
    ],
    "flash_ids": [
      [
        2,
        0,
        125,
        34
      ]
    ],
    "voltage": 3.3,
    "flash_size": 8388608,
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
          65535,
          65535
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
    "id": "AGB_S29GL256",
    "sourceFile": "fc_AGB_S29GL256.txt",
    "type": "AGB",
    "names": [
      "insideGadgets 32 MiB (S29GL512N) + RTC",
      "AGB-E20-30 with S29GL256N10TFI01",
      "GBFlash 1M FLASH RTC (AGB-R1M-02V3)",
      "GBFlash 1M FLASH RTC (AGB-R1M-02V4)"
    ],
    "flash_ids": [
      [
        1,
        0,
        126,
        34
      ],
      [
        1,
        0,
        126,
        34
      ],
      [
        1,
        0,
        126,
        34
      ]
    ],
    "voltage": 3.3,
    "flash_size": 33554432,
    "sector_size": 131072,
    "chip_erase_timeout": 300,
    "rtc": true,
    "rumble": true,
    "enable_pullups": true,
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
          170,
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
          65535,
          65535
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
    "id": "AGB_Sintax",
    "sourceFile": "fc_AGB_Sintax.txt",
    "type": "AGB",
    "names": [
      "Sintax YJencrypted Cartridge"
    ],
    "flash_size": 33554432,
    "voltage": 3.3,
    "sintax": true,
    "manual_select": true,
    "command_set": "SINTAX_YJENCRYPTED",
    "commands": {}
  },
  {
    "id": "AGB_TE28F128",
    "sourceFile": "fc_AGB_TE28F128.txt",
    "type": "AGB",
    "names": [
      "DL9SEC GBA flashcart with TE28F128"
    ],
    "flash_ids": [
      [
        137,
        0,
        24,
        0
      ]
    ],
    "voltage": 3.3,
    "flash_size": 16777216,
    "sector_size_from_cfi": true,
    "command_set": "INTEL",
    "commands": {
      "reset": [
        [
          0,
          80
        ],
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
          65535
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          128,
          65535
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
          65535
        ],
        [
          null,
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
          65535
        ],
        [
          null,
          null,
          null
        ]
      ],
      "single_write": [
        [
          0,
          112
        ],
        [
          0,
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
    "id": "AGB_TE28F256",
    "sourceFile": "fc_AGB_TE28F256.txt",
    "type": "AGB",
    "names": [
      "DL9SEC GBA flashcart with TE28F256"
    ],
    "flash_ids": [
      [
        137,
        0,
        29,
        0
      ]
    ],
    "voltage": 3.3,
    "flash_size": 33554432,
    "sector_size_from_cfi": true,
    "command_set": "INTEL",
    "commands": {
      "reset": [
        [
          0,
          80
        ],
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
          65535
        ],
        [
          null,
          null,
          null
        ],
        [
          "SA",
          128,
          65535
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
          65535
        ],
        [
          null,
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
          65535
        ],
        [
          null,
          null,
          null
        ]
      ],
      "single_write": [
        [
          0,
          112
        ],
        [
          0,
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
    "id": "AGB_TH50VSF3680",
    "sourceFile": "fc_AGB_TH50VSF3680.txt",
    "type": "AGB",
    "names": [
      "3682 with TH50VSF3680"
    ],
    "flash_ids": [
      [
        152,
        0,
        147,
        0
      ]
    ],
    "voltage": 3.3,
    "flash_size": 8388608,
    "sector_size": [
      [
        65536,
        127
      ],
      [
        8192,
        8
      ],
      [
        65536,
        127
      ],
      [
        8192,
        8
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
          170,
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
    },
    "geometryException": {
      "expectedFlashSize": 8388608,
      "actualSectorTotal": 16777216,
      "note": "Dual-region/dual-die sector_size description (16 MiB) exceeds flash_size (8 MiB) in FlashGBX config."
    }
  },
  {
    "id": "AGB_VastFame",
    "sourceFile": "fc_AGB_VastFame.txt",
    "type": "AGB",
    "names": [
      "Vast Fame"
    ],
    "voltage": 3.3,
    "vast_fame": true,
    "command_set": "VASTFAME",
    "commands": {}
  },
  {
    "id": "AGB_iG_16MB_28EW256A",
    "sourceFile": "fc_AGB_iG_16MB_28EW256A.txt",
    "type": "AGB",
    "names": [
      "insideGadgets 16 MiB (28EW256A) + RTC/Solar"
    ],
    "flash_ids": [
      [
        137,
        0,
        126,
        34
      ]
    ],
    "voltage": 3.3,
    "flash_size": 16777216,
    "sector_size": 131072,
    "chip_erase_timeout": 300,
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
          170,
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
          65535,
          65535
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
    "id": "AGB_iG_32MB_28EW256A",
    "sourceFile": "fc_AGB_iG_32MB_28EW256A.txt",
    "type": "AGB",
    "names": [
      "insideGadgets 32 MiB (28EW256A) + RTC/Rumble",
      "insideGadgets 32 MiB (IS29GL256)",
      "insideGadgets 32 MiB (W29GL256)"
    ],
    "flash_ids": [
      [
        137,
        0,
        126,
        34
      ],
      [
        157,
        0,
        126,
        34
      ],
      [
        239,
        0,
        126,
        34
      ]
    ],
    "voltage": 3.3,
    "flash_size": 33554432,
    "sector_size": 131072,
    "chip_erase_timeout": 300,
    "rtc": true,
    "rumble": true,
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
          170,
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
          65535,
          65535
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
    "id": "AGB_iG_32MB_EEPROM",
    "sourceFile": "fc_AGB_iG_32MB_EEPROM.txt",
    "type": "AGB",
    "names": [
      "insideGadgets 32 MiB + EEPROM"
    ],
    "flash_ids": [],
    "voltage": 3.3,
    "flash_size": 33554176,
    "sector_size": 131072,
    "chip_erase_timeout": 300,
    "rtc": true,
    "rumble": true,
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
          170,
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
          65535,
          65535
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
    },
    "geometryException": {
      "expectedFlashSize": 33554176,
      "actualSectorTotal": 33554432,
      "note": "flash_size (0x1FFFF00) reserves 256 bytes for EEPROM and is not an exact multiple of sector_size (0x20000)."
    }
  }
];
