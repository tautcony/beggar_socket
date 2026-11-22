/*!
 * Flashcart profile data converted from FlashGBX (https://github.com/Lesserkuma/FlashGBX).
 * Copyright (C) Lesserkuma — Licensed under GNU General Public License v3.0 (GPL-3.0).
 */
/* eslint-disable */
import type { FlashcartMode, FlashcartProfile, FlashcartType } from '@/types/flashcart-profile';

export {
  FLASHCART_GEOMETRY_EXCEPTIONS,
  FLASHCART_ID_COLLISIONS,
  FLASHCART_PROFILE_COUNTS,
} from './snapshots';

export const FLASHCART_PROFILES_LICENSE_NOTICE = "Flashcart profile data converted from FlashGBX (https://github.com/Lesserkuma/FlashGBX).\nCopyright (C) Lesserkuma — Licensed under GNU General Public License v3.0 (GPL-3.0).";

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
