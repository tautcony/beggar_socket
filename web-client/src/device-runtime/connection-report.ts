/**
 * Connection log report.
 *
 * The right-hand log area (not just `console`) renders the actual device/firmware of the
 * committed session, the port match result and an actionable hint per failure stage. The
 * UI only forwards these entries, so the wording stays next to the data that produced it.
 */
import { displayTextToString } from '@/device/display';
import type { ConnectionAttemptContext, DeviceDiagnostic } from '@/device/session';
import { formatUsbIds } from '@/device/usb-identity';
import type { DeviceInfo } from '@/types/device-info';

export interface ConnectionLogEntry {
  readonly level: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly details?: string;
  readonly error?: string;
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

    entries.push({
      level: 'info',
      message: `Connected: ${deviceName}${firmwareVersion ? ` (${firmwareVersion})` : ''}`,
      details,
    });

    for (const diagnostic of (profile?.diagnostics ?? device.diagnostics ?? [])) {
      entries.push({
        level: diagnosticLevel(diagnostic),
        message: `[${diagnostic.stage ?? 'connection'}/${diagnostic.code}] ${displayTextToString(diagnostic.message)}`,
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
    const hint = STAGE_HINTS[failure.stage] ?? STAGE_HINTS.unknown;
    entries.push({
      level: 'error',
      message: `Connection failed at ${failure.stage}: ${failure.message}`,
      details: attemptDetails ? `${attemptDetails} — ${hint}` : hint,
    });
    for (const diagnostic of failure.diagnostics ?? []) {
      entries.push({
        level: diagnosticLevel(diagnostic),
        message: `[${diagnostic.stage ?? 'connection'}/${diagnostic.code}] ${displayTextToString(diagnostic.message)}`,
      });
    }
  }

  return entries;
}
