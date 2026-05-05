import type { RamType } from '@/types/command-options';
import type { DeviceInfo } from '@/types/device-info';
import type { SerialPortInfo } from '@/types/serial';

export type FirmwareProfileId = 'stm' | 'stc' | 'unknown';
export type ConfigurableFirmwareProfileId = Exclude<FirmwareProfileId, 'unknown'>;

export interface FirmwareCapabilities {
  readonly gbaSectorErase: boolean;
  readonly gbaFramRam: boolean;
  readonly gbcFramRam: boolean;
  readonly cartPowerControl: boolean;
}

export interface FirmwareProfile {
  readonly id: FirmwareProfileId;
  readonly label: string;
  readonly capabilities: FirmwareCapabilities;
}

export const STM_FIRMWARE_PROFILE: FirmwareProfile = {
  id: 'stm',
  label: '丐中丐',
  capabilities: {
    gbaSectorErase: true,
    gbaFramRam: true,
    gbcFramRam: true,
    cartPowerControl: false,
  },
};

export const STC_FIRMWARE_PROFILE: FirmwareProfile = {
  id: 'stc',
  label: '碳酸丐',
  capabilities: {
    gbaSectorErase: false,
    gbaFramRam: false,
    gbcFramRam: true,
    cartPowerControl: true,
  },
};

export const UNKNOWN_FIRMWARE_PROFILE: FirmwareProfile = {
  id: 'unknown',
  label: 'Unknown',
  capabilities: {
    gbaSectorErase: true,
    gbaFramRam: true,
    gbcFramRam: true,
    cartPowerControl: true,
  },
};

export function getFirmwareProfileById(id: FirmwareProfileId): FirmwareProfile {
  switch (id) {
    case 'stm':
      return STM_FIRMWARE_PROFILE;
    case 'stc':
      return STC_FIRMWARE_PROFILE;
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

export function inferFirmwareProfileFromPort(portInfo?: SerialPortInfo | null): FirmwareProfile {
  const manufacturer = lower(portInfo?.manufacturer);
  const product = lower(portInfo?.product);
  const path = lower(portInfo?.path);
  const serialNumber = lower(portInfo?.serialNumber);

  if (containsAny(`${manufacturer} ${product} ${path}`, ['stc', 'stc8'])) {
    return STC_FIRMWARE_PROFILE;
  }

  if (serialNumber || /usbmodem[0-9a-f]{8,}$/i.test(portInfo?.path ?? '')) {
    return STM_FIRMWARE_PROFILE;
  }

  const vendorId = lower(portInfo?.vendorId);
  const productId = lower(portInfo?.productId);
  if (vendorId === '0483' && productId === '0721') {
    if (/usbmodem\d+$/i.test(portInfo?.path ?? '')) {
      return STC_FIRMWARE_PROFILE;
    }
    if (containsAny(`${manufacturer} ${product}`, ['stmicroelectronics', 'stm32', 'beggar socket'])) {
      return STM_FIRMWARE_PROFILE;
    }
    return UNKNOWN_FIRMWARE_PROFILE;
  }

  return UNKNOWN_FIRMWARE_PROFILE;
}

export function attachFirmwareProfile(device: DeviceInfo, profile?: FirmwareProfile): DeviceInfo {
  const resolvedProfile = profile ?? inferFirmwareProfileFromPort(device.portInfo);
  device.firmwareProfile = resolvedProfile;
  if (device.serialHandle) {
    device.serialHandle.firmwareProfile = resolvedProfile;
  }
  return device;
}

export function getFirmwareProfile(device: DeviceInfo): FirmwareProfile {
  return device.firmwareProfile
    ?? device.serialHandle?.firmwareProfile
    ?? inferFirmwareProfileFromPort(device.portInfo ?? device.serialHandle?.portInfo);
}

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

export function firmwareUnsupportedResult(operation: string, profile: FirmwareProfile): { success: false; message: string } {
  return {
    success: false,
    message: `${operation} is not supported by ${profile.label} firmware`,
  };
}
