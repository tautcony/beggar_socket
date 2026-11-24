/**
 * Transitional `FirmwareProfile` facade (deprecated).
 *
 * The legacy profile shape is derived from the registered device/firmware definitions,
 * never from port strings and never with permissive defaults: a device without a committed
 * session and without an explicit legacy profile has no profile at all.
 *
 * Delete in P4 together with `types/firmware-profile.ts`'s value exports.
 */
import type {
  FirmwareCapabilities,
  FirmwareProfile,
  FirmwareProfileId,
} from '@/types/firmware-profile';

import { resolveCapabilities } from '../capabilities';
import {
  BEGGAR_STC_BINDING,
  BEGGAR_STC_DEVICE,
  BEGGAR_STC_FIRMWARE,
  BEGGAR_STM_BINDING,
  BEGGAR_STM_DEVICE,
  BEGGAR_STM_FIRMWARE,
  GBFLASH_FIRMWARE,
  GBFLASH_BINDING,
  GBFLASH_DEVICE,
} from '../definitions';
import { displayTextToString } from '../display';
import type { SessionProfile } from '../session';
import type { DeviceDefinition, FirmwareDefinition } from '../types';

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
    nativeGbflashProtocol: firmware.protocol === 'gbflash',
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

/** Deprecated (removed in P4): use the registered `gbflash.cfw` definition / resolved session profile. */
export const GBFLASH_FIRMWARE_PROFILE: FirmwareProfile = buildLegacyProfile(
  'gbflash',
  GBFLASH_FIRMWARE,
  GBFLASH_DEVICE,
  GBFLASH_BINDING.transport.maxReadChunk,
);

/**
 * Projection of a committed session onto the legacy `FirmwareProfile` shape.
 *
 * Adapters and UI still read `FirmwareProfile` during the transition; every value here is
 * taken from the resolved session so the legacy view can never drift from it.
 *
 * Deprecated (removed in P4).
 */
export function firmwareProfileFromSession(profile: SessionProfile): FirmwareProfile {
  const id: FirmwareProfileId = profile.firmware.protocol === 'gbflash'
    ? 'gbflash'
    : profile.variantId === BEGGAR_STC_BINDING.id ? 'stc' : 'stm';

  return Object.freeze({
    id,
    label: displayTextToString(profile.display.title),
    maxReadChunk: profile.transport.maxReadChunk,
    ...(profile.firmwareVersion !== undefined ? { firmwareVersion: profile.firmwareVersion } : {}),
    capabilities: Object.freeze({
      gbaSectorErase: profile.capabilities.has('rom.erase.sector'),
      gbaFramRam: profile.capabilities.has('ram.fram.gba'),
      gbcFramRam: profile.capabilities.has('ram.fram.gbc'),
      cartPowerControl: profile.capabilities.has('cart.powerControl'),
      boostMode: profile.runtimeFeatures.boostTransport,
      nativeGbflashProtocol: profile.firmware.protocol === 'gbflash',
      audioWePin: profile.capabilities.has('cart.audioWePin'),
    }),
  });
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
