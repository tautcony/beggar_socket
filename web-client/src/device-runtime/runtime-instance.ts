/**
 * Process-wide device runtime.
 *
 * The catalog, parameter store, selection provider and session establishment transaction
 * are stateless with respect to a connection, so the app shares one instance. Tests can
 * reset it (or inject a runtime into `createDeviceRuntime`) between cases.
 */
import { createDeviceRuntime, type DeviceRuntime } from './index';

export type { DeviceRuntime };

let instance: DeviceRuntime | undefined;

export function getDeviceRuntime(): DeviceRuntime {
  instance ??= createDeviceRuntime();
  return instance;
}

export function resetDeviceRuntime(): void {
  instance = undefined;
}
