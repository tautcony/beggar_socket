import type { Transport, TransportReadMode } from '@/platform/serial';
import { AdvancedSettings } from '@/settings/advanced-settings';

import { PROTOCOL_ACK } from './constants';

export class ProtocolAdapter {
  static async sendPackage(
    transport: Transport,
    payload: Uint8Array,
    timeoutMs?: number,
  ): Promise<boolean> {
    return transport.send(payload, timeoutMs ?? AdvancedSettings.packageSendTimeout);
  }

  static async getPackage(
    transport: Transport,
    length: number,
    timeoutMs?: number,
    mode: TransportReadMode = 'byob',
  ): Promise<{ data: Uint8Array }> {
    return transport.read(length, timeoutMs ?? AdvancedSettings.packageReceiveTimeout, mode);
  }

  /** Atomic send + receive guarded by a transport-level mutex. */
  static async sendAndReceive(
    transport: Transport,
    payload: Uint8Array,
    readLength: number,
    sendTimeoutMs?: number,
    readTimeoutMs?: number,
  ): Promise<{ data: Uint8Array }> {
    return transport.sendAndReceive(
      payload,
      readLength,
      sendTimeoutMs ?? AdvancedSettings.packageSendTimeout,
      readTimeoutMs ?? AdvancedSettings.packageReceiveTimeout,
    );
  }

  static async getResult(transport: Transport, timeoutMs?: number): Promise<boolean> {
    const result = await this.getPackage(transport, 1, timeoutMs ?? AdvancedSettings.packageReceiveTimeout);
    return result.data?.byteLength > 0 && result.data[0] === PROTOCOL_ACK;
  }

  static async setSignals(transport: Transport, signals: SerialOutputSignals): Promise<void> {
    await transport.setSignals(signals);
  }
}
