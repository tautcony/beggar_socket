import { describe, expect, it, vi } from 'vitest';

import type { Transport } from '@/platform/serial';
import {
  computeGbflashBufferLimits,
  DEVICE_VAR,
  FLASH_COMMAND_SET,
  FLASH_METHOD,
  FLASH_WE_PIN,
  GBFLASH_CMD,
  GBFLASH_CRC32_CHUNK_SIZE,
  GbflashCommandClient,
  type GbflashFirmwareInfo,
  GbflashFramingLayer,
  GbflashProtocolError,
} from '@/protocol/gbflash';
import { crc32 } from '@/utils/crc-utils';

function makeFwInfo(overrides: Partial<GbflashFirmwareInfo> = {}): GbflashFirmwareInfo {
  return {
    family: 'gbflash',
    cfwId: 'L',
    fwVer: 16,
    pcbVer: 13,
    fwTs: 0,
    ofwVer: null,
    pcbName: 'GBFlash',
    cartPowerCtrl: true,
    cartPresenceSwitch: false,
    cartModeSwitch: false,
    bootloaderReset: true,
    hasDeviceSerial: false,
    unregistered: false,
    audioWePin: true,
    isCdc: false,
    ...overrides,
  };
}

function createScriptedTransport(readChunks: (number[] | Uint8Array)[]) {
  const sent: number[][] = [];
  const queue = readChunks.map(c => (c instanceof Uint8Array ? c : new Uint8Array(c)));
  const setSignals = vi.fn(() => Promise.resolve(undefined));
  const flushInput = vi.fn(() => Promise.resolve(undefined));
  const flushOutput = vi.fn(() => Promise.resolve(undefined));

  const transport: Transport = {
    send: vi.fn((data: Uint8Array) => {
      sent.push(Array.from(data));
      return Promise.resolve(true);
    }),
    read: vi.fn((length: number) => {
      const next = queue.shift() ?? new Uint8Array(0);
      if (next.length > length) {
        queue.unshift(next.subarray(length));
        return Promise.resolve({ data: next.subarray(0, length) });
      }
      return Promise.resolve({ data: next });
    }),
    sendAndReceive: vi.fn(() => Promise.resolve({ data: new Uint8Array(0) })),
    setSignals,
    flushInput,
    flushOutput,
    readAvailable: vi.fn(() => Promise.resolve({ data: queue.shift() ?? new Uint8Array(0) })),
  };

  return { transport, sent, setSignals, flushInput, flushOutput };
}

