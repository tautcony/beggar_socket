import { describe, expect, it } from 'vitest';

import {
  FLASHCART_GEOMETRY_EXCEPTIONS,
  FLASHCART_ID_COLLISIONS,
  FLASHCART_PROFILE_COUNTS,
  FLASHCART_PROFILES_LICENSE_NOTICE,
  loadAgbFlashcartProfiles,
  loadDmgFlashcartProfiles,
} from '@/data/flashcart-profiles';

import {
  ALLOWED_COMMAND_KEYS,
  ALLOWED_PROFILE_FIELDS,
  isValidPlaceholder,
  parseFlashgbxConfigText,
  validateAndNormalizeProfile,
} from '../../scripts/gen-flashcart-profiles.mjs';

describe('Flashcart profiles generated data & schema', () => {
  it('matches generated AGB and DMG profile counts', async () => {
    const [agb, dmg] = await Promise.all([
      loadAgbFlashcartProfiles(),
      loadDmgFlashcartProfiles(),
    ]);

    expect(agb.length).toBeGreaterThan(0);
    expect(dmg.length).toBeGreaterThan(0);
    expect(FLASHCART_PROFILE_COUNTS.AGB).toBe(agb.length);
    expect(FLASHCART_PROFILE_COUNTS.DMG).toBe(dmg.length);
    expect(FLASHCART_PROFILE_COUNTS.total).toBe(agb.length + dmg.length);
  });

  it('preserves FlashGBX GPL-3.0 copyright/license notice', () => {
    expect(FLASHCART_PROFILES_LICENSE_NOTICE).toContain('FlashGBX');
    expect(FLASHCART_PROFILES_LICENSE_NOTICE).toContain('ChisFlash-Tools-Exp');
    expect(FLASHCART_PROFILES_LICENSE_NOTICE).toContain('Lesserkuma');
    expect(FLASHCART_PROFILES_LICENSE_NOTICE).toContain('GPL-3.0');
  });

  it('validates schema, whitelisted fields, commands, and placeholders for all profiles', async () => {
    const [agb, dmg] = await Promise.all([
      loadAgbFlashcartProfiles(),
      loadDmgFlashcartProfiles(),
    ]);
    const all = [...agb, ...dmg];
    const ids = new Set<string>();

    for (const profile of all) {
      expect(profile.id).toBeTruthy();
      expect(ids.has(profile.id)).toBe(false);
      ids.add(profile.id);

      expect(['AGB', 'DMG']).toContain(profile.type);
      expect(profile.names.length).toBeGreaterThan(0);
      expect([3.3, 5]).toContain(profile.voltage);
      expect(typeof profile.command_set).toBe('string');

      for (const key of Object.keys(profile)) {
        if (key === 'id' || key === 'sourceFile' || key === 'geometryException') {
          continue;
        }
        expect(ALLOWED_PROFILE_FIELDS.has(key)).toBe(true);
      }

      for (const [cmdKey, steps] of Object.entries(profile.commands)) {
        expect(ALLOWED_COMMAND_KEYS.has(cmdKey)).toBe(true);
        expect(Array.isArray(steps)).toBe(true);
        if (cmdKey.endsWith('_wait_for')) {
          for (const tuple of steps as readonly unknown[]) {
            expect(Array.isArray(tuple)).toBe(true);
            expect((tuple as readonly unknown[]).length).toBe(3);
          }
        } else {
          for (const step of steps as readonly (readonly unknown[])[]) {
            expect([2, 3]).toContain(step.length);
            for (const arg of step) {
              if (typeof arg === 'string') {
                expect(isValidPlaceholder(arg)).toBe(true);
              }
            }
          }
        }
      }
    }
  });

  it('has no geometry exceptions or Flash ID collisions in ChisFlash profiles', () => {
    expect(FLASHCART_GEOMETRY_EXCEPTIONS).toEqual([]);
    expect(FLASHCART_ID_COLLISIONS).toEqual([]);
  });

  it('reproduces FlashGBX hex-to-dec parsing and fails on unknown fields, placeholders, wait_for, or unlisted geometry exceptions', () => {
    const parsed = parseFlashgbxConfigText(
      '{"type":"AGB","names":["Test"],"voltage":3.3,"flash_size":0x100000,"command_set":"AMD","commands":{"reset":[[0,0xF0]]}}',
      'fc_AGB_Test.txt',
    ) as { flash_size: number; commands: { reset: unknown[] } };
    expect(parsed.flash_size).toBe(0x100000);
    expect(parsed.commands.reset).toEqual([[0, 0xF0]]);

    expect(() => {
      validateAndNormalizeProfile({ ...parsed, unexpected_field: 1 }, 'fc_AGB_BadField.txt');
    }).toThrow(/Unknown profile field "unexpected_field" in "fc_AGB_BadField\.txt"/);

    expect(() => {
      validateAndNormalizeProfile(
        { ...parsed, commands: { reset: [['BAD_TOKEN', 0xF0]] } },
        'fc_AGB_BadPlaceholder.txt',
      );
    }).toThrow(/Invalid command argument "BAD_TOKEN" in "fc_AGB_BadPlaceholder\.txt"/);

    expect(() => {
      validateAndNormalizeProfile(
        { ...parsed, commands: { sector_erase_wait_for: [[0, 0x80]] } },
        'fc_AGB_BadWaitFor.txt',
      );
    }).toThrow(/Invalid wait_for tuple.*fc_AGB_BadWaitFor\.txt/);

    expect(() => {
      validateAndNormalizeProfile(
        { ...parsed, flash_size: 0x100000, sector_size: [[0x10000, 8]] },
        'fc_AGB_UnlistedGeom.txt',
      );
    }).toThrow(/Geometry mismatch in "fc_AGB_UnlistedGeom\.txt"/);
  });
});
