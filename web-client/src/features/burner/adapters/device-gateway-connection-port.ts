import type { DeviceGateway, DeviceHandle, DeviceSelection } from '@/platform/serial';

import { mapConnectionStageError } from '../application/domain/error-mapping';
import type { BurnerConnectionHandle, BurnerConnectionPort, BurnerConnectionSelection } from '../application/domain/ports';
import { type BurnerDomainResult, failureResult, successResult } from '../application/domain/result';

function toConnectionHandle(handle: DeviceHandle, sequence: number): BurnerConnectionHandle {
  return {
    id: `${handle.platform}:${handle.portInfo?.path ?? 'auto'}:${sequence}`,
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

async function withConnectionMapping<T>(
  lifecycleStage: 'list' | 'select' | 'connect' | 'init' | 'disconnect',
  operation: () => Promise<T>,
): Promise<BurnerDomainResult<T>> {
  try {
    return successResult(await operation());
  } catch (error) {
    return failureResult(mapConnectionStageError(lifecycleStage, error));
  }
}

export class DeviceGatewayConnectionPortAdapter implements BurnerConnectionPort {
  private sequence = 0;

  constructor(private readonly gateway: DeviceGateway) {}

  async list(): Promise<BurnerDomainResult<BurnerConnectionHandle['portInfo'][]>> {
    const result = await withConnectionMapping('list', () => this.gateway.list());
    return result.ok ? successResult(result.data) : result;
  }

  async select(): Promise<BurnerDomainResult<BurnerConnectionSelection | null>> {
    const result = await withConnectionMapping('select', () => this.gateway.select());
    return result.ok ? successResult(toSelection(result.data)) : result;
  }

  async connect(selection?: BurnerConnectionSelection | null): Promise<BurnerDomainResult<BurnerConnectionHandle>> {
    const result = await withConnectionMapping('connect', () => this.gateway.connect(unwrapSelection(selection)));
    if (!result.ok) {
      return result;
    }

    this.sequence += 1;
    return successResult(toConnectionHandle(result.data, this.sequence));
  }

  async init(handle: BurnerConnectionHandle): Promise<BurnerDomainResult<void>> {
    return withConnectionMapping('init', () => this.gateway.init(unwrapHandle(handle)));
  }

  async disconnect(handle: BurnerConnectionHandle): Promise<BurnerDomainResult<void>> {
    return withConnectionMapping('disconnect', () => this.gateway.disconnect(unwrapHandle(handle)));
  }
}
