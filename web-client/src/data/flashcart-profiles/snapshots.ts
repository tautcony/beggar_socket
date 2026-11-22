/*!
 * Flashcart profile data converted from FlashGBX (https://github.com/Lesserkuma/FlashGBX).
 * Copyright (C) Lesserkuma — Licensed under GNU General Public License v3.0 (GPL-3.0).
 */
/* eslint-disable */
import type {
  FlashcartCollisionEntry,
  FlashcartGeometryExceptionSnapshot,
} from '@/types/flashcart-profile';

export const FLASHCART_PROFILE_COUNTS = {
  AGB: 59,
  DMG: 106,
  total: 165,
} as const;

export const FLASHCART_GEOMETRY_EXCEPTIONS: readonly FlashcartGeometryExceptionSnapshot[] = [
  {
    "sourceFile": "fc_AGB_TH50VSF3680.txt",
    "expectedFlashSize": 8388608,
    "actualSectorTotal": 16777216,
    "note": "Dual-region/dual-die sector_size description (16 MiB) exceeds flash_size (8 MiB) in FlashGBX config."
  },
  {
    "sourceFile": "fc_AGB_iG_32MB_EEPROM.txt",
    "expectedFlashSize": 33554176,
    "actualSectorTotal": 33554432,
    "note": "flash_size (0x1FFFF00) reserves 256 bytes for EEPROM and is not an exact multiple of sector_size (0x20000)."
  }
];

