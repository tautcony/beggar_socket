import { mapCommandError } from '@/types/command-error';

import type { BurnerDomainError, BurnerErrorCode } from './result';

export const mapDomainError = mapCommandError;

export function mapConnectionStageError(
  lifecycleStage: 'list' | 'select' | 'connect' | 'init' | 'disconnect',
  error: unknown,
): BurnerDomainError {
  const mapped = mapDomainError('connection', error, `Connection ${lifecycleStage} failed`);
  const codeMap: Record<typeof lifecycleStage, BurnerErrorCode> = {
    list: 'list_failed',
    select: mapped.code === 'selection_required' ? 'selection_required' : 'select_failed',
    connect: 'connect_failed',
    init: 'init_failed',
    disconnect: 'disconnect_failed',
  };

  return {
    ...mapped,
    code: codeMap[lifecycleStage],
  };
}
