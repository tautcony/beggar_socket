import type { BurnerDomainError, BurnerErrorCode, BurnerErrorStage } from './result';

function extractErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
    if ('error' in error && typeof error.error === 'string') {
      return error.error;
    }
  }

  return null;
}

function inferErrorCode(error: unknown): BurnerErrorCode {
  const extractedMessage = extractErrorMessage(error);

  if (error instanceof Error || extractedMessage) {
    const message = extractedMessage?.toLowerCase() ?? '';
    if (error instanceof Error && error.name === 'AbortError') {
      return 'aborted';
    }
    if (error instanceof Error && error.name === 'PortSelectionRequiredError') {
      return 'selection_required';
    }
    if (message.includes('selection')) {
      return 'selection_required';
    }
    if (message.includes('not connected') || message.includes('not properly initialized')) {
      return 'not_connected';
    }
    if (message.includes('timeout')) {
      return 'timeout';
    }
    return 'runtime_error';
  }

  return 'unknown';
}

export function mapDomainError(stage: BurnerErrorStage, error: unknown, fallbackMessage: string): BurnerDomainError {
  const message = extractErrorMessage(error) ?? fallbackMessage;
  const code = inferErrorCode(error);
  const recoverable = code !== 'unknown';

  return {
    stage,
    code,
    message,
    cause: error,
    recoverable,
  };
}

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
