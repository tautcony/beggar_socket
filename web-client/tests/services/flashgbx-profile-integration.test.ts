import { afterEach, describe, expect, it, vi } from 'vitest';

import { FLASHGBX_FIRMWARE_PROFILE } from '@/device/compat/firmware-profile';
import { FLASH_WE_PIN, FlashgbxCommandClient, type FlashgbxFirmwareInfo } from '@/protocol';
import { FlashcartProfileService } from '@/services/flashcart-profile-service';
import { FlashgbxGbaAdapter } from '@/services/flashgbx-gba-adapter';
import { FlashgbxMbcAdapter } from '@/services/flashgbx-mbc-adapter';
import type { DeviceInfo } from '@/types/device-info';
import type { FlashcartProfile } from '@/types/flashcart-profile';

import { buildFlashgbxSession } from '../helpers/session-profile';

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
    bootloaderReset: false,
    hasDeviceSerial: false,
    unregistered: false,
    audioWePin: true,
    isCdc: false,
    ...overrides,
  };
}

function makeMockClient(
  fwInfo: FlashgbxFirmwareInfo,
  readRomHandler: (mode: 'DMG' | 'AGB', address: number, length: number) => Uint8Array,
) {
  const client = {
    fwInfo,
    bufferLimits: { maxRead: 0x1000, maxWrite: 0x1000 },
    framing: { isAckEnabled: false },
    mutex: {
      run: async <T>(fn: () => Promise<T>) => fn(),
    },
    resetChannel: vi.fn(() => Promise.resolve(undefined)),
    enterAutoPowerOffKeepAlive: vi.fn(() => Promise.resolve(null)),
    leaveAutoPowerOffKeepAlive: vi.fn(() => Promise.resolve(undefined)),
    setVariable: vi.fn((_name: string, _val: number) => Promise.resolve(undefined)),
    setMode: vi.fn(() => Promise.resolve(undefined)),
    cartPowerOff: vi.fn(() => Promise.resolve(undefined)),
    setVoltage: vi.fn(() => Promise.resolve(undefined)),
    dmgMbcReset: vi.fn(() => Promise.resolve(undefined)),
    cartRead: vi.fn((mode: 'DMG' | 'AGB') => Promise.resolve(mode === 'AGB' ? 0xFFFF : 0xFF)),
    cartWrite: vi.fn(() => Promise.resolve(undefined)),
    cartWriteFlash: vi.fn((
      _mode: 'DMG' | 'AGB',
      _cmds: readonly (readonly [number, number])[],
      _flashcart?: boolean,
    ) => Promise.resolve(undefined)),
    setFlashCmd: vi.fn(() => Promise.resolve(undefined)),
    writeFlashRom: vi.fn(() => Promise.resolve(undefined)),
    calcCrc32: vi.fn(() => Promise.resolve({ supported: false, chunkCrcs: [] })),
    readRom: vi.fn((mode: 'DMG' | 'AGB', address: number, length: number) =>
      Promise.resolve(readRomHandler(mode, address, length)),
    ),
  };

  const device: DeviceInfo = {
    port: null,
    connection: null,
    firmwareProfile: { ...FLASHGBX_FIRMWARE_PROFILE, label: fwInfo.pcbName, firmwareVersion: `L${fwInfo.fwVer}` },
    flashgbxInfo: fwInfo,
    // The committed session is what grants the flashcart database capability.
    session: buildFlashgbxSession({ flashgbxInfo: fwInfo }),
  };

  return { client: client as unknown as FlashgbxCommandClient, mocks: client, device };
}

