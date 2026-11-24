import type { DisplayText } from '@/device/display';
import type { ConnectionLogEntry } from '@/device-runtime/connection-report';

export type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

interface FailureLike {
  readonly stage?: string;
  readonly code?: string;
  readonly message?: string;
  readonly cause?: unknown;
  readonly diagnostics?: readonly { readonly code?: string; readonly message?: unknown }[];
}

const GENERIC_FAILURE_KEYS: Readonly<Record<string, string>> = {
  connect_failed: 'messages.device.errors.connectFailed',
  init_failed: 'messages.device.errors.initFailed',
  list_failed: 'messages.device.errors.listFailed',
  disconnect_failed: 'messages.device.errors.disconnectFailed',
  probe_failed: 'messages.device.errors.probeFailed',
  resolve_failed: 'messages.device.errors.resolveFailed',
  initialize_failed: 'messages.device.errors.initializeFailed',
  unknown: 'messages.device.errors.unknown',
};

const GENERIC_FALLBACK_MESSAGES = new Set([
  'Device connection failed',
  'Failed to connect to selected port',
  'Failed to initialize device',
  'Failed to list ports',
  'Failed to disconnect device',
  'Device probe failed',
]);

function extractCauseCode(cause: unknown): string | undefined {
  if (cause && typeof cause === 'object' && 'code' in cause && typeof cause.code === 'string') {
    return cause.code;
  }
  return undefined;
}

function extractMessage(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object' && 'message' in value && typeof value.message === 'string') {
    return value.message;
  }
  return String(value);
}

function translateKey(
  t: TranslateFn,
  key: string,
  params: Record<string, unknown> | undefined,
  fallback: string,
): string {
  const translated = t(key, params);
  return translated === key ? fallback : translated;
}

function formatSelectionMessage(message: string, t: TranslateFn): string {
  const unregisteredMatch = /^Device selection (.+) is not registered$/.exec(message);
  if (unregisteredMatch) {
    return translateKey(
      t,
      'messages.device.errors.selectionNotRegistered',
      { variantId: unregisteredMatch[1] },
      message,
    );
  }
  return translateKey(t, 'messages.device.errors.noValidSelection', undefined, message);
}

function formatStageCode(
  code: string | undefined,
  message: string,
  t: TranslateFn,
): string | null {
  switch (code) {
    case 'selection-invalid':
    case 'selection_invalid':
      return formatSelectionMessage(message, t);
    case 'runtime-binding-missing': {
      const match = /^No runtime is registered for (.+)$/.exec(message);
      return translateKey(
        t,
        'messages.device.errors.runtimeBindingMissing',
        { variantId: match?.[1] ?? '' },
        message,
      );
    }
    case 'simulated-protocol-unsupported': {
      const match = /^Simulated (.+?) is not supported:/.exec(message);
      return translateKey(
        t,
        'messages.device.errors.simulatedUnsupported',
        { variantId: match?.[1] ?? '' },
        message,
      );
    }
    case 'boost-unsupported':
    case 'boost-probe-failed':
      return translateKey(t, 'messages.device.errors.boostUnsupported', undefined, message);
    case 'unsupported':
    case 'unsupported-firmware':
      return translateKey(t, 'messages.device.errors.gbflashUnsupported', undefined, message);
    case 'handshake-failed':
      return translateKey(t, 'messages.device.errors.gbflashHandshakeFailed', undefined, message);
    case 'teardown-failed':
      if (message.includes('Beggar Boost')) {
        return translateKey(t, 'messages.device.errors.beggarTeardownFailed', undefined, message);
      }
      if (message.includes('GBFlash')) {
        return translateKey(t, 'messages.device.errors.gbflashTeardownFailed', undefined, message);
      }
      return translateKey(t, 'messages.device.errors.disconnectFailed', undefined, message);
    default:
      return null;
  }
}

function formatFailure(failure: FailureLike, t: TranslateFn): string | null {
  const message = failure.message ?? '';
  const causeCode = extractCauseCode(failure.cause);
  const direct = formatStageCode(causeCode ?? failure.code, message, t);
  if (direct) {
    return direct;
  }

  for (const diagnostic of failure.diagnostics ?? []) {
    const formatted = formatStageCode(diagnostic.code, message, t);
    if (formatted) {
      return formatted;
    }
  }

  if (failure.cause) {
    const causeMessage = extractMessage(failure.cause);
    if (causeMessage) {
      return causeMessage;
    }
  }

  if (message && !GENERIC_FALLBACK_MESSAGES.has(message)) {
    return message;
  }

  const genericKey = failure.code ? GENERIC_FAILURE_KEYS[failure.code] : undefined;
  return genericKey ? t(genericKey) : null;
}

/**
 * Formats device connection/runtime errors for user-facing UI messages using `t`,
 * falling back to the raw error message when no structured translation applies.
 */
export function formatDeviceError(error: unknown, t: TranslateFn): string {
  if (error && typeof error === 'object') {
    const record = error as {
      name?: unknown;
      code?: unknown;
      message?: unknown;
      failure?: FailureLike;
    };

    if (record.failure) {
      const formatted = formatFailure(record.failure, t);
      if (formatted) {
        return formatted;
      }
    }

    const message = typeof record.message === 'string' ? record.message : extractMessage(error);
    if (
      record.name === 'DeviceSelectionError'
      || record.code === 'selection_invalid'
      || record.code === 'selection-invalid'
    ) {
      return formatSelectionMessage(message, t);
    }

    if (typeof record.code === 'string') {
      const formatted = formatStageCode(record.code, message, t);
      if (formatted) {
        return formatted;
      }
    }

    if (message === 'Device connection already in progress') {
      return t('messages.device.errors.connectionInProgress');
    }
    if (message === 'This method is only available in Tauri environment') {
      return t('messages.device.errors.tauriOnly');
    }
    if (message === 'Invalid connection handle: context is not a valid DeviceHandle') {
      return t('messages.device.errors.invalidConnectionHandle');
    }

    return message;
  }

  return String(error);
}

/** Translates a `DisplayText` payload using the UI translator. */
export function translateDisplayText(text: DisplayText, t: TranslateFn): string {
  if (typeof text === 'string') {
    return text;
  }
  const translated = t(text.key, text.params ? { ...text.params } : undefined);
  return translated === text.key && text.fallback ? text.fallback : translated;
}

/** Localizes structured `ConnectionLogEntry` payloads produced by the runtime. */
export function localizeConnectionLogEntries(
  entries: readonly ConnectionLogEntry[],
  t: TranslateFn,
): readonly ConnectionLogEntry[] {
  return entries.map((entry) => {
    const localizedMessage = entry.messageText
      ? translateDisplayText(entry.messageText, t)
      : entry.message;
    const message = entry.messagePrefix && entry.messageText
      ? `${entry.messagePrefix} ${localizedMessage}`
      : localizedMessage;

    let details = entry.details;
    if (entry.hintText) {
      const hint = translateDisplayText(entry.hintText, t);
      details = entry.detailsPrefix ? `${entry.detailsPrefix} — ${hint}` : hint;
    }

    return {
      ...entry,
      message,
      ...(details !== undefined ? { details } : {}),
    };
  });
}
