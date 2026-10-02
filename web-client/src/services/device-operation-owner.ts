import { toRaw } from 'vue';

import { DeviceOperationOwner } from '@/features/burner/application/device-operation-owner';
import type { Transport } from '@/platform/serial';
import type { DeviceInfo } from '@/types/device-info';

const owners = new WeakMap<Transport, DeviceOperationOwner>();

export function getTransportOperationOwner(transport: Transport): DeviceOperationOwner {
  const identity = toRaw(transport);
  let owner = owners.get(identity);
  if (!owner) {
    owner = new DeviceOperationOwner();
    owners.set(identity, owner);
  }
  return owner;
}

export function getDeviceOperationOwner(device: DeviceInfo | null): DeviceOperationOwner | undefined {
  const transport = device?.transport ?? device?.serialHandle?.transport;
  return transport ? getTransportOperationOwner(transport) : undefined;
}

export function runDeviceOperation<T>(device: DeviceInfo, operation: () => Promise<T>): Promise<T> {
  const owner = getDeviceOperationOwner(device);
  if (!owner) return Promise.reject(new Error('Device transport is not initialized'));
  return owner.run(operation);
}
