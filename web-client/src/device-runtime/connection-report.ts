/**
 * Connection log report.
 *
 * The right-hand log area (not just `console`) renders the actual device/firmware of the
 * committed session, the port match result and an actionable hint per failure stage. The
 * runtime builds plain-text entries plus structured `DisplayText` payloads so the UI
 * layer can localize them without coupling the runtime to vue-i18n.
 */
import { type DisplayText, displayTextToString } from '@/device/display';
import type { ConnectionAttemptContext, DeviceDiagnostic } from '@/device/session';
import { formatUsbIds } from '@/device/usb-identity';
import type { DeviceInfo } from '@/types/device-info';

export interface ConnectionLogEntry {
  readonly level: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly details?: string;
  readonly error?: string;
  /** Structured i18n payload for UI consumers; runtime stays i18n-free. */
  readonly messageText?: DisplayText;
  readonly messagePrefix?: string;
  readonly hintText?: DisplayText;
  readonly detailsPrefix?: string;
}

export interface ConnectionFailureReport {
  readonly stage: string;
  readonly message: string;
  readonly diagnostics?: readonly DeviceDiagnostic[];
  /** Discovery of the failed attempt: the same fields a committed session reports. */
  readonly context?: ConnectionAttemptContext;
}

/** Actionable guidance per failure stage; never collapses a protocol stage into `connect`. */
const STAGE_HINTS: Readonly<Record<string, string>> = {
  list: 'Could not enumerate serial ports. Check the USB connection and the platform permissions.',
  select: 'Choose a device and firmware in the advanced settings, then retry.',
  connect: 'Check the USB cable and close other applications that may hold the port.',
  init: 'The port opened but signal initialisation failed. Retry or choose another port.',
  probe: 'The device did not answer the selected firmware handshake. Check the advanced settings; a Boost selection needs ChisFlash-Beggar-Boost firmware.',
  resolve: 'The device responded but the session could not be resolved. Check the advanced settings.',
  initialize: 'The handshake succeeded but session initialisation failed. Retry the connection.',
  disconnect: 'Protocol teardown failed while closing the port. Retry the disconnect.',
  unknown: 'Connection failed. Check the device, cable and advanced settings.',
};

function diagnosticDisplayText(diagnostic: DeviceDiagnostic): DisplayText {
  const raw = displayTextToString(diagnostic.message);
  if (typeof diagnostic.message !== 'string') {
    return diagnostic.message;
  }

  switch (diagnostic.code) {
    case 'port-mismatch': {
      const match = /^Port (.+?) does not match the identity(?: for (.+?))? \((.+)\)$/.exec(raw);
      if (match) {
        const [, observed, variantId, expected] = match;
        return {
          key: variantId
            ? 'messages.device.diagnostics.portMismatch'
            : 'messages.device.diagnostics.portMismatchNoVariant',
          params: {
            observed,
            expected,
            ...(variantId ? { variantId } : {}),
          },
          fallback: raw,
        };
      }
      return raw;
    }
    case 'port-identity-incomplete': {
      const match = /^Port (.+?) does not report (.+?), so it cannot be matched against (.+)$/.exec(raw);
      if (match) {
        const [, observed, missing, expected] = match;
        return {
          key: 'messages.device.diagnostics.portIdentityIncomplete',
          params: { observed, missing, expected },
          fallback: raw,
        };
      }
      return raw;
    }
    case 'port-identity-unknown': {
      const match = /^Port reported no USB identity, so (.+?) could not be checked$/.exec(raw);
      if (match) {
        return {
          key: 'messages.device.diagnostics.portIdentityUnknown',
          params: { expected: match[1] },
          fallback: raw,
        };
      }
      return raw;
    }
    case 'boost-probe-failed':
      return { key: 'messages.device.errors.boostUnsupported', fallback: raw };
    case 'unsupported-firmware':
      return { key: 'messages.device.errors.gbflashUnsupported', fallback: raw };
    case 'handshake-failed':
      return { key: 'messages.device.errors.gbflashHandshakeFailed', fallback: raw };
    case 'teardown-failed':
      return { key: 'messages.device.diagnostics.teardownFailed', fallback: raw };
    case 'cleanup-failed':
      return { key: 'messages.device.diagnostics.cleanupFailed', fallback: raw };
    default:
      return raw;
  }
}

function diagnosticLevel(diagnostic: DeviceDiagnostic): ConnectionLogEntry['level'] {
  if (diagnostic.severity === 'error') {
    return 'error';
  }
  return diagnostic.severity === 'warning' ? 'warn' : 'info';
}

function describePort(device: DeviceInfo): string {
  const port = device.portInfo;
  if (!port?.path) {
    return 'no port metadata';
  }
  const ids = port.vendorId || port.productId
    ? `${port.vendorId ?? '----'}:${port.productId ?? '----'}`
    : 'no VID/PID';
  return `${port.path} (${ids})`;
}

