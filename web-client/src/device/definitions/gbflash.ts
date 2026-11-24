/**
 * GBFlash hardware running the FlashGBX protocol firmware.
 *
 * Per-PCB reality (power control, presence detect, Audio WE pin) is reported by the
 * `0xA1` handshake, so those three capabilities are conditional rules rather than a
 * static yes/no.
 */
import type { CompleteCapabilityDeclarations } from '../capabilities';
import type { TransportRequirements } from '../hardware';
import {
  createRuntimeBindingId,
  type DeviceDefinition,
  type DeviceFirmwareBinding,
  type FirmwareDefinition,
} from '../types';
import { FLASHGBX_PACKET_LIMITS } from './packet-limits';
import { conditional, createFirmwareDefinition, createFlashgbxParameterSchema, SUPPORTED, unsupported } from './shared';

export const GBFLASH_RUNTIME_BINDING_ID = createRuntimeBindingId('flashgbx');

/** `auto` has always expanded to a fixed 2 Mbps; there is no host or port dimension. */
export const GBFLASH_AUTO_BAUD_RATE = 2_000_000;

export const GBFLASH_DEVICE: DeviceDefinition = {
  id: 'gbflash',
  displayName: 'GBFlash',
  hardware: {
    cartVoltages: ['3.3V', '5V'],
    cartPowerControl: 'software',
    modeSwitch: 'software',
    // Family level support only; the handshake narrows it per PCB.
    cartPresenceDetect: true,
    audioWePin: true,
  },
};

export const FLASHGBX_CAPABILITIES: CompleteCapabilityDeclarations = {
  'rom.read': SUPPORTED,
  'rom.write': SUPPORTED,
  'rom.erase.chip': SUPPORTED,
  'rom.erase.sector': SUPPORTED,
  'rom.verify.crc': SUPPORTED,
  'rom.bankSwitch.32M': unsupported('bank switch is not wired to a capability yet; pending hardware confirmation'),
  'ram.read': SUPPORTED,
  'ram.write': SUPPORTED,
  'ram.fram.gba': SUPPORTED,
  'ram.fram.gbc': SUPPORTED,
  'cart.powerControl': conditional('gbflash.power-control-present', 'PCB has no cartridge power control'),
  'cart.voltageSwitch': SUPPORTED,
  'cart.presenceDetect': conditional('gbflash.presence-detect-present', 'PCB has no cartridge presence detect'),
  'cart.audioWePin': conditional('gbflash.audio-write-enabled', 'Audio WE pin output is disabled on this PCB'),
  // RTC keeps its current UI and service entrypoints; the implementation is still partial.
  'tool.rtc.gba': SUPPORTED,
  'tool.rtc.mbc3': SUPPORTED,
  'tool.rumble.gba': SUPPORTED,
  'tool.debug': unsupported('FlashGBX firmware has no debug command'),
  'tool.ppbUnlock': unsupported('FlashGBX firmware has no PPB unlock command'),
  'profile.flashcartDb': SUPPORTED,
};

export const FLASHGBX_FIRMWARE: FirmwareDefinition = createFirmwareDefinition({
  id: 'flashgbx.cfw',
  displayName: 'FlashGBX',
  protocol: 'flashgbx',
  baseCapabilities: FLASHGBX_CAPABILITIES,
  parameters: createFlashgbxParameterSchema,
});

/**
 * `auto` baud resolves to a fixed 2 Mbps; CH340 and CDC share the 256B packet cap.
 *
 * `maxReadChunk`/`readPageDefault` describe one read *request*, not one frame: GBFlash
 * answers a `CART_READ` with as many bytes as `TRANSFER_SIZE` asks for, up to its 4 KiB
 * buffer, while the 256B packet cap above only bounds a single USB frame.
 */
export const GBFLASH_TRANSPORT: TransportRequirements = {
  defaultBaudRate: 'auto',
  allowedBaudRates: [1_000_000, 1_500_000, 2_000_000],
  signalInit: 'none',
  packetLimits: FLASHGBX_PACKET_LIMITS,
  maxReadChunk: 0x1000,
  readPageDefault: 0x1000,
};

export const GBFLASH_BINDING: DeviceFirmwareBinding = {
  id: 'gbflash',
  deviceId: GBFLASH_DEVICE.id,
  firmwareId: FLASHGBX_FIRMWARE.id,
  discoveryFilters: [
    { vendorId: '1a86', productId: '7523' },
    { vendorId: '16c0', productId: '27dd' },
  ],
  identityMatchers: [
    { id: 'gbflash-ch340', vendorId: '1a86', productId: '7523', description: 'CH340' },
    { id: 'gbflash-cdc', vendorId: '16c0', productId: '27dd', description: 'CDC' },
  ],
  transport: GBFLASH_TRANSPORT,
  parameterNamespace: 'flashgbx.cfw',
  runtimeBindingId: GBFLASH_RUNTIME_BINDING_ID,
  // FlashGBX framing (0x00/0xA1 handshake, CART_* commands) has no simulated backend;
  // a simulated GBFlash session would commit and then fail on its first command.
  simulated: {
    supported: false,
    reason: 'The debug simulator only executes the Beggar command frames; the FlashGBX framing protocol is not simulated.',
  },
};
