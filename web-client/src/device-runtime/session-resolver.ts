/**
 * Session resolver: the single entry point that turns a selection plus typed probe facts
 * into an immutable `SessionProfile`.
 *
 * The runtime binding is taken from `binding.runtimeBindingId` only, so there is exactly
 * one source of truth for driver / adapter / display / mode-sync wiring.
 */
import { NO_CAPABILITY_SIGNALS, resolveCapabilities, type RuntimeFeatures } from '@/device/capabilities';
import { GBFLASH_AUTO_BAUD_RATE, VARIANT_IDS } from '@/device/definitions';
import type { ParameterStore, ParameterValue } from '@/device/parameters';
import type {
  DeviceDiagnostic,
  ProbeResult,
  ResolvedTransportProfile,
  SessionProfile,
  TransportFacts,
} from '@/device/session';
import type { ResolvedVariantSelection } from '@/device/types';
import { describeIdentityMatchers, formatUsbIds, matchUsbIdentity } from '@/device/usb-identity';
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
  resolve<TFacts>(
    selection: ResolvedVariantSelection,
    probe: ProbeResult<TFacts>,
    transportFacts: TransportFacts,
    store: ParameterStore,
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

export function createSessionResolver(options: SessionResolverOptions): SessionResolver {
  const { composition, platform } = options;

  return {
    resolve<TFacts>(
      selection: ResolvedVariantSelection,
      probe: ProbeResult<TFacts>,
      transportFacts: TransportFacts,
      store: ParameterStore,
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

      const settings = store.operationSnapshot(selection.parameterNamespace);
      const baudRate = resolveConnectionBaudRate(selection, settings.values);
      const transport: ResolvedTransportProfile = {
        backend: transportFacts.backend,
        platform,
        ...(baudRate !== undefined ? { baudRate } : {}),
        packetLimits: selection.transport.packetLimits,
        maxReadChunk: selection.transport.maxReadChunk,
      };

      const diagnostics: DeviceDiagnostic[] = [];
      if (transportFacts.backend === 'simulated') {
        diagnostics.push({
          code: 'probe-skipped',
          severity: 'info',
          message: 'Simulated backend: hardware probe skipped',
          stage: 'probe',
        });
      } else if (matchUsbIdentity(selection.binding, transportFacts.usb) === 'mismatch') {
        // A mismatch is a warning, not a failure: the user may have picked the right
        // device on a cable that reports no usable VID/PID. The reason must be in the
        // profile so callers never have to parse log text.
        diagnostics.push({
          code: 'port-mismatch',
          severity: 'warning',
          message: `Port ${formatUsbIds(transportFacts.usb)} does not match ${selection.variantId} identity (${describeIdentityMatchers(selection.binding)})`,
          stage: 'transport',
        });
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
        device: selection.device,
        firmware: selection.firmware,
        ...(probe.firmwareVersion !== undefined ? { firmwareVersion: probe.firmwareVersion } : {}),
        capabilities,
        runtimeFeatures,
        transport,
        verification: probe.verification,
        connectionParameters: Object.freeze({ ...settings.values }),
        display,
        // Copy each entry: the array itself and the diagnostics snapshot stay immutable
        // even when a driver keeps a reference to its own probe result.
        diagnostics: Object.freeze(diagnostics.map(diagnostic => Object.freeze({ ...diagnostic }))),
      });
    },
  };
}
