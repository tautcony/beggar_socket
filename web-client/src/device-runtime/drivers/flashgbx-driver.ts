/**
 * FlashGBX protocol driver.
 *
 * P0 skeleton: verification is reported as `verified` because the real driver has to
 * complete the `0xA1` handshake before a session may be published. The handshake
 * client and teardown sequence (`CART_PWR_OFF` + 3.3V) land with
 * `refactor-device-lifecycle-drivers`.
 */
import type { CapabilitySignals } from '@/device/capabilities';
import type { ProbeResult, ProtocolDriver } from '@/device/session';
import type { FlashgbxFirmwareInfo } from '@/protocol/flashgbx';

export interface FlashgbxProbeFacts {
  readonly firmwareInfo?: FlashgbxFirmwareInfo;
}

export function createFlashgbxDriver(): ProtocolDriver<FlashgbxProbeFacts> {
  return {
    probe({ pending }): Promise<ProbeResult<FlashgbxProbeFacts>> {
      return Promise.resolve({
        firmwareId: pending.selection.firmware.id,
        verification: 'verified',
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
