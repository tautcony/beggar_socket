/**
 * 丐中丐 (Beggar STM32) hardware with its two firmware variants.
 *
 * Boost is an independent firmware that reuses the standard STM implementation,
 * runtime binding and `beggar.stm` parameter namespace; it only widens the read chunk.
 */
import type { CompleteCapabilityDeclarations } from '../capabilities';
import type { TransportRequirements } from '../hardware';
import {
  createRuntimeBindingId,
  type DeviceDefinition,
  type DeviceFirmwareBinding,
  type FirmwareDefinition,
} from '../types';
import { BEGGAR_STM_PACKET_LIMITS } from './packet-limits';
import {
  createBeggarParameterSchema,
  createFirmwareDefinition,
  SUPPORTED,
  unsupported,
} from './shared';

/** Shared implementation id: STM and Boost reuse the same protocol driver. */
export const BEGGAR_RUNTIME_BINDING_ID = createRuntimeBindingId('beggar');

export const BEGGAR_STM_DEVICE: DeviceDefinition = {
  id: 'beggar-stm',
  displayName: '丐中丐',
  hardware: {
    cartVoltages: ['5V'],
    cartPowerControl: 'none',
    modeSwitch: 'hardware-switch',
    cartPresenceDetect: false,
    audioWePin: false,
  },
};

/**
 * Normative matrix row set shared by `beggar.stm` and `beggar.stm-boost`
 * (their capability values are identical; only the transport profile differs).
 */
export const BEGGAR_STM_CAPABILITIES: CompleteCapabilityDeclarations = {
  'rom.read': SUPPORTED,
  'rom.write': SUPPORTED,
  'rom.erase.chip': SUPPORTED,
  'rom.erase.sector': SUPPORTED,
  'rom.verify.crc': SUPPORTED,
  'rom.bankSwitch.32M': unsupported('bank switch exists in the adapter but is not wired to a capability yet; pending hardware confirmation'),
  'ram.read': SUPPORTED,
  'ram.write': SUPPORTED,
  'ram.fram.gba': SUPPORTED,
  'ram.fram.gbc': SUPPORTED,
  'cart.powerControl': unsupported('丐中丐 has no cartridge power control'),
  'cart.voltageSwitch': unsupported('丐中丐 drives a single cart voltage'),
  'cart.presenceDetect': unsupported('丐中丐 has no cartridge presence detect'),
  'cart.audioWePin': unsupported('丐中丐 has no Audio WE pin control'),
  'tool.rtc.gba': SUPPORTED,
  'tool.rtc.mbc3': SUPPORTED,
  'tool.rumble.gba': SUPPORTED,
  'tool.debug': SUPPORTED,
  'tool.ppbUnlock': SUPPORTED,
  'profile.flashcartDb': unsupported('flashcart database profiles are FlashGBX only'),
};

export const BEGGAR_STM_FIRMWARE: FirmwareDefinition = createFirmwareDefinition({
  id: 'beggar.stm',
  displayName: '丐中丐',
  protocol: 'beggar',
  baseCapabilities: BEGGAR_STM_CAPABILITIES,
  parameters: createBeggarParameterSchema,
});

export const BEGGAR_STM_BOOST_FIRMWARE: FirmwareDefinition = createFirmwareDefinition({
  id: 'beggar.stm-boost',
  displayName: '丐中丐（Boost）',
  protocol: 'beggar',
  baseCapabilities: BEGGAR_STM_CAPABILITIES,
  parameters: createBeggarParameterSchema,
});

export const BEGGAR_STM_TRANSPORT: TransportRequirements = {
  signalInit: 'dtr-rts-pulse',
  packetLimits: BEGGAR_STM_PACKET_LIMITS,
  maxReadChunk: 0x1000,
};

export const BEGGAR_STM_BOOST_TRANSPORT: TransportRequirements = {
  ...BEGGAR_STM_TRANSPORT,
  maxReadChunk: 0x2000,
};

export const BEGGAR_STM_BINDING: DeviceFirmwareBinding = {
  id: 'beggar-stm',
  deviceId: BEGGAR_STM_DEVICE.id,
  firmwareId: BEGGAR_STM_FIRMWARE.id,
  discoveryFilters: [{ vendorId: '0483', productId: '0721' }],
  identityMatchers: [
    { id: 'beggar-stm-cdc', vendorId: '0483', productId: '0721', description: 'STM32 CDC' },
  ],
  transport: BEGGAR_STM_TRANSPORT,
  parameterNamespace: 'beggar.stm',
  runtimeBindingId: BEGGAR_RUNTIME_BINDING_ID,
  simulated: { supported: true },
};

export const BEGGAR_STM_BOOST_BINDING: DeviceFirmwareBinding = {
  id: 'beggar-stm-boost',
  deviceId: BEGGAR_STM_DEVICE.id,
  firmwareId: BEGGAR_STM_BOOST_FIRMWARE.id,
  discoveryFilters: [{ vendorId: '0483', productId: '0721' }],
  identityMatchers: [
    { id: 'beggar-stm-boost-cdc', vendorId: '0483', productId: '0721', description: 'STM32 CDC (Boost firmware)' },
  ],
  // Same parameter namespace as plain STM: Boost shares the packet settings.
  transport: BEGGAR_STM_BOOST_TRANSPORT,
  parameterNamespace: 'beggar.stm',
  runtimeBindingId: BEGGAR_RUNTIME_BINDING_ID,
  // The simulator implements the standard command frames only; the Boost extension
  // (0xa0-0xd5) has no simulated backend, so the transaction must not publish a session.
  simulated: {
    supported: false,
    reason: 'The debug simulator only executes the standard 丐中丐/碳酸丐 command frames; the Boost extension protocol is not simulated.',
  },
};
