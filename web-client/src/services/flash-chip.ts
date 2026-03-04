import { arraysEqual, getFlashId } from '@/protocol';

export function shouldUseLargeRomPage(chipId?: number[]): boolean {
  return arraysEqual(chipId, getFlashId('S29GL256N'));
}
