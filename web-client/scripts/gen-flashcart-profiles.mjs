#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_CLIENT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_CONFIG_DIR = path.resolve(WEB_CLIENT_ROOT, '../FlashGBX/FlashGBX/config');
const DEFAULT_OUTPUT_DIR = path.resolve(WEB_CLIENT_ROOT, 'src/data/flashcart-profiles');

export const FLASHGBX_LICENSE_NOTICE = [
  'Flashcart profile data converted from FlashGBX (https://github.com/Lesserkuma/FlashGBX).',
  'Copyright (C) Lesserkuma — Licensed under GNU General Public License v3.0 (GPL-3.0).',
].join('\n');

const LICENSE_BANNER = `/*!\n * ${FLASHGBX_LICENSE_NOTICE.split('\n').join('\n * ')}\n */`;

export const ALLOWED_PROFILE_FIELDS = new Set([
  'type',
  'names',
  'voltage',
  'command_set',
  'commands',
  'flash_ids',
  '_flash_ids',
  'flash_ids_banks',
  'flash_id_offsets',
  'flash_size',
  'sector_size',
  'sector_size_from_cfi',
  'write_pin',
  'buffer_size',
  'chip_erase_timeout',
  'start_addr',
  'first_bank',
  'mbc',
  'voltage_variants',
  'reset_every',
  'flash_commands_on_bank_1',
  'enable_pullup_wr',
  'enable_pullups',
  'wait_read_status_register',
  'flash_bank_size',
  'flash_bank_select_type',
  'status_register_mask',
  'status_register_value',
  'read_identifier_at',
  'set_irq_high',
  'set_audio_high',
  'dmg-mbc5-32m-flash',
  'dmg-mmsa-jpn',
  'm29w640',
  'rtc',
  'rumble',
  'double_die',
  'manual_select',
  '3d_memory',
  'power_cycle',
  'sintax',
  'vast_fame',
  'audio_gates_flash_write',
  'unlock_before_rom_dump',
  'hidden_sector_size',
  'pulse_reset_after_write',
]);

export const ALLOWED_COMMAND_KEYS = new Set([
  'reset',
  'read_identifier',
  'read_cfi',
  'single_write',
  'single_write_wait_for',
  'buffer_write',
  'buffer_write_wait_for',
  'sector_erase',
  'sector_erase_wait_for',
  'chip_erase',
  'chip_erase_wait_for',
  'unlock',
  'unlock_read',
  'read_status_register',
  'fast_write',
  'fast_write_wait_for',
  'bank_switch',
  'page_write',
  'page_write_wait_for',
  'read_hidden_sector',
  '_chip_erase',
]);

export const KNOWN_GEOMETRY_EXCEPTIONS = new Map([
  [
    'fc_AGB_TH50VSF3680.txt',
    {
      expectedFlashSize: 0x800000,
      actualSectorTotal: 0x1000000,
      note: 'Dual-region/dual-die sector_size description (16 MiB) exceeds flash_size (8 MiB) in FlashGBX config.',
    },
  ],
  [
    'fc_AGB_iG_32MB_EEPROM.txt',
    {
      expectedFlashSize: 0x1FFFF00,
      actualSectorTotal: 0x2000000,
      note: 'flash_size (0x1FFFF00) reserves 256 bytes for EEPROM and is not an exact multiple of sector_size (0x20000).',
    },
  ],
]);

const PLACEHOLDER_REGEX = /^(?:SA|PA|PD|BS|WR|ID|SA\+(?:0x[0-9A-Fa-f]+|\d+))$/;

export function isValidPlaceholder(value) {
  return typeof value === 'string' && PLACEHOLDER_REGEX.test(value);
}

/**
 * Reproduce FlashGBX's hex-to-dec pre-pass before JSON.parse:
 * re.sub("(0x[0-9A-F]+)", lambda m: str(int(m.group(1), 16)), data)
 */
export function parseFlashgbxConfigText(rawText, filename = '<unknown>') {
  const decimalized = rawText.replace(/(0x[0-9A-F]+)/g, (_, hex) => String(Number.parseInt(hex, 16)));
  try {
    return JSON.parse(decimalized);
  } catch (error) {
    throw new Error(`Failed to parse FlashGBX config "${filename}": ${error.message}`);
  }
}

function validateCommandArg(arg, filename, cmdKey) {
  if (arg === null) {
    return;
  }
  if (typeof arg === 'number' && Number.isInteger(arg) && arg >= 0) {
    return;
  }
  if (isValidPlaceholder(arg)) {
    return;
  }
  throw new Error(`Invalid command argument ${JSON.stringify(arg)} in "${filename}" (${cmdKey})`);
}

