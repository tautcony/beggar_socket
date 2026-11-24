import type { Transport } from '@/platform/serial';

import type { GbflashFirmwareInfo } from './handshake';

export interface GbflashBufferLimits {
  maxRead: number;
  maxWrite: number;
}

export function computeGbflashBufferLimits(
  fwInfo: Pick<GbflashFirmwareInfo, 'family'> & { isCdc?: boolean },
  _baudRate?: number,
): GbflashBufferLimits {
  if (!fwInfo.isCdc) {
    // CH340 GBFlash corrupts +0xDF..+0xE2 during FLASH_PROGRAM when TRANSFER_SIZE >= 0x100;
    // 0x80 (128B) is verified bit-exact (3/3 CRC32 matches on live L14 hardware).
    return { maxRead: 0x1000, maxWrite: 0x80 };
  }
  return { maxRead: 0x1000, maxWrite: 0x400 };
}

/**
 * Framing layer for GBFlash devices (direct transport read/write and buffer reset).
 */
export class GbflashFramingLayer {
  constructor(private readonly transport: Transport) {}

  async write(data: Uint8Array, timeoutMs: number): Promise<void> {
    const ok = await this.transport.send(data, timeoutMs);
    if (!ok) {
      throw new Error('GBFlash transport write failed');
    }
  }

  async read(size: number, timeoutMs: number): Promise<Uint8Array> {
    if (size === 0) {
      return new Uint8Array(0);
    }
    const { data } = await this.transport.read(size, timeoutMs);
    return data;
  }

  async resetBuffers(): Promise<void> {
    await this.transport.flushInput?.().catch(() => undefined);
    await this.transport.flushOutput?.().catch(() => undefined);
    if (this.transport.readAvailable) {
      await this.transport.readAvailable(20).catch(() => undefined);
    }
  }
}
