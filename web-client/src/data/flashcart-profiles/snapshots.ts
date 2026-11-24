/*!
 * Flashcart profile data based on ChisFlash-Tools-Exp (https://github.com/ChisLightyear/ChisFlash-Tools-Exp)
 * using the FlashGBX (https://github.com/Lesserkuma/FlashGBX) profile schema.
 * Copyright (C) Lesserkuma — Licensed under GNU General Public License v3.0 (GPL-3.0).
 */
/* eslint-disable */
import type {
  FlashcartCollisionEntry,
  FlashcartGeometryExceptionSnapshot,
} from '@/types/flashcart-profile';

export const FLASHCART_PROFILE_COUNTS = {
  AGB: 11,
  DMG: 13,
  total: 24,
} as const;

export const FLASHCART_GEOMETRY_EXCEPTIONS: readonly FlashcartGeometryExceptionSnapshot[] = [];

export const FLASHCART_ID_COLLISIONS: readonly FlashcartCollisionEntry[] = [];
