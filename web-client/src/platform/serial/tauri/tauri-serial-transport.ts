import {
  closeNativeSerial,
  flushNativeSerialInput,
  readNativeSerial,
  setNativeSerialSignals,
  writeNativeSerial,
} from '@/platform/native';
import { AdvancedSettings } from '@/settings/advanced-settings';
import { withTimeout } from '@/utils/async-utils';

import { Mutex } from '../mutex';
import { createReadTimeoutError } from '../transport-errors';
import type { Transport, TransportReadMode } from '../types';

export class TauriSerialTransport implements Transport {
  private readonly mutex = new Mutex();
  private closed = false;
  private totalRxBytes = 0;
  private totalRxReads = 0;
  private totalTxBytes = 0;
  private totalTxPackets = 0;
  private lastRxAt = 0;
  private readSequence = 0;

  constructor(private readonly sessionId: number) {}

  async attachListener(): Promise<void> {
    return Promise.resolve();
  }

  async send(payload: Uint8Array, timeoutMs?: number): Promise<boolean> {
    this.assertOpen();
    const timeout = timeoutMs ?? AdvancedSettings.packageSendTimeout;

    await withTimeout(
      writeNativeSerial(this.sessionId, payload, timeout),
      timeout,
      `Send package timeout in ${timeout}ms`,
    );

    this.totalTxPackets += 1;
    this.totalTxBytes += payload.byteLength;
    return true;
  }

  async read(length: number, timeoutMs?: number, _mode: TransportReadMode = 'default'): Promise<{ data: Uint8Array }> {
    this.assertOpen();
    const timeout = timeoutMs ?? AdvancedSettings.packageReceiveTimeout;
    const readId = ++this.readSequence;
    const startedAt = Date.now();
    const startRxBytes = this.totalRxBytes;
    const startRxReads = this.totalRxReads;

    const target = new Uint8Array(length);
    let offset = 0;

    while (offset < length) {
      this.assertOpen();
      const elapsed = Date.now() - startedAt;
      const remainingTimeout = Math.max(1, timeout - elapsed);

      let chunk: Uint8Array;
      try {
        chunk = await withTimeout(
          readNativeSerial(this.sessionId, length - offset, remainingTimeout),
          remainingTimeout,
          `Read package timeout in ${timeout}ms`,
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes('Read package timeout')) {
          const sinceLastRx = this.lastRxAt > 0 ? Date.now() - this.lastRxAt : -1;
          const sessionRxBytes = this.totalRxBytes - startRxBytes;
          const sessionRxReads = this.totalRxReads - startRxReads;
          const sinceLastRxText = sinceLastRx >= 0 ? `, sinceLastRx=${sinceLastRx}ms` : '';
          throw createReadTimeoutError({
            timeout,
            readId,
            expectedLength: length,
            receivedLength: offset,
            diagnostics:
              `sessionRx=${sessionRxBytes}B/${sessionRxReads}reads, `
              + `totalRx=${this.totalRxBytes}B/${this.totalRxReads}reads, `
              + `totalTx=${this.totalTxBytes}B/${this.totalTxPackets}packets, `
              + `elapsed=${elapsed}ms${sinceLastRxText}`,
          });
        }
        throw error;
      }

      if (!(chunk instanceof Uint8Array) || chunk.byteLength === 0) {
        const sessionRxBytes = this.totalRxBytes - startRxBytes;
        const sessionRxReads = this.totalRxReads - startRxReads;
        throw new Error(
          'Read package returned no data '
          + `(read#${readId}, expected=${length}B, received=${offset}B, `
          + `sessionRx=${sessionRxBytes}B/${sessionRxReads}reads)`,
        );
      }

      target.set(chunk.subarray(0, Math.min(chunk.byteLength, length - offset)), offset);
      offset += chunk.byteLength;
      this.totalRxBytes += chunk.byteLength;
      this.totalRxReads += 1;
      this.lastRxAt = Date.now();
    }

    return { data: target };
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

  async setSignals(signals: SerialOutputSignals): Promise<void> {
    this.assertOpen();

    if (typeof signals.dataTerminalReady === 'boolean') {
      await setNativeSerialSignals(this.sessionId, {
        dataTerminalReady: signals.dataTerminalReady,
      });
    }
    if (typeof signals.requestToSend === 'boolean') {
      await setNativeSerialSignals(this.sessionId, {
        requestToSend: signals.requestToSend,
      });
    }
  }

  flushInput(): Promise<void> {
    return flushNativeSerialInput(this.sessionId).catch(() => {});
  }

  async drainInput(quietMs = 50, _maxWaitMs?: number): Promise<void> {
    // 原生 flush 直接清驱动层缓冲；间隔一个静默期再清一次，
    // 吸收仍在 USB 传输途中的迟到字节。
    await this.flushInput();
    await new Promise((resolve) => setTimeout(resolve, quietMs));
    await this.flushInput();
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;
    await closeNativeSerial(this.sessionId);
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new Error('Serial transport is closed');
    }
  }
}