function describeAssessment(
  assessment: ConnectionAttemptContext['portIdentity'] | undefined,
  fallbackUsb: { readonly vendorId?: string; readonly productId?: string } | undefined,
): string {
  if (assessment) {
    if (assessment.reason === 'matched') {
      return 'match';
    }
    if (assessment.reason === 'mismatch') {
      return `mismatch (expected ${assessment.expected})`;
    }
    if (assessment.reason === 'incomplete') {
      return `incomplete — the port does not report ${assessment.missing.join('/')}`;
    }
    return 'unknown — the port reported no USB identity';
  }
  if (!fallbackUsb?.vendorId && !fallbackUsb?.productId) {
    return 'unknown — the port reported no USB identity';
  }
  return 'match';
}

function describeMatch(device: DeviceInfo): string {
  const mismatch = device.diagnostics?.find(diagnostic => diagnostic.code === 'port-mismatch');
  if (mismatch) {
    return `mismatch — ${displayTextToString(mismatch.message)}`;
  }
  return describeAssessment(device.session?.portIdentity, device.portInfo);
}

export function buildConnectionLogReport(input: {
  readonly device?: DeviceInfo | null;
  readonly failure?: ConnectionFailureReport | null;
}): readonly ConnectionLogEntry[] {
  const entries: ConnectionLogEntry[] = [];
  const { device, failure } = input;

  if (device) {
    const profile = device.session;
    const deviceName = profile ? displayTextToString(profile.display.title) : device.firmwareProfile?.label ?? 'Unknown device';
    const firmwareName = profile ? displayTextToString(profile.firmware.displayName) : device.firmwareProfile?.label ?? 'unknown';
    const firmwareVersion = profile?.firmwareVersion ?? device.firmwareProfile?.firmwareVersion;
    const details = [
      `variant=${profile?.variantId ?? device.firmwareProfile?.id ?? 'unknown'}`,
      `firmware=${firmwareName}${firmwareVersion ? ` ${firmwareVersion}` : ''}`,
      `port=${describePort(device)}`,
      `match=${describeMatch(device)}`,
      profile ? `baud=${profile.transport.baudRate ?? 'default'}` : null,
      profile ? `transport=${profile.transport.backend}` : null,
    ].filter(Boolean).join(', ');

    const versionSuffix = firmwareVersion ? ` (${firmwareVersion})` : '';
    const connectedMessage = `Connected: ${deviceName}${versionSuffix}`;
    entries.push({
      level: 'info',
      message: connectedMessage,
      messageText: {
        key: 'messages.device.log.connected',
        params: { device: deviceName, version: versionSuffix },
        fallback: connectedMessage,
      },
      details,
    });

    for (const diagnostic of (profile?.diagnostics ?? device.diagnostics ?? [])) {
      const prefix = `[${diagnostic.stage ?? 'connection'}/${diagnostic.code}]`;
      entries.push({
        level: diagnosticLevel(diagnostic),
        message: `${prefix} ${displayTextToString(diagnostic.message)}`,
        messagePrefix: prefix,
        messageText: diagnosticDisplayText(diagnostic),
      });
    }
  }

  if (failure) {
    const context = failure.context;
    const attemptDetails = context
      ? [
        `variant=${context.variantId ?? 'unknown'}`,
        `port=${context.port?.path ?? 'no port metadata'} (${formatUsbIds(context.port)})`,
        `match=${describeAssessment(context.portIdentity, context.port)}`,
      ].join(', ')
      : null;
    const hintKey = failure.stage in STAGE_HINTS ? failure.stage : 'unknown';
    const hint = STAGE_HINTS[hintKey];
    const failureMessage = `Connection failed at ${failure.stage}: ${failure.message}`;
    entries.push({
      level: 'error',
      message: failureMessage,
      messageText: {
        key: 'messages.device.log.connectionFailedAt',
        params: { stage: failure.stage, message: failure.message },
        fallback: failureMessage,
      },
      details: attemptDetails ? `${attemptDetails} — ${hint}` : hint,
      ...(attemptDetails ? { detailsPrefix: attemptDetails } : {}),
      hintText: {
        key: `messages.device.stageHints.${hintKey}`,
        fallback: hint,
      },
    });
    for (const diagnostic of failure.diagnostics ?? []) {
      const prefix = `[${diagnostic.stage ?? 'connection'}/${diagnostic.code}]`;
      entries.push({
        level: diagnosticLevel(diagnostic),
        message: `${prefix} ${displayTextToString(diagnostic.message)}`,
        messagePrefix: prefix,
        messageText: diagnosticDisplayText(diagnostic),
      });
    }
  }

  return entries;
}
