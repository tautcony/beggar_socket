/**
 * Beggar protocol driver.
 *
 * P0 skeleton: the stub reports `assumed` verification, exactly like the current
 * standard STM path (no identity handshake). The real probe / Boost detection arrives
 * with `refactor-device-lifecycle-drivers` and keeps the same `RuntimeBinding<TFacts>`.
 */
import type { ProbeResult, ProtocolDriver } from '@/device/session';

export interface BeggarProbeFacts {
  /** Boost banner reported by `boost_probe`. */
  readonly boostBanner?: string;
  readonly boostSupported?: boolean;
}

/** `boost_probe(transport, 250)`: the timeout is fixed, not `packageReceiveTimeout`. */
export const BEGGAR_BOOST_PROBE_TIMEOUT_MS = 250;

export function createBeggarDriver(): ProtocolDriver<BeggarProbeFacts> {
  return {
    probe({ pending }): Promise<ProbeResult<BeggarProbeFacts>> {
      return Promise.resolve({
        firmwareId: pending.selection.firmware.id,
        verification: 'assumed',
        facts: {},
      });
    },
    initialize(): Promise<void> {
      return Promise.resolve();
    },
    teardown(): Promise<void> {
      return Promise.resolve();
    },
    cleanupPending(): Promise<void> {
      return Promise.resolve();
    },
  };
}
