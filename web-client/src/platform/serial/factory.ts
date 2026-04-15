import { isTauri } from '@/utils/tauri';

import { TauriDeviceGateway } from './tauri/device-gateway';
import type { DeviceGateway } from './types';
import { WebDeviceGateway } from './web/device-gateway';

let cachedGateway: DeviceGateway | null = null;

export function getDeviceGateway(): DeviceGateway {
  if (cachedGateway) {
    return cachedGateway;
  }

  cachedGateway = isTauri()
    ? new TauriDeviceGateway()
    : new WebDeviceGateway();

  return cachedGateway;
}
