/**
 * Session resolver: the single entry point that turns a selection plus typed probe facts
 * into an immutable `SessionProfile`.
 *
 * The runtime binding is taken from `binding.runtimeBindingId` only, so there is exactly
 * one source of truth for driver / adapter / display / mode-sync wiring.
 */
import { NO_CAPABILITY_SIGNALS, resolveCapabilities, type RuntimeFeatures } from '@/device/capabilities';
import { GBFLASH_AUTO_BAUD_RATE, VARIANT_IDS } from '@/device/definitions';
import type { ParameterValue } from '@/device/parameters';
import type {
  DeviceDiagnostic,
  ProbeResult,
  ResolvedTransportProfile,
  SessionProfile,
  TransportFacts,
} from '@/device/session';
import type { ResolvedVariantSelection } from '@/device/types';
import { assessPortIdentity, type PortIdentityAssessment, portIdentityDiagnostic } from '@/device/usb-identity';
import type { HostPlatform } from '@/types/host-platform';

import type { RuntimeCompositionRegistry } from './composition-registry';

export type SessionResolutionFailureCode =
  | 'identity-mismatch'
  | 'boost-verification-failed'
  | 'runtime-binding-missing';

export class SessionResolutionError extends Error {
  readonly code: SessionResolutionFailureCode;

  constructor(code: SessionResolutionFailureCode, message: string) {
    super(message);
    this.name = 'SessionResolutionError';
    this.code = code;
  }
}

export interface SessionResolverOptions {
  /** Host used to expand the per-host packet limits of the resolved transport. */
  readonly platform: HostPlatform;
  readonly composition: RuntimeCompositionRegistry;
}

export interface SessionResolver {
  /**
   * Resolves the committed profile from the attempt snapshot.
   *
   * `parameters` is the operation snapshot taken when the attempt started, so the baud
   * rate published in the profile is exactly the one the port was opened with.
   */
  resolve<TFacts>(
    selection: ResolvedVariantSelection,
    probe: ProbeResult<TFacts>,
    transportFacts: TransportFacts,
    parameters: Readonly<Record<string, ParameterValue>>,
    /** Discovery of the attempt when the caller already computed it (never re-derived). */
    portIdentity?: PortIdentityAssessment,
  ): SessionProfile;
}

function resolveBoostTransport(
  selection: ResolvedVariantSelection,
  verification: ProbeResult<unknown>['verification'],
  transportFacts: TransportFacts,
): boolean {
  if (selection.variantId !== VARIANT_IDS.stmBoost) {
    return false;
  }
  if (transportFacts.backend === 'simulated' || verification === 'verified') {
    return true;
  }
  // Never downgrade a Boost selection to a standard STM session.
  throw new SessionResolutionError(
    'boost-verification-failed',
    `variant ${selection.variantId} requires a verified Boost handshake, got ${verification}`,
  );
}

/**
 * `auto` always expands to a fixed 2 Mbps (no host or port dimension), matching the
 * existing FlashGBX connection path.
 *
 * Exported so the connection layer opens the port with exactly the value the resolver
 * will publish in `SessionProfile.transport.baudRate`.
 */
export function resolveConnectionBaudRate(
  selection: ResolvedVariantSelection,
  values: Readonly<Record<string, ParameterValue>>,
): number | undefined {
  const declared = selection.transport.defaultBaudRate;
  if (declared === undefined) {
    return undefined;
  }
  const configured = values.baudRate;
  if (declared === 'auto') {
    return typeof configured === 'number' ? configured : GBFLASH_AUTO_BAUD_RATE;
  }
  return declared;
}

/**
 * Copies and freezes plain data, so the published snapshot owns what it exposes.
 *
 * Registered definitions (`device`, `firmware`, their capability rows and packet limits)
 * are shared by every session of the same variant. Publishing them by reference would let a
 * caller mutate the registry through one session and change every other session with it,
 * which is exactly what an "immutable snapshot" must not allow.
 *
 * Class instances are not copied — freezing the instance is the only ownership that cannot
 * break its type — and functions are referenced as they are.
 */
function ownData<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  const object = value as unknown as object;
  const cached = seen.get(object);
  if (cached !== undefined) {
    return cached as T;
  }
  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(object, copy);
    for (const entry of value) {
      copy.push(ownData(entry, seen));
    }
    return Object.freeze(copy) as unknown as T;
  }
  if (Object.getPrototypeOf(object) !== Object.prototype) {
    return Object.freeze(value);
  }
  const copy: Record<string, unknown> = {};
  seen.set(object, copy);
  for (const [key, entry] of Object.entries(object as Record<string, unknown>)) {
    copy[key] = ownData(entry, seen);
  }
  return Object.freeze(copy) as T;
}

