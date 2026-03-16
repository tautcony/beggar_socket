import { AdvancedSettings } from '@/settings/advanced-settings';
import type { DefaultReader } from '@/types';
import type { SerialConnection } from '@/types/serial';

import type { Transport, TransportReadMode } from './types';

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  message: string,
  onTimeout?: () => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          onTimeout?.();
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

export class ConnectionTransport implements Transport {
  private readonly overflow: Uint8Array[] = [];

  constructor(private readonly connection: SerialConnection) {}

  async send(payload: Uint8Array, timeoutMs?: number): Promise<boolean> {
    const timeout = timeoutMs ?? AdvancedSettings.packageSendTimeout;

    await withTimeout(
      this.connection.write(payload),
      timeout,
      `Send package timeout in ${timeout}ms`,
    );

    return true;
  }

  async read(length: number, timeoutMs?: number): Promise<{ data: Uint8Array }> {
    const timeout = timeoutMs ?? AdvancedSettings.packageReceiveTimeout;

    return new Promise((resolve, reject) => {
      const { connection, overflow } = this;
      const accumulatedData = new Uint8Array(length);
      let offset = 0;
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      // Drain bytes left over from the previous read before registering for new data
      while (overflow.length > 0 && offset < length) {
        const chunk = overflow[0];
        const bytesToCopy = Math.min(chunk.byteLength, length - offset);
        accumulatedData.set(chunk.subarray(0, bytesToCopy), offset);
        offset += bytesToCopy;
        if (bytesToCopy === chunk.byteLength) {
          overflow.shift();
        } else {
          overflow[0] = chunk.subarray(bytesToCopy);
        }
      }

      if (offset >= length) {
        resolve({ data: accumulatedData });
        return;
      }

      const clearActiveTimer = () => {
        if (timer) {
          clearTimeout(timer);
          timer = undefined;
        }
      };

      function handleData(data: Uint8Array) {
        if (settled) return;

        const bytesToCopy = Math.min(data.byteLength, length - offset);
        accumulatedData.set(data.subarray(0, bytesToCopy), offset);
        offset += bytesToCopy;

        // Buffer any bytes beyond what this read needs so they aren't lost
        if (data.byteLength > bytesToCopy) {
          overflow.push(data.subarray(bytesToCopy));
        }

        if (offset >= length) {
          settled = true;
          clearActiveTimer();
          connection.removeDataListener(handleData);
          resolve({ data: accumulatedData });
          return;
        }

        // Treat timeout as inactivity timeout instead of total packet timeout.
        armTimeout();
      }

      function armTimeout() {
        clearActiveTimer();
        timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          connection.removeDataListener(handleData);
          reject(new Error(`Read package timeout in ${timeout}ms`));
        }, timeout);
      }

      connection.onData(handleData);
      armTimeout();
    });
  }

  async setSignals(signals: SerialOutputSignals): Promise<void> {
    await this.connection.setSignals(signals);
  }

  async close(): Promise<void> {
    await this.connection.close();
  }
}

export class WebSerialTransport implements Transport {
  private reader: DefaultReader | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private pumpPromise: Promise<void> | null = null;
  private readonly bufferedChunks: Uint8Array[] = [];
  private bufferedLength = 0;
  private readWaiters = new Set<() => void>();
  private streamDone = false;
  private streamError: unknown = null;

  constructor(private readonly port: SerialPort) {}

  private acquireWriter(): WritableStreamDefaultWriter<Uint8Array> {
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

  async send(payload: Uint8Array, timeoutMs?: number): Promise<boolean> {
    const writer = this.acquireWriter();
    const timeout = timeoutMs ?? AdvancedSettings.packageSendTimeout;

    await withTimeout(
      writer.write(payload),
      timeout,
      `Send package timeout in ${timeout}ms`,
      () => {
        // Abort writer to prevent ghost write completing after timeout
        writer.abort(new Error('Write aborted due to send timeout')).catch(() => {});
        this.writer = null;
      },
    );

    return true;
  }

  async read(length: number, timeoutMs?: number, _mode: TransportReadMode = 'byob'): Promise<{ data: Uint8Array }> {
    if (!this.port.readable) {
      throw new Error('Port readable stream is not available');
    }

    this.ensurePumpStarted();
    return this.readFromBuffer(length, timeoutMs);
  }

  async setSignals(signals: SerialOutputSignals): Promise<void> {
    await this.port.setSignals(signals);
  }

  async close(): Promise<void> {
    this.releaseWriter();
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {}
    }
    if (this.pumpPromise) {
      try {
        await this.pumpPromise;
      } catch {}
    }
    await this.port.close();
  }

  private ensurePumpStarted(): void {
    if (!this.port.readable) {
      throw new Error('Port readable stream is not available');
    }
    if (this.pumpPromise) {
      return;
    }
    // Propagate a previous pump error instead of silently restarting on an errored stream
    if (this.streamError !== null) {
      throw this.streamError instanceof Error ? this.streamError : new Error('Serial read pump failed');
    }

    // Reset buffer state when restarting pump after a previous error
    this.bufferedChunks.length = 0;
    this.bufferedLength = 0;
    this.streamDone = false;
    this.streamError = null;
    this.reader = this.port.readable.getReader();
    this.pumpPromise = this.pumpReadable();
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

  private async readFromBuffer(
    length: number,
    timeoutMs?: number,
  ): Promise<{ data: Uint8Array }> {
    const timeout = timeoutMs ?? AdvancedSettings.packageReceiveTimeout;
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

      await this.waitForData(timeout);
    }

    if (offset < length) {
      throw new Error(`Incomplete package read: expected ${length} bytes, got ${offset}`);
    }

    return { data: accumulatedData };
  }
}