function validateWaitForEntry(entry, filename, cmdKey) {
  if (!Array.isArray(entry) || entry.length !== 3) {
    throw new Error(`Invalid wait_for tuple ${JSON.stringify(entry)} in "${filename}" (${cmdKey}): expected 3-element array`);
  }
  const [value, mask, timeout] = entry;
  for (const elem of [value, mask]) {
    if (elem !== null && !(typeof elem === 'number' && Number.isInteger(elem)) && !isValidPlaceholder(elem)) {
      throw new Error(`Invalid wait_for element ${JSON.stringify(elem)} in "${filename}" (${cmdKey})`);
    }
  }
  if (timeout !== null && !(typeof timeout === 'number' && Number.isInteger(timeout) && timeout >= 0)) {
    throw new Error(`Invalid wait_for timeout ${JSON.stringify(timeout)} in "${filename}" (${cmdKey})`);
  }
}

function validateFlashIdEntry(entry, filename) {
  if (!Array.isArray(entry) || entry.length === 0) {
    throw new Error(`Invalid flash_ids entry ${JSON.stringify(entry)} in "${filename}"`);
  }
  if (entry.length > 1 && Array.isArray(entry[1])) {
    if (entry.length % 2 !== 0) {
      throw new Error(`Invalid nested flash_ids entry ${JSON.stringify(entry)} in "${filename}": expected [offset, bytes[], ...]`);
    }
    for (let i = 0; i < entry.length; i += 2) {
      if (typeof entry[i] !== 'number' || !Number.isInteger(entry[i])) {
        throw new Error(`Invalid nested flash_ids offset ${JSON.stringify(entry[i])} in "${filename}"`);
      }
      if (!Array.isArray(entry[i + 1]) || !entry[i + 1].every(b => typeof b === 'number' && Number.isInteger(b) && b >= 0 && b <= 255)) {
        throw new Error(`Invalid nested flash_ids bytes ${JSON.stringify(entry[i + 1])} in "${filename}"`);
      }
    }
    return;
  }
  if (!entry.every(b => typeof b === 'number' && Number.isInteger(b) && b >= 0 && b <= 255)) {
    throw new Error(`Invalid flat flash_ids bytes ${JSON.stringify(entry)} in "${filename}"`);
  }
}

