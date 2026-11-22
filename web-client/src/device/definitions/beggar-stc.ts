/**
 * 碳酸丐 (Beggar STC8) hardware.
 *
 * Shares the Beggar protocol and runtime binding with 丐中丐; the capability matrix
 * differs for GBA FRAM and cartridge power control.
 */
import type { CompleteCapabilityDeclarations } from '../capabilities';
import type { TransportRequirements } from '../hardware';
import type { DeviceDefinition, DeviceFirmwareBinding, FirmwareDefinition } from '../types';
import { BEGGAR_RUNTIME_BINDING_ID, BEGGAR_STM_CAPABILITIES } from './beggar-stm';
import { BEGGAR_STC_PACKET_LIMITS } from './packet-limits';
import { createBeggarParameterSchema, createFirmwareDefinition, SUPPORTED, unsupported } from './shared';

export const BEGGAR_STC_DEVICE: DeviceDefinition = {
  id: 'beggar-stc',
  displayName: '碳酸丐',
  hardware: {
    cartVoltages: ['5V'],
    cartPowerControl: 'software',
    modeSwitch: 'hardware-switch',
    cartPresenceDetect: false,
    audioWePin: false,
  },
};

export const BEGGAR_STC_CAPABILITIES: CompleteCapabilityDeclarations = {
  ...BEGGAR_STM_CAPABILITIES,
  'ram.fram.gba': unsupported('STC8 firmware cannot reach GBA FRAM'),
  'cart.powerControl': SUPPORTED,
  'cart.voltageSwitch': unsupported('碳酸丐 drives a single cart voltage'),
  'cart.presenceDetect': unsupported('碳酸丐 has no cartridge presence detect'),
  'cart.audioWePin': unsupported('碳酸丐 has no Audio WE pin control'),
};

export const BEGGAR_STC_FIRMWARE: FirmwareDefinition = createFirmwareDefinition({
  id: 'beggar.stc',
  displayName: '碳酸丐',
  protocol: 'beggar',
  baseCapabilities: BEGGAR_STC_CAPABILITIES,
  parameters: createBeggarParameterSchema,
});

/** STC8 streams short read replies, so its ceiling sits above the host read default. */
export const BEGGAR_STC_TRANSPORT: TransportRequirements = {
  signalInit: 'dtr-rts-pulse',
  packetLimits: BEGGAR_STC_PACKET_LIMITS,
  maxReadChunk: 0x8000,
};

export const BEGGAR_STC_BINDING: DeviceFirmwareBinding = {
  id: 'beggar-stc',
  deviceId: BEGGAR_STC_DEVICE.id,
  firmwareId: BEGGAR_STC_FIRMWARE.id,
  discoveryFilters: [
    { vendorId: '0483', productId: '0721' },
    { vendorId: '0483', productId: '5740' },
  ],
  identityMatchers: [
    { id: 'beggar-stc-cdc', vendorId: '0483', productId: '0721', description: 'STC8 CDC' },
    { id: 'beggar-stc-rc31', vendorId: '0483', productId: '5740', description: 'RC31 legacy CDC' },
  ],
  transport: BEGGAR_STC_TRANSPORT,
  parameterNamespace: 'beggar.stc',
  runtimeBindingId: BEGGAR_RUNTIME_BINDING_ID,
};
