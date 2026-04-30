export { fromLegacyDeviceInfo, resolveTransport, toLegacyDeviceInfo, withPortInfo } from './compat';
export { getDeviceGateway, resetDeviceGatewayForTests } from './factory';
export { Mutex } from './mutex';
export type {
  DeviceGateway,
  DeviceHandle,
  DeviceSelection,
  Transport,
  TransportReadMode,
} from './types';
