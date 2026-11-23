/**
 * FlashGBX protocol driver (GBFlash hardware).
 *
 * The `0xA1` handshake is the only probe; it runs with the same 250 ms lifecycle budget
 * the teardown uses. Teardown follows one normative sequence and reports every failing
 * safety command as a `disconnect` diagnostic while the transport still closes.
 */
import type { CapabilitySignals } from '@/device/capabilities';
import type { DeviceDiagnostic, ProbeResult, ProtocolDriver, SessionTransport } from '@/device/session';
import {
  type FlashgbxFirmwareInfo,
  FlashgbxHandshakeError,
  performFlashgbxHandshake,
  performFlashgbxTeardown,
} from '@/protocol/flashgbx';
import type { SerialPortInfo } from '@/types/serial';

import { createDiagnostic, SessionStageError } from '../diagnostics';
import { asPlatformTransport } from '../session-transport';

export interface FlashgbxProbeFacts {
  readonly firmwareInfo?: FlashgbxFirmwareInfo;
}

/** Facts are keyed by transport because that identity survives into `ActiveSession`. */
const probeFacts = new WeakMap<SessionTransport, FlashgbxProbeFacts>();

function toPortInfo(pending: { readonly transportFacts: { readonly usb?: { readonly vendorId?: string; readonly productId?: string } }; readonly portInfo?: SerialPortInfo }): SerialPortInfo | undefined {
  if (pending.portInfo) {
    return pending.portInfo;
  }
  const usb = pending.transportFacts.usb;
  if (!usb?.vendorId && !usb?.productId) {
    return undefined;
  }
  return { path: 'unknown-port', ...usb };
}

function handshakeDiagnostic(error: FlashgbxHandshakeError): DeviceDiagnostic {
  if (error.code === 'unsupported') {
    return createDiagnostic(
      'unsupported-firmware',
      'error',
      `Unsupported GBFlash firmware (${error.message}). Update the FlashGBX firmware and retry.`,
      'probe',
    );
  }
  return createDiagnostic(
    'handshake-failed',
    'error',
    `GBFlash handshake failed at ${error.stage} (${error.code}). Check the cable and the selected port.`,
    'probe',
  );
}

export function createFlashgbxDriver(): ProtocolDriver<FlashgbxProbeFacts> {
  return {
    async probe({ pending }): Promise<ProbeResult<FlashgbxProbeFacts>> {
      const firmwareId = pending.selection.firmware.id;

      if (pending.transportFacts.backend === 'simulated') {
        return { firmwareId, verification: 'not-applicable', facts: {} };
      }

      const transport = asPlatformTransport(pending.transport);
      try {
        const firmwareInfo = await performFlashgbxHandshake(transport, {
          portInfo: toPortInfo(pending),
        });
        const facts: FlashgbxProbeFacts = { firmwareInfo };
        probeFacts.set(pending.transport, facts);
        return {
          firmwareId,
          verification: 'verified',
          firmwareVersion: `${firmwareInfo.cfwId}${firmwareInfo.fwVer}`,
          facts,
        };
      } catch (error) {
        if (error instanceof FlashgbxHandshakeError) {
          throw new SessionStageError('probe', error.message, {
            code: error.code,
            diagnostics: [handshakeDiagnostic(error)],
            cause: error,
          });
        }
        throw new SessionStageError('probe', 'GBFlash handshake failed', {
          code: 'handshake-failed',
          diagnostics: [
            createDiagnostic('handshake-failed', 'error', 'GBFlash handshake failed. Check the cable and the selected port.', 'probe'),
          ],
          cause: error,
        });
      }
    },

    initialize(): Promise<void> {
      // The handshake already leaves the device in its default state; nothing else is
      // required before the session may be published.
      return Promise.resolve();
    },

    async teardown(session): Promise<void> {
      const transport = asPlatformTransport(session.transport);
      const firmwareInfo = probeFacts.get(session.transport)?.firmwareInfo;
      const { failures } = await performFlashgbxTeardown(transport, firmwareInfo ?? null);
      if (failures.length === 0) {
        return;
      }
      throw new SessionStageError(
        'disconnect',
        `GBFlash teardown failed (${failures.map(failure => failure.command).join(', ')})`,
        {
          code: 'teardown-failed',
          diagnostics: failures.map(failure => createDiagnostic(
            'teardown-failed',
            'error',
            `Failed to send ${failure.command} while disconnecting the GBFlash device`,
            'disconnect',
          )),
          cause: failures[0]?.error,
        },
      );
    },

    async cleanupPending(pending): Promise<void> {
      // A partially completed handshake leaves stray bytes behind; the port itself is
      // closed by the orchestration.
      const transport = asPlatformTransport(pending.transport);
      try {
        await transport.flushInput?.();
        await transport.flushOutput?.();
      } catch {
        // Best effort only.
      }
      probeFacts.delete(pending.transport);
    },
  };
}

/**
 * Per-PCB facts → conditional capability signals. Without a handshake result every
 * conditional capability stays unsupported, which is the safe direction.
 */
export function flashgbxCapabilitySignals(facts: FlashgbxProbeFacts): CapabilitySignals {
  const info = facts.firmwareInfo;
  return {
    powerControlPresent: info?.cartPowerCtrl ?? false,
    audioWriteEnabled: info?.audioWePin ?? false,
    presenceDetectPresent: info?.cartPresenceSwitch ?? false,
  };
}
