import { ClearBuffer, SerialPort } from 'tauri-plugin-serialplugin-api';

import { AdvancedSettings } from '@/settings/advanced-settings';

import { Mutex } from '../mutex';
import type { Transport, TransportReadMode } from '../types';

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(message));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export class TauriSerialTransport implements Transport {
  private readonly mutex = new Mutex();
  private closed = false;
  private totalRxBytes = 0;
  private totalRxReads = 0;
  private totalTxBytes = 0;
  private totalTxPackets = 0;
  private lastRxAt = 0;
  private readSequence = 0;

  constructor(private readonly serialPort: SerialPort) {}

  async attachListener(): Promise<void> {
    return Promise.resolve();
  }

  async send(payload: Uint8Array, timeoutMs?: number): Promise<boolean> {
    this.assertOpen();
    const timeout = timeoutMs ?? AdvancedSettings.packageSendTimeout;

    await withTimeout(
      this.serialPort.writeBinary(payload),
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
          this.serialPort.readBinary({ size: length - offset, timeout: remainingTimeout }),
          remainingTimeout,
          `Read package timeout in ${timeout}ms`,
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes('Read package timeout')) {
          const sinceLastRx = this.lastRxAt > 0 ? Date.now() - this.lastRxAt : -1;
          const sessionRxBytes = this.totalRxBytes - startRxBytes;
          const sessionRxReads = this.totalRxReads - startRxReads;
          const sinceLastRxText = sinceLastRx >= 0 ? `, sinceLastRx=${sinceLastRx}ms` : '';
          throw new Error(
            `Read package timeout in ${timeout}ms `
            + `(read#${readId}, expected=${length}B, received=${offset}B, `
            + `sessionRx=${sessionRxBytes}B/${sessionRxReads}reads, `
            + `totalRx=${this.totalRxBytes}B/${this.totalRxReads}reads, `
            + `totalTx=${this.totalTxBytes}B/${this.totalTxPackets}packets, `
            + `elapsed=${elapsed}ms${sinceLastRxText})`,
          );
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
      await this.serialPort.writeDataTerminalReady(signals.dataTerminalReady);
    }
    if (typeof signals.requestToSend === 'boolean') {
      await this.serialPort.writeRequestToSend(signals.requestToSend);
    }
  }

  flushInput(): Promise<void> {
    return this.serialPort.clearBuffer(ClearBuffer.Input).catch(() => {});
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;
    await this.serialPort.close();
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new Error('Serial transport is closed');
    }
  }
}