export const FLASHCART_ID_COLLISIONS: readonly FlashcartCollisionEntry[] = [
  {
    "type": "AGB",
    "flashIdKey": "[1,0,126,34]",
    "sourceFiles": [
      "fc_AGB_S29GL256.txt",
      "fc_AGB_S29GL256.txt",
      "fc_AGB_S29GL256.txt"
    ],
    "profileIds": [
      "AGB_S29GL256",
      "AGB_S29GL256",
      "AGB_S29GL256"
    ]
  },
  {
    "type": "AGB",
    "flashIdKey": "[137,0,126,34]",
    "sourceFiles": [
      "fc_AGB_iG_16MB_28EW256A.txt",
      "fc_AGB_iG_32MB_28EW256A.txt"
    ],
    "profileIds": [
      "AGB_iG_16MB_28EW256A",
      "AGB_iG_32MB_28EW256A"
    ]
  },
  {
    "type": "AGB",
    "flashIdKey": "[137,0,137,0,197,136,197,136]",
    "sourceFiles": [
      "fc_AGB_Flash2Advance_Ultra_256M.txt",
      "fc_AGB_Flash2Advance_Ultra_64M.txt"
    ],
    "profileIds": [
      "AGB_Flash2Advance_Ultra_256M",
      "AGB_Flash2Advance_Ultra_64M"
    ]
  },
  {
    "type": "AGB",
    "flashIdKey": "[138,0,125,34]",
    "sourceFiles": [
      "fc_AGB_GL256S.txt",
      "fc_AGB_MSP55LV128M.txt"
    ],
    "profileIds": [
      "AGB_GL256S",
      "AGB_MSP55LV128M"
    ]
  },
  {
    "type": "AGB",
    "flashIdKey": "[138,0,176,136]",
    "sourceFiles": [
      "fc_AGB_6600M0U0BE.txt",
      "fc_AGB_6600M0U0BE.txt",
      "fc_AGB_F0095H0.txt"
    ],
    "profileIds": [
      "AGB_6600M0U0BE",
      "AGB_6600M0U0BE",
      "AGB_F0095H0"
    ]
  },
  {
    "type": "AGB",
    "flashIdKey": "[138,0,21,136]",
    "sourceFiles": [
      "fc_AGB_256L30B.txt",
      "fc_AGB_256L30B.txt",
      "fc_AGB_256L30B.txt"
    ],
    "profileIds": [
      "AGB_256L30B",
      "AGB_256L30B",
      "AGB_256L30B"
    ]
  },
  {
    "type": "AGB",
    "flashIdKey": "[176,0,226,0]",
    "sourceFiles": [
      "fc_AGB_Dev_E201629_128M.txt",
      "fc_AGB_Dev_E201843.txt",
      "fc_AGB_Dev_E201843.txt",
      "fc_AGB_Dev_E201850.txt",
      "fc_AGB_Dev_E201850.txt"
    ],
    "profileIds": [
      "AGB_Dev_E201629_128M",
      "AGB_Dev_E201843",
      "AGB_Dev_E201843",
      "AGB_Dev_E201850",
      "AGB_Dev_E201850"
    ]
  },
  {
    "type": "AGB",
    "flashIdKey": "[2,0,125,34]",
    "sourceFiles": [
      "fc_AGB_GL04GR00FHCR2.txt",
      "fc_AGB_GL256S.txt",
      "fc_AGB_GL256S.txt",
      "fc_AGB_GL256S.txt",
      "fc_AGB_MSP54LV100.txt",
      "fc_AGB_MSP55LV128M.txt",
      "fc_AGB_MSP55LV128M.txt",
      "fc_AGB_MSP55LV128M.txt",
      "fc_AGB_MSP55LV128M.txt",
      "fc_AGB_S29GL064.txt"
    ],
    "profileIds": [
      "AGB_GL04GR00FHCR2",
      "AGB_GL256S",
      "AGB_GL256S",
      "AGB_GL256S",
      "AGB_MSP54LV100",
      "AGB_MSP55LV128M",
      "AGB_MSP55LV128M",
      "AGB_MSP55LV128M",
      "AGB_MSP55LV128M",
      "AGB_S29GL064"
    ]
  },
  {
    "type": "AGB",
    "flashIdKey": "[2,1,2,1,125,126,125,126]",
    "sourceFiles": [
      "fc_AGB_MSP55LV100G.txt",
      "fc_AGB_MSP55LV100G.txt"
    ],
    "profileIds": [
      "AGB_MSP55LV100G",
      "AGB_MSP55LV100G"
    ]
  },
  {
    "type": "AGB",
    "flashIdKey": "[32,0,125,34]",
    "sourceFiles": [
      "fc_AGB_M29W640.txt",
      "fc_AGB_MSP55LV128M.txt",
      "fc_AGB_MSP55LV128M.txt",
      "fc_AGB_MSP55LV128M.txt"
    ],
    "profileIds": [
      "AGB_M29W640",
      "AGB_MSP55LV128M",
      "AGB_MSP55LV128M",
      "AGB_MSP55LV128M"
    ]
  },
  {
    "type": "AGB",
    "flashIdKey": "[32,0,13,136]",
    "sourceFiles": [
      "fc_AGB_M36L0R806.txt",
      "fc_AGB_M36L0R806.txt",
      "fc_AGB_M36L0R806_2.txt"
    ],
    "profileIds": [
      "AGB_M36L0R806",
      "AGB_M36L0R806",
      "AGB_M36L0R806_2"
    ]
  },
  {
    "type": "AGB",
    "flashIdKey": "[32,0,14,136]",
    "sourceFiles": [
      "fc_AGB_M36L0R806.txt",
      "fc_AGB_M36L0R806.txt",
      "fc_AGB_M36L0R806.txt",
      "fc_AGB_M36L0R806_2.txt"
    ],
    "profileIds": [
      "AGB_M36L0R806",
      "AGB_M36L0R806",
      "AGB_M36L0R806",
      "AGB_M36L0R806_2"
    ]
  },
  {
    "type": "AGB",
    "flashIdKey": "[32,0,196,136]",
    "sourceFiles": [
      "fc_AGB_M36L0R705.txt",
      "fc_AGB_M36L0R705.txt"
    ],
    "profileIds": [
      "AGB_M36L0R705",
      "AGB_M36L0R705"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[1,126,16]",
    "sourceFiles": [
      "fc_DMG_GBFlash_MBCX_64M.txt",
      "fc_DMG_iG_8MB.txt"
    ],
    "profileIds": [
      "DMG_GBFlash_MBCX_64M",
      "DMG_iG_8MB"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[1,126,34]",
    "sourceFiles": [
      "fc_DMG_ChisFlash-MBC5-MAX_S29GL256N.txt",
      "fc_DMG_GBFlash_MBCX_256M.txt"
    ],
    "profileIds": [
      "DMG_ChisFlash-MBC5-MAX_S29GL256N",
      "DMG_GBFlash_MBCX_256M"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[1,164]",
    "sourceFiles": [
      "fc_DMG_AM29F040_AUDIO.txt",
      "fc_DMG_AM29F040_WR.txt"
    ],
    "profileIds": [
      "DMG_AM29F040_AUDIO",
      "DMG_AM29F040_WR"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[1,173]",
    "sourceFiles": [
      "fc_DMG_AM29F016_AUDIO.txt",
      "fc_DMG_AM29F016_WR.txt"
    ],
    "profileIds": [
      "DMG_AM29F016_AUDIO",
      "DMG_AM29F016_WR"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[1,213]",
    "sourceFiles": [
      "fc_DMG_AM29F080_AUDIO.txt",
      "fc_DMG_AM29F080_WR.txt"
    ],
    "profileIds": [
      "DMG_AM29F080_AUDIO",
      "DMG_AM29F080_WR"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[1,32]",
    "sourceFiles": [
      "fc_DMG_AM29F010_AUDIO.txt",
      "fc_DMG_AM29F010_WR.txt"
    ],
    "profileIds": [
      "DMG_AM29F010_AUDIO",
      "DMG_AM29F010_WR"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[137,137,20,20]",
    "sourceFiles": [
      "fc_DMG_Dev_E201264_2.txt",
      "fc_DMG_GB_Smart_32M.txt"
    ],
    "profileIds": [
      "DMG_Dev_E201264_2",
      "DMG_GB_Smart_32M"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[137,137,21,21]",
    "sourceFiles": [
      "fc_DMG_Doctor_GB_Card_64M.txt",
      "fc_DMG_Doctor_GB_Card_64M.txt"
    ],
    "profileIds": [
      "DMG_Doctor_GB_Card_64M",
      "DMG_Doctor_GB_Card_64M"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[138,138,125,125]",
    "sourceFiles": [
      "fc_DMG_256M29EWH.txt",
      "fc_DMG_256M29EWH.txt",
      "fc_DMG_S29GL032M90T.txt"
    ],
    "profileIds": [
      "DMG_256M29EWH",
      "DMG_256M29EWH",
      "DMG_S29GL032M90T"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[152,69,0,42]",
    "sourceFiles": [
      "fc_DMG_TC58FVB016FT.txt",
      "fc_DMG_TC58FVB016FT.txt"
    ],
    "profileIds": [
      "DMG_TC58FVB016FT",
      "DMG_TC58FVB016FT"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[174,174,196,196]",
    "sourceFiles": [
      "fc_DMG_HY29LV160TT.txt",
      "fc_DMG_HY29LV160TT.txt"
    ],
    "profileIds": [
      "DMG_HY29LV160TT",
      "DMG_HY29LV160TT"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[191,0,83,115]",
    "sourceFiles": [
      "fc_DMG_36VF3204.txt",
      "fc_DMG_36VF3204.txt",
      "fc_DMG_36VF3204.txt",
      "fc_DMG_36VF3204_2.txt"
    ],
    "profileIds": [
      "DMG_36VF3204",
      "DMG_36VF3204",
      "DMG_36VF3204",
      "DMG_36VF3204_2"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[191,181]",
    "sourceFiles": [
      "fc_DMG_FerranteCrafts_32KB.txt",
      "fc_DMG_FerranteCrafts_64KB.txt",
      "fc_DMG_iG_512KB.txt"
    ],
    "profileIds": [
      "DMG_FerranteCrafts_32KB",
      "DMG_FerranteCrafts_64KB",
      "DMG_iG_512KB"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[191,182]",
    "sourceFiles": [
      "fc_DMG_39SF020A.txt",
      "fc_DMG_SST39SF020_AUDIO.txt",
      "fc_DMG_iG_512KB.txt"
    ],
    "profileIds": [
      "DMG_39SF020A",
      "DMG_SST39SF020_AUDIO",
      "DMG_iG_512KB"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[191,183]",
    "sourceFiles": [
      "fc_DMG_FerranteCrafts_32KB_2.txt",
      "fc_DMG_SST39SF040_AUDIO.txt",
      "fc_DMG_iG_512KB.txt"
    ],
    "profileIds": [
      "DMG_FerranteCrafts_32KB_2",
      "DMG_SST39SF040_AUDIO",
      "DMG_iG_512KB"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[193,193,167,167]",
    "sourceFiles": [
      "fc_DMG_MX29LV320BTC.txt",
      "fc_DMG_MX29LV320BTC.txt"
    ],
    "profileIds": [
      "DMG_MX29LV320BTC",
      "DMG_MX29LV320BTC"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[193,193,168,168]",
    "sourceFiles": [
      "fc_DMG_29LV320DB.txt",
      "fc_DMG_MX29LV320BTC.txt"
    ],
    "profileIds": [
      "DMG_29LV320DB",
      "DMG_MX29LV320BTC"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[194,164]",
    "sourceFiles": [
      "fc_DMG_AM29F032_AUDIO.txt",
      "fc_DMG_AM29F032_WR.txt"
    ],
    "profileIds": [
      "DMG_AM29F032_AUDIO",
      "DMG_AM29F032_WR"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[194,194,126,126]",
    "sourceFiles": [
      "fc_DMG_BV_MBC3000.txt",
      "fc_DMG_BV_MBC3000_ROM2.txt",
      "fc_DMG_ChisFlash-MBC5-PLUS.txt"
    ],
    "profileIds": [
      "DMG_BV_MBC3000",
      "DMG_BV_MBC3000_ROM2",
      "DMG_ChisFlash-MBC5-PLUS"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[194,194,167,167]",
    "sourceFiles": [
      "fc_DMG_MX29LV320ET.txt",
      "fc_DMG_MX29LV320ET.txt",
      "fc_DMG_MX29LV320ET.txt",
      "fc_DMG_MX29LV320ET_2MB.txt",
      "fc_DMG_iG_4MB_3.txt"
    ],
    "profileIds": [
      "DMG_MX29LV320ET",
      "DMG_MX29LV320ET",
      "DMG_MX29LV320ET",
      "DMG_MX29LV320ET_2MB",
      "DMG_iG_4MB_3"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[194,194,203,203]",
    "sourceFiles": [
      "fc_DMG_BV_MBC3000.txt",
      "fc_DMG_BV_MBC3000_ROM2.txt",
      "fc_DMG_MX29LV640_AUDIO.txt",
      "fc_DMG_MX29LV640_WR.txt"
    ],
    "profileIds": [
      "DMG_BV_MBC3000",
      "DMG_BV_MBC3000_ROM2",
      "DMG_MX29LV640_AUDIO",
      "DMG_MX29LV640_WR"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[2,2,125,125]",
    "sourceFiles": [
      "fc_DMG_GL032M11BAIR4.txt",
      "fc_DMG_GL032M11BAIR4.txt",
      "fc_DMG_GL032M11BAIR4.txt",
      "fc_DMG_GL032M11BAIR4.txt",
      "fc_DMG_M29W320DT.txt",
      "fc_DMG_M29W320DT.txt",
      "fc_DMG_M29W320DT.txt",
      "fc_DMG_S29GL032M90T.txt"
    ],
    "profileIds": [
      "DMG_GL032M11BAIR4",
      "DMG_GL032M11BAIR4",
      "DMG_GL032M11BAIR4",
      "DMG_GL032M11BAIR4",
      "DMG_M29W320DT",
      "DMG_M29W320DT",
      "DMG_M29W320DT",
      "DMG_S29GL032M90T"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[2,2,196,196]",
    "sourceFiles": [
      "fc_DMG_AM29LV160DT.txt",
      "fc_DMG_AM29LV160MB.txt"
    ],
    "profileIds": [
      "DMG_AM29LV160DT",
      "DMG_AM29LV160MB"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[2,2,74,74]",
    "sourceFiles": [
      "fc_DMG_AM29LV160DB.txt",
      "fc_DMG_AM29LV160MB.txt",
      "fc_DMG_AM29LV160MB.txt",
      "fc_DMG_AM29LV160MB.txt",
      "fc_DMG_AM29LV160MB.txt",
      "fc_DMG_AM29LV160MB.txt",
      "fc_DMG_AM29LV160MB.txt"
    ],
    "profileIds": [
      "DMG_AM29LV160DB",
      "DMG_AM29LV160MB",
      "DMG_AM29LV160MB",
      "DMG_AM29LV160MB",
      "DMG_AM29LV160MB",
      "DMG_AM29LV160MB",
      "DMG_AM29LV160MB"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[31,19]",
    "sourceFiles": [
      "fc_DMG_AT49F040_AUDIO.txt",
      "fc_DMG_AT49F040_WR.txt"
    ],
    "profileIds": [
      "DMG_AT49F040_AUDIO",
      "DMG_AT49F040_WR"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[32,0,125,0]",
    "sourceFiles": [
      "fc_DMG_M29W640.txt",
      "fc_DMG_M29W640.txt",
      "fc_DMG_M29W640.txt",
      "fc_DMG_M29W640_2.txt"
    ],
    "profileIds": [
      "DMG_M29W640",
      "DMG_M29W640",
      "DMG_M29W640",
      "DMG_M29W640_2"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[32,241]",
    "sourceFiles": [
      "fc_DMG_AM29F080_AUDIO.txt",
      "fc_DMG_AM29F080_WR.txt"
    ],
    "profileIds": [
      "DMG_AM29F080_AUDIO",
      "DMG_AM29F080_WR"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[32,32,196,196]",
    "sourceFiles": [
      "fc_DMG_HY29LV160TT.txt",
      "fc_DMG_HY29LV160TT.txt",
      "fc_DMG_HY29LV160TT.txt"
    ],
    "profileIds": [
      "DMG_HY29LV160TT",
      "DMG_HY29LV160TT",
      "DMG_HY29LV160TT"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[4,173]",
    "sourceFiles": [
      "fc_DMG_AM29F016_AUDIO.txt",
      "fc_DMG_AM29F016_WR.txt"
    ],
    "profileIds": [
      "DMG_AM29F016_AUDIO",
      "DMG_AM29F016_WR"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[4,199,0,0]",
    "sourceFiles": [
      "fc_DMG_TC58FVB016FT.txt",
      "fc_DMG_TC58FVB016FT.txt"
    ],
    "profileIds": [
      "DMG_TC58FVB016FT",
      "DMG_TC58FVB016FT"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[4,212]",
    "sourceFiles": [
      "fc_DMG_AM29F032_AUDIO.txt",
      "fc_DMG_AM29F032_AUDIO.txt",
      "fc_DMG_AM29F032_AUDIO.txt",
      "fc_DMG_AM29F032_WR.txt",
      "fc_DMG_AM29F032_WR.txt"
    ],
    "profileIds": [
      "DMG_AM29F032_AUDIO",
      "DMG_AM29F032_AUDIO",
      "DMG_AM29F032_AUDIO",
      "DMG_AM29F032_WR",
      "DMG_AM29F032_WR"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[4,4,125,125]",
    "sourceFiles": [
      "fc_DMG_29DL32TF-70.txt",
      "fc_DMG_M29W320DT.txt"
    ],
    "profileIds": [
      "DMG_29DL32TF-70",
      "DMG_M29W320DT"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[4,4,43,43]",
    "sourceFiles": [
      "fc_DMG_29DL163BD-90.txt",
      "fc_DMG_29DL163BD-90.txt"
    ],
    "profileIds": [
      "DMG_29DL163BD-90",
      "DMG_29DL163BD-90"
    ]
  },
  {
    "type": "DMG",
    "flashIdKey": "[4,4,54,54]",
    "sourceFiles": [
      "fc_DMG_29DL161TD-90.txt",
      "fc_DMG_29DL161TD-90.txt"
    ],
    "profileIds": [
      "DMG_29DL161TD-90",
      "DMG_29DL161TD-90"
    ]
  }
];
