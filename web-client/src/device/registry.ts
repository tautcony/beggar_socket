/**
 * Device registry: registration, selection and port matching only.
 *
 * Session resolution lives in `src/device-runtime/session-resolver.ts` because it
 * needs runtime bindings and typed probe facts.
 */
import type { HostPlatform } from '@/types/host-platform';
import type { SerialPortInfo } from '@/types/serial';

import type { TransportRequirements } from './hardware';
import type { ParameterSchema } from './parameters';
import type {
  DeviceDefinition,
  DeviceFirmwareBinding,
  DeviceId,
  DeviceRegistry,
  FirmwareDefinition,
  FirmwareId,
  ResolvedVariantSelection,
  SelectableVariant,
  UsbIdentity,
  VariantId,
} from './types';
import { matchUsbIdentity } from './usb-identity';

export interface DeviceRegistryOptions {
  readonly platform: HostPlatform;
}

function parseUsbId(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 16);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function samePacketLimits(a: TransportRequirements, b: TransportRequirements): boolean {
  const hosts: HostPlatform[] = ['windows', 'macos', 'linux', 'unknown'];
  return hosts.every((host) => {
    const left = a.packetLimits[host];
    const right = b.packetLimits[host];
    return left.romWrite === right.romWrite
      && left.romRead === right.romRead
      && left.ramPage === right.ramPage;
  });
}

function registryError(message: string): Error {
  return new Error(`DeviceRegistry: ${message}`);
}

