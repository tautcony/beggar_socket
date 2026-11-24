import { describe, expect, it } from 'vitest';

import { loadAgbFlashcartProfiles, loadDmgFlashcartProfiles } from '@/data/flashcart-profiles';
import { FlashcartProfileService } from '@/services/flashcart-profile-service';
import type { FlashcartProbeObservation, FlashcartProfile } from '@/types/flashcart-profile';

function requireProfile(profiles: readonly FlashcartProfile[], sourceFile: string): FlashcartProfile {
  const found = profiles.find(p => p.sourceFile === sourceFile);
  if (!found) {
    throw new Error(`Missing test profile: ${sourceFile}`);
  }
  return found;
}

describe('FlashcartProfileService', () => {
  it('filters profiles by GBA / MBC5 mode', async () => {
    const [agb, dmg] = await Promise.all([
      loadAgbFlashcartProfiles(),
      loadDmgFlashcartProfiles(),
    ]);
    const combined = [...agb, ...dmg];

    const gbaFiltered = FlashcartProfileService.filterByMode(combined, 'GBA');
    const mbc5Filtered = FlashcartProfileService.filterByMode(combined, 'MBC5');

    expect(gbaFiltered).toHaveLength(11);
    expect(gbaFiltered.every(p => p.type === 'AGB')).toBe(true);
    expect(mbc5Filtered).toHaveLength(13);
    expect(mbc5Filtered.every(p => p.type === 'DMG')).toBe(true);
  });

  it('includes ChisFlash-Tools-Exp NOR IDs and burn profiles for DMG and AGB', async () => {
    const [agb, dmg] = await Promise.all([
      loadAgbFlashcartProfiles(),
      loadDmgFlashcartProfiles(),
    ]);

    const s29gl256Max = requireProfile(dmg, 'fc_DMG_ChisFlash-MBC5-MAX_S29GL256N.txt');
    expect(s29gl256Max.flash_id_offsets).toEqual([0x00, 0x02, 0x1C, 0x1E]);
    expect(s29gl256Max.flash_ids).toEqual([[0x01, 0x7E, 0x22, 0x01]]);

    const is29gl256Max = requireProfile(dmg, 'fc_DMG_ChisFlash-MBC5-MAX_IS29GL256.txt');
    expect(is29gl256Max.flash_ids).toEqual([[0x9D, 0x7E, 0x22, 0x01]]);

    const mx29lv640eb = requireProfile(dmg, 'fc_DMG_ChisFlash-MBC5-8M_MX29LV640EB.txt');
    expect(mx29lv640eb.sector_size).toEqual([[0x2000, 8], [0x10000, 127]]);
    expect(mx29lv640eb.commands.buffer_write).toBeUndefined();

    const s70gl02gs = requireProfile(agb, 'fc_AGB_ChisFlash_S70GL02GS.txt');
    expect(s70gl02gs.double_die).toBe(true);
    expect(s70gl02gs.flash_size).toBe(0x10000000);
    expect(s70gl02gs.flash_ids).toEqual([[0x01, 0x00, 0x7E, 0x22, 0x48, 0x22, 0x01, 0x22]]);
  });

  it('matches unique profile via flash_id_offsets and rejects when ROM equals ID', async () => {
    const agb = await loadAgbFlashcartProfiles();
    requireProfile(agb, 'fc_AGB_ChisFlash_S29GL256.txt');

    const idBuf = new Uint8Array(32).fill(0x00);
    idBuf[0] = 0x01;
    idBuf[1] = 0x00;
    idBuf[2] = 0x7E;
    idBuf[3] = 0x22;
    idBuf[0x1C] = 0x22;
    idBuf[0x1D] = 0x22;
    idBuf[0x1E] = 0x01;
    idBuf[0x1F] = 0x22;
    const romBuf = new Uint8Array(32).fill(0xFF);

    const match = FlashcartProfileService.matchFlashId(agb, { rom: romBuf, id: idBuf });
    expect(match.status).toBe('unique');
    if (match.status === 'unique') {
      expect(match.profile.sourceFile).toBe('fc_AGB_ChisFlash_S29GL256.txt');
    }

    const sameAsRom = FlashcartProfileService.matchFlashId(agb, { rom: idBuf, id: idBuf });
    expect(sameAsRom.status).toBe('none');
  });

  it('matches DMG profiles using flash_id_offsets', async () => {
    const dmg = await loadDmgFlashcartProfiles();
    const s29gl256Max = requireProfile(dmg, 'fc_DMG_ChisFlash-MBC5-MAX_S29GL256N.txt');
    expect(s29gl256Max.flash_id_offsets).toEqual([0x00, 0x02, 0x1C, 0x1E]);

    const idBuf = new Uint8Array(32).fill(0x00);
    idBuf[0] = 0x01;
    idBuf[2] = 0x7E;
    idBuf[0x1C] = 0x22;
    idBuf[0x1E] = 0x01;
    const romBuf = new Uint8Array(32).fill(0xFF);

    const extracted = FlashcartProfileService.extractFlashIdBytes(idBuf, 4, s29gl256Max);
    expect(extracted).toEqual([0x01, 0x7E, 0x22, 0x01]);
    expect(FlashcartProfileService.matchesObservation(s29gl256Max, { rom: romBuf, id: idBuf })).toBe(true);
  });

  it('matches nested multi-offset flash_ids', async () => {
    const dmg = await loadDmgFlashcartProfiles();
    const baseProfile = requireProfile(dmg, 'fc_DMG_ChisFlash-MBC5-MAX_S29GL256N.txt');
    const nestedProfile: FlashcartProfile = {
      ...baseProfile,
      id: 'DMG_Test_Nested',
      sourceFile: 'fc_DMG_Test_Nested.txt',
      flash_id_offsets: undefined,
      flash_ids: [[0, [0xB0, 0xB0, 0xD0, 0xD0], 0x400000, [0xB0, 0xB0, 0xD0, 0xD0]]],
    };

    const sets = FlashcartProfileService.getFlashIdSets(nestedProfile);
    expect(sets).toEqual([
      [
        { offset: 0, bytes: [0xB0, 0xB0, 0xD0, 0xD0] },
        { offset: 0x400000, bytes: [0xB0, 0xB0, 0xD0, 0xD0] },
      ],
    ]);

    const obsMap = new Map<number | null, FlashcartProbeObservation>([
      [0, { rom: [0x00, 0x00, 0x00, 0x00], id: [0xB0, 0xB0, 0xD0, 0xD0] }],
      [0x400000, { rom: [0x00, 0x00, 0x00, 0x00], id: [0xB0, 0xB0, 0xD0, 0xD0] }],
    ]);
    const res = FlashcartProfileService.matchFlashId([nestedProfile], obsMap);
    expect(res.status).toBe('unique');

    const partialMap = new Map<number | null, FlashcartProbeObservation>([
      [0, { rom: [0x00, 0x00, 0x00, 0x00], id: [0xB0, 0xB0, 0xD0, 0xD0] }],
    ]);
    expect(FlashcartProfileService.matchesObservation(nestedProfile, partialMap)).toBe(false);
  });

  it('returns ambiguous result when multiple profiles share the same Flash ID', async () => {
    const dmg = await loadDmgFlashcartProfiles();
    const base = requireProfile(dmg, 'fc_DMG_ChisFlash-MBC5-MAX_S29GL256N.txt');
    const cloneA: FlashcartProfile = { ...base, id: 'A', sourceFile: 'A.txt', flash_id_offsets: undefined, flash_ids: [[0x01, 0xA4]] };
    const cloneB: FlashcartProfile = { ...base, id: 'B', sourceFile: 'B.txt', flash_id_offsets: undefined, flash_ids: [[0x01, 0xA4]] };

    const res = FlashcartProfileService.matchFlashId([cloneA, cloneB], {
      rom: new Uint8Array([0x00, 0x00]),
      id: new Uint8Array([0x01, 0xA4]),
    });

    expect(res.status).toBe('ambiguous');
    if (res.status === 'ambiguous') {
      expect(res.candidates.map(c => c.sourceFile).sort()).toEqual(['A.txt', 'B.txt']);
    }
  });

  it('returns none when no profile matches', async () => {
    const agb = await loadAgbFlashcartProfiles();
    const res = FlashcartProfileService.matchFlashId(agb, {
      rom: new Uint8Array(32).fill(0x00),
      id: new Uint8Array(32).fill(0x12),
    });
    expect(res).toEqual({ status: 'none' });
  });

  it('synthesizes CFIInfo from profile geometry and capabilities', async () => {
    const dmg = await loadDmgFlashcartProfiles();
    const lv640eb = requireProfile(dmg, 'fc_DMG_ChisFlash-MBC5-8M_MX29LV640EB.txt');
    const cfi = FlashcartProfileService.synthesizeCfiInfo(lv640eb, [0xC2, 0xCB]);

    expect(cfi.cfiDetected).toBe(false);
    expect(cfi.magic).toBe('');
    expect(cfi.isIntel).toBe(false);
    expect(cfi.deviceSize).toBe(0x800000);
    expect(cfi.eraseSectorRegions).toBe(2);
    expect(cfi.eraseSectorBlocks[0]).toEqual({
      sectorSize: 0x2000,
      sectorCount: 8,
      totalSize: 0x10000,
      startAddress: 0,
      endAddress: 0xFFFF,
    });
    expect(cfi.sectorErase).toBe(true);
    expect(cfi.singleWrite).toBe(true);
    expect(cfi.bufferWrite).toBe(false);
    expect(cfi.info).toContain(lv640eb.names[0]);
  });

  it('rejects AUDIO/VIN write_pin when audioWePin is false and validates voltage', async () => {
    const dmg = await loadDmgFlashcartProfiles();
    const wrProfile = requireProfile(dmg, 'fc_DMG_ChisFlash-MBC5-MAX_S29GL256N.txt');
    const audioProfile: FlashcartProfile = { ...wrProfile, write_pin: 'AUDIO' };
    const vinProfile: FlashcartProfile = { ...wrProfile, write_pin: 'VIN' };
    const fiveVoltProfile: FlashcartProfile = { ...wrProfile, voltage: 5 };

    expect(FlashcartProfileService.validateCapabilities(audioProfile, { audioWePin: false, supportedVoltages: [3.3, 5] })).toEqual({
      valid: false,
      errorCode: 'unsupported',
      reason: expect.stringContaining('AUDIO'),
    });

    expect(FlashcartProfileService.validateCapabilities(vinProfile, { audioWePin: false, supportedVoltages: [3.3, 5] })).toEqual({
      valid: false,
      errorCode: 'unsupported',
      reason: expect.stringContaining('VIN'),
    });

    expect(FlashcartProfileService.validateCapabilities(audioProfile, { audioWePin: true, supportedVoltages: [3.3, 5] })).toEqual({
      valid: true,
    });

    expect(FlashcartProfileService.validateCapabilities(fiveVoltProfile, { audioWePin: false, supportedVoltages: [3.3] })).toEqual({
      valid: false,
      errorCode: 'voltage_mismatch',
      reason: expect.stringContaining('5V'),
    });

    expect(FlashcartProfileService.validateCapabilities(fiveVoltProfile, { audioWePin: false, cartPowerControl: false })).toEqual({
      valid: false,
      errorCode: 'voltage_mismatch',
      reason: expect.stringContaining('5V'),
    });
  });
});
