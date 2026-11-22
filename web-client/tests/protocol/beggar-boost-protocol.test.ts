import { describe, expect, it, vi } from 'vitest';

import type { Transport } from '@/platform/serial';
import {
  boost_crc_rom,
  boost_enter_mode,
  boost_gba_rtc_read,
  BOOST_MAX_WRITE_CHUNK,
  boost_probe,
  boost_program_save,
  boost_read_rom,
  boost_write_units,
  BoostCommand,
} from '@/protocol';
import { crc32 } from '@/utils/crc-utils';

function createMockTransport(handler: {
  onSendAndReceive?: (payload: Uint8Array, readLength: number) => Uint8Array;
  onRead?: (length: number) => Uint8Array;
}): { transport: Transport; sent: Uint8Array[]; signals: SerialOutputSignals[] } {
  const sent: Uint8Array[] = [];
  const signals: SerialOutputSignals[] = [];
  const transport: Transport = {
    send: vi.fn((payload: Uint8Array) => {
      sent.push(payload);
      return Promise.resolve(true);
    }),
    read: vi.fn((length: number) => Promise.resolve({
      data: handler.onRead ? handler.onRead(length) : new Uint8Array(length),
    })),
    sendAndReceive: vi.fn((payload: Uint8Array, readLength: number) => {
      sent.push(payload);
      return Promise.resolve({
        data: handler.onSendAndReceive
          ? handler.onSendAndReceive(payload, readLength)
          : new Uint8Array([0x01]),
      });
    }),
    setSignals: vi.fn((sig: SerialOutputSignals) => {
      signals.push(sig);
      return Promise.resolve();
    }),
    flushInput: vi.fn(() => Promise.resolve()),
    drainInput: vi.fn(() => Promise.resolve()),
  };
  return { transport, sent, signals };
}

describe('crc32', () => {
  it('computes standard IEEE 802.3 CRC32 matching 0xd5 firmware output', () => {
    const checkValue = crc32(new TextEncoder().encode('123456789'));
    expect(checkValue).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0x00000000);
  });
});

describe('Beggar Boost protocol extensions', () => {
  it('probes ChisFlash-Beggar-Boost banner via 0x55 0xaa', async () => {
    const bannerBytes = Array.from(new TextEncoder().encode('\x01ChisFlash Beggar FW C15 RC39-STM32\r\n'));
    let cursor = 0;
    const { transport, sent } = createMockTransport({
      onRead: (len) => {
        const chunk = Uint8Array.from(bannerBytes.slice(cursor, cursor + len));
        cursor += chunk.byteLength;
        return chunk;
      },
    });

    const res = await boost_probe(transport);
    expect(sent[0]).toEqual(Uint8Array.from([0x55, 0xaa]));
    expect(res.supported).toBe(true);
    expect(res.banner).toBe('ChisFlash Beggar FW C15 RC39-STM32');
  });

  it('returns supported=false when legacy firmware times out on probe', async () => {
    const transport: Transport = {
      send: vi.fn(() => Promise.resolve(true)),
      read: vi.fn(() => Promise.reject(new Error('Read timeout'))),
      sendAndReceive: vi.fn(() => Promise.resolve({ data: new Uint8Array(0) })),
      setSignals: vi.fn(() => Promise.resolve()),
      flushInput: vi.fn(() => Promise.resolve()),
    };

    const res = await boost_probe(transport, 20);
    expect(res).toEqual({ supported: false });
  });

  it('sends big-endian ADDRESS/TRANSFER and parses big-endian CRC32 on 0xd5', async () => {
    const expectedCrc = 0x1234abcd;
    const { transport, sent } = createMockTransport({
      onSendAndReceive: (payload) => {
        if (payload[0] === BoostCommand.CRC_ROM) {
          return Uint8Array.from([0x12, 0x34, 0xab, 0xcd]);
        }
        return Uint8Array.from([0x01]);
      },
    });

    const actual = await boost_crc_rom(transport, 'agb', 0x20000, 0x10000);
    expect(actual).toBe(expectedCrc);
    expect(sent[0]).toEqual(Uint8Array.from([
      BoostCommand.SET_VARIABLE, 4, 0, 0, 0, 0, 0, 0x01, 0x00, 0x00,
    ]));
    expect(sent[1]).toEqual(Uint8Array.from([
      BoostCommand.CRC_ROM, 0, 0x01, 0x00, 0x00,
    ]));
  });

  it('reads up to 8KiB ROM chunk via 0xc1/0xb1 and writes units via 0xd4', async () => {
    const expectedData = Uint8Array.from({ length: 8192 }, (_, idx) => idx & 0xff);
    const { transport, sent } = createMockTransport({
      onSendAndReceive: (payload) => {
        if (payload[0] === BoostCommand.READ_AGB_ROM) return expectedData;
        return Uint8Array.from([0x01]);
      },
    });

    const data = await boost_read_rom(transport, 'agb', 8192, 0x400);
    expect(data).toEqual(expectedData);
    expect(sent[2]).toEqual(Uint8Array.from([BoostCommand.READ_AGB_ROM]));

    await boost_write_units(transport, false, [{ address: 0x02, value: 0x10 }, { address: 0x03, value: 0x40 }]);
    expect(sent[3]).toEqual(Uint8Array.from([
      BoostCommand.WRITE_UNITS, 0, 2,
      0, 0, 0, 2, 0, 0x10,
      0, 0, 0, 3, 0, 0x40,
    ]));
  });

  it('enters mode and reads 8-byte native GBA RTC via 0xca', async () => {
    const bannerBytes = Array.from(new TextEncoder().encode('\x01ChisFlash Beggar FW C15 RC39-STM32\r\n'));
    let cursor = 0;
    const rtcRaw = Uint8Array.from([0x40, 0x26, 0x11, 0x22, 0x00, 0x09, 0x30, 0x15]);
    const { transport, sent } = createMockTransport({
      onRead: (len) => {
        const chunk = Uint8Array.from(bannerBytes.slice(cursor, cursor + len));
        cursor += chunk.byteLength;
        return chunk;
      },
      onSendAndReceive: (payload) => {
        if (payload[0] === BoostCommand.READ_AGB_RTC) return rtcRaw;
        return Uint8Array.from([0x01]);
      },
    });

    await boost_enter_mode(transport, 'agb');
    const rtc = await boost_gba_rtc_read(transport);
    expect(rtc).toEqual(rtcRaw);
    expect(sent.some(p => p[0] === BoostCommand.MODE_AGB)).toBe(true);
    expect(sent.some(p => p[0] === BoostCommand.READ_AGB_RTC)).toBe(true);
  });

  it('rejects boost_program_save payloads exceeding BOOST_MAX_WRITE_CHUNK', async () => {
    const { transport } = createMockTransport({});
    await expect(
      boost_program_save(transport, 2, 0, new Uint8Array(BOOST_MAX_WRITE_CHUNK + 1)),
    ).rejects.toThrow(RangeError);
  });
});
