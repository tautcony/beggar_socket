import { AdvancedSettings } from '@/settings/advanced-settings';
import type { DefaultReader } from '@/types';
import { withTimeout } from '@/utils/async-utils';

import { Mutex } from './mutex';
import type { Transport, TransportReadMode } from './types';

const WEB_SERIAL_CLOSE_WAIT_TIMEOUT_MS = 2_000;

export class WebSerialTransport implements Transport {
  private reader: DefaultReader | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private writerRecoveryPromise: Promise<void> | null = null;
  private pumpPromise: Promise<void> | null = null;
  private readonly bufferedChunks: Uint8Array[] = [];
  private bufferedLength = 0;
  private readWaiters = new Set<() => void>();
  private streamDone = false;
  private streamError: unknown = null;
  private readonly mutex = new Mutex();
  private totalRxBytes = 0;
  private totalRxChunks = 0;
  private totalTxBytes = 0;
  private totalTxPackets = 0;
  private lastRxAt = 0;
  private readSequence = 0;

  constructor(private readonly port: SerialPort) {}

  private async acquireWriter(): Promise<WritableStreamDefaultWriter<Uint8Array>> {
    await this.waitForWriterRecovery();

    if (!this.writer) {
      const writable = this.port.writable;
      if (!writable) {
        throw new Error('Serial port not properly initialized');
      }
      this.writer = writable.getWriter();
    }
    return this.writer;
  }

  private releaseWriter(): void {
    if (this.writer) {
      try { this.writer.releaseLock(); } catch {}
      this.writer = null;
    }
  }

  private async waitForWriterRecovery(): Promise<void> {
    if (this.writerRecoveryPromise) {
      await this.writerRecoveryPromise;
    }
  }

  private startWriterRecovery(writer: WritableStreamDefaultWriter<Uint8Array>, abortReason?: Error): Promise<void> {
    if (this.writer !== writer) {
      return this.writerRecoveryPromise ?? Promise.resolve();
    }

    if (this.writerRecoveryPromise) {
      return this.writerRecoveryPromise;
    }

    const recovery = (async () => {
      if (abortReason) {
        try {
          await writer.abort(abortReason);
        } catch {}
      }

      if (this.writer === writer) {
        this.releaseWriter();
      }
    })();

    const recoveryPromise = recovery.finally(() => {
      if (this.writerRecoveryPromise === recoveryPromise) {
        this.writerRecoveryPromise = null;
      }
    });

    this.writerRecoveryPromise = recoveryPromise;
    return recoveryPromise;
  }

  async send(payload: Uint8Array, timeoutMs?: number): Promise<boolean> {
    const writer = await this.acquireWriter();
    const timeout = timeoutMs ?? AdvancedSettings.packageSendTimeout;
    let timedOut = false;

    try {
      await withTimeout(
        writer.write(payload),
        timeout,
        `Send package timeout in ${timeout}ms`,
        {
          onTimeout: () => {
            timedOut = true;
            void this.startWriterRecovery(writer, new Error('Write aborted due to send timeout'));
          },
        },
      );
    } catch (error) {
      if (!timedOut) {
        const reason = error instanceof Error
          ? error
          : new Error('Write aborted due to send failure');
        void this.startWriterRecovery(writer, reason);
      }
      throw error;
    }

    this.totalTxPackets += 1;
    this.totalTxBytes += payload.byteLength;
    return true;
  }

  async read(length: number, timeoutMs?: number, _mode: TransportReadMode = 'byob'): Promise<{ data: Uint8Array }> {
    if (!this.port.readable) {
      throw new Error('Port readable stream is not available');
    }

    this.ensurePumpStarted();
    return this.readFromBuffer(length, timeoutMs);
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
    await this.port.setSignals(signals);
  }

  flushInput(): Promise<void> {
    this.clearBuffer();
    return Promise.resolve();
  }

  async close(): Promise<void> {
    await this.waitForWriterRecovery();
    this.releaseWriter();
    this.clearBuffer();

    const reader = this.reader;
    if (reader) {
      await this.waitForCloseStage(reader.cancel(), 'reader cancel');
    }

    const pumpPromise = this.pumpPromise;
    if (pumpPromise) {
      await this.waitForCloseStage(pumpPromise, 'pump shutdown');
    }

    await this.port.close();
  }

  private async waitForCloseStage(operation: Promise<unknown>, stage: string): Promise<void> {
    try {
      await withTimeout(
        operation,
        WEB_SERIAL_CLOSE_WAIT_TIMEOUT_MS,
        `WebSerial ${stage} timeout after ${WEB_SERIAL_CLOSE_WAIT_TIMEOUT_MS}ms`,
      );
    } catch {}
  }

  private ensurePumpStarted(): void {
    if (!this.port.readable) {
      throw new Error('Port readable stream is not available');
    }
    if (this.pumpPromise) {
      return;
    }

    // If a previous pump errored out, reset state and attempt to restart.
    // The readable stream may still be usable after certain transient errors.
    if (this.streamError !== null) {
      this.resetPumpState();
    }

    // Reset buffer state when restarting pump after a previous error
    this.bufferedChunks.length = 0;
    this.bufferedLength = 0;
    this.streamDone = false;
    this.streamError = null;
    this.reader = this.port.readable.getReader();
    this.pumpPromise = this.pumpReadable();
  }

  /**
   * Reset pump state so a new pump can be started.
   * Call this to recover from a stream error if the underlying port is still available.
   */
  private resetPumpState(): void {
    if (this.reader) {
      try { this.reader.releaseLock(); } catch { /* ignore */ }
      this.reader = null;
    }
    this.pumpPromise = null;
    this.bufferedChunks.length = 0;
    this.bufferedLength = 0;
    this.streamDone = false;
    this.streamError = null;
  }

