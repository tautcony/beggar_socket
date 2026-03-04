import { getDeviceGateway } from '@/platform/serial';

import { ConnectionOrchestrationUseCase } from '../application/connection-use-case';
import { DeviceGatewayConnectionPortAdapter } from './device-gateway-connection-port';

export function createConnectionOrchestrationUseCase(): ConnectionOrchestrationUseCase {
  return new ConnectionOrchestrationUseCase(new DeviceGatewayConnectionPortAdapter(getDeviceGateway()));
}
