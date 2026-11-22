/**
 * Legacy firmware profile types (deprecated).
 *
 * Only the shape lives here: `types/` must not import `device/` at runtime (enforced by
 * `npm run check:deps`). The values — constants, inference and helpers — are derived
 * from the registered definitions in `@/device/compat/firmware-profile`.
 *
 * Deprecated (removed in P4): use `SessionProfile` from `@/device` and capability queries instead.
 */
export type FirmwareProfileId = 'stm' | 'stc' | 'flashgbx' | 'unknown';
export type ConfigurableFirmwareProfileId = Exclude<FirmwareProfileId, 'unknown'>;

export interface FirmwareCapabilities {
  readonly gbaSectorErase: boolean;
  readonly gbaFramRam: boolean;
  readonly gbcFramRam: boolean;
  readonly cartPowerControl: boolean;
  readonly boostMode: boolean;
  readonly nativeFlashgbxProtocol: boolean;
  readonly audioWePin: boolean;
}

export interface FirmwareProfile {
  readonly id: FirmwareProfileId;
  readonly label: string;
  readonly maxReadChunk: number;
  readonly capabilities: FirmwareCapabilities;
  readonly firmwareVersion?: string;
}