/** Copy of the per-host packet limits: the definition object is shared by every session. */
function copyPacketLimits(selection: ResolvedVariantSelection): ResolvedTransportProfile['packetLimits'] {
  return ownData(selection.transport.packetLimits);
}

/**
 * Connection-period parameters only: the descriptors that say they act at connection
 * time. Page sizes, throttles and retries belong to the next operation and are read from
 * the store there, so keeping them here would publish values that are already stale.
 */
function pickConnectionParameters(
  selection: ResolvedVariantSelection,
  parameters: Readonly<Record<string, ParameterValue>>,
  platform: HostPlatform,
): Readonly<Record<string, ParameterValue>> {
  const schema = selection.firmware.parameters({ platform, transport: selection.transport });
  const connectionKeys = new Set(
    schema
      .filter(descriptor => descriptor.requiresReconnect === true || descriptor.group === 'connection')
      .map(descriptor => descriptor.key),
  );
  const picked: Record<string, ParameterValue> = {};
  for (const key of connectionKeys) {
    const value = parameters[key];
    if (value !== undefined) {
      picked[key] = value;
    }
  }
  return ownData(picked);
}

export function createSessionResolver(options: SessionResolverOptions): SessionResolver {
  const { composition, platform } = options;
  return {
    resolve<TFacts>(
      selection: ResolvedVariantSelection,
      probe: ProbeResult<TFacts>,
      transportFacts: TransportFacts,
      parameters: Readonly<Record<string, ParameterValue>>,
      existingPortIdentity?: PortIdentityAssessment,
    ): SessionProfile {
      if (!composition.has(selection.runtimeBindingId)) {
        throw new SessionResolutionError(
          'runtime-binding-missing',
          `runtime binding ${selection.runtimeBindingId} is not registered for variant ${selection.variantId}`,
        );
      }
      const runtime = composition.resolve<TFacts>(selection.runtimeBindingId);

      if (probe.firmwareId !== selection.firmware.id) {
        // Drivers may not rewrite firmware identity.
        throw new SessionResolutionError(
          'identity-mismatch',
          `probe reported ${probe.firmwareId} but the selection is ${selection.firmware.id}`,
        );
      }

      const capabilities = resolveCapabilities(
        selection.firmware.baseCapabilities,
        selection.device.hardware,
        runtime.capabilitySignals?.(probe.facts) ?? NO_CAPABILITY_SIGNALS,
      );
      const runtimeFeatures: RuntimeFeatures = {
        boostTransport: resolveBoostTransport(selection, probe.verification, transportFacts),
      };

      const baudRate = resolveConnectionBaudRate(selection, parameters);
      const transport: ResolvedTransportProfile = {
        backend: transportFacts.backend,
        platform,
        ...(baudRate !== undefined ? { baudRate } : {}),
        packetLimits: copyPacketLimits(selection),
        maxReadChunk: selection.transport.maxReadChunk,
      };

      const diagnostics: DeviceDiagnostic[] = [];
      const portIdentity = existingPortIdentity ?? assessPortIdentity(selection.binding, transportFacts.usb);
      if (transportFacts.backend === 'simulated') {
        diagnostics.push({
          code: 'probe-skipped',
          severity: 'info',
          message: 'Simulated backend: hardware probe skipped',
          stage: 'probe',
        });
      } else {
        const identityDiagnostic = portIdentityDiagnostic(portIdentity, selection.variantId);
        if (identityDiagnostic) {
          diagnostics.push(identityDiagnostic);
        }
      }
      // Driver-reported non-fatal issues keep the driver's own order.
      diagnostics.push(...(probe.diagnostics ?? []));

      const display = runtime.displayContributor.build({
        device: selection.device,
        firmware: selection.firmware,
        binding: selection.binding,
        probe,
        capabilities,
        transport,
        runtimeFeatures,
      });

      return Object.freeze({
        variantId: selection.variantId,
        // `device` and `firmware` are registry objects shared by every session: the profile
        // publishes its own copy so no caller can reach the registry through a session.
        device: ownData(selection.device),
        firmware: ownData(selection.firmware),
        parameterNamespace: selection.parameterNamespace,
        ...(probe.firmwareVersion !== undefined ? { firmwareVersion: probe.firmwareVersion } : {}),
        capabilities,
        runtimeFeatures: ownData(runtimeFeatures),
        transport: ownData<ResolvedTransportProfile>(transport),
        verification: probe.verification,
        connectionParameters: pickConnectionParameters(selection, parameters, platform),
        portIdentity,
        display: ownData(display),
        // Copy each entry: the array itself and the diagnostics snapshot stay immutable
        // even when a driver keeps a reference to its own probe result.
        diagnostics: Object.freeze(diagnostics.map(diagnostic => Object.freeze({ ...diagnostic }))),
      });
    },
  };
}
