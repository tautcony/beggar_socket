import type { GameBoyAdvance } from 'gbats';

const CPSR_MODE_M4 = 0x10;
const CPSR_THUMB_STATE = 0x20;

/**
 * gbats omits CPSR mode bit M4 from PRIV_MASK. Its MSR SPSR path uses this
 * mask when merging control bits, which can turn valid saved modes into
 * reserved modes. Keep M4 writable while keeping the T bit out of this mask.
 */
export function applyGbatsArmCompatibility(core: Pick<GameBoyAdvance, 'cpu'>): void {
  core.cpu.PRIV_MASK = (core.cpu.PRIV_MASK | CPSR_MODE_M4) & ~CPSR_THUMB_STATE;
}