const gbaProfileA: FlashcartProfile = {
  id: 'agb:test-non-cfi-a',
  sourceFile: 'fc_AGB_TestA.txt',
  type: 'AGB',
  names: ['Test Non-CFI GBA A'],
  voltage: 3.3,
  command_set: 'AMD',
  flash_ids: [[0x01, 0x00, 0x7E, 0x22]],
  flash_size: 0x100000,
  sector_size: [[0x20000, 8]],
  buffer_size: 32,
  commands: {
    reset: [[0x00, 0xF0]],
    read_identifier: [[0xAAA, 0xAA], [0x555, 0x55], [0xAAA, 0x90]],
    sector_erase: [[0xAAA, 0xAA], [0x555, 0x55], [0xAAA, 0x80], [0xAAA, 0xAA], [0x555, 0x55], ['SA', 0x30]],
    chip_erase: [[0xAAA, 0xAA], [0x555, 0x55], [0xAAA, 0x80], [0xAAA, 0xAA], [0x555, 0x55], [0xAAA, 0x10]],
    single_write: [[0xAAA, 0xAA], [0x555, 0x55], [0xAAA, 0xA0], ['PA', 'PD']],
    buffer_write: [[0xAAA, 0xAA], [0x555, 0x55], ['SA', 0x25], ['SA', 'BS'], ['PA', 'PD'], ['SA', 0x29]],
  },
};

const gbaProfileM29: FlashcartProfile = {
  ...gbaProfileA,
  id: 'agb:test-m29w640',
  sourceFile: 'fc_AGB_M29.txt',
  names: ['Test M29W640'],
  m29w640: true,
  flash_ids: [[0x20, 0x00, 0xED, 0x22]],
  commands: {
    ...gbaProfileA.commands,
    read_identifier: [[0xAAA, 0xAA], [0x555, 0x55], [0xAAA, 0x90]],
  },
};

const dmgAudioProfile: FlashcartProfile = {
  id: 'dmg:test-audio',
  sourceFile: 'fc_DMG_TestAudio.txt',
  type: 'DMG',
  names: ['Test DMG Audio Cart'],
  voltage: 5,
  write_pin: 'AUDIO',
  command_set: 'AMD',
  flash_ids: [[0xC2, 0xCB]],
  flash_size: 0x80000,
  sector_size: [[0x10000, 8]],
  commands: {
    reset: [[0x00, 0xF0]],
    read_identifier: [[0x555, 0xAA], [0x2AA, 0x55], [0x555, 0x90]],
    sector_erase: [[0x555, 0xAA], [0x2AA, 0x55], [0x555, 0x80], [0x555, 0xAA], [0x2AA, 0x55], ['SA', 0x30]],
    single_write: [[0x555, 0xAA], [0x2AA, 0x55], [0x555, 0xA0], ['PA', 'PD']],
  },
};