describe('GBFlash fw_ver thresholds & Decision 2 commands', () => {
  it('enforces GET_VARIABLE >= 10, SET_VARIABLE ACK >= 12, and PING >= 15', async () => {
    const fw9 = makeFwInfo({ fwVer: 9 });
    const t9 = createScriptedTransport([]);
    const client9 = new GbflashCommandClient(t9.transport, fw9);

    expect(await client9.getVariable('CART_MODE')).toBe(0);
    expect(t9.sent).toEqual([]); // Does not even send 0xAD below fw_ver 10

    await client9.setVariable('TRANSFER_SIZE', 0x40);
    expect(t9.sent).toEqual([
      [GBFLASH_CMD.SET_VARIABLE, 2, 0, 0, 0, DEVICE_VAR.TRANSFER_SIZE[1], 0, 0, 0, 0x40],
    ]);
    expect(await client9.ping(0x5A)).toBe(false);

    const fw15 = makeFwInfo({ fwVer: 15 });
    const t15 = createScriptedTransport([
      [0x01], // SET_VARIABLE ACK
      [0x00, 0x00, 0x00, 0x02], // GET_VARIABLE CART_MODE
      [(~0x5A) & 0xFF], // PING reply
    ]);
    const client15 = new GbflashCommandClient(t15.transport, fw15);

    await client15.setVariable('CART_MODE', 2);
    expect(await client15.getVariable('CART_MODE')).toBe(2);
    expect(await client15.ping(0x5A)).toBe(true);
    expect(t15.sent[1]).toEqual([GBFLASH_CMD.GET_VARIABLE, 1, 0, 0, 0, 0]);
    expect(t15.sent[2]).toEqual([GBFLASH_CMD.PING, 0x5A]);
  });

  it('uses AGB word addressing (address >> 1) for AGB_CART_READ and AGB_FLASH_WRITE_SHORT', async () => {
    const fw14 = makeFwInfo({ family: 'gbflash', pcbVer: 13, fwVer: 14 });
    const t = createScriptedTransport([
      [0x01], // SET_VARIABLE TRANSFER_SIZE ACK
      [0x01], // SET_VARIABLE ADDRESS ACK
      [0x12, 0x34, 0x56, 0x78], // AGB_CART_READ 4 bytes
      [0x01], // restore TRANSFER_SIZE ACK
      [0x01], // AGB_FLASH_WRITE_SHORT ACK
    ]);
    const client = new GbflashCommandClient(t.transport, fw14, { baudRate: 2_000_000 });

    const data = await client.readRom('AGB', 0x0002_0004, 4);
    expect(Array.from(data)).toEqual([0x12, 0x34, 0x56, 0x78]);
    // ADDRESS = 0x00020004 >> 1 = 0x00010002
    expect(t.sent[1]).toEqual([
      GBFLASH_CMD.SET_VARIABLE, 4, 0, 0, 0, 0x00, 0x00, 0x01, 0x00, 0x02,
    ]);
    expect(t.sent[2]).toEqual([GBFLASH_CMD.AGB_CART_READ]);

    await client.cartWrite('AGB', 0xAAA, 0x00AA, { flashcart: true });
    expect(t.sent[4]).toEqual([
      GBFLASH_CMD.AGB_FLASH_WRITE_SHORT, 0x00, 0x00, 0x05, 0x55, 0x00, 0xAA,
    ]);
  });

  it('handles FLASH_PROGRAM 0x03 continue ACK without re-sending 0xD3', async () => {
    const fw14 = makeFwInfo({ family: 'gbflash', pcbVer: 13, fwVer: 14 });
    const t = createScriptedTransport([
      [0x01], // TRANSFER_SIZE
      [0x01], // ADDRESS
      [0x03], // chunk 0 -> 0x03 continue!
      [0x01], // chunk 1 -> 0x01 done
    ]);
    const client = new GbflashCommandClient(t.transport, fw14, { baudRate: 2_000_000 });
    const payload = new Uint8Array(8).fill(0xAA);

    await client.writeFlashRom('AGB', 0x0000, payload, 0, { maxLength: 4 });
    // Expect: SET_VAR(TRANSFER_SIZE), SET_VAR(ADDRESS), coalesced [FLASH_PROGRAM(0xD3), ...chunk0], chunk1 (NO second 0xD3!)
    expect(t.sent[2]).toEqual([GBFLASH_CMD.FLASH_PROGRAM, 0xAA, 0xAA, 0xAA, 0xAA]);
    expect(t.sent[3]).toEqual([0xAA, 0xAA, 0xAA, 0xAA]);
    expect(t.sent.length).toBe(4);
  });

  it('keeps sending raw payload after 0x03 when the next chunk is all 0xFF', async () => {
    const fw14 = makeFwInfo({ family: 'gbflash', pcbVer: 13, fwVer: 14 });
    const t = createScriptedTransport([
      [0x01], // TRANSFER_SIZE
      [0x01], // ADDRESS
      [0x03], // chunk 0 -> continue: the device now expects raw bytes
      [0x01], // chunk 1 ack
      [0x01], // chunk 2 ack
    ]);
    const client = new GbflashCommandClient(t.transport, fw14, { baudRate: 2_000_000 });
    const payload = new Uint8Array([
      0xAA, 0xAA, 0xAA, 0xAA,
      0xFF, 0xFF, 0xFF, 0xFF,
      0xBB, 0xBB, 0xBB, 0xBB,
    ]);

    await client.writeFlashRom('AGB', 0x0000, payload, 0, { maxLength: 4 });

    // The all-0xFF chunk cannot be skipped mid-resume: skipping it would strand the device
    // waiting for payload, so the next command byte would be consumed as data.
    expect(t.sent[2]).toEqual([GBFLASH_CMD.FLASH_PROGRAM, 0xAA, 0xAA, 0xAA, 0xAA]);
    expect(t.sent[3]).toEqual([0xFF, 0xFF, 0xFF, 0xFF]);
    expect(t.sent[4]).toEqual([GBFLASH_CMD.FLASH_PROGRAM, 0xBB, 0xBB, 0xBB, 0xBB]);
    // No SET_VARIABLE between the resumed chunks.
    expect(t.sent.length).toBe(5);
  });

  it('chunks CALC_CRC32 at 0x20000 and falls back to readback below fw_ver 10', async () => {
    const data = new Uint8Array(GBFLASH_CRC32_CHUNK_SIZE + 16);
    for (let i = 0; i < data.length; i++) {
      data[i] = i & 0xFF;
    }
    const crc0 = crc32(data.subarray(0, GBFLASH_CRC32_CHUNK_SIZE)) >>> 0;
    const crc1 = crc32(data.subarray(GBFLASH_CRC32_CHUNK_SIZE)) >>> 0;
    const u32be = (v: number) => [(v >>> 24) & 0xFF, (v >>> 16) & 0xFF, (v >>> 8) & 0xFF, v & 0xFF];

    const fw12 = makeFwInfo({ fwVer: 12 });
    const t12 = createScriptedTransport([
      [0x01], // ADDRESS 0
      u32be(crc0),
      [0x01], // ADDRESS 0x20000 >> 1 = 0x10000
      u32be(crc1),
    ]);
    const client12 = new GbflashCommandClient(t12.transport, fw12);
    const res12 = await client12.verifyRomCrc32('AGB', 0, data);
    expect(res12).toEqual({ matched: true, usedHardwareCrc: true });
    expect(t12.sent[1]).toEqual([GBFLASH_CMD.CALC_CRC32, ...u32be(GBFLASH_CRC32_CHUNK_SIZE)]);
    expect(t12.sent[3]).toEqual([GBFLASH_CMD.CALC_CRC32, ...u32be(16)]);

    // fw_ver < 10 falls back to readRom
    const small = new Uint8Array([1, 2, 3, 4]);
    const fw9 = makeFwInfo({ fwVer: 9 });
    const t9 = createScriptedTransport([small]);
    const client9 = new GbflashCommandClient(t9.transport, fw9);
    const res9 = await client9.verifyRomCrc32('DMG', 0, small);
    expect(res9.matched).toBe(true);
    expect(res9.usedHardwareCrc).toBe(false);
  });

  it('encodes AGB_BOOTUP_SEQUENCE, AGB_READ_GPIO_RTC, and CART_PWR_OFF / SET_ADDR_AS_INPUTS', async () => {
    const fw14 = makeFwInfo({ fwVer: 14, cartPowerCtrl: true });
    const t = createScriptedTransport([
      [0x01], // AGB_BOOTUP_SEQUENCE ACK
      [0x01, 0x26, 0x11, 0x22, 0x05, 0x13, 0x30, 0x00], // AGB_READ_GPIO_RTC 8B
      [0x01], // CART_PWR_OFF ACK
    ]);
    const client = new GbflashCommandClient(t.transport, fw14);
    await client.agbBootupSequence();
    const rtc = await client.agbReadGpioRtc();
    await client.cartPowerOff();

    expect(rtc?.length).toBe(8);
    expect(t.sent).toEqual([
      [GBFLASH_CMD.AGB_BOOTUP_SEQUENCE],
      [GBFLASH_CMD.AGB_READ_GPIO_RTC],
      [GBFLASH_CMD.CART_PWR_OFF],
    ]);

    const noPwr = makeFwInfo({ fwVer: 14, cartPowerCtrl: false });
    const tNoPwr = createScriptedTransport([[0x01]]);
    const clientNoPwr = new GbflashCommandClient(tNoPwr.transport, noPwr);
    await clientNoPwr.cartPowerOff();
    expect(tNoPwr.sent).toEqual([[GBFLASH_CMD.SET_ADDR_AS_INPUTS]]);
  });

  it('encodes SET_FLASH_CMD (0xA7) as 40 bytes with flashCommandSet byte 1', async () => {
    const fw14 = makeFwInfo({ family: 'gbflash', pcbVer: 13, fwVer: 14 });
    const t = createScriptedTransport([
      [0x01], // SET_FLASH_CMD ACK
      [0x01], // FLASH_COMMANDS_BANK_1
      [0x01], // DMG_SET_BANK_CHANGE_CMD
      [0x01], // STATUS_REGISTER_MASK
      [0x01], // STATUS_REGISTER_VALUE
    ]);
    const client = new GbflashCommandClient(t.transport, fw14, { baudRate: 2_000_000 });
    await client.setFlashCmd('AGB', FLASH_COMMAND_SET.AMD, FLASH_METHOD.UNBUFFERED, FLASH_WE_PIN.UNSET, [
      [0xAAA, 0xAA],
      [0x555, 0x55],
      [0xAAA, 0xA0],
    ]);

    const pkt = t.sent[0];
    expect(pkt.length).toBe(40);
    expect(pkt.slice(0, 4)).toEqual([
      GBFLASH_CMD.SET_FLASH_CMD,
      FLASH_COMMAND_SET.AMD,
      FLASH_METHOD.UNBUFFERED,
      FLASH_WE_PIN.UNSET,
    ]);
    // Entry 0: 0xAAA >> 1 = 0x555, val = 0x00AA
    expect(pkt.slice(4, 10)).toEqual([0x00, 0x00, 0x05, 0x55, 0x00, 0xAA]);
    // Entry 1: 0x555 >> 1 = 0x2AA, val = 0x0055
    expect(pkt.slice(10, 16)).toEqual([0x00, 0x00, 0x02, 0xAA, 0x00, 0x55]);
    // Entry 2: 0xAAA >> 1 = 0x555, val = 0x00A0
    expect(pkt.slice(16, 22)).toEqual([0x00, 0x00, 0x05, 0x55, 0x00, 0xA0]);
    // Entries 3..5 zero-padded (18 bytes)
    expect(pkt.slice(22, 40)).toEqual(new Array(18).fill(0));
  });

  it('fails fast on first mismatching 0x20000 chunk and locates exact byte offset', async () => {
    const data = new Uint8Array(GBFLASH_CRC32_CHUNK_SIZE + 16);
    data[5] = 0x7F;
    const actualChunk0 = new Uint8Array(GBFLASH_CRC32_CHUNK_SIZE);
    actualChunk0[5] = 0xFF;
    const expectedCrc0 = crc32(data.subarray(0, GBFLASH_CRC32_CHUNK_SIZE)) >>> 0;
    const actualCrc0 = crc32(actualChunk0) >>> 0;
    const u32be = (v: number) => [(v >>> 24) & 0xFF, (v >>> 16) & 0xFF, (v >>> 8) & 0xFF, v & 0xFF];

    const fw14 = makeFwInfo({ family: 'gbflash', pcbVer: 13, fwVer: 14 });
    const t = createScriptedTransport([
      [0x01], // ADDRESS 0
      u32be(actualCrc0), // CALC_CRC32 chunk 0 mismatch!
      // Immediately reads back chunk 0 to find exact byte offset:
      [0x01], // TRANSFER_SIZE
      [0x01], // ADDRESS
      actualChunk0, // readRom 0x20000
    ]);
    const client = new GbflashCommandClient(t.transport, fw14, { baudRate: 2_000_000 });
    const res = await client.verifyRomCrc32('AGB', 0, data);

    expect(res).toEqual({
      matched: false,
      usedHardwareCrc: true,
      mismatchOffset: 5,
      expected: expectedCrc0,
      actual: actualCrc0,
      expectedByte: 0x7F,
      actualByte: 0xFF,
    });
    // Only 1 CALC_CRC32 sent; stopped before chunk 1
    const crcCmds = t.sent.filter(p => p[0] === GBFLASH_CMD.CALC_CRC32);
    expect(crcCmds.length).toBe(1);
  });

  it('skips buffer-aligned all-0xFF blocks when chunkLen < flashBufferSize', async () => {
    const fw14 = makeFwInfo({ family: 'gbflash', pcbVer: 13, fwVer: 14 });
    // 0x400 bytes: first 0x200 is all 0xFF (skipped!), second 0x200 is 0xAA (4x 0x80 chunks)
    const data = new Uint8Array(0x400);
    data.fill(0xFF, 0, 0x200);
    data.fill(0xAA, 0x200, 0x400);

    const t = createScriptedTransport([
      [0x01], // TRANSFER_SIZE (0x80)
      [0x01], // BUFFER_SIZE (0x200)
      [0x01], // ADDRESS (0x200 >> 1 = 0x100)
      [0x03], [0x03], [0x03], [0x01], // 4x 0x80 chunks
    ]);
    const client = new GbflashCommandClient(t.transport, fw14, { baudRate: 2_000_000 });
    const chunks: { written: number; skipped: boolean }[] = [];
    await client.writeFlashRom('AGB', 0x0000, data, 0x200, {
      maxLength: 0x80,
      onChunk: (written, skipped) => chunks.push({ written, skipped }),
    });

    expect(chunks[0]).toEqual({ written: 0x200, skipped: true });
    expect(chunks.slice(1)).toEqual([
      { written: 0x80, skipped: false },
      { written: 0x80, skipped: false },
      { written: 0x80, skipped: false },
      { written: 0x80, skipped: false },
    ]);
    // ADDRESS was set to 0x200 >> 1 = 0x100 (skipped first 0x200 block)
    expect(t.sent[2]).toEqual([
      GBFLASH_CMD.SET_VARIABLE, 4, 0, 0, 0, 0x00, 0x00, 0x00, 0x01, 0x00,
    ]);
  });

  it('splits CH340 GBFlash FLASH_PROGRAM payloads into 32-byte (0x20) sub-writes', async () => {
    const fw14 = makeFwInfo({ fwVer: 14, isCdc: false });
    const payload = new Uint8Array(0x80).fill(0x5A); // 2x 0x40 chunks
    const t = createScriptedTransport([
      [0x01], // TRANSFER_SIZE
      [0x01], // ADDRESS
      [0x03], // chunk 0 continue ACK
      [0x01], // chunk 1 done ACK
    ]);
    const client = new GbflashCommandClient(t.transport, fw14, { baudRate: 2_000_000 });
    await client.writeFlashRom('AGB', 0x0000, payload, 0, { maxLength: 0x40 });

    // Chunk 0: [0xD3, ...64B] = 65 bytes -> 32 + 32 + 1 sub-writes
    // Chunk 1: [64B] (continue ACK 0x03) -> 32 + 32 sub-writes
    const subWrites = t.sent.slice(2);
    expect(subWrites.map(s => s.length)).toEqual([32, 32, 1, 32, 32]);
    expect(subWrites[0][0]).toBe(GBFLASH_CMD.FLASH_PROGRAM);
    const reassembled = subWrites.flat();
    expect(reassembled.length).toBe(1 + 0x80);
  });
});

