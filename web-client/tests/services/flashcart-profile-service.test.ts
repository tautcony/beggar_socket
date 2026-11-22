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

    expect(gbaFiltered).toHaveLength(59);
    expect(gbaFiltered.every(p => p.type === 'AGB')).toBe(true);
    expect(mbc5Filtered).toHaveLength(106);
    expect(mbc5Filtered.every(p => p.type === 'DMG')).toBe(true);
  });

  it('matches unique profile via flat flash_ids and rejects when ROM equals ID', async () => {
    const agb = await loadAgbFlashcartProfiles();
    requireProfile(agb, 'fc_AGB_TH50VSF3680.txt');

    // Unique ID [0x98, 0x00, 0x93, 0x00]
    const match = FlashcartProfileService.matchFlashId(agb, {
      rom: new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]),
      id: new Uint8Array([0x98, 0x00, 0x93, 0x00]),
    });
    expect(match.status).toBe('unique');
    if (match.status === 'unique') {
      expect(match.profile.sourceFile).toBe('fc_AGB_TH50VSF3680.txt');
    }

    // ROM bytes equal ID bytes -> no match
    const sameAsRom = FlashcartProfileService.matchFlashId(agb, {
      rom: new Uint8Array([0x98, 0x00, 0x93, 0x00]),
      id: new Uint8Array([0x98, 0x00, 0x93, 0x00]),
    });
    expect(sameAsRom.status).toBe('none');
  });

  it('matches profiles using flash_id_offsets', async () => {
    const dmg = await loadDmgFlashcartProfiles();
    const ig4mb = requireProfile(dmg, 'fc_DMG_iG_4MB.txt');
    expect(ig4mb.flash_id_offsets).toEqual([0, 2, 28]);

    const idBuf = new Uint8Array(32).fill(0x00);
    idBuf[0] = 0x01;
    idBuf[2] = 0x7E;
    idBuf[28] = 0x1C;
    const romBuf = new Uint8Array(32).fill(0xFF);

    const extracted = FlashcartProfileService.extractFlashIdBytes(idBuf, 3, ig4mb);
    expect(extracted).toEqual([0x01, 0x7E, 0x1C]);
    expect(FlashcartProfileService.matchesObservation(ig4mb, { rom: romBuf, id: idBuf })).toBe(true);
  });

  it('matches nested multi-offset flash_ids (e.g. fc_DMG_Dev_MBC3-FLASH.txt)', async () => {
    const dmg = await loadDmgFlashcartProfiles();
    const mbc3Dev = requireProfile(dmg, 'fc_DMG_Dev_MBC3-FLASH.txt');

    const sets = FlashcartProfileService.getFlashIdSets(mbc3Dev);
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
    const res = FlashcartProfileService.matchFlashId([mbc3Dev], obsMap);
    expect(res.status).toBe('unique');
    if (res.status === 'unique') {
      expect(res.profile.sourceFile).toBe('fc_DMG_Dev_MBC3-FLASH.txt');
    }

    // Across all DMG profiles, both MBC3-FLASH and MBC5-32M-R-FLASH match offset 0
    const dmgRes = FlashcartProfileService.matchFlashId(dmg, obsMap);
    expect(dmgRes.status).toBe('ambiguous');

    // Missing second offset -> no match
    const partialMap = new Map<number | null, FlashcartProbeObservation>([
      [0, { rom: [0x00, 0x00, 0x00, 0x00], id: [0xB0, 0xB0, 0xD0, 0xD0] }],
    ]);
    expect(FlashcartProfileService.matchesObservation(mbc3Dev, partialMap)).toBe(false);
  });

  it('returns ambiguous result when multiple profiles share the same Flash ID', async () => {
    const dmg = await loadDmgFlashcartProfiles();
    const res = FlashcartProfileService.matchFlashId(dmg, {
      rom: new Uint8Array([0x00, 0x00]),
      id: new Uint8Array([0x01, 0xA4]),
    });

    expect(res.status).toBe('ambiguous');
    if (res.status === 'ambiguous') {
      const files = res.candidates.map(c => c.sourceFile).sort();
      expect(files).toEqual(['fc_DMG_AM29F040_AUDIO.txt', 'fc_DMG_AM29F040_WR.txt']);
    }
  });

  it('returns none when no profile matches', async () => {
    const agb = await loadAgbFlashcartProfiles();
    const res = FlashcartProfileService.matchFlashId(agb, {
      rom: new Uint8Array([0x00, 0x00, 0x00, 0x00]),
      id: new Uint8Array([0x12, 0x34, 0x56, 0x78]),
    });
    expect(res).toEqual({ status: 'none' });
  });

  it('synthesizes CFIInfo from profile geometry and capabilities', async () => {
    const agb = await loadAgbFlashcartProfiles();
    const th50 = requireProfile(agb, 'fc_AGB_TH50VSF3680.txt');
    const cfi = FlashcartProfileService.synthesizeCfiInfo(th50, [0x98, 0x00, 0x93, 0x00]);

    expect(cfi.cfiDetected).toBe(false);
    expect(cfi.magic).toBe('');
    expect(cfi.isIntel).toBe(false);
    expect(cfi.deviceSize).toBe(0x800000);
    expect(cfi.eraseSectorRegions).toBe(4);
    expect(cfi.eraseSectorBlocks[0]).toEqual({
      sectorSize: 0x10000,
      sectorCount: 127,
      totalSize: 0x7F0000,
      startAddress: 0,
      endAddress: 0x7EFFFF,
    });
    expect(cfi.sectorErase).toBe(true);
    expect(cfi.singleWrite).toBe(true);
    expect(cfi.info).toContain(th50.names[0]);
  });

  it('rejects AUDIO/VIN write_pin when audioWePin is false and validates voltage', async () => {
    const dmg = await loadDmgFlashcartProfiles();
    const audioProfile = requireProfile(dmg, 'fc_DMG_AM29F040_AUDIO.txt');
    const wrProfile = requireProfile(dmg, 'fc_DMG_AM29F040_WR.txt');

    expect(FlashcartProfileService.validateCapabilities(audioProfile, { audioWePin: false, supportedVoltages: [3.3, 5] })).toEqual({
      valid: false,
      errorCode: 'unsupported',
      reason: expect.stringContaining('AUDIO'),
    });

    const vinProfile: FlashcartProfile = { ...audioProfile, write_pin: 'VIN' };
    expect(FlashcartProfileService.validateCapabilities(vinProfile, { audioWePin: false, supportedVoltages: [3.3, 5] })).toEqual({
      valid: false,
      errorCode: 'unsupported',
      reason: expect.stringContaining('VIN'),
    });

    expect(FlashcartProfileService.validateCapabilities(audioProfile, { audioWePin: true, supportedVoltages: [3.3, 5] })).toEqual({
      valid: true,
    });

    expect(FlashcartProfileService.validateCapabilities(wrProfile, { audioWePin: false, supportedVoltages: [3.3] })).toEqual({
      valid: false,
      errorCode: 'voltage_mismatch',
      reason: expect.stringContaining('5V'),
    });

    expect(FlashcartProfileService.validateCapabilities(wrProfile, { audioWePin: false, cartPowerControl: false })).toEqual({
      valid: false,
      errorCode: 'voltage_mismatch',
      reason: expect.stringContaining('5V'),
    });
  });
});
