import type { DeviceGateway, DeviceHandle, DeviceSelection } from '@/platform/serial';

import { mapDomainError } from '../application/domain/error-mapping';
import type { BurnerConnectionHandle, BurnerConnectionPort, BurnerConnectionSelection } from '../application/domain/ports';
import { failureResult, successResult, type BurnerDomainResult } from '../application/domain/result';

function toConnectionHandle(handle: DeviceHandle): BurnerConnectionHandle {
  return {
    id: `${handle.platform}:${handle.portInfo?.path ?? 'auto'}`,
    platform: handle.platform,
    portInfo: handle.portInfo,
    context: handle,
  };
}

function toSelection(selection: DeviceSelection | null): BurnerConnectionSelection | null {
  if (!selection) {
    return null;
  }

  return {
    portInfo: selection.portInfo,
    context: selection,
  };
}

function unwrapHandle(handle: BurnerConnectionHandle): DeviceHandle {
  return handle.context as DeviceHandle;
}

function unwrapSelection(selection?: BurnerConnectionSelection | null): DeviceSelection | null | undefined {
  if (!selection) {
    return selection;
  }
  return selection.context as DeviceSelection;
}

async function withConnectionMapping<T>(operation: () => Promise<T>): Promise<BurnerDomainResult<T>> {
  try {
    return successResult(await operation());
  } catch (error) {
    return failureResult(mapDomainError('connection', error, 'Device connection operation failed'));
  }
}

export class DeviceGatewayConnectionPortAdapter implements BurnerConnectionPort {
  constructor(private readonly gateway: DeviceGateway) {}

  async list(): Promise<BurnerDomainResult<BurnerConnectionHandle['portInfo'][]>> {
    const result = await withConnectionMapping(() => this.gateway.list());
    return result.ok ? successResult(result.data) : result;
  }

  async select(): Promise<BurnerDomainResult<BurnerConnectionSelection | null>> {
    const result = await withConnectionMapping(() => this.gateway.select());
    return result.ok ? successResult(toSelection(result.data)) : result;
  }

  async connect(selection?: BurnerConnectionSelection | null): Promise<BurnerDomainResult<BurnerConnectionHandle>> {
    const result = await withConnectionMapping(() => this.gateway.connect(unwrapSelection(selection)));
    return result.ok ? successResult(toConnectionHandle(result.data)) : result;
  }

  async init(handle: BurnerConnectionHandle): Promise<BurnerDomainResult<void>> {
    return withConnectionMapping(() => this.gateway.init(unwrapHandle(handle)));
  }

  async disconnect(handle: BurnerConnectionHandle): Promise<BurnerDomainResult<void>> {
    return withConnectionMapping(() => this.gateway.disconnect(unwrapHandle(handle)));
  }
}
