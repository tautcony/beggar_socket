/**
 * Transitional `FirmwareProfile` facade (deprecated).
 *
 * The legacy profile shape is now derived from the registered device/firmware definitions
 * instead of a hand-maintained table. Lenient defaults for unknown devices live **only**
 * here: the new resolver treats undeclared capabilities as unsupported.
 *
 * Delete in P4 together with `types/firmware-profile.ts`'s value exports.
 */
import type { RamType } from '@/types/command-options';
import type { DeviceInfo } from '@/types/device-info';
import type {
  FirmwareCapabilities,
  FirmwareProfile,
  FirmwareProfileId,
} from '@/types/firmware-profile';
import type { SerialPortInfo } from '@/types/serial';

import { resolveCapabilities } from '../capabilities';
import {
  BEGGAR_STC_BINDING,
  BEGGAR_STC_DEVICE,
  BEGGAR_STC_FIRMWARE,
  BEGGAR_STM_BINDING,
  BEGGAR_STM_DEVICE,
  BEGGAR_STM_FIRMWARE,
  FLASHGBX_FIRMWARE,
  GBFLASH_BINDING,
  GBFLASH_DEVICE,
} from '../definitions';
import type { DisplayText } from '../display';
import type { DeviceDefinition, FirmwareDefinition } from '../types';

function displayTextToString(text: DisplayText): string {
  return typeof text === 'string' ? text : text.fallback ?? text.key;
}

function legacyCapabilitiesFrom(
  firmware: FirmwareDefinition,
  device: DeviceDefinition,
): FirmwareCapabilities {
  const capabilities = resolveCapabilities(firmware.baseCapabilities, device.hardware);
  return {
    gbaSectorErase: capabilities.has('rom.erase.sector'),
    gbaFramRam: capabilities.has('ram.fram.gba'),
    gbcFramRam: capabilities.has('ram.fram.gbc'),
    cartPowerControl: capabilities.has('cart.powerControl'),
    boostMode: false,
    nativeFlashgbxProtocol: firmware.protocol === 'flashgbx',
    audioWePin: capabilities.has('cart.audioWePin'),
  };
}

function buildLegacyProfile(
  id: FirmwareProfileId,
  firmware: FirmwareDefinition,
  device: DeviceDefinition,
  maxReadChunk: number,
): FirmwareProfile {
  return Object.freeze({
    id,
    label: displayTextToString(firmware.displayName),
    maxReadChunk,
    capabilities: Object.freeze(legacyCapabilitiesFrom(firmware, device)),
  });
}

/** Deprecated (removed in P4): use the registered `beggar.stm` definition / resolved session profile. */
export const STM_FIRMWARE_PROFILE: FirmwareProfile = buildLegacyProfile(
  'stm',
  BEGGAR_STM_FIRMWARE,
  BEGGAR_STM_DEVICE,
  BEGGAR_STM_BINDING.transport.maxReadChunk,
);

/** Deprecated (removed in P4): use the registered `beggar.stc` definition / resolved session profile. */
export const STC_FIRMWARE_PROFILE: FirmwareProfile = buildLegacyProfile(
  'stc',
  BEGGAR_STC_FIRMWARE,
  BEGGAR_STC_DEVICE,
  BEGGAR_STC_BINDING.transport.maxReadChunk,
);

/** Deprecated (removed in P4): use the registered `flashgbx.cfw` definition / resolved session profile. */
export const FLASHGBX_FIRMWARE_PROFILE: FirmwareProfile = buildLegacyProfile(
  'flashgbx',
  FLASHGBX_FIRMWARE,
  GBFLASH_DEVICE,
  GBFLASH_BINDING.transport.maxReadChunk,
);

/**
 * Lenient fallback for unknown devices. This permissiveness exists only in the facade;
 * the new resolution path never produces an unknown session.
 *
 * Deprecated (removed in P4).
 */
export const UNKNOWN_FIRMWARE_PROFILE: FirmwareProfile = Object.freeze({
  id: 'unknown',
  label: 'Unknown',
  maxReadChunk: 0x1000,
  capabilities: Object.freeze({
    gbaSectorErase: true,
    gbaFramRam: true,
    gbcFramRam: true,
    cartPowerControl: true,
    boostMode: false,
    nativeFlashgbxProtocol: false,
    audioWePin: false,
  }),
});

