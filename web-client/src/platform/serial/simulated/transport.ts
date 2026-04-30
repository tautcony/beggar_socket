import { Mutex } from '@/platform/serial/mutex';
import type { Transport, TransportReadMode } from '@/platform/serial/types';

import {
  applySimulatedTransferDelay,
  closeSimulatedDeviceState,
  createSimulatedDeviceState,
  executeSimulatedCommand,
  maybeThrowSimulatedTransportError,
  setSimulatedSignals,
  type SimulatedDeviceState,
} from './runtime';

export class SimulatedTransport implements Transport {
  private readonly mutex = new Mutex();
  private readonly pendingResponses: Uint8Array[] = [];

  constructor(private readonly state: SimulatedDeviceState = createSimulatedDeviceState()) {}

  get deviceState(): SimulatedDeviceState {
    return this.state;
  }

  async send(payload: Uint8Array, _timeoutMs?: number): Promise<boolean> {
    await applySimulatedTransferDelay('write', payload.byteLength);
    maybeThrowSimulatedTransportError('send');
    const result = executeSimulatedCommand(this.state, payload);
    if (result.response) {
      this.pendingResponses.push(result.response);
    }
    return true;
  }

  async read(length: number, _timeoutMs?: number, _mode: TransportReadMode = 'byob'): Promise<{ data: Uint8Array }> {
    await applySimulatedTransferDelay('read', length);
    maybeThrowSimulatedTransportError('read');

    const response = this.pendingResponses.shift();
    if (!response) {
      throw new Error('No simulated response queued');
    }

    return {
      data: response.byteLength === length ? response : response.subarray(0, Math.min(length, response.byteLength)),
    };
  }

  async sendAndReceive(
    payload: Uint8Array,
    readLength: number,
    sendTimeoutMs?: number,
    readTimeoutMs?: number,
  ): Promise<{ data: Uint8Array }> {
    const release = await this.mutex.acquire();
    try {
      await this.send(payload, sendTimeoutMs);
      return await this.read(readLength, readTimeoutMs);
    } finally {
      release();
    }
  }

  setSignals(signals: SerialOutputSignals): Promise<void> {
    setSimulatedSignals(this.state, signals);
    return Promise.resolve();
  }

  flushInput(): Promise<void> {
    this.pendingResponses.length = 0;
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.pendingResponses.length = 0;
    closeSimulatedDeviceState(this.state);
    return Promise.resolve();
  }
}
