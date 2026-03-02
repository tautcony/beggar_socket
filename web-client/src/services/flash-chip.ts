import { arraysEqual, getFlashId } from '@/protocol/beggar_socket/protocol-utils';

export function shouldUseLargeRomPage(chipId?: number[]): boolean {
  return arraysEqual(chipId, getFlashId('S29GL256N'));
}
