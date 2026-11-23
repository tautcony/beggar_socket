/**
 * Session establishment transaction.
 *
 * `PendingSession` is created from the transport right after the port opens. Probe,
 * resolve and initialize all run against it; only a fully resolved profile is committed
 * as an `ActiveSession`. Any failure before commit runs `cleanupPending()` so protocol
 * state never leaks into the next attempt, and the transport is closed by the caller.
 */
import type { ParameterStore } from '@/device/parameters';
import type {
  ActiveSession,
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
import type { SerialPortInfo } from '@/types/serial';

import type { RuntimeCompositionRegistry } from './composition-registry';
import { createDiagnostic, isSessionStageError, type SessionFailureStage, SessionStageError } from './diagnostics';
import type { SessionResolver } from './session-resolver';

export interface EstablishSessionInput {
  /** Stable identity of the connection attempt; committed with the active session. */
  readonly connectionId: string;
  readonly transport: PendingSession['transport'];
  readonly portInfo?: SerialPortInfo;
  readonly backend: TransportBackend;
  readonly usb?: { readonly vendorId?: string; readonly productId?: string };
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

function selectionFailure(message: string, code: string, cause?: unknown): SessionStageError {
  return new SessionStageError('selection', message, {
    code,
    diagnostics: [createDiagnostic(code, 'error', message, 'selection')],
    cause,
  });
}

export function createSessionEstablishment(deps: SessionEstablishmentDeps): SessionEstablishment {
  const { selection, registry, store, resolver, composition } = deps;

  async function cleanupPending(
    driver: ProtocolDriver<unknown>,
    pending: PendingSession,
    stage: Exclude<SessionFailureStage, 'selection' | 'disconnect'>,
    primary: unknown,
  ): Promise<unknown> {
    try {
      await driver.cleanupPending(pending, stage);
      return undefined;
    } catch (cleanupError) {
      return cleanupError;
    }
  }

  return {
    async establish(input: EstablishSessionInput): Promise<EstablishedSession> {
      const snapshot = selection.read();
      if (!snapshot.variantId) {
        throw selectionFailure(
          'No valid device selection. Choose a device and firmware in the advanced settings.',
          'selection-invalid',
        );
      }

      let resolved: ResolvedVariantSelection;
      try {
        resolved = registry.selectVariant(snapshot.variantId);
      } catch (error) {
        throw selectionFailure(
          `Device selection ${snapshot.variantId} is not registered`,
          'selection-invalid',
          error,
        );
      }

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
        const cleanup = await cleanupPending(runtime.driver, pending, 'probe', error);
        throw error instanceof SessionStageError
          ? error
          : new SessionStageError('probe', error instanceof Error ? error.message : 'Device probe failed', {
            code: 'probe-failed',
            diagnostics: [
              createDiagnostic('probe-failed', 'error', 'Device probe failed. Check the cable and the selected port.', 'probe'),
              ...(cleanup
                ? [createDiagnostic('cleanup-failed', 'warning', 'Protocol cleanup after the probe failure also failed', 'probe')]
                : []),
            ],
            cause: cleanup ? { original: error, cleanup } : error,
          });
      }

      let profile: SessionProfile;
      try {
        profile = resolver.resolve(resolved, probe, transportFacts, store);
      } catch (error) {
        const cleanup = await cleanupPending(runtime.driver, pending, 'resolve', error);
        throw new SessionStageError('resolve', error instanceof Error ? error.message : 'Session resolution failed', {
          code: 'resolve-failed',
          diagnostics: [
            createDiagnostic('resolve-failed', 'error', 'Could not resolve the selected device profile', 'resolve'),
            ...(cleanup
              ? [createDiagnostic('cleanup-failed', 'warning', 'Protocol cleanup after the resolve failure also failed', 'resolve')]
              : []),
          ],
          cause: cleanup ? { original: error, cleanup } : error,
        });
      }

      try {
        await runtime.driver.initialize?.(pending);
      } catch (error) {
        const cleanup = await cleanupPending(runtime.driver, pending, 'initialize', error);
        throw new SessionStageError('initialize', error instanceof Error ? error.message : 'Device initialization failed', {
          code: 'initialize-failed',
          diagnostics: [
            createDiagnostic('initialize-failed', 'error', 'Device initialization failed after a successful handshake', 'initialize'),
            ...(cleanup
              ? [createDiagnostic('cleanup-failed', 'warning', 'Protocol cleanup after the initialization failure also failed', 'initialize')]
              : []),
          ],
          cause: cleanup ? { original: error, cleanup } : error,
        });
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