export function validateAndNormalizeProfile(raw, filename) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Profile "${filename}" must be a JSON object`);
  }

  for (const key of Object.keys(raw)) {
    if (!ALLOWED_PROFILE_FIELDS.has(key)) {
      throw new Error(`Unknown profile field "${key}" in "${filename}"`);
    }
  }

  if (raw.type !== 'AGB' && raw.type !== 'DMG') {
    throw new Error(`Invalid or missing "type" (${JSON.stringify(raw.type)}) in "${filename}"`);
  }
  if (!Array.isArray(raw.names) || raw.names.length === 0 || !raw.names.every(n => typeof n === 'string' && n.length > 0)) {
    throw new Error(`Invalid or missing "names" in "${filename}"`);
  }
  if (typeof raw.voltage !== 'number' || (raw.voltage !== 3.3 && raw.voltage !== 5)) {
    throw new Error(`Invalid "voltage" (${JSON.stringify(raw.voltage)}) in "${filename}"`);
  }
  if (typeof raw.command_set !== 'string') {
    throw new Error(`Invalid or missing "command_set" in "${filename}"`);
  }
  if (!raw.commands || typeof raw.commands !== 'object' || Array.isArray(raw.commands)) {
    throw new Error(`Invalid or missing "commands" in "${filename}"`);
  }

  for (const [cmdKey, cmdVal] of Object.entries(raw.commands)) {
    if (!ALLOWED_COMMAND_KEYS.has(cmdKey)) {
      throw new Error(`Unknown command key "${cmdKey}" in "${filename}"`);
    }
    if (!Array.isArray(cmdVal)) {
      throw new Error(`Command "${cmdKey}" must be an array in "${filename}"`);
    }
    if (cmdKey.endsWith('_wait_for')) {
      for (const entry of cmdVal) {
        validateWaitForEntry(entry, filename, cmdKey);
      }
    } else {
      for (const step of cmdVal) {
        if (!Array.isArray(step) || (step.length !== 2 && step.length !== 3)) {
          throw new Error(`Invalid command step ${JSON.stringify(step)} in "${filename}" (${cmdKey})`);
        }
        for (const arg of step) {
          validateCommandArg(arg, filename, cmdKey);
        }
      }
    }
  }

  if (raw.flash_ids !== undefined) {
    if (!Array.isArray(raw.flash_ids)) {
      throw new Error(`"flash_ids" must be an array in "${filename}"`);
    }
    for (const entry of raw.flash_ids) {
      validateFlashIdEntry(entry, filename);
    }
  }

  if (raw.flash_id_offsets !== undefined) {
    if (!Array.isArray(raw.flash_id_offsets) || !raw.flash_id_offsets.every(o => typeof o === 'number' && Number.isInteger(o) && o >= 0)) {
      throw new Error(`Invalid "flash_id_offsets" in "${filename}"`);
    }
  }

  let geometryException;
  if (raw.sector_size !== undefined) {
    if (typeof raw.sector_size === 'number') {
      if (!Number.isInteger(raw.sector_size) || raw.sector_size <= 0) {
        throw new Error(`Invalid numeric "sector_size" in "${filename}"`);
      }
      if (typeof raw.flash_size === 'number' && raw.flash_size % raw.sector_size !== 0) {
        const known = KNOWN_GEOMETRY_EXCEPTIONS.get(filename);
        const roundedTotal = Math.ceil(raw.flash_size / raw.sector_size) * raw.sector_size;
        if (!known || known.expectedFlashSize !== raw.flash_size || known.actualSectorTotal !== roundedTotal) {
          throw new Error(
            `"flash_size" (${raw.flash_size}) is not divisible by "sector_size" (${raw.sector_size}) in "${filename}" (not in KNOWN_GEOMETRY_EXCEPTIONS)`,
          );
        }
        geometryException = known;
      }
    } else if (Array.isArray(raw.sector_size)) {
      let actualSectorTotal = 0;
      for (const pair of raw.sector_size) {
        if (!Array.isArray(pair) || pair.length !== 2 || !Number.isInteger(pair[0]) || pair[0] <= 0 || !Number.isInteger(pair[1]) || pair[1] <= 0) {
          throw new Error(`Invalid sector_size tuple ${JSON.stringify(pair)} in "${filename}"`);
        }
        actualSectorTotal += pair[0] * pair[1];
      }
      if (typeof raw.flash_size === 'number' && actualSectorTotal !== raw.flash_size) {
        const known = KNOWN_GEOMETRY_EXCEPTIONS.get(filename);
        if (!known || known.expectedFlashSize !== raw.flash_size || known.actualSectorTotal !== actualSectorTotal) {
          throw new Error(
            `Geometry mismatch in "${filename}": sector_size sum=${actualSectorTotal} != flash_size=${raw.flash_size} (not in KNOWN_GEOMETRY_EXCEPTIONS)`,
          );
        }
        geometryException = known;
      }
    } else {
      throw new Error(`Invalid "sector_size" type in "${filename}"`);
    }
  }

  const id = filename.replace(/^fc_/, '').replace(/\.txt$/, '');
  return {
    id,
    sourceFile: filename,
    ...raw,
    ...(geometryException ? { geometryException } : {}),
  };
}

export function computeFlashIdCollisions(profiles) {
  const buckets = new Map();
  for (const profile of profiles) {
    for (const entry of profile.flash_ids ?? []) {
      const key = `${profile.type}:${JSON.stringify(entry)}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          type: profile.type,
          flashIdKey: JSON.stringify(entry),
          sourceFiles: [],
          profileIds: [],
        };
        buckets.set(key, bucket);
      }
      bucket.sourceFiles.push(profile.sourceFile);
      bucket.profileIds.push(profile.id);
    }
  }
  return Array.from(buckets.values())
    .filter(b => b.sourceFiles.length > 1)
    .sort((a, b) => a.type.localeCompare(b.type) || a.flashIdKey.localeCompare(b.flashIdKey));
}

export function buildProfilesFromDirectory(configDir = DEFAULT_CONFIG_DIR) {
  const filenames = fs.readdirSync(configDir)
    .filter(name => /^fc_.*\.txt$/.test(name))
    .sort();

  const agb = [];
  const dmg = [];
  const geometryExceptions = [];

  for (const filename of filenames) {
    const rawText = fs.readFileSync(path.join(configDir, filename), 'utf8');
    const parsed = parseFlashgbxConfigText(rawText, filename);
    const profile = validateAndNormalizeProfile(parsed, filename);
    if (profile.geometryException) {
      geometryExceptions.push({
        sourceFile: profile.sourceFile,
        ...profile.geometryException,
      });
    }
    if (profile.type === 'AGB') {
      agb.push(profile);
    } else {
      dmg.push(profile);
    }
  }

  for (const knownFile of KNOWN_GEOMETRY_EXCEPTIONS.keys()) {
    if (!geometryExceptions.some(item => item.sourceFile === knownFile)) {
      throw new Error(`Known geometry exception "${knownFile}" was not encountered during generation`);
    }
  }

  const collisions = computeFlashIdCollisions([...agb, ...dmg]);
  return { agb, dmg, geometryExceptions, collisions };
}

