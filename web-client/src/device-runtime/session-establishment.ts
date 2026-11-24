/**
 * Session establishment transaction.
 *
 * `PendingSession` is created from the transport right after the port opens. Probe,
 * resolve and initialize all run against it; only a fully resolved profile is committed
 * as an `ActiveSession`. Any failure before commit runs `cleanupPending()` so protocol
 * state never leaks into the next attempt, and the transport is closed by the caller.
 */
import { displayTextToString } from '@/device/display';
import type { ParameterStore } from '@/device/parameters';
import type {
  ActiveSession,
  ConnectionAttemptContext,
  ConnectionPlan,
  DeviceDiagnostic,
  PendingSession,
  ProbeResult,
  ProtocolDriver,
  SessionProfile,
} from '@/device/session';
import type {
  DeviceRegistry,
  ResolvedVariantSelection,
  SelectionProvider,
  TransportBackend,
} from '@/device/types';
import { assessPortIdentity, type PortIdentityAssessment, portIdentityDiagnostic } from '@/device/usb-identity';
import type { SerialPortInfo } from '@/types/serial';

import type { RuntimeCompositionRegistry } from './composition-registry';
import { planConnection, requireVariant, selectionFailure } from './connection-plan';
import { createDiagnostic, isSessionStageError, type SessionFailureStage, SessionStageError } from './diagnostics';
import type { SessionResolver } from './session-resolver';

export interface EstablishSessionInput {
  /** Stable identity of the connection attempt; committed with the active session. */
  readonly connectionId: string;
  readonly transport: PendingSession['transport'];
  readonly portInfo?: SerialPortInfo;
  readonly backend: TransportBackend;
  readonly usb?: { readonly vendorId?: string; readonly productId?: string };
  /**
   * Snapshot taken before the port opened. Callers that open the port themselves must pass
   * it, otherwise the attempt would resolve the selection and the connection parameters a
   * second time and could publish a profile that disagrees with the opened port.
   *
   * Omitted only by callers that never opened a port (tests, direct use); the transaction
   * then takes its own single snapshot up front.
   */
  readonly plan?: ConnectionPlan;
}

export interface EstablishedSession {
  /** Immutable snapshot produced by the resolver. */
  readonly active: ActiveSession;
  /**
   * Typed probe facts, only for the legacy `DeviceInfo` compat facade (e.g. the FlashGBX
   * command client). They are deliberately not part of `SessionProfile`.
   */
  readonly probeFacts?: unknown;
  readonly diagnostics: readonly DeviceDiagnostic[];
}

export interface SessionEstablishment {
  establish(input: EstablishSessionInput): Promise<EstablishedSession>;
  /**
   * Runs `teardown(activeSession)` for a committed session and returns the `disconnect`
   * diagnostics. Teardown failures never throw: the transport must still close, and the
   * UI gets the failure as a diagnostic instead of losing the close path.
   */
  teardown(active: ActiveSession): Promise<readonly DeviceDiagnostic[]>;
}

export interface SessionEstablishmentDeps {
  readonly selection: SelectionProvider;
  readonly registry: DeviceRegistry;
  readonly store: ParameterStore;
  readonly resolver: SessionResolver;
  readonly composition: RuntimeCompositionRegistry;
}

/** Port part of the attempt context: only fields the host actually reported. */
function portIdentityPort(portInfo: SerialPortInfo): NonNullable<ConnectionAttemptContext['port']> {
  return {
    ...(portInfo.path ? { path: portInfo.path } : {}),
    ...(portInfo.vendorId ? { vendorId: portInfo.vendorId } : {}),
    ...(portInfo.productId ? { productId: portInfo.productId } : {}),
  };
}

/**
 * Discovery diagnostics of the attempt. A simulated backend never claims a match result:
 * the port metadata is synthetic there.
 */
function transportDiagnosticsFor(
  assessment: PortIdentityAssessment,
  backend: TransportBackend,
): readonly DeviceDiagnostic[] {
  if (backend === 'simulated') {
    return [];
  }
  const diagnostic = portIdentityDiagnostic(assessment);
  return diagnostic ? [diagnostic] : [];
}

