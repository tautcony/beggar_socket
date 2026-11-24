/**
 * Package timeouts of the running operation.
 *
 * The protocol layer used to read `AdvancedSettings.packageSendTimeout` /
 * `packageReceiveTimeout` on every frame, so a settings edit made mid-transfer could change
 * the timeout of a transfer already in flight. The adapter binds its operation snapshot to
 * the transport at `beginOperation()`, and the protocol helpers read that scope instead of
 * the persisted values.
 *
 * The binding lives next to the transport (not in a module global) so two connections can
 * never observe each other's snapshot, and it is dropped when the operation ends.
 */
import { AdvancedSettings } from '@/settings/advanced-settings';

export interface PackageTimeouts {
  readonly send: number;
  readonly receive: number;
}

const scopeByTransport = new WeakMap<object, PackageTimeouts>();

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/** Binds the timeouts of one operation to its transport. */
export function bindPackageTimeouts(transport: object, timeouts: PackageTimeouts): void {
  if (!isPositive(timeouts.send) || !isPositive(timeouts.receive)) {
    // An unusable snapshot must not widen or zero the protocol deadlines.
    scopeByTransport.delete(transport);
    return;
  }
  scopeByTransport.set(transport, timeouts);
}

/** Drops the bound snapshot so later reads fall back to the persisted settings. */
export function releasePackageTimeouts(transport: object): void {
  scopeByTransport.delete(transport);
}

/**
 * Timeouts the protocol layer must use for this transport.
 *
 * Returns the operation snapshot when one is bound; otherwise the persisted values, which
 * is what direct protocol use (debug tools, tests) and session establishment rely on.
 */
export function packageTimeouts(transport: object): PackageTimeouts {
  const bound = scopeByTransport.get(transport);
  if (bound) {
    return bound;
  }
  return {
    send: AdvancedSettings.packageSendTimeout,
    receive: AdvancedSettings.packageReceiveTimeout,
  };
}
