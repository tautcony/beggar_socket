import { isElectron } from '@/utils/electron';

import { ElectronDeviceGateway } from './electron/device-gateway';
import type { DeviceGateway } from './types';
import { WebDeviceGateway } from './web/device-gateway';

let cachedGateway: DeviceGateway | null = null;

export function getDeviceGateway(): DeviceGateway {
  if (cachedGateway) {
    return cachedGateway;
  }

  cachedGateway = isElectron()
    ? new ElectronDeviceGateway()
    : new WebDeviceGateway();

  return cachedGateway;
}