  private async pumpReadable(): Promise<void> {
    const reader = this.reader;
    if (!reader) {
      return;
    }

    try {
      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          this.streamDone = true;
          this.notifyReadWaiters();
          return;
        }

        if (value && value.byteLength > 0) {
          this.bufferedChunks.push(new Uint8Array(value));
          this.bufferedLength += value.byteLength;
          this.totalRxChunks += 1;
          this.totalRxBytes += value.byteLength;
          this.lastRxAt = Date.now();
          this.notifyReadWaiters();
        }
      }
    } catch (error) {
      this.streamError = error;
      this.notifyReadWaiters();
    } finally {
      try { reader.releaseLock(); } catch {}
      if (this.reader === reader) {
        this.reader = null;
      }
      this.pumpPromise = null;
    }
  }

  private notifyReadWaiters(): void {
    const waiters = [...this.readWaiters];
    this.readWaiters.clear();
    waiters.forEach((resolve) => {
      resolve();
    });
  }

  private async waitForData(timeoutMs: number): Promise<void> {
    if (this.bufferedLength > 0 || this.streamDone || this.streamError) {
      return;
    }

    let resolveWaiter: (() => void) | undefined;
    const waitForReadable = new Promise<void>((resolve) => {
      resolveWaiter = resolve;
      this.readWaiters.add(resolve);
    });

    try {
      await withTimeout(waitForReadable, timeoutMs, `Read package timeout in ${timeoutMs}ms`);
    } finally {
      if (resolveWaiter) {
        this.readWaiters.delete(resolveWaiter);
      }
    }
  }

  private consumeBufferedData(
    target: Uint8Array,
    offset: number,
  ): number {
    let nextOffset = offset;

    while (nextOffset < target.byteLength && this.bufferedChunks.length > 0) {
      const chunk = this.bufferedChunks[0];
      const bytesToCopy = Math.min(chunk.byteLength, target.byteLength - nextOffset);
      target.set(chunk.subarray(0, bytesToCopy), nextOffset);
      nextOffset += bytesToCopy;

      if (bytesToCopy === chunk.byteLength) {
        this.bufferedChunks.shift();
      } else {
        this.bufferedChunks[0] = chunk.subarray(bytesToCopy);
      }

      this.bufferedLength -= bytesToCopy;
    }

    return nextOffset;
  }

  private clearBuffer(): void {
    this.bufferedChunks.length = 0;
    this.bufferedLength = 0;
  }

  private createReadTimeoutError(params: {
    timeout: number;
    expectedLength: number;
    receivedLength: number;
    readId: number;
    startedAt: number;
    initialBufferedLength: number;
    startRxBytes: number;
    startRxChunks: number;
  }): Error {
    const {
      timeout,
      expectedLength,
      receivedLength,
      readId,
      startedAt,
      initialBufferedLength,
      startRxBytes,
      startRxChunks,
    } = params;
    const elapsed = Date.now() - startedAt;
    const sinceLastRx = this.lastRxAt > 0 ? Date.now() - this.lastRxAt : -1;
    const sessionRxBytes = this.totalRxBytes - startRxBytes;
    const sessionRxChunks = this.totalRxChunks - startRxChunks;
    const sinceLastRxText = sinceLastRx >= 0 ? `, sinceLastRx=${sinceLastRx}ms` : '';

    return new Error(
      `Read package timeout in ${timeout}ms `
      + `(read#${readId}, expected=${expectedLength}B, received=${receivedLength}B, `
      + `buffered=${this.bufferedLength}B, initialBuffered=${initialBufferedLength}B, `
      + `sessionRx=${sessionRxBytes}B/${sessionRxChunks}chunks, `
      + `totalRx=${this.totalRxBytes}B/${this.totalRxChunks}chunks, `
      + `totalTx=${this.totalTxBytes}B/${this.totalTxPackets}packets, `
      + `elapsed=${elapsed}ms${sinceLastRxText}, streamDone=${this.streamDone})`,
    );
  }

  private async readFromBuffer(
    length: number,
    timeoutMs?: number,
  ): Promise<{ data: Uint8Array }> {
    const timeout = timeoutMs ?? AdvancedSettings.packageReceiveTimeout;
    const readId = ++this.readSequence;
    const startedAt = Date.now();
    const initialBufferedLength = this.bufferedLength;
    const startRxBytes = this.totalRxBytes;
    const startRxChunks = this.totalRxChunks;
    let offset = 0;
    const accumulatedData = new Uint8Array(length);

    while (offset < length) {
      if (this.streamError) {
        throw this.streamError instanceof Error ? this.streamError : new Error('Serial read pump failed');
      }

      offset = this.consumeBufferedData(accumulatedData, offset);
      if (offset >= length) {
        break;
      }

      if (this.streamDone) {
        break;
      }

      try {
        await this.waitForData(timeout);
      } catch (error) {
        if (error instanceof Error && error.message.includes('Read package timeout')) {
          throw this.createReadTimeoutError({
            timeout,
            expectedLength: length,
            receivedLength: offset,
            readId,
            startedAt,
            initialBufferedLength,
            startRxBytes,
            startRxChunks,
          });
        }
        throw error;
      }
    }

    if (offset < length) {
      const sessionRxBytes = this.totalRxBytes - startRxBytes;
      const sessionRxChunks = this.totalRxChunks - startRxChunks;
      throw new Error(
        `Incomplete package read: expected ${length} bytes, got ${offset} `
        + `(read#${readId}, buffered=${this.bufferedLength}B, initialBuffered=${initialBufferedLength}B, `
        + `sessionRx=${sessionRxBytes}B/${sessionRxChunks}chunks, streamDone=${this.streamDone})`,
      );
    }

    return { data: accumulatedData };
  }
}
