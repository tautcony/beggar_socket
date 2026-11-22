export const BOOST_PROBE_REQUEST = new Uint8Array([0x55, 0xaa]);
export const BOOST_PROBE_ACK = 0x01;
export const BOOST_ACK_OK = 0x01;
export const BOOST_ACK_ERR = 0x02;

export const BOOST_MAX_WRITE_CHUNK = 0x1000;
export const BOOST_MAX_READ_CHUNK = 0x2000;
export const BOOST_MAX_CRC_CHUNK = 0x20000;

/**
 * ChisFlash-Beggar-Boost 固件扩展命令集
 */
export const BoostCommand = {
  QUERY_INFO: 0xa1,
  MODE_AGB: 0xa2,
  MODE_DMG: 0xa3,
  SET_VARIABLE: 0xa6,
  GET_VARIABLE: 0xad,
  READ_DMG_ROM: 0xb1,
  WRITE_DMG_BYTE: 0xb2,
  WRITE_DMG_RANGE: 0xb3,
  READ_AGB_ROM: 0xc1,
  WRITE_AGB_WORD: 0xc2,
  READ_AGB_RAM: 0xc3,
  WRITE_AGB_RAM: 0xc4,
  READ_AGB_EEPROM: 0xc5,
  WRITE_AGB_EEPROM: 0xc6,
  READ_AGB_RTC: 0xca,
  WRITE_DMG_FLASH: 0xd1,
  WRITE_AGB_FLASH: 0xd2,
  PROGRAM_FLASH: 0xd3,
  WRITE_UNITS: 0xd4,
  CRC_ROM: 0xd5,
} as const;

export type BoostCommandCode = (typeof BoostCommand)[keyof typeof BoostCommand];

export type BoostMode = 'agb' | 'dmg';