describe('FlashGBX non-CFI profile integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('auto-falls back to FlashcartProfileService when CFI is missing, probes m29w640 first, resets after each probe, and runs profile erase/write', async () => {
    vi.spyOn(FlashcartProfileService, 'loadByMode').mockResolvedValue([gbaProfileA, gbaProfileM29]);

    let inIdMode = false;
    const { client, mocks, device } = makeMockClient(makeFwInfo(), (_mode, _addr, length) => {
      if (inIdMode) {
        return new Uint8Array([0x01, 0x00, 0x7E, 0x22, 0, 0, 0, 0]).slice(0, length);
      }
      return new Uint8Array(length).fill(0x00); // No CFI "QRY"
    });

    mocks.cartWriteFlash.mockImplementation((_mode, cmds: readonly (readonly [number, number])[]) => {
      const last = cmds[cmds.length - 1];
      if (last?.[1] === 0x90) {
        inIdMode = true;
      } else if (last?.[1] === 0xF0 || last?.[1] === 0xFF) {
        inIdMode = false;
      }
      return Promise.resolve(undefined);
    });

    const adapter = new FlashgbxGbaAdapter(device, null, null, null, client);
    const info = await adapter.getCartInfo(false);
    expect(info).not.toBe(false);
    if (!info) return;

    expect(info.cfiDetected).toBe(false);
    expect(info.deviceSize).toBe(0x100000);
    expect(info.info).toContain('Test Non-CFI GBA A');

    // Verify reset was sent after each probe and at the end
    const flashCalls = mocks.cartWriteFlash.mock.calls.map(call => call[1]);
    expect(flashCalls.some(cmds => cmds?.[0]?.[1] === 0xF0)).toBe(true);
    expect(flashCalls[flashCalls.length - 1]).toEqual([[0, 0xFF], [0, 0xF0]]);

    // Erase & write using profile commands
    const eraseRes = await adapter.eraseSectors(
      [{ sectorSize: 0x20000, sectorCount: 1, totalSize: 0x20000, startAddress: 0, endAddress: 0x1FFFF }],
      { cfiInfo: info },
    );
    expect(eraseRes.success).toBe(true);
    expect(mocks.cartWriteFlash).toHaveBeenCalledWith(
      'AGB',
      [[0xAAA, 0xAA], [0x555, 0x55], [0xAAA, 0x80], [0xAAA, 0xAA], [0x555, 0x55], [0, 0x30]],
      true,
    );

    const writeRes = await adapter.writeROM(new Uint8Array([0x11, 0x22, 0x33, 0x44]), { cfiInfo: info });
    expect(writeRes.success).toBe(true);
    expect(mocks.setFlashCmd).toHaveBeenCalled();
    expect(mocks.writeFlashRom).toHaveBeenCalled();
  });

  it('returns profile_ambiguous with candidates when multiple profiles match Flash ID', async () => {
    const gbaProfileB: FlashcartProfile = {
      ...gbaProfileA,
      id: 'agb:test-non-cfi-b',
      sourceFile: 'fc_AGB_TestB.txt',
      names: ['Test Non-CFI GBA B'],
    };
    vi.spyOn(FlashcartProfileService, 'loadByMode').mockResolvedValue([gbaProfileA, gbaProfileB]);

    let inIdMode = false;
    const { client, mocks, device } = makeMockClient(makeFwInfo(), (_mode, _addr, length) => {
      if (inIdMode) {
        return new Uint8Array([0x01, 0x00, 0x7E, 0x22, 0, 0, 0, 0]).slice(0, length);
      }
      return new Uint8Array(length).fill(0x00);
    });
    mocks.cartWriteFlash.mockImplementation((_mode, cmds: readonly (readonly [number, number])[]) => {
      const last = cmds[cmds.length - 1];
      if (last?.[1] === 0x90) inIdMode = true;
      else if (last?.[1] === 0xF0 || last?.[1] === 0xFF) inIdMode = false;
      return Promise.resolve(undefined);
    });

    const adapter = new FlashgbxGbaAdapter(device, null, null, null, client);
    const info = await adapter.getCartInfo(false);
    expect(info).toBe(false);
    expect(adapter.getLastCartInfoErrorCode()).toBe('profile_ambiguous');
    const details = adapter.getLastCartInfoErrorDetails() as { candidates: { id: string }[] };
    expect(details.candidates.map(c => c.id)).toEqual(['agb:test-non-cfi-a', 'agb:test-non-cfi-b']);
  });

  it('returns profile_not_found when no profile matches', async () => {
    vi.spyOn(FlashcartProfileService, 'loadByMode').mockResolvedValue([gbaProfileA]);
    const { client, device } = makeMockClient(makeFwInfo(), (_m, _a, length) => new Uint8Array(length).fill(0x00));

    const adapter = new FlashgbxGbaAdapter(device, null, null, null, client);
    const info = await adapter.getCartInfo(false);
    expect(info).toBe(false);
    expect(adapter.getLastCartInfoErrorCode()).toBe('profile_not_found');
  });

  it('probes DMG WR then AUDIO we_pins and matches AUDIO-pin profile', async () => {
    vi.spyOn(FlashcartProfileService, 'loadByMode').mockResolvedValue([dmgAudioProfile]);

    let currentWePin: number = FLASH_WE_PIN.WR;
    let inIdMode = false;
    const { client, mocks, device } = makeMockClient(makeFwInfo({ audioWePin: true }), (_mode, _addr, length) => {
      if (inIdMode && currentWePin === FLASH_WE_PIN.AUDIO) {
        return new Uint8Array([0xC2, 0xCB, 0, 0, 0, 0, 0, 0]).slice(0, length);
      }
      return new Uint8Array(length).fill(0x00);
    });
    mocks.setVariable.mockImplementation((name: string, val: number) => {
      if (name === 'FLASH_WE_PIN') currentWePin = val;
      return Promise.resolve(undefined);
    });
    mocks.cartWriteFlash.mockImplementation((_mode, cmds: readonly (readonly [number, number])[]) => {
      const last = cmds[cmds.length - 1];
      if (last?.[1] === 0x90) inIdMode = true;
      else if (last?.[1] === 0xF0 || last?.[1] === 0xFF) inIdMode = false;
      return Promise.resolve(undefined);
    });

    const adapter = new FlashgbxMbcAdapter(device, null, null, null, client);
    const info = await adapter.getCartInfo(true);
    expect(info).not.toBe(false);
    if (info) {
      expect(info.info).toContain('Test DMG Audio Cart');
    }
    expect(mocks.setVariable).toHaveBeenCalledWith('FLASH_WE_PIN', FLASH_WE_PIN.WR);
    expect(mocks.setVariable).toHaveBeenCalledWith('FLASH_WE_PIN', FLASH_WE_PIN.AUDIO);
  });

  it('supports manual override and rejects unsupported AUDIO write_pin or 5V without power control', async () => {
    vi.spyOn(FlashcartProfileService, 'loadByMode').mockResolvedValue([dmgAudioProfile]);

    // 1. Unsupported audioWePin=false
    const { client: noAudioClient, device: noAudioDev } = makeMockClient(
      makeFwInfo({ audioWePin: false, cartPowerCtrl: true }),
      (_m, _a, len) => new Uint8Array(len),
    );
    const noAudioAdapter = new FlashgbxMbcAdapter(noAudioDev, null, null, null, noAudioClient);
    const res1 = await noAudioAdapter.getCartInfo(true, { flashcartProfileId: dmgAudioProfile.id });
    expect(res1).toBe(false);
    expect(noAudioAdapter.getLastCartInfoErrorCode()).toBe('unsupported');

    // 2. Voltage mismatch (5V profile when cartPowerCtrl=false)
    const dmgWr5vProfile: FlashcartProfile = { ...dmgAudioProfile, id: 'dmg:wr-5v', write_pin: 'WR' };
    vi.spyOn(FlashcartProfileService, 'loadByMode').mockResolvedValue([dmgWr5vProfile]);
    const { client: noPwrClient, device: noPwrDev } = makeMockClient(
      makeFwInfo({ audioWePin: false, cartPowerCtrl: false }),
      (_m, _a, len) => new Uint8Array(len),
    );
    const noPwrAdapter = new FlashgbxMbcAdapter(noPwrDev, null, null, null, noPwrClient);
    const res2 = await noPwrAdapter.getCartInfo(true, { flashcartProfileId: dmgWr5vProfile.id });
    expect(res2).toBe(false);
    expect(noPwrAdapter.getLastCartInfoErrorCode()).toBe('voltage_mismatch');

    // 3. Valid manual override skips auto-probing
    vi.spyOn(FlashcartProfileService, 'loadByMode').mockResolvedValue([dmgAudioProfile]);
    const { client: okClient, device: okDev } = makeMockClient(
      makeFwInfo({ audioWePin: true, cartPowerCtrl: true }),
      (_m, _a, len) => new Uint8Array(len),
    );
    const okAdapter = new FlashgbxMbcAdapter(okDev, null, null, null, okClient);
    const res3 = await okAdapter.getCartInfo(true, { flashcartProfileId: dmgAudioProfile.id });
    expect(res3).not.toBe(false);
    if (res3) {
      expect(res3.deviceSize).toBe(0x80000);
    }
  });
});
