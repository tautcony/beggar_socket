import { DebugSettings } from '@/settings/debug-settings';
import type { PortFilter } from '@/utils/port-filter';
import { isTauri } from '@/utils/tauri';

import { SimulatedDeviceGateway } from './simulated/device-gateway';
import { TauriDeviceGateway } from './tauri/device-gateway';
import type { DeviceGateway, DeviceHandle, DeviceSelection } from './types';
import { WebDeviceGateway } from './web/device-gateway';

let cachedGateway: DeviceGateway | null = null;
let simulatedGateway: DeviceGateway | null = null;
let tauriGateway: DeviceGateway | null = null;
let webGateway: DeviceGateway | null = null;

type GatewayKind = 'simulated' | 'tauri' | 'web';

function getPreferredGatewayKind(): GatewayKind {
  if (DebugSettings.debugMode) {
    return 'simulated';
  }

  return isTauri() ? 'tauri' : 'web';
}

function getGatewayForKind(kind: GatewayKind): DeviceGateway {
  switch (kind) {
    case 'simulated':
      simulatedGateway ??= new SimulatedDeviceGateway();
      return simulatedGateway;
    case 'tauri':
      tauriGateway ??= new TauriDeviceGateway();
      return tauriGateway;
    case 'web':
    default:
      webGateway ??= new WebDeviceGateway();
      return webGateway;
  }
}

class RoutedDeviceGateway implements DeviceGateway {
  private resolveGateway(kind = getPreferredGatewayKind()): DeviceGateway {
    return getGatewayForKind(kind);
  }

  async list(filter?: PortFilter) {
    return this.resolveGateway().list(filter);
  }

  async select(filter?: PortFilter) {
    return this.resolveGateway().select(filter);
  }

  async connect(selection?: DeviceSelection | null) {
    return this.resolveGateway().connect(selection);
  }

  async init(device: DeviceHandle) {
    return this.resolveGateway(device.platform).init(device);
  }

  async disconnect(device: DeviceHandle) {
    return this.resolveGateway(device.platform).disconnect(device);
  }
}

export function getDeviceGateway(): DeviceGateway {
  if (cachedGateway) {
    return cachedGateway;
  }

  cachedGateway = new RoutedDeviceGateway();

  return cachedGateway;
}

export function resetDeviceGatewayForTests(): void {
  cachedGateway = null;
  simulatedGateway = null;
  tauriGateway = null;
  webGateway = null;
}
