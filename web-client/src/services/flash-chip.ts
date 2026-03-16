import { arraysEqual, getFlashId } from '@/protocol';

// Flash chips that support a 512-byte write page via their extended write-buffer command.
// S29GL256N uses a 4-byte autoselect ID; S29GL01 and S70GL02 are the larger-capacity
// variants in the same Spansion/Cypress GL family and share the same write-buffer support.
const LARGE_ROM_PAGE_CHIPS = ['S29GL256N', 'S29GL01', 'S70GL02'] as const;

export function shouldUseLargeRomPage(chipId?: number[]): boolean {
  return LARGE_ROM_PAGE_CHIPS.some(name => arraysEqual(chipId, getFlashId(name)));
}