export function createDeviceRegistry(options: DeviceRegistryOptions): DeviceRegistry {
  const devices = new Map<DeviceId, DeviceDefinition>();
  const firmwares = new Map<FirmwareId, FirmwareDefinition>();
  const bindings = new Map<VariantId, DeviceFirmwareBinding>();
  const schemaCache = new Map<string, { schema: ParameterSchema; transport: TransportRequirements }>();

  function resolveId(variantId: VariantId): ResolvedVariantSelection | undefined {
    const binding = bindings.get(variantId);
    if (!binding) {
      return undefined;
    }
    const device = devices.get(binding.deviceId);
    const firmware = firmwares.get(binding.firmwareId);
    if (!device || !firmware) {
      return undefined;
    }
    return {
      variantId: binding.id,
      binding,
      device,
      firmware,
      runtimeBindingId: binding.runtimeBindingId,
      parameterNamespace: binding.parameterNamespace,
      transport: binding.transport,
    };
  }

  function assertNamespaceConsistency(candidate: readonly DeviceFirmwareBinding[]): void {
    const grouped = new Map<string, DeviceFirmwareBinding[]>();
    for (const binding of candidate) {
      const group = grouped.get(binding.parameterNamespace) ?? [];
      group.push(binding);
      grouped.set(binding.parameterNamespace, group);
    }
    for (const [namespace, group] of grouped) {
      const [first] = group;
      for (const binding of group.slice(1)) {
        if (!samePacketLimits(first.transport, binding.transport)) {
          throw registryError(
            `bindings ${first.id} and ${binding.id} share namespace ${namespace} but declare different packetLimits`,
          );
        }
        if (first.transport.signalInit !== binding.transport.signalInit) {
          throw registryError(
            `bindings ${first.id} and ${binding.id} share namespace ${namespace} but declare different signalInit`,
          );
        }
      }
    }
  }

  return {
    register(
      device: DeviceDefinition,
      newFirmwares: readonly FirmwareDefinition[],
      newBindings: readonly DeviceFirmwareBinding[],
    ): void {
      if (devices.has(device.id)) {
        throw registryError(`duplicate device id ${device.id}`);
      }
      for (const firmware of newFirmwares) {
        if (firmwares.has(firmware.id) || newFirmwares.filter(item => item.id === firmware.id).length > 1) {
          throw registryError(`duplicate firmware id ${firmware.id}`);
        }
      }
      for (const binding of newBindings) {
        if (bindings.has(binding.id) || newBindings.filter(item => item.id === binding.id).length > 1) {
          throw registryError(`duplicate variant id ${binding.id}`);
        }
        if (!binding.runtimeBindingId) {
          throw registryError(`variant ${binding.id} has no runtimeBindingId`);
        }
        if (!binding.parameterNamespace) {
          throw registryError(`variant ${binding.id} has no parameterNamespace`);
        }
        if (binding.identityMatchers.length === 0 && binding.discoveryFilters.length === 0) {
          throw registryError(`variant ${binding.id} has no identity matcher or discovery filter`);
        }
      }

      // Validate the references against the next state before mutating anything.
      const nextDevices = new Map(devices).set(device.id, device);
      const nextFirmwares = new Map(firmwares);
      for (const firmware of newFirmwares) nextFirmwares.set(firmware.id, firmware);
      const nextBindings = new Map(bindings);
      for (const binding of newBindings) {
        if (binding.deviceId !== device.id && !nextDevices.has(binding.deviceId)) {
          throw registryError(`variant ${binding.id} references unknown device ${binding.deviceId}`);
        }
        if (!nextFirmwares.has(binding.firmwareId)) {
          throw registryError(`variant ${binding.id} references unknown firmware ${binding.firmwareId}`);
        }
        nextBindings.set(binding.id, binding);
      }
      assertNamespaceConsistency([...nextBindings.values()]);

      devices.set(device.id, device);
      for (const firmware of newFirmwares) firmwares.set(firmware.id, firmware);
      for (const binding of newBindings) bindings.set(binding.id, binding);
      schemaCache.clear();
    },

    listSelectable(): readonly SelectableVariant[] {
      return [...bindings.values()].map((binding) => {
        const device = devices.get(binding.deviceId);
        const firmware = firmwares.get(binding.firmwareId);
        return {
          variantId: binding.id,
          deviceName: device?.displayName ?? binding.deviceId,
          firmwareName: firmware?.displayName ?? binding.firmwareId,
        };
      });
    },

    selectVariant(variantId: VariantId): ResolvedVariantSelection {
      const selection = resolveId(variantId);
      if (!selection) {
        throw registryError(`variant ${variantId} is not registered`);
      }
      return selection;
    },

    findVariant(variantId: string): ResolvedVariantSelection | undefined {
      return resolveId(variantId);
    },

    listBindings(): readonly DeviceFirmwareBinding[] {
      return [...bindings.values()];
    },

    getDevice(deviceId: DeviceId): DeviceDefinition | undefined {
      return devices.get(deviceId);
    },

    getFirmware(firmwareId: FirmwareId): FirmwareDefinition | undefined {
      return firmwares.get(firmwareId);
    },

    forUsbFilters(binding: DeviceFirmwareBinding): SerialPortFilter[] {
      return binding.discoveryFilters
        .filter(filter => filter.vendorId !== undefined)
        .map((filter) => {
          const webFilter: SerialPortFilter = { usbVendorId: parseUsbId(filter.vendorId) };
          if (filter.productId !== undefined) {
            webFilter.usbProductId = parseUsbId(filter.productId);
          }
          return webFilter;
        });
    },

    matchPort(binding: DeviceFirmwareBinding, port?: SerialPortInfo | null): UsbIdentity {
      return matchUsbIdentity(binding, port);
    },

    resolveNamespaceSchema(
      namespace: string,
    ): { readonly schema: ParameterSchema; readonly transport: TransportRequirements } | undefined {
      const cached = schemaCache.get(namespace);
      if (cached) {
        return cached;
      }
      const group = [...bindings.values()].filter(binding => binding.parameterNamespace === namespace);
      const [first] = group;
      if (!first) {
        return undefined;
      }
      const firmware = firmwares.get(first.firmwareId);
      if (!firmware) {
        return undefined;
      }
      const transport: TransportRequirements = {
        ...first.transport,
        maxReadChunk: Math.max(...group.map(binding => binding.transport.maxReadChunk)),
      };
      const schema = firmware.parameters({ platform: options.platform, transport });
      const resolved = { schema, transport };
      schemaCache.set(namespace, resolved);
      return resolved;
    },
  };
}
