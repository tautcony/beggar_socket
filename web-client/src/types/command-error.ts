export const COMMAND_ERROR_STAGES = ['connection', 'transport', 'protocol', 'session', 'unknown'] as const;
export type CommandErrorStage = typeof COMMAND_ERROR_STAGES[number];

export const COMMAND_ERROR_CODES = ['aborted', 'selection_required', 'not_connected', 'list_failed', 'select_failed', 'connect_failed', 'init_failed', 'disconnect_failed', 'stale_context', 'timeout', 'transport_failure', 'length_mismatch', 'ack_failure', 'verification_mismatch', 'runtime_error', 'unknown'] as const;
export type CommandErrorCode = typeof COMMAND_ERROR_CODES[number];

export interface CommandError {
  stage: CommandErrorStage;
  code: CommandErrorCode;
  message: string;
  cause?: unknown;
  recoverable: boolean;
  operation?: string;
  address?: number;
  cleanupError?: unknown;
}

export function isCommandError(error: unknown): error is CommandError {
  return Boolean(error && typeof error === 'object' && 'stage' in error && COMMAND_ERROR_STAGES.some(stage => stage === error.stage)
    && 'code' in error && COMMAND_ERROR_CODES.some(code => code === error.code) && 'message' in error && typeof error.message === 'string'
    && 'recoverable' in error && typeof error.recoverable === 'boolean');
}

function extractErrorCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }

  return null;
}

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

function inferErrorCode(error: unknown): CommandErrorCode {
  const extractedMessage = extractErrorMessage(error);
  const extractedCode = extractErrorCode(error)?.toUpperCase();

  if (extractedCode) {
    if (extractedCode === 'ABORTED') {
      return 'aborted';
    }
    if (extractedCode === 'SELECTION_REQUIRED') {
      return 'selection_required';
    }
    if (extractedCode === 'NOT_CONNECTED' || extractedCode === 'TRANSPORT_NOT_CONNECTED') {
      return 'not_connected';
    }
    if (extractedCode === 'TIMEOUT' || extractedCode === 'PACKET_TIMEOUT' || extractedCode === 'TRANSPORT_TIMEOUT') {
      return 'timeout';
    }
    if (extractedCode === 'TRANSPORT_FAILURE') return 'transport_failure';
    if (extractedCode === 'LENGTH_MISMATCH') return 'length_mismatch';
    if (extractedCode === 'ACK_FAILURE') return 'ack_failure';
    return 'runtime_error';
  }

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

export function mapCommandError(stage: CommandErrorStage, error: unknown, fallbackMessage: string): CommandError {
  if (isCommandError(error)) return error;
  const message = extractErrorMessage(error) ?? fallbackMessage;
  const code = inferErrorCode(error);
  const recoverable = code !== 'unknown';

  return {
    stage: code === 'transport_failure' ? 'transport' : stage,
    code,
    message,
    ...(error === undefined ? {} : { cause: error }),
    recoverable,
  };
}

/** Preserve Error-based throw contracts while carrying the mapped cause. */
export function commandErrorToException(error: CommandError, message = error.message): Error & CommandError {
  return Object.assign(new Error(message), error, { message });
}

/** Explicit cancellation uses the caught I/O failure, or signal reason before I/O, as its cause. */
export function abortedCommandError(message: string, failure?: unknown): CommandError {
  const cause = isCommandError(failure) ? failure.cause : failure;
  return { stage: 'session', code: 'aborted', message, recoverable: true, ...(cause === undefined ? {} : { cause }) };
}
