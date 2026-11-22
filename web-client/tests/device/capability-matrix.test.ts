import { describe, expect, it } from 'vitest';

import {
  type CapabilityKey,
  type CapabilityRuleId,
  type CapabilitySignals,
  type DeviceDefinition,
  type FirmwareDefinition,
  resolveCapabilities,
} from '@/device';
import {
  BEGGAR_STC_DEVICE,
  BEGGAR_STC_FIRMWARE,
  BEGGAR_STM_BOOST_FIRMWARE,
  BEGGAR_STM_DEVICE,
  BEGGAR_STM_FIRMWARE,
  FLASHGBX_FIRMWARE,
  GBFLASH_DEVICE,
} from '@/device/definitions';

type Column = 'stm' | 'boost' | 'stc' | 'flashgbx';
/** `supported`, `unsupported`, or the rule id of a conditional capability. */
type Expectation = 'supported' | 'unsupported' | CapabilityRuleId;

/**
 * Normative capability matrix from the change design, restated independently from the
 * definitions. Both sides are exhaustive `Record`s, so a new `CapabilityKey` or a new
 * firmware column fails to compile until this table is updated.
 */
const MATRIX: Record<CapabilityKey, Record<Column, Expectation>> = {
  'rom.read': { stm: 'supported', boost: 'supported', stc: 'supported', flashgbx: 'supported' },
  'rom.write': { stm: 'supported', boost: 'supported', stc: 'supported', flashgbx: 'supported' },
  'rom.erase.chip': { stm: 'supported', boost: 'supported', stc: 'supported', flashgbx: 'supported' },
  'rom.erase.sector': { stm: 'supported', boost: 'supported', stc: 'supported', flashgbx: 'supported' },
  'rom.verify.crc': { stm: 'supported', boost: 'supported', stc: 'supported', flashgbx: 'supported' },
  'rom.bankSwitch.32M': {
    stm: 'unsupported',
    boost: 'unsupported',
    stc: 'unsupported',
    flashgbx: 'unsupported',
  },
  'ram.read': { stm: 'supported', boost: 'supported', stc: 'supported', flashgbx: 'supported' },
  'ram.write': { stm: 'supported', boost: 'supported', stc: 'supported', flashgbx: 'supported' },
  'ram.fram.gba': { stm: 'supported', boost: 'supported', stc: 'unsupported', flashgbx: 'supported' },
  'ram.fram.gbc': { stm: 'supported', boost: 'supported', stc: 'supported', flashgbx: 'supported' },
  'cart.powerControl': {
    stm: 'unsupported',
    boost: 'unsupported',
    stc: 'supported',
    flashgbx: 'gbflash.power-control-present',
  },
  'cart.voltageSwitch': {
    stm: 'unsupported',
    boost: 'unsupported',
    stc: 'unsupported',
    flashgbx: 'supported',
  },
  'cart.presenceDetect': {
    stm: 'unsupported',
    boost: 'unsupported',
    stc: 'unsupported',
    flashgbx: 'gbflash.presence-detect-present',
  },
  'cart.audioWePin': {
    stm: 'unsupported',
    boost: 'unsupported',
    stc: 'unsupported',
    flashgbx: 'gbflash.audio-write-enabled',
  },
  'tool.rtc.gba': { stm: 'supported', boost: 'supported', stc: 'supported', flashgbx: 'supported' },
  'tool.rtc.mbc3': { stm: 'supported', boost: 'supported', stc: 'supported', flashgbx: 'supported' },
  'tool.rumble.gba': { stm: 'supported', boost: 'supported', stc: 'supported', flashgbx: 'supported' },
  'tool.debug': { stm: 'supported', boost: 'supported', stc: 'supported', flashgbx: 'unsupported' },
  'tool.ppbUnlock': { stm: 'supported', boost: 'supported', stc: 'supported', flashgbx: 'unsupported' },
  'profile.flashcartDb': {
    stm: 'unsupported',
    boost: 'unsupported',
    stc: 'unsupported',
    flashgbx: 'supported',
  },
};

const COLUMNS: readonly {
  column: Column;
  firmware: FirmwareDefinition;
  device: DeviceDefinition;
}[] = [
  { column: 'stm', firmware: BEGGAR_STM_FIRMWARE, device: BEGGAR_STM_DEVICE },
  { column: 'boost', firmware: BEGGAR_STM_BOOST_FIRMWARE, device: BEGGAR_STM_DEVICE },
  { column: 'stc', firmware: BEGGAR_STC_FIRMWARE, device: BEGGAR_STC_DEVICE },
  { column: 'flashgbx', firmware: FLASHGBX_FIRMWARE, device: GBFLASH_DEVICE },
];

const ALL_SIGNALS_TRUE: CapabilitySignals = {
  powerControlPresent: true,
  audioWriteEnabled: true,
  presenceDetectPresent: true,
};

describe('capability matrix', () => {
  it('declares every capability key for all four firmwares', () => {
    for (const { column, firmware } of COLUMNS) {
      for (const key of Object.keys(MATRIX) as CapabilityKey[]) {
        expect(firmware.baseCapabilities[key], `${firmware.id} is missing ${key}`).toBeDefined();
        expect(MATRIX[key][column]).toBeTypeOf('string');
      }
    }
  });

  it.each(COLUMNS)('matches the matrix for $firmware.id', ({ column, firmware, device }) => {
    const resolved = resolveCapabilities(firmware.baseCapabilities, device.hardware, ALL_SIGNALS_TRUE);

    for (const key of Object.keys(MATRIX) as CapabilityKey[]) {
      const expected = MATRIX[key][column];
      const declaration = firmware.baseCapabilities[key];

      if (expected === 'supported') {
        expect(declaration, `${key} declaration`).toEqual({ state: 'supported' });
      } else if (expected === 'unsupported') {
        expect(declaration?.state, `${key} declaration`).toBe('unsupported');
        expect(declaration, `${key} needs a reason`).toHaveProperty('reason');
      } else {
        expect(declaration, `${key} declaration`).toEqual(
          expect.objectContaining({ state: 'conditional', ruleId: expected }),
        );
      }

      // Resolved values follow the declaration when every rule input is present.
      expect(resolved.has(key), `${firmware.id} resolves ${key}`).toBe(expected !== 'unsupported');
    }
  });

  it('keeps rom.bankSwitch.32M unsupported with a pending-confirmation reason', () => {
    for (const { firmware } of COLUMNS) {
      const declaration = firmware.baseCapabilities['rom.bankSwitch.32M'];
      expect(declaration?.state).toBe('unsupported');
      expect(JSON.stringify(declaration)).toContain('pending');
    }
  });

  it('keeps FlashGBX RTC available for the existing UI and service entrypoints', () => {
    const resolved = resolveCapabilities(FLASHGBX_FIRMWARE.baseCapabilities, GBFLASH_DEVICE.hardware);
    expect(resolved.has('tool.rtc.gba')).toBe(true);
    expect(resolved.has('tool.rtc.mbc3')).toBe(true);
  });
});