/** Deprecated (removed in P4): Boost is an explicitly selected variant (`beggar-stm-boost`). */
export function withBeggarBoostProfile(
  baseProfile: FirmwareProfile = STM_FIRMWARE_PROFILE,
  firmwareVersion?: string,
): FirmwareProfile {
  return {
    ...baseProfile,
    label: baseProfile.id === 'stm' ? '丐中丐 (Boost)' : `${baseProfile.label} (Boost)`,
    maxReadChunk: 0x2000,
    firmwareVersion,
    capabilities: {
      ...baseProfile.capabilities,
      boostMode: true,
    },
  };
}

/** Deprecated (removed in P4). */
export function getFirmwareProfileById(id: FirmwareProfileId): FirmwareProfile {
  switch (id) {
    case 'stm':
      return STM_FIRMWARE_PROFILE;
    case 'stc':
      return STC_FIRMWARE_PROFILE;
    case 'flashgbx':
      return FLASHGBX_FIRMWARE_PROFILE;
    case 'unknown':
      return UNKNOWN_FIRMWARE_PROFILE;
  }
}

function lower(value?: string): string {
  return value?.toLowerCase() ?? '';
}

function containsAny(value: string, tokens: readonly string[]): boolean {
  return tokens.some(token => value.includes(token));
}

/**
 * Legacy port inference, kept byte-for-byte compatible with the previous behavior.
 *
 * Deprecated (removed in P4): Connection setup selects a variant; port matching only reports match /
 * mismatch / unknown.
 */
export function inferFirmwareProfileFromPort(
  portInfo?: SerialPortInfo | null,
  _configuredProfile?: FirmwareProfileId,
): FirmwareProfile {
  const manufacturer = lower(portInfo?.manufacturer);
  const product = lower(portInfo?.product);
  const path = lower(portInfo?.path);
  const serialNumber = lower(portInfo?.serialNumber);

  if (containsAny(`${manufacturer} ${product} ${path}`, ['stc', 'stc8'])) {
    return STC_FIRMWARE_PROFILE;
  }

  const vendorId = lower(portInfo?.vendorId);
  const productId = lower(portInfo?.productId);
  if (vendorId === '0483' && productId === '5740') {
    return STC_FIRMWARE_PROFILE;
  }

  if (serialNumber || /usbmodem[0-9a-f]{8,}$/i.test(portInfo?.path ?? '')) {
    return STM_FIRMWARE_PROFILE;
  }

  if (vendorId === '0483' && productId === '0721') {
    if (/usbmodem\d+$/i.test(portInfo?.path ?? '')) {
      return STC_FIRMWARE_PROFILE;
    }
    if (containsAny(`${manufacturer} ${product}`, ['stmicroelectronics', 'stm32', 'beggar socket', 'chisflash beggar'])) {
      return STM_FIRMWARE_PROFILE;
    }
    return UNKNOWN_FIRMWARE_PROFILE;
  }

  return UNKNOWN_FIRMWARE_PROFILE;
}

/** Deprecated (removed in P4). */
export function attachFirmwareProfile(device: DeviceInfo, profile?: FirmwareProfile): DeviceInfo {
  const resolvedProfile = profile ?? inferFirmwareProfileFromPort(device.portInfo);
  device.firmwareProfile = resolvedProfile;
  if (device.serialHandle) {
    device.serialHandle.firmwareProfile = resolvedProfile;
  }
  return device;
}

/** Deprecated (removed in P4): read `device.session.profile` instead once lifecycle is migrated. */
export function getFirmwareProfile(device: DeviceInfo): FirmwareProfile {
  return device.firmwareProfile
    ?? device.serialHandle?.firmwareProfile
    ?? inferFirmwareProfileFromPort(device.portInfo ?? device.serialHandle?.portInfo);
}

/** Deprecated (removed in P4): use capability queries (`ram.fram.gba` / `ram.fram.gbc`). */
export function isRamTypeSupportedByFirmware(
  profile: FirmwareProfile,
  platformId: 'gba' | 'mbc5',
  ramType: RamType,
): boolean {
  if (ramType !== 'FRAM') {
    return true;
  }

  return platformId === 'gba'
    ? profile.capabilities.gbaFramRam
    : profile.capabilities.gbcFramRam;
}

/** Deprecated (removed in P4): use capability queries and localized messages from the session profile. */
export function firmwareUnsupportedResult(
  operation: string,
  profile: FirmwareProfile,
): { success: false; message: string; errorCode: string; errorStage: string } {
  return {
    success: false,
    message: `${operation} is not supported by ${profile.label} firmware`,
    errorCode: 'unsupported',
    errorStage: 'protocol',
  };
}
