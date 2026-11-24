/**
 * Beggar protocol driver (丐中丐 / 丐中丐 Boost / 碳酸丐).
 *
 * Standard STM and STC firmware have no identity handshake, so their probe is a no-op
 * that reports `assumed`. Only an explicitly selected Boost variant probes the Boost
 * extension, always with the fixed 250 ms budget — the session never downgrades itself
 * to a standard STM session when that handshake fails.
 */
import { VARIANT_IDS } from '@/device/definitions';
import type { ProbeResult, ProtocolDriver } from '@/device/session';
import type { Transport } from '@/platform/serial';
import {
  boost_probe,
  BOOST_PROBE_TIMEOUT_MS,
  boost_reset_to_default,
  ensureDefaultProtocol,
} from '@/protocol';

import { createDiagnostic, SessionStageError } from '../diagnostics';
import { asPlatformTransport } from '../session-transport';

export interface BeggarProbeFacts {
  /** Boost banner reported by `boost_probe`. */
  readonly boostBanner?: string;
  readonly boostSupported?: boolean;
}

/** `boost_probe(transport, 250)`: the timeout is fixed, not `packageReceiveTimeout`. */
export const BEGGAR_BOOST_PROBE_TIMEOUT_MS = BOOST_PROBE_TIMEOUT_MS;

function isSimulated(backend: 'serial' | 'simulated'): boolean {
  return backend === 'simulated';
}

/** Best effort: a Boost reset failure must never hide the probe failure that caused it. */
async function resetBoostSafely(transport: Transport): Promise<void> {
  try {
    await boost_reset_to_default(transport);
  } catch {
    // The probe error stays authoritative; the port closes in the cleanup path.
  }
}

export function createBeggarDriver(): ProtocolDriver<BeggarProbeFacts> {
  return {
    async probe({ pending }): Promise<ProbeResult<BeggarProbeFacts>> {
      const firmwareId = pending.selection.firmware.id;

      // Debug simulation executes the implemented Beggar protocol and cannot answer the
      // Boost handshake, so it keeps whatever the simulation actually implements.
      if (isSimulated(pending.transportFacts.backend)) {
        return { firmwareId, verification: 'not-applicable', facts: {} };
      }

      if (pending.selection.variantId !== VARIANT_IDS.stmBoost) {
        return { firmwareId, verification: 'assumed', facts: {} };
      }

      const transport = asPlatformTransport(pending.transport);
      const probe = await boost_probe(transport, BEGGAR_BOOST_PROBE_TIMEOUT_MS);
      if (!probe.supported) {
        await resetBoostSafely(transport);
        throw new SessionStageError(
          'probe',
          'Beggar Boost handshake did not answer; the selected 丐中丐（Boost） variant requires Boost firmware',
          {
            code: 'boost-unsupported',
            diagnostics: [
              createDiagnostic(
                'boost-probe-failed',
                'error',
                'Boost handshake failed. Switch the advanced settings back to standard 丐中丐 or check the firmware.',
                'probe',
              ),
            ],
          },
        );
      }

      return {
        firmwareId,
        verification: 'verified',
        ...(probe.banner ? { firmwareVersion: probe.banner } : {}),
        facts: { boostSupported: true, ...(probe.banner ? { boostBanner: probe.banner } : {}) },
      };
    },

    initialize(): Promise<void> {
      // DTR/RTS initialisation belongs to the gateway `init()` step; the Beggar protocol
      // itself has no additional session initialisation.
      return Promise.resolve();
    },

    async teardown(session): Promise<void> {
      const transport = asPlatformTransport(session.transport);
      try {
        await ensureDefaultProtocol(transport);
      } catch (error) {
        throw new SessionStageError('disconnect', 'Failed to leave Beggar Boost mode', {
          code: 'teardown-failed',
          diagnostics: [
            createDiagnostic('teardown-failed', 'error', 'Failed to reset the device to the default protocol', 'disconnect'),
          ],
          cause: error,
        });
      }
    },

    async cleanupPending(pending): Promise<void> {
      // Protocol state only: the orchestration closes the pending transport right after,
      // so the driver must stay idempotent and never close it twice. A failure here is
      // reported by the transaction as a `cleanup-failed` diagnostic instead of being
      // swallowed: the primary stage error stays authoritative either way.
      if (pending.transportFacts.backend === 'simulated') {
        return;
      }
      const transport = asPlatformTransport(pending.transport);
      await transport.flushInput?.();
      await ensureDefaultProtocol(transport);
    },
  };
}