function renderDataModule(exportName, profiles) {
  return `${LICENSE_BANNER}
/* eslint-disable */
import type { FlashcartProfile } from '@/types/flashcart-profile';

export const FLASHCART_PROFILES_LICENSE_NOTICE = ${JSON.stringify(FLASHGBX_LICENSE_NOTICE)};

export const ${exportName}: readonly FlashcartProfile[] = ${JSON.stringify(profiles, null, 2)};
`;
}

function renderSnapshotsModule(agbCount, dmgCount, geometryExceptions, collisions) {
  return `${LICENSE_BANNER}
/* eslint-disable */
import type {
  FlashcartCollisionEntry,
  FlashcartGeometryExceptionSnapshot,
} from '@/types/flashcart-profile';

export const FLASHCART_PROFILE_COUNTS = {
  AGB: ${agbCount},
  DMG: ${dmgCount},
  total: ${agbCount + dmgCount},
} as const;

export const FLASHCART_GEOMETRY_EXCEPTIONS: readonly FlashcartGeometryExceptionSnapshot[] = ${JSON.stringify(geometryExceptions, null, 2)};

export const FLASHCART_ID_COLLISIONS: readonly FlashcartCollisionEntry[] = ${JSON.stringify(collisions, null, 2)};
`;
}

function renderIndexModule() {
  return `${LICENSE_BANNER}
/* eslint-disable */
import type { FlashcartMode, FlashcartProfile, FlashcartType } from '@/types/flashcart-profile';

export {
  FLASHCART_GEOMETRY_EXCEPTIONS,
  FLASHCART_ID_COLLISIONS,
  FLASHCART_PROFILE_COUNTS,
} from './snapshots';

export const FLASHCART_PROFILES_LICENSE_NOTICE = ${JSON.stringify(FLASHGBX_LICENSE_NOTICE)};

export async function loadAgbFlashcartProfiles(): Promise<readonly FlashcartProfile[]> {
  const mod = await import('./agb');
  return mod.AGB_FLASHCART_PROFILES;
}

export async function loadDmgFlashcartProfiles(): Promise<readonly FlashcartProfile[]> {
  const mod = await import('./dmg');
  return mod.DMG_FLASHCART_PROFILES;
}

export function loadFlashcartProfilesByType(type: FlashcartType): Promise<readonly FlashcartProfile[]> {
  return type === 'AGB' ? loadAgbFlashcartProfiles() : loadDmgFlashcartProfiles();
}

export function modeToFlashcartType(mode: FlashcartMode): FlashcartType {
  return mode === 'GBA' ? 'AGB' : 'DMG';
}

export function loadFlashcartProfilesByMode(mode: FlashcartMode): Promise<readonly FlashcartProfile[]> {
  return loadFlashcartProfilesByType(modeToFlashcartType(mode));
}
`;
}

export function writeFlashcartProfileArtifacts({
  configDir = DEFAULT_CONFIG_DIR,
  outputDir = DEFAULT_OUTPUT_DIR,
} = {}) {
  const { agb, dmg, geometryExceptions, collisions } = buildProfilesFromDirectory(configDir);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'agb.ts'), renderDataModule('AGB_FLASHCART_PROFILES', agb), 'utf8');
  fs.writeFileSync(path.join(outputDir, 'dmg.ts'), renderDataModule('DMG_FLASHCART_PROFILES', dmg), 'utf8');
  fs.writeFileSync(
    path.join(outputDir, 'snapshots.ts'),
    renderSnapshotsModule(agb.length, dmg.length, geometryExceptions, collisions),
    'utf8',
  );
  fs.writeFileSync(path.join(outputDir, 'index.ts'), renderIndexModule(), 'utf8');
  return { agbCount: agb.length, dmgCount: dmg.length, geometryExceptions, collisions };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(__filename)) {
  const result = writeFlashcartProfileArtifacts();
  console.log(
    `Generated Flashcart profiles: AGB=${result.agbCount}, DMG=${result.dmgCount}, ` +
    `geometryExceptions=${result.geometryExceptions.length}, idCollisions=${result.collisions.length}`,
  );
}
