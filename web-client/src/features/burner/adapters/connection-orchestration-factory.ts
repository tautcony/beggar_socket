import { type DeviceRuntime, getDeviceRuntime } from '@/device-runtime/runtime-instance';
import { getDeviceGateway } from '@/platform/serial';

import { ConnectionOrchestrationUseCase } from '../application/connection-use-case';
import { DeviceGatewayConnectionPortAdapter } from './device-gateway-connection-port';

export function createConnectionOrchestrationUseCase(runtime: DeviceRuntime = getDeviceRuntime()): ConnectionOrchestrationUseCase {
  return new ConnectionOrchestrationUseCase(
    new DeviceGatewayConnectionPortAdapter(getDeviceGateway(), runtime.establishment),
  );
}