export function createSessionEstablishment(deps: SessionEstablishmentDeps): SessionEstablishment {
  const { selection, registry, store, resolver, composition } = deps;

  async function cleanupPending(
    driver: ProtocolDriver<unknown>,
    pending: PendingSession,
    stage: Exclude<SessionFailureStage, 'selection' | 'disconnect'>,
  ): Promise<unknown> {
    try {
      await driver.cleanupPending(pending, stage);
      return undefined;
    } catch (cleanupError) {
      return cleanupError;
    }
  }

  /**
   * Keeps the primary stage error authoritative while still publishing the cleanup
   * failure as its own diagnostic. A driver that already reports a stage error (e.g. the
   * Boost probe) would otherwise swallow the cleanup outcome on the way out.
   */
  function withCleanupDiagnostic(
    stage: Exclude<SessionFailureStage, 'selection' | 'disconnect'>,
    error: unknown,
    cleanup: unknown,
    fallbackMessage: string,
    diagnostic: DeviceDiagnostic,
    code: string,
    context: ConnectionAttemptContext,
    transportDiagnostics: readonly DeviceDiagnostic[],
  ): SessionStageError {
    const cleanupDiagnostic = cleanup
      ? [createDiagnostic('cleanup-failed', 'warning', `Protocol cleanup after the ${stage} failure also failed`, stage)]
      : [];

    if (isSessionStageError(error)) {
      return new SessionStageError(error.stage, error.message, {
        code: error.code,
        // The driver's own diagnostics stay first; discovery and cleanup follow.
        diagnostics: [...error.diagnostics, ...transportDiagnostics, ...cleanupDiagnostic],
        cause: cleanup ? { original: error.cause ?? error, cleanup } : error.cause ?? error,
        context: { ...error.context, ...context },
      });
    }

    return new SessionStageError(stage, error instanceof Error ? error.message : fallbackMessage, {
      code,
      diagnostics: [...transportDiagnostics, diagnostic, ...cleanupDiagnostic],
      cause: cleanup ? { original: error, cleanup } : error,
      context,
    });
  }

  /** Rejects a simulated attempt whose protocol the simulator cannot execute. */
  function assertSimulatedSupport(
    resolved: ResolvedVariantSelection,
    backend: TransportBackend,
    context: ConnectionAttemptContext,
  ): void {
    if (backend !== 'simulated') {
      return;
    }
    const support = resolved.binding.simulated;
    if (support?.supported) {
      return;
    }
    const reason = support?.reason
      ? displayTextToString(support.reason)
      : 'The debug simulator does not implement this firmware protocol.';
    throw new SessionStageError('probe', `Simulated ${resolved.variantId} is not supported: ${reason}`, {
      code: 'simulated-protocol-unsupported',
      diagnostics: [
        createDiagnostic(
          'simulated-protocol-unsupported',
          'error',
          `${reason} Choose a variant the simulator supports, or turn off debug simulation.`,
          'probe',
        ),
      ],
      context,
    });
  }

  return {
    async establish(input: EstablishSessionInput): Promise<EstablishedSession> {
      // Exactly one snapshot per attempt: supplied by the opener, or taken here.
      const plan = input.plan ?? planConnection({ selection, registry, store });
      const resolved: ResolvedVariantSelection = requireVariant(registry, plan.variantId);

      if (!composition.has(resolved.runtimeBindingId)) {
        throw selectionFailure(
          `No runtime is registered for ${resolved.variantId}`,
          'runtime-binding-missing',
        );
      }

      const runtime = composition.resolve(resolved.runtimeBindingId);
      const transportFacts = {
        backend: input.backend,
        ...(input.usb ? { usb: input.usb } : {}),
      };

      // Discovery happens before the first protocol byte: the same structured result is
      // published by the committed profile and by every failed stage of this attempt.
      const portIdentity = assessPortIdentity(resolved.binding, input.usb);
      const context: ConnectionAttemptContext = {
        variantId: resolved.variantId,
        ...(input.portInfo ? { port: portIdentityPort(input.portInfo) } : {}),
        portIdentity,
      };
      const transportDiagnostics = transportDiagnosticsFor(portIdentity, input.backend);

      // A simulated backend that cannot execute the protocol is rejected before any
      // command is written, so no session is published for a variant the simulator
      // would fail on mid-operation.
      assertSimulatedSupport(resolved, input.backend, context);

      const pending: PendingSession = {
        transport: input.transport,
        selection: resolved,
        ...(input.portInfo ? { portInfo: input.portInfo } : {}),
        transportFacts,
      };

      let probe: ProbeResult<unknown>;
      try {
        probe = await runtime.driver.probe({ pending });
      } catch (error) {
        const cleanup = await cleanupPending(runtime.driver, pending, 'probe');
        throw withCleanupDiagnostic(
          'probe',
          error,
          cleanup,
          'Device probe failed',
          createDiagnostic('probe-failed', 'error', 'Device probe failed. Check the cable and the selected port.', 'probe'),
          'probe-failed',
          context,
          transportDiagnostics,
        );
      }

      let profile: SessionProfile;
      try {
        profile = resolver.resolve(resolved, probe, transportFacts, plan.parameters, portIdentity);
      } catch (error) {
        const cleanup = await cleanupPending(runtime.driver, pending, 'resolve');
        throw withCleanupDiagnostic(
          'resolve',
          error,
          cleanup,
          'Session resolution failed',
          createDiagnostic('resolve-failed', 'error', 'Could not resolve the selected device profile', 'resolve'),
          'resolve-failed',
          context,
          transportDiagnostics,
        );
      }

      try {
        await runtime.driver.initialize?.(pending);
      } catch (error) {
        const cleanup = await cleanupPending(runtime.driver, pending, 'initialize');
        throw withCleanupDiagnostic(
          'initialize',
          error,
          cleanup,
          'Device initialization failed',
          createDiagnostic('initialize-failed', 'error', 'Device initialization failed after a successful handshake', 'initialize'),
          'initialize-failed',
          context,
          transportDiagnostics,
        );
      }

      return {
        active: {
          profile,
          transport: pending.transport,
          connectionId: input.connectionId,
        },
        ...(probe.facts !== undefined ? { probeFacts: probe.facts } : {}),
        diagnostics: profile.diagnostics,
      };
    },

    async teardown(active: ActiveSession): Promise<readonly DeviceDiagnostic[]> {
      const resolved = registry.findVariant(active.profile.variantId);
      if (!resolved || !composition.has(resolved.runtimeBindingId)) {
        return [
          createDiagnostic(
            'teardown-failed',
            'warning',
            `No runtime is registered to tear down ${active.profile.variantId}`,
            'disconnect',
          ),
        ];
      }
      try {
        await composition.resolve<unknown>(resolved.runtimeBindingId).driver.teardown(active);
        return [];
      } catch (error) {
        if (isSessionStageError(error) && error.diagnostics.length > 0) {
          return error.diagnostics;
        }
        return [
          createDiagnostic(
            'teardown-failed',
            'warning',
            error instanceof Error ? error.message : 'Protocol teardown failed',
            'disconnect',
          ),
        ];
      }
    },
  };
}
