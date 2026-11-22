import type { DeviceDiagnostic } from '@/device/session';
import type { EstablishedSession, SessionEstablishment } from '@/device-runtime';
import { isSessionStageError } from '@/device-runtime';
import type { DeviceGateway, DeviceHandle, DeviceSelection } from '@/platform/serial';
import type { SerialPortInfo } from '@/types/serial';

import { mapConnectionStageError } from '../application/domain/error-mapping';
import type {
  BurnerConnectionHandle,
  BurnerConnectionPort,
  BurnerConnectionSelection,
  BurnerConnectionSelectOptions,
  BurnerConnectionSession,
} from '../application/domain/ports';
import type { BurnerDomainError } from '../application/domain/result';
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

function toSerialPortInfo(portInfo?: BurnerConnectionHandle['portInfo']): SerialPortInfo | undefined {
  if (!portInfo?.path) {
    return undefined;
  }
  return {
    path: portInfo.path,
    manufacturer: portInfo.manufacturer,
    product: portInfo.product,
    vendorId: portInfo.vendorId,
    productId: portInfo.productId,
  };
}

const SESSION_FAILURE_CODES = {
  selection: 'selection_invalid',
  probe: 'probe_failed',
  resolve: 'resolve_failed',
  initialize: 'initialize_failed',
  disconnect: 'disconnect_failed',
} as const;

/** Probe / resolve / initialize failures keep their own stage and diagnostics. */
function mapSessionStageError(error: unknown): BurnerDomainError {
  if (isSessionStageError(error)) {
    return {
      stage: error.stage === 'selection' ? 'select' : error.stage,
      code: SESSION_FAILURE_CODES[error.stage],
      message: error.message,
      cause: error.cause ?? error,
      recoverable: true,
      ...(error.diagnostics.length > 0 ? { diagnostics: error.diagnostics } : {}),
    };
  }

  return {
    stage: 'probe',
    code: 'probe_failed',
    message: error instanceof Error ? error.message : 'Device probe failed',
    cause: error,
    recoverable: true,
  };
}

export class DeviceGatewayConnectionPortAdapter implements BurnerConnectionPort {
  private sequence = 0;
  private readonly sessions = new Map<string, EstablishedSession>();

  /** Present only when the port is wired with a session establishment transaction. */
  readonly establishSession?: (handle: BurnerConnectionHandle) => Promise<BurnerDomainResult<BurnerConnectionSession>>;

  constructor(
    private readonly gateway: DeviceGateway,
    private readonly establishment?: SessionEstablishment,
  ) {
    if (establishment) {
      this.establishSession = handle => this.openSession(handle, establishment);
    }
  }

  async list(): Promise<BurnerDomainResult<BurnerConnectionHandle['portInfo'][]>> {
    const result = await withConnectionMapping('list', () => this.gateway.list());
    return result.ok ? successResult(result.data) : result;
  }

  async select(options?: BurnerConnectionSelectOptions): Promise<BurnerDomainResult<BurnerConnectionSelection | null>> {
    const result = await withConnectionMapping('select', async () => {
      const selected = await this.gateway.select(options?.filter);
      if (!selected) {
        return null;
      }
      return {
        ...selected,
        ...(options?.baudRate !== undefined ? { baudRate: options.baudRate } : {}),
        ...(options?.skipSignalInit !== undefined ? { skipSignalInit: options.skipSignalInit } : {}),
      };
    });
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
    const session = this.sessions.get(handle.id);
    this.sessions.delete(handle.id);

    // Teardown runs before the close and never blocks it; its failures become diagnostics.
    const diagnostics: readonly DeviceDiagnostic[] = session && this.establishment
      ? await this.establishment.teardown(session.active)
      : [];

    const closed = await withConnectionMapping('disconnect', () => this.gateway.disconnect(unwrapHandle(handle)));
    if (!closed.ok) {
      return closed;
    }
    return successResult(undefined, undefined, diagnostics);
  }

  private async openSession(
    handle: BurnerConnectionHandle,
    establishment: SessionEstablishment,
  ): Promise<BurnerDomainResult<BurnerConnectionSession>> {
    const device = unwrapHandle(handle);
    const portInfo = toSerialPortInfo(device.portInfo ?? handle.portInfo);
    try {
      const established = await establishment.establish({
        connectionId: handle.id,
        transport: device.transport,
        ...(portInfo ? { portInfo } : {}),
        backend: device.platform === 'simulated' ? 'simulated' : 'serial',
        ...(portInfo?.vendorId || portInfo?.productId
          ? { usb: { vendorId: portInfo.vendorId, productId: portInfo.productId } }
          : {}),
      });
      this.sessions.set(handle.id, established);
      return successResult<BurnerConnectionSession>({
        connectionId: handle.id,
        profile: established.active.profile,
        diagnostics: established.diagnostics,
        ...(established.probeFacts !== undefined ? { probeFacts: established.probeFacts } : {}),
      });
    } catch (error) {
      return failureResult(mapSessionStageError(error));
    }
  }
}