describe('GBFlash framing layer & buffer limit matrix', () => {
  it('computes buffer limits for CH340 and CDC GBFlash', () => {
    expect(computeGbflashBufferLimits({ family: 'gbflash', isCdc: false }, 2_000_000)).toEqual({
      maxRead: 0x1000,
      maxWrite: 0x80,
    });
    expect(computeGbflashBufferLimits({ family: 'gbflash', isCdc: true }, 2_000_000)).toEqual({
      maxRead: 0x1000,
      maxWrite: 0x400,
    });
  });

  it('forwards direct transport read/write and resets buffers', async () => {
    const t = createScriptedTransport([[0xDE, 0xAD]]);
    const framing = new GbflashFramingLayer(t.transport);

    await framing.write(new Uint8Array([0xA1]), 500);
    expect(t.sent[0]).toEqual([0xA1]);

    const read = await framing.read(2, 500);
    expect(Array.from(read)).toEqual([0xDE, 0xAD]);

    await framing.resetBuffers();
    expect(t.flushInput).toHaveBeenCalledTimes(1);
    expect(t.flushOutput).toHaveBeenCalledTimes(1);
  });
});

describe('GBFlash session mutex & AbortSignal cancellation', () => {
  it('serializes concurrent multi-step transactions and aborts cleanly', async () => {
    const fw14 = makeFwInfo({ fwVer: 14 });
    const t = createScriptedTransport([]);
    const client = new GbflashCommandClient(t.transport, fw14);
    const order: string[] = [];

    const p1 = client.mutex.run(async () => {
      order.push('tx1:start');
      await new Promise(r => setTimeout(r, 15));
      order.push('tx1:end');
      return 1;
    });

    const p2 = client.mutex.run(() => {
      order.push('tx2:start');
      order.push('tx2:end');
      return Promise.resolve(2);
    });

    expect(await Promise.all([p1, p2])).toEqual([1, 2]);
    expect(order).toEqual(['tx1:start', 'tx1:end', 'tx2:start', 'tx2:end']);

    const ac = new AbortController();
    ac.abort();
    await expect(client.readRom('AGB', 0, 16, { signal: ac.signal })).rejects.toBeInstanceOf(GbflashProtocolError);
  });
});
