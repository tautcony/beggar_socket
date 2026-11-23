import { afterEach, describe, expect, it, vi } from 'vitest';

import { FLASHGBX_FIRMWARE_PROFILE } from '@/device/compat/firmware-profile';
import type { Transport } from '@/platform/serial';
import {
  FLASHGBX_CMD,
  FlashgbxCommandClient,
  type FlashgbxFirmwareInfo,
} from '@/protocol/flashgbx';
import { FlashgbxGbaAdapter } from '@/services/flashgbx-gba-adapter';
import { FlashgbxMbcAdapter } from '@/services/flashgbx-mbc-adapter';
import { AdvancedSettings } from '@/settings/advanced-settings';
import type { DeviceInfo } from '@/types/device-info';
import { crc32 } from '@/utils/crc-utils';
import type { CFIInfo } from '@/utils/parsers/cfi-parser';

function makeFwInfo(overrides: Partial<FlashgbxFirmwareInfo> = {}): FlashgbxFirmwareInfo {
  return {
    family: 'gbflash',
    cfwId: 'L',
    fwVer: 14,
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

function createScriptedDevice(
  fwInfo: FlashgbxFirmwareInfo,
  readChunks: (number[] | Uint8Array)[],
) {
  const sent: number[][] = [];
  const queue = readChunks.map(c => (c instanceof Uint8Array ? c : new Uint8Array(c)));
  const setSignals = vi.fn(() => Promise.resolve(undefined));

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
    flushInput: vi.fn(() => Promise.resolve(undefined)),
    flushOutput: vi.fn(() => Promise.resolve(undefined)),
    readAvailable: vi.fn(() => Promise.resolve({ data: new Uint8Array(0) })),
  };

  const device: DeviceInfo = {
    port: null,
    connection: null,
    transport,
    firmwareProfile: { ...FLASHGBX_FIRMWARE_PROFILE, label: fwInfo.pcbName },
    flashgbxInfo: fwInfo,
  };

  const client = new FlashgbxCommandClient(transport, fwInfo, { baudRate: 2_000_000 });
  return { device, client, sent, setSignals };
}

function buildValidCfiBytes(): Uint8Array {
  const cfi = new Uint8Array(0x100);
  // QRY at 0x20, 0x22, 0x24
  cfi[0x20] = 0x51;
  cfi[0x22] = 0x52;
  cfi[0x24] = 0x59;
  cfi[0x2A] = 0x02; // AMD PRI
  cfi[0x4E] = 0x16; // 2^22 = 4MB
  cfi[0x54] = 0x05; // 2^5 = 32B buffer
  cfi[0x58] = 0x01; // 1 erase region
  // 32 sectors of 128KB (0x200 * 256 = 0x20000)
  cfi[0x5A] = 0x1F; // 31 -> 32 sectors
  cfi[0x5C] = 0x00;
  cfi[0x5E] = 0x00;
  cfi[0x60] = 0x02;
  return cfi;
}

const dummyCfi: CFIInfo = {
  flashId: new Uint8Array([0x01, 0x7E]),
  magic: 'QRY',
  dataSwap: null,
  cfiDetected: true,
  isSwapD0D1: false,
  isIntel: false,
  vddMin: 2.7,
  vddMax: 3.6,
  singleWrite: true,
  bufferWrite: false,
  sectorErase: true,
  chipErase: true,
  deviceSize: 0x100000,
  tbBootSector: 'None',
  tbBootSectorRaw: 0,
  eraseSectorRegions: 1,
  reverseSectorRegion: false,
  eraseSectorBlocks: [{ sectorSize: 0x20000, sectorCount: 8, totalSize: 0x100000, startAddress: 0, endAddress: 0x100000 }],
  info: '',
};

describe('FlashgbxGbaAdapter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('never pulses DTR/RTS and reads GBA ID/CFI + GPIO RTC', async () => {
    const fw14 = makeFwInfo({ fwVer: 14 });
    const cfiBytes = buildValidCfiBytes();
    const { device, client, setSignals } = createScriptedDevice(fw14, [
      [0x00, 0x00, 0x00, 0x00], // AUTO_POWEROFF_ENABLED = 0
      [0x01], [0x01], [0x01], [0x01], [0x01], [0x01], // setMode AGB
      [0x00], [0x01], [0x01], [0x01], [0x01], // cartPowerOn (QUERY=0, SET_MODE, PWR_ON, QUERY=1, BOOTUP)
      [0x01], // CART_WRITE_FLASH_CMD F0
      [0x01], // CART_WRITE_FLASH_CMD 90
      [0x01], [0x01], // readRom ID setup
      [0x00, 0x01, 0x22, 0x7E, 0, 0, 0, 0], // ID bytes
      [0x01], // reset F0
      [0x01], // CFI 98
      [0x01], [0x01], // readRom CFI setup
      cfiBytes, // 0x100 CFI
      [0x01], // reset F0
    ]);

    const adapter = new FlashgbxGbaAdapter(device, null, null, null, client);
    await adapter.resetCommandBuffer();
    const info = await adapter.getCartInfo(false);
    if (!info) {
      throw new Error(`getCartInfo failed: ${adapter.getLastCartInfoError()}`);
    }

    expect(setSignals).not.toHaveBeenCalled();
    expect(info).not.toBe(false);
    if (info) {
      expect(info.cfiDetected).toBe(true);
      expect(info.deviceSize).toBe(0x400000);
    }
  });

  it('supports GBA ROM read, CRC32 verify, and EEPROM/Flash RAM read', async () => {
    const fw14 = makeFwInfo({ fwVer: 14 });
    const romData = new Uint8Array([0x10, 0x20, 0x30, 0x40]);
    const romCrc = crc32(romData) >>> 0;
    const u32be = [(romCrc >>> 24) & 0xFF, (romCrc >>> 16) & 0xFF, (romCrc >>> 8) & 0xFF, romCrc & 0xFF];

    const { device, client } = createScriptedDevice(fw14, [
      // readROM
      [0x00, 0x00, 0x00, 0x00], // AUTO_POWEROFF_ENABLED = 0
      [0x01], [0x01], [0x01], [0x01], [0x01], [0x01], // setMode
      [0x01], // QUERY_CART_PWR = 1 (already on)
      [0x01], [0x01], // readRom TRANSFER_SIZE, ADDRESS
      romData,
      [0x01], // restore TRANSFER_SIZE
      // verifyROM
      [0x00, 0x00, 0x00, 0x00],
      [0x01], [0x01], [0x01], [0x01], [0x01], [0x01],
      [0x01],
      [0x01], // ADDRESS
      u32be, // CALC_CRC32
    ]);

    const progressEvents: { showProgress?: boolean; totalBytes?: number; state?: string }[] = [];
    const logs: { msg: string; level: string }[] = [];
    const adapter = new FlashgbxGbaAdapter(
      device,
      (msg, level) => logs.push({ msg: typeof msg === 'string' ? msg : msg.message, level }),
      info => progressEvents.push(info),
      null,
      client,
    );
    const readRes = await adapter.readROM(4, { cfiInfo: dummyCfi });
    expect(readRes.message).toBe('Read 4 B');
    expect(readRes.success).toBe(true);
    expect(Array.from(readRes.data ?? [])).toEqual([0x10, 0x20, 0x30, 0x40]);
    expect(progressEvents.length).toBeGreaterThanOrEqual(2);
    expect(progressEvents[0]).toMatchObject({ showProgress: true, totalBytes: 4, state: 'running' });
    expect(progressEvents[progressEvents.length - 1]).toMatchObject({ showProgress: true, totalBytes: 4, state: 'completed' });
    expect(logs.some(e => e.msg === 'messages.operation.startReadROM')).toBe(true);
    expect(logs.some(e => e.msg === 'messages.rom.readSummary')).toBe(true);

    const ac = new AbortController();
    const verifyRes = await adapter.verifyROM(romData, { cfiInfo: dummyCfi }, ac.signal);
    expect(verifyRes.success).toBe(true);
    expect(logs.some(e => e.msg === 'messages.operation.startVerifyROM')).toBe(true);
    expect(logs.some(e => e.msg === 'messages.rom.verifySummary')).toBe(true);
  });

  it('sizes a CART_READ from the saved FlashGBX read page instead of forcing 0x1000', () => {
    class ChunkProbe extends FlashgbxGbaAdapter {
      chunk(): number {
        return this.getReadChunkLimit();
      }
    }

    const { device, client } = createScriptedDevice(makeFwInfo({ fwVer: 14 }), []);
    const adapter = new ChunkProbe(device, null, null, null, client);

    // Default: one read fills the declared 4 KiB firmware buffer.
    expect(adapter.chunk()).toBe(0x1000);

    // A saved smaller page must reach the wire: this is what users change on flaky CH340s.
    AdvancedSettings.setNamespaceSize('flashgbx.cfw', 'romReadPageSize', 0x80);
    adapter.beginOperation();
    expect(adapter.chunk()).toBe(0x80);

    AdvancedSettings.setNamespaceSize('flashgbx.cfw', 'romReadPageSize', 0x200);
    adapter.beginOperation();
    expect(adapter.chunk()).toBe(0x200);

    // The device buffer stays the ceiling even when the schema allows a bigger value.
    AdvancedSettings.setNamespaceSize('flashgbx.cfw', 'romReadPageSize', 0x2000);
    adapter.beginOperation();
    expect(adapter.chunk()).toBe(0x1000);

    AdvancedSettings.resetToDefaults();
  });

  it('reports detailed byte/CRC mismatch and sets error progress state in verifyROM', async () => {
    const fw14 = makeFwInfo({ fwVer: 14 });
    const expectedRom = new Uint8Array([0x7F, 0x00, 0x00, 0xEA]);
    const actualRom = new Uint8Array([0xFF, 0x00, 0x00, 0xEA]);
    const actualCrc = crc32(actualRom) >>> 0;
    const u32be = [(actualCrc >>> 24) & 0xFF, (actualCrc >>> 16) & 0xFF, (actualCrc >>> 8) & 0xFF, actualCrc & 0xFF];

    const { device, client } = createScriptedDevice(fw14, [
      [0x00, 0x00, 0x00, 0x00], // AUTO_POWEROFF_ENABLED = 0
      [0x01], [0x01], [0x01], [0x01], [0x01], [0x01], // setMode AGB
      [0x01], // QUERY_CART_PWR = 1
      [0x01], // ADDRESS 0
      u32be, // CALC_CRC32 mismatch
      [0x01], [0x01], // readRom TRANSFER_SIZE, ADDRESS
      actualRom,
      [0x01], // restore TRANSFER_SIZE
    ]);

    const events: { state?: string; showProgress?: boolean; detail?: string }[] = [];
    const adapter = new FlashgbxGbaAdapter(device, null, info => events.push(info), null, client);
    const res = await adapter.verifyROM(expectedRom, { cfiInfo: dummyCfi }, new AbortController().signal);

    expect(res.success).toBe(false);
    expect(res.message).toContain('expected=0x7F, actual=0xFF');
    expect(res.message).toContain('crc expected=');
    expect(events[events.length - 1]).toMatchObject({ state: 'error', showProgress: true });
  });
});

