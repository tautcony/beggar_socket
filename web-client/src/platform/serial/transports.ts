import { AdvancedSettings } from '@/settings/advanced-settings';
import type { BYOBReader, DefaultReader } from '@/types';
import type { SerialConnection } from '@/types/serial';

import type { Transport, TransportReadMode } from './types';

export class ConnectionTransport implements Transport {
  constructor(private readonly connection: SerialConnection) {}

  async send(payload: Uint8Array, timeoutMs?: number): Promise<boolean> {
    const timeout = timeoutMs ?? AdvancedSettings.packageSendTimeout;

    await Promise.race([
      this.connection.write(payload),
      new Promise((_, reject) => {
        setTimeout(() => { reject(new Error(`Send package timeout in ${timeout}ms`)); }, timeout);
      }),
    ]);

    return true;
  }

  async read(length: number, timeoutMs?: number): Promise<{ data: Uint8Array }> {
    const timeout = timeoutMs ?? AdvancedSettings.packageReceiveTimeout;

    return new Promise((resolve, reject) => {
      const accumulatedData = new Uint8Array(length);
      let offset = 0;
      let settled = false;

      const handleData = (data: Uint8Array) => {
        if (settled) return;

        const bytesToCopy = Math.min(data.byteLength, length - offset);
        accumulatedData.set(data.subarray(0, bytesToCopy), offset);
        offset += bytesToCopy;

        if (offset >= length) {
          settled = true;
          this.connection.removeDataListener(handleData);
          resolve({ data: accumulatedData });
        }
      };

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.connection.removeDataListener(handleData);
        reject(new Error(`Read package timeout in ${timeout}ms`));
      }, timeout);

      this.connection.onData(handleData);
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
  constructor(private readonly port: SerialPort) {}

  async send(payload: Uint8Array, timeoutMs?: number): Promise<boolean> {
    const writer = this.port.writable?.getWriter();
    if (!writer) {
      throw new Error('Serial port not properly initialized');
    }

    const timeout = timeoutMs ?? AdvancedSettings.packageSendTimeout;
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      const writePromise = writer.write(payload);
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          writer.releaseLock();
          reject(new Error(`Send package timeout in ${timeout}ms`));
        }, timeout);
      });

      await Promise.race([writePromise, timeoutPromise]);
      return true;
    } finally {
      if (timer) clearTimeout(timer);
      try { writer.releaseLock(); } catch {}
    }
  }

  async read(length: number, timeoutMs?: number, mode: TransportReadMode = 'byob'): Promise<{ data: Uint8Array }> {
    if (!this.port.readable) {
      throw new Error('Port readable stream is not available');
    }

    if (mode === 'byob') {
      const reader = this.port.readable.getReader({ mode: 'byob' });
      return this.getPackageWithBYOBReader(reader, length, timeoutMs);
    }

    const reader = this.port.readable.getReader();
    return this.getPackageWithDefaultReader(reader, length, timeoutMs);
  }

  async setSignals(signals: SerialOutputSignals): Promise<void> {
    await this.port.setSignals(signals);
  }

  async close(): Promise<void> {
    await this.port.close();
  }

  private async getPackageWithDefaultReader(
    reader: DefaultReader,
    length: number,
    timeoutMs?: number,
  ): Promise<{ data: Uint8Array }> {
    const timeout = timeoutMs ?? AdvancedSettings.packageReceiveTimeout;
    let offset = 0;
    const accumulatedData = new Uint8Array(length);

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const readOperation = (async () => {
        while (offset < length) {
          const { value, done } = await reader.read();
          if (done || !value) {
            break;
          }

          const bytesToCopy = Math.min(value.byteLength, length - offset);
          accumulatedData.set(value.subarray(0, bytesToCopy), offset);
          offset += bytesToCopy;
        }
      })();

      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          reader.releaseLock();
          reject(new Error(`Read package timeout in ${timeout}ms`));
        }, timeout);
      });

      await Promise.race([readOperation, timeoutPromise]);
      return { data: accumulatedData.slice(0, offset) };
    } catch (error) {
      if (offset === 0) {
        throw error;
      }
      return { data: accumulatedData.slice(0, offset) };
    } finally {
      if (timer) clearTimeout(timer);
      try { reader.releaseLock(); } catch {}
    }
  }

  private async getPackageWithBYOBReader(
    reader: BYOBReader,
    length: number,
    timeoutMs?: number,
  ): Promise<{ data: Uint8Array }> {
    const timeout = timeoutMs ?? AdvancedSettings.packageReceiveTimeout;
    let buffer = new Uint8Array(length);
    let offset = 0;
    const accumulatedData = new Uint8Array(length);

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const readOperation = (async () => {
        while (offset < length) {
          const { value, done } = await reader.read(
            new Uint8Array(buffer as unknown as ArrayBufferLike, offset),
          );
          if (done) {
            break;
          }

          accumulatedData.set(value, offset);
          buffer = value.buffer as unknown as Uint8Array<ArrayBuffer>;
          offset += value.byteLength;
        }
      })();

      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          reader.releaseLock();
          reject(new Error(`Read package timeout in ${timeout}ms`));
        }, timeout);
      });

      await Promise.race([readOperation, timeoutPromise]);
      return { data: new Uint8Array(buffer) };
    } catch (error) {
      if (offset === 0) {
        throw error;
      }
      return { data: accumulatedData.slice(0, offset) };
    } finally {
      if (timer) clearTimeout(timer);
      try { reader.releaseLock(); } catch {}
    }
  }
}
