/**
 * Connection plan: the single snapshot a connection attempt is built from.
 *
 * The saved selection and the operation parameters are read exactly once, before the
 * port opens. Everything downstream (port baud rate, probe, resolve, the published
 * `SessionProfile`) consumes that snapshot, so an asynchronous open cannot straddle two
 * different configurations.
 */
import type { ParameterStore } from '@/device/parameters';
import type { ConnectionPlan } from '@/device/session';
import type { DeviceRegistry, ResolvedVariantSelection, SelectionProvider } from '@/device/types';

import { createDiagnostic, SessionStageError } from './diagnostics';
import { resolveConnectionBaudRate } from './session-resolver';

export interface ConnectionPlanDeps {
  readonly selection: SelectionProvider;
  readonly registry: DeviceRegistry;
  readonly store: ParameterStore;
}

/** Selection-stage failure shared by the plan reader and the establishment transaction. */
export function selectionFailure(message: string, code: string, cause?: unknown): SessionStageError {
  return new SessionStageError('selection', message, {
    code,
    diagnostics: [createDiagnostic(code, 'error', message, 'selection')],
    cause,
  });
}

/** Resolves a saved variant id or throws a selection-stage error; never guesses. */
export function requireVariant(registry: DeviceRegistry, variantId: string): ResolvedVariantSelection {
  try {
    return registry.selectVariant(variantId);
  } catch (error) {
    throw selectionFailure(`Device selection ${variantId} is not registered`, 'selection-invalid', error);
  }
}

/**
 * Takes the attempt snapshot: selected variant, its operation parameters and the baud
 * rate those parameters resolve to.
 */
export function planConnection(deps: ConnectionPlanDeps): ConnectionPlan {
  const snapshot = deps.selection.read();
  if (!snapshot.variantId) {
    throw selectionFailure(
      'No valid device selection. Choose a device and firmware in the advanced settings.',
      'selection-invalid',
    );
  }

  const resolved = requireVariant(deps.registry, snapshot.variantId);
  const settings = deps.store.operationSnapshot(resolved.parameterNamespace);
  const baudRate = resolveConnectionBaudRate(resolved, settings.values);

  return Object.freeze({
    variantId: resolved.variantId,
    parameters: Object.freeze({ ...settings.values }),
    ...(baudRate !== undefined ? { baudRate } : {}),
  });
}