describe('FlashgbxMbcAdapter & Task 2.3 cleanup/keep-alive', () => {
  it('restores voltage/power and AUTO_POWEROFF_TIME on cancellation/failure', async () => {
    const fw14 = makeFwInfo({ fwVer: 14, cartPowerCtrl: true });
    const { device, client, sent } = createScriptedDevice(fw14, [
      [0x00, 0x00, 0x00, 0x01], // AUTO_POWEROFF_ENABLED = 1
      [0x00, 0x00, 0x0B, 0xB8], // AUTO_POWEROFF_TIME = 3000
      [0x01], // SET_VAR AUTO_POWEROFF_TIME = 5000
      [0x01], [0x01], [0x01], [0x01], [0x01], // setMode DMG
      [0x01], // QUERY_CART_PWR = 1
      // Now inside readROM -> abort!
      // Cleanup: DMG_MBC_RESET, CART_PWR_OFF, SET_VOLTAGE_3_3V, restore AUTO_POWEROFF_TIME
      [0x01], [0x01], [0x01], [0x01],
    ]);

    const adapter = new FlashgbxMbcAdapter(device, null, null, null, client);
    const ac = new AbortController();
    // Abort right after setMode begins by passing an already-aborted signal to readRom
    // First test pre-aborted signal returns cancelled
    ac.abort();
    const res = await adapter.readROM(64, { cfiInfo: dummyCfi, enable5V: true }, ac.signal);
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('cancelled');

    // Test failure inside transaction triggers restoreVoltageAndPower + leaveAutoPowerOffKeepAlive
    const ac2 = new AbortController();
    const res2 = await adapter.readROM(64, { cfiInfo: dummyCfi, enable5V: true }, ac2.signal);
    // Will fail on read timeout since queue is exhausted after setup, triggering cleanup
    expect(res2.success).toBe(false);
    const opcodes = sent.map(p => p[0]);
    expect(opcodes).toContain(FLASHGBX_CMD.DMG_MBC_RESET);
    expect(opcodes).toContain(FLASHGBX_CMD.CART_PWR_OFF);
    expect(opcodes).toContain(FLASHGBX_CMD.SET_VOLTAGE_3_3V);
    // Verify AUTO_POWEROFF_TIME was set to 600000 on entry and restored to 3000 on exit
    const autoPowerOffSets = sent.filter(
      p => p[0] === FLASHGBX_CMD.SET_VARIABLE && p[1] === 4 && p[5] === 0x01,
    );
    expect(autoPowerOffSets.length).toBe(2);
  });

  it('handles GBA FLASH_512K Atmel 0x1F3D (no erase, mode 2) vs non-Atmel (erase+poll, mode 1)', async () => {
    const fw14 = makeFwInfo({ fwVer: 14 });
    const saveData = new Uint8Array([0x11, 0x22, 0x33, 0x44]);

    // 1) Atmel 0x1F3D: ID=0x1F, 0x3D -> skips chip erase, uses [AGB_CART_WRITE_FLASH_DATA, 2]
    const tAtmel = createScriptedDevice(fw14, [
      [0x00, 0x00, 0x00, 0x00], // AUTO_POWEROFF_ENABLED = 0
      [0x01], [0x01], [0x01], [0x01], [0x01], [0x01], // setMode AGB
      [0x01], // QUERY_CART_PWR = 1
      [0x01], // CART_WRITE_FLASH_CMD 90
      [0x01], [0x01], [0x1F], [0x01], // cartRead 0x0000 -> 0x1F
      [0x01], [0x01], [0x3D], [0x01], // cartRead 0x0001 -> 0x3D
      [0x01], // CART_WRITE_FLASH_CMD F0
      [0x01], [0x01], [0x01], // writeRam TRANSFER_SIZE, ADDRESS, data ACK
    ]);
    const atmelAdapter = new FlashgbxGbaAdapter(tAtmel.device, null, null, null, tAtmel.client);
    const atmelRes = await atmelAdapter.writeRAM(saveData, { cfiInfo: dummyCfi, ramType: 'FLASH' });
    expect(atmelRes.success).toBe(true);
    const atmelWriteCmd = tAtmel.sent.find(p => p[0] === FLASHGBX_CMD.AGB_CART_WRITE_FLASH_DATA);
    expect(atmelWriteCmd).toEqual([FLASHGBX_CMD.AGB_CART_WRITE_FLASH_DATA, 2]);
    // Only 2 CART_WRITE_FLASH_CMD calls (ID + F0), no chip erase!
    expect(tAtmel.sent.filter(p => p[0] === FLASHGBX_CMD.CART_WRITE_FLASH_CMD).length).toBe(2);

    // 2) Non-Atmel 0xC21C: erases chip + polls 0xFF, uses [AGB_CART_WRITE_FLASH_DATA, 1]
    const tMacronix = createScriptedDevice(fw14, [
      [0x00, 0x00, 0x00, 0x00],
      [0x01], [0x01], [0x01], [0x01], [0x01], [0x01],
      [0x01],
      [0x01], // ID 90
      [0x01], [0x01], [0xC2], [0x01], // 0xC2
      [0x01], [0x01], [0x1C], [0x01], // 0x1C
      [0x01], // F0
      [0x01], // chip erase 80..10
      [0x01], [0x01], [0xFF], [0x01], // poll 0x0000 -> 0xFF
      [0x01], [0x01], [0x01], // writeRam
    ]);
    const macronixAdapter = new FlashgbxGbaAdapter(tMacronix.device, null, null, null, tMacronix.client);
    const macronixRes = await macronixAdapter.writeRAM(saveData, { cfiInfo: dummyCfi, ramType: 'FLASH' });
    expect(macronixRes.success).toBe(true);
    const macronixWriteCmd = tMacronix.sent.find(p => p[0] === FLASHGBX_CMD.AGB_CART_WRITE_FLASH_DATA);
    expect(macronixWriteCmd).toEqual([FLASHGBX_CMD.AGB_CART_WRITE_FLASH_DATA, 1]);
    expect(tMacronix.sent.filter(p => p[0] === FLASHGBX_CMD.CART_WRITE_FLASH_CMD).length).toBe(3);
  });

  it('aborts the save write when the Flash chip erase never confirms', async () => {
    const fw14 = makeFwInfo({ fwVer: 14 });
    const saveData = new Uint8Array([0x11, 0x22, 0x33, 0x44]);
    const neverErased = createScriptedDevice(fw14, [
      [0x00, 0x00, 0x00, 0x00], // AUTO_POWEROFF_ENABLED = 0
      [0x01], [0x01], [0x01], [0x01], [0x01], [0x01], // setMode AGB
      [0x01], // QUERY_CART_PWR = 1
      [0x01], // CART_WRITE_FLASH_CMD 90
      [0x01], [0x01], [0xC2], [0x01], // ID 0xC2
      [0x01], [0x01], [0x1C], [0x01], // ID 0x1C
      [0x01], // CART_WRITE_FLASH_CMD F0
      [0x01], // chip erase
      ...[0, 1, 2, 3, 4].flatMap(() => [[0x01], [0x01], [0x00], [0x01]]), // never 0xFF
    ]);
    const adapter = new FlashgbxGbaAdapter(neverErased.device, null, null, null, neverErased.client);

    // The 15s poll budget is wall-clock based; advance the clock instead of waiting.
    let clock = 0;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => (clock += 5_000));
    try {
      const result = await adapter.writeRAM(saveData, { cfiInfo: dummyCfi, ramType: 'FLASH' });
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/timeout/i);
    } finally {
      nowSpy.mockRestore();
    }

    // An unconfirmed erase must never be followed by a programming command.
    expect(neverErased.sent.some(p => p[0] === FLASHGBX_CMD.AGB_CART_WRITE_FLASH_DATA)).toBe(false);
  });

  it('switches 32 MiB GBA ROM banks across 0x02000000 and restores bank 0', async () => {
    const fw14 = makeFwInfo({ fwVer: 14 });
    const bank0Tail = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const bank1Head = new Uint8Array([0xA1, 0xA2, 0xA3, 0xA4]);
    const { device, client, sent } = createScriptedDevice(fw14, [
      [0x00, 0x00, 0x00, 0x00], // AUTO_POWEROFF_ENABLED = 0
      [0x01], [0x01], [0x01], [0x01], [0x01], [0x01], // setMode AGB
      [0x01], // QUERY_CART_PWR = 1
      // switchROMBank(0): 2x writeRam (TRANSFER_SIZE, ADDRESS, 1B write)
      [0x01], [0x01], [0x01],
      [0x01], [0x01], [0x01],
      // readRom bank 0 (4B at 0x01FFFFFC)
      [0x01], [0x01], bank0Tail, [0x01],
      // switchROMBank(1): 2x writeRam
      [0x01], [0x01], [0x01],
      [0x01], [0x01], [0x01],
      // readRom bank 1 (4B at 0x00000000)
      [0x01], [0x01], bank1Head, [0x01],
      // finally switchROMBank(0): 2x writeRam
      [0x01], [0x01], [0x01],
      [0x01], [0x01], [0x01],
    ]);

    const adapter = new FlashgbxGbaAdapter(device, null, null, null, client);
    const largeCfi: CFIInfo = { ...dummyCfi, deviceSize: 0x08000000 };
    const res = await adapter.readROM(8, { cfiInfo: largeCfi, baseAddress: 0x01FFFFFC });

    expect(res.success).toBe(true);
    expect(Array.from(res.data ?? [])).toEqual([0x01, 0x02, 0x03, 0x04, 0xA1, 0xA2, 0xA3, 0xA4]);
    // Verify bank 1 switch wrote 0x10 and 0x40 via AGB_CART_WRITE_SRAM (0xC4)
    const sramWrites = sent.filter(p => p[0] === FLASHGBX_CMD.AGB_CART_WRITE_SRAM);
    expect(sramWrites.length).toBe(6);
    expect(sent.some(p => p.length === 1 && p[0] === 0x10)).toBe(true);
    expect(sent.some(p => p.length === 1 && p[0] === 0x40)).toBe(true);
  });

  it('syncHardwareMode safely updates mode and LEDs without CART_PWR_ON or 5V', async () => {
    const fw14 = makeFwInfo({ fwVer: 14, cartPowerCtrl: true });
    const { device, client, sent } = createScriptedDevice(fw14, [
      // MBC5: CART_PWR_OFF, SET_VOLTAGE_3_3V, SET_MODE_DMG, CART_MODE=1
      [0x01], [0x01], [0x01], [0x01],
      // GBA: CART_PWR_OFF, SET_VOLTAGE_3_3V, SET_MODE_AGB, CART_MODE=2
      [0x01], [0x01], [0x01], [0x01],
    ]);

    const adapter = new FlashgbxGbaAdapter(device, null, null, null, client);
    await adapter.syncHardwareMode('MBC5');
    await adapter.syncHardwareMode('GBA');

    const opcodes = sent.map(p => p[0]);
    expect(opcodes).toContain(FLASHGBX_CMD.CART_PWR_OFF);
    expect(opcodes).toContain(FLASHGBX_CMD.SET_VOLTAGE_3_3V);
    expect(opcodes).toContain(FLASHGBX_CMD.SET_MODE_DMG);
    expect(opcodes).toContain(FLASHGBX_CMD.SET_MODE_AGB);
    expect(opcodes).not.toContain(FLASHGBX_CMD.CART_PWR_ON);
    expect(opcodes).not.toContain(FLASHGBX_CMD.SET_VOLTAGE_5V);
  });

  it('emits sectorProgress during eraseSectors and multi-bank writeROM', async () => {
    const fw14 = makeFwInfo({ fwVer: 14 });
    const eraseEvents: { sectorProgress?: { totalSectors: number; completedSectors: number; stateBuffer: Uint8Array } }[] = [];
    const sectorCfi: CFIInfo = {
      ...dummyCfi,
      deviceSize: 0x40000,
      eraseSectorBlocks: [{ sectorSize: 0x20000, sectorCount: 2, totalSize: 0x40000, startAddress: 0, endAddress: 0x40000 }],
    };

    const tErase = createScriptedDevice(fw14, [
      [0x00, 0x00, 0x00, 0x00], // AUTO_POWEROFF_ENABLED = 0
      [0x01], [0x01], [0x01], [0x01], [0x01], [0x01], // setMode AGB
      [0x01], // QUERY_CART_PWR = 1
      // sector 0 CALC_CRC32 (non-blank): setVariable ADDRESS, read 4B CRC32
      [0x01], [0x00, 0x00, 0x00, 0x01],
      // sector 0 erase: CART_WRITE_FLASH_CMD, poll x2 (0xFFFF), reset F0
      [0x01],
      [0x01], [0x01], [0xFF, 0xFF], [0x01],
      [0x01], [0x01], [0xFF, 0xFF], [0x01],
      [0x01],
      // sector 1 erase: CART_WRITE_FLASH_CMD, poll x2 (0xFFFF), reset F0
      [0x01],
      [0x01], [0x01], [0xFF, 0xFF], [0x01],
      [0x01], [0x01], [0xFF, 0xFF], [0x01],
      [0x01],
    ]);

    const eraseAdapter = new FlashgbxGbaAdapter(
      tErase.device,
      null,
      info => eraseEvents.push(info),
      null,
      tErase.client,
    );
    const eraseRes = await eraseAdapter.eraseSectors(
      [{ sectorSize: 0x20000, sectorCount: 1, totalSize: 0x20000, startAddress: 0, endAddress: 0x20000 }],
      { cfiInfo: sectorCfi },
    );
    expect(eraseRes.success).toBe(true);
    const initialSector = eraseEvents[0]?.sectorProgress;
    const finalSector = eraseEvents[eraseEvents.length - 1]?.sectorProgress;
    expect(initialSector?.totalSectors).toBe(1);
    expect(initialSector?.stateBuffer[0]).toBe(4); // pending_erase
    expect(finalSector?.completedSectors).toBe(1);
    expect(finalSector?.stateBuffer[0]).toBe(6); // erased

    // Multi-bank writeROM across 0x02000000 auto-erases target sectors, emits sliced sectorProgress, and logs startWriteROM params
    const writeEvents: { sectorProgress?: { totalSectors: number; completedSectors: number; stateBuffer: Uint8Array } }[] = [];
    const writeLogs: { key: string; params?: Record<string, unknown> }[] = [];
    const payload = new Uint8Array([0xAA, 0xBB, 0xCC, 0xDD, 0x11, 0x22, 0x33, 0x44]);
    const tWrite = createScriptedDevice(fw14, [
      // 1) Auto-erase (2 sectors across 0x01FFFFFC..0x02000004):
      [0x00, 0x00, 0x00, 0x00], // AUTO_POWEROFF_ENABLED = 0
      [0x01], [0x01], [0x01], [0x01], [0x01], [0x01], // setMode AGB
      [0x01], // QUERY_CART_PWR = 1
      // switchROMBank(0): 2x writeRam
      [0x01], [0x01], [0x01], [0x01], [0x01], [0x01],
      // sector 0 CALC_CRC32 (non-blank)
      [0x01], [0x00, 0x00, 0x00, 0x01],
      // sector 0 erase: CART_WRITE_FLASH_CMD, poll x2 (0xFFFF), reset F0
      [0x01],
      [0x01], [0x01], [0xFF, 0xFF], [0x01],
      [0x01], [0x01], [0xFF, 0xFF], [0x01],
      [0x01],
      // switchROMBank(1): 2x writeRam
      [0x01], [0x01], [0x01], [0x01], [0x01], [0x01],
      // sector 1 CALC_CRC32 (non-blank)
      [0x01], [0x00, 0x00, 0x00, 0x01],
      // sector 1 erase: CART_WRITE_FLASH_CMD, poll x2 (0xFFFF), reset F0
      [0x01],
      [0x01], [0x01], [0xFF, 0xFF], [0x01],
      [0x01], [0x01], [0xFF, 0xFF], [0x01],
      [0x01],
      // finally switchROMBank(0): 2x writeRam
      [0x01], [0x01], [0x01], [0x01], [0x01], [0x01],
      // 2) Program:
      [0x00, 0x00, 0x00, 0x00], // AUTO_POWEROFF_ENABLED = 0
      [0x01], [0x01], [0x01], [0x01], [0x01], [0x01], // setMode AGB
      [0x01], // QUERY_CART_PWR = 1
      // SET_FLASH_CMD + FLASH_COMMANDS_BANK_1 + DMG_SET_BANK_CHANGE_CMD + SR_MASK + SR_VALUE
      [0x01], [0x01], [0x01], [0x01], [0x01],
      // switchROMBank(0): 2x writeRam
      [0x01], [0x01], [0x01], [0x01], [0x01], [0x01],
      // writeFlashRom bank 0 (4B)
      [0x01], [0x01], [0x01],
      // switchROMBank(1): 2x writeRam
      [0x01], [0x01], [0x01], [0x01], [0x01], [0x01],
      // writeFlashRom bank 1 (4B)
      [0x01], [0x01], [0x01],
      // finally switchROMBank(0): 2x writeRam
      [0x01], [0x01], [0x01], [0x01], [0x01], [0x01],
      // single resetFlashToRead at end
      [0x01],
    ]);
    const writeAdapter = new FlashgbxGbaAdapter(
      tWrite.device,
      null,
      info => writeEvents.push(info),
      (key, params) => {
        writeLogs.push({ key, params: params as Record<string, unknown> | undefined });
        return key;
      },
      tWrite.client,
    );
    const largeCfi: CFIInfo = {
      ...dummyCfi,
      deviceSize: 0x08000000,
      eraseSectorBlocks: [{ sectorSize: 0x20000, sectorCount: 1024, totalSize: 0x08000000, startAddress: 0, endAddress: 0x08000000 }],
    };
    const writeRes = await writeAdapter.writeROM(payload, { cfiInfo: largeCfi, baseAddress: 0x01FFFFFC });
    expect(writeRes.success).toBe(true);
    const finalWriteSector = writeEvents[writeEvents.length - 1]?.sectorProgress;
    // Sliced to the 2 target sectors instead of all 1024 chip sectors
    expect(finalWriteSector?.totalSectors).toBe(2);
    expect(finalWriteSector?.completedSectors).toBe(2);
    expect(finalWriteSector?.stateBuffer[0]).toBe(2); // completed
    const startWriteLog = writeLogs.find(e => e.key === 'messages.operation.startWriteROM');
    expect(startWriteLog?.params).toMatchObject({ fileSize: 8, pageSize: 0x80, bufferSize: 0 });
    // Auto-erase ran (CART_WRITE_FLASH_CMD 0xD4 x2 for 2 sectors) before FLASH_PROGRAM (0xD3)
    const firstEraseCmdIdx = tWrite.sent.findIndex(p => p[0] === FLASHGBX_CMD.CART_WRITE_FLASH_CMD);
    const firstProgramCmdIdx = tWrite.sent.findIndex(p => p[0] === FLASHGBX_CMD.FLASH_PROGRAM);
    expect(firstEraseCmdIdx).toBeGreaterThanOrEqual(0);
    expect(firstProgramCmdIdx).toBeGreaterThan(firstEraseCmdIdx);
  });

  it('skips erasing blank sectors whose CALC_CRC32 matches all-0xFF', async () => {
    const fw14 = makeFwInfo({ fwVer: 14 });
    const events: { sectorProgress?: { totalSectors: number; completedSectors: number; stateBuffer: Uint8Array } }[] = [];
    const sectorCfi: CFIInfo = {
      ...dummyCfi,
      deviceSize: 0x80000, // > totalBytes (0x40000) so sector-by-sector erase runs instead of full-chip erase
      eraseSectorBlocks: [{ sectorSize: 0x20000, sectorCount: 4, totalSize: 0x80000, startAddress: 0, endAddress: 0x80000 }],
    };

    const t = createScriptedDevice(fw14, [
      [0x00, 0x00, 0x00, 0x00], // AUTO_POWEROFF_ENABLED = 0
      [0x01], [0x01], [0x01], [0x01], [0x01], [0x01], // setMode AGB
      [0x01], // QUERY_CART_PWR = 1
      // sector 0 CALC_CRC32 -> 0x154803CC (all-0xFF for 0x20000) -> skip erase!
      [0x01], [0x15, 0x48, 0x03, 0xCC],
      // sector 1 CALC_CRC32 -> non-blank -> erase!
      [0x01], [0x00, 0x00, 0x00, 0x01],
      [0x01], // CART_WRITE_FLASH_CMD (0xD4)
      [0x01], [0x01], [0xFF, 0xFF], [0x01], // poll 1
      [0x01], [0x01], [0xFF, 0xFF], [0x01], // poll 2
      [0x01], // reset F0
    ]);

    const adapter = new FlashgbxGbaAdapter(
      t.device,
      null,
      info => events.push(info),
      null,
      t.client,
    );
    const res = await adapter.eraseSectors(
      [{ sectorSize: 0x20000, sectorCount: 2, totalSize: 0x40000, startAddress: 0, endAddress: 0x40000 }],
      { cfiInfo: sectorCfi },
    );

    expect(res.success).toBe(true);
    const eraseCmds = t.sent.filter(p => p[0] === FLASHGBX_CMD.CART_WRITE_FLASH_CMD);
    expect(eraseCmds).toHaveLength(1);
    const finalSector = events[events.length - 1]?.sectorProgress;
    expect(finalSector?.totalSectors).toBe(2);
    expect(finalSector?.completedSectors).toBe(2);
  });
});
