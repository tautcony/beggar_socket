/**
 * Core identifiers and registration contracts of the pure device definition layer.
 *
 * `src/device/` may depend on `src/types/` only: no services, platform, protocol,
 * UI or `device-runtime` imports are allowed here.
 */
import type { SerialPortInfo } from '@/types/serial';

import type { CapabilityDeclarationMap } from './capabilities';
import type { DisplayText } from './display';
import type { HardwareTraits, TransportRequirements } from './hardware';
import type { ParameterSchema, ParameterSchemaFactory } from './parameters';

/** Hardware product identifier, e.g. `beggar-stm` / `beggar-stc` / `gbflash`. */
export type DeviceId = string;
/** Firmware identifier, e.g. `beggar.stm` / `beggar.stm-boost` / `beggar.stc` / `flashgbx.cfw`. */
export type FirmwareId = string;
export type ProtocolId = 'beggar' | 'flashgbx';
/** The single selectable unit: a registered device + firmware binding id. */
export type VariantId = string;
export type TransportBackend = 'serial' | 'simulated';
export type PlatformId = 'gba' | 'mbc5';

export type VerificationStatus = 'verified' | 'assumed' | 'not-applicable';

export type RuntimeBindingId = string & { readonly __brand: 'RuntimeBindingId' };

export function createRuntimeBindingId(id: string): RuntimeBindingId {
  return id as RuntimeBindingId;
}

/** Hardware only: everything here is independent of the installed firmware. */
export interface DeviceDefinition {
  readonly id: DeviceId;
  readonly displayName: DisplayText;
  readonly hardware: HardwareTraits;
}

/** Firmware: how the device talks. Never stores an implementation id. */
export interface FirmwareDefinition {
  readonly id: FirmwareId;
  readonly displayName: DisplayText;
  readonly protocol: ProtocolId;
  /** Normative capability matrix row for this firmware. */
  readonly baseCapabilities: CapabilityDeclarationMap;
  readonly parameters: ParameterSchemaFactory;
}

/** VID/PID conditions the host can actually filter on. */
export interface UsbDiscoveryFilter {
  readonly vendorId?: string;
  readonly productId?: string;
}

/** Identity rules used for diagnostics and manual candidate ordering. */
export interface UsbIdentityMatcher {
  readonly id: string;
  readonly vendorId?: string;
  readonly productId?: string;
  /** Human readable hint, diagnostics only. */
  readonly description?: string;
}

export type UsbIdentity = 'match' | 'mismatch' | 'unknown';

/** An explicitly registered legal device/firmware combination. */
export interface DeviceFirmwareBinding {
  readonly id: VariantId;
  readonly deviceId: DeviceId;
  readonly firmwareId: FirmwareId;
  readonly discoveryFilters: readonly UsbDiscoveryFilter[];
  readonly identityMatchers: readonly UsbIdentityMatcher[];
  /** Single source of static transport requirements. */
  readonly transport: TransportRequirements;
  /** STM and Boost share `beggar.stm`. */
  readonly parameterNamespace: string;
  /** Single source of the driver / adapter / display / mode-sync implementation. */
  readonly runtimeBindingId: RuntimeBindingId;
  /**
   * Whether the debug simulator can actually execute this variant's protocol.
   *
   * The simulator implements the standard Beggar command frames only, so a simulated
   * GBFlash or Boost session would be published and then fail on its first operation.
   * Absent means "not simulated": the transaction rejects the combination before probing
   * instead of committing a session that cannot work.
   */
  readonly simulated?: SimulatedProtocolSupport;
}

/** Simulator support declaration of one binding. */
export interface SimulatedProtocolSupport {
  readonly supported: boolean;
  /** Shown in the rejection diagnostic; required when `supported` is false. */
  readonly reason?: DisplayText;
}

export interface SelectableVariant {
  readonly variantId: VariantId;
  readonly deviceName: DisplayText;
  readonly firmwareName: DisplayText;
}

/** Fully resolved selection: device, firmware, matcher, runtime and namespace at once. */
export interface ResolvedVariantSelection {
  readonly variantId: VariantId;
  readonly binding: DeviceFirmwareBinding;
  readonly device: DeviceDefinition;
  readonly firmware: FirmwareDefinition;
  readonly runtimeBindingId: RuntimeBindingId;
  readonly parameterNamespace: string;
  readonly transport: TransportRequirements;
}

/** Where a selection came from; invalid means "ask the user, do not guess". */
export interface SelectionSnapshot {
  readonly variantId?: VariantId;
  readonly source: 'legacy' | 'v2' | 'invalid';
}

/** P1/P2 is read-only; P3 enables `write` after the v2 migration. */
export interface SelectionProvider {
  read(): SelectionSnapshot;
  write?(variantId: VariantId): void;
}

export interface DeviceRegistry {
  register(
    device: DeviceDefinition,
    firmwares: readonly FirmwareDefinition[],
    bindings: readonly DeviceFirmwareBinding[],
  ): void;
  listSelectable(): readonly SelectableVariant[];
  selectVariant(variantId: VariantId): ResolvedVariantSelection;
  findVariant(variantId: string): ResolvedVariantSelection | undefined;
  listBindings(): readonly DeviceFirmwareBinding[];
  getDevice(deviceId: DeviceId): DeviceDefinition | undefined;
  getFirmware(firmwareId: FirmwareId): FirmwareDefinition | undefined;
  forUsbFilters(binding: DeviceFirmwareBinding): SerialPortFilter[];
  matchPort(binding: DeviceFirmwareBinding, port?: SerialPortInfo | null): UsbIdentity;
  /**
   * Namespace scoped schema. Bindings sharing a namespace must declare the same
   * host packet limits; the read ceiling is the widest of the sharing variants.
   */
  resolveNamespaceSchema(namespace: string): { readonly schema: ParameterSchema; readonly transport: TransportRequirements } | undefined;
}
