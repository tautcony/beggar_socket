import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import CartBurner from '@/components/CartBurner.vue';
import CartridgeToolsModal from '@/components/modal/CartridgeToolsModal.vue';
import DebugToolModal from '@/components/modal/DebugToolModal.vue';
import { GBFLASH_FIRMWARE_PROFILE, STM_FIRMWARE_PROFILE } from '@/device/compat/firmware-profile';
import { GBFLASH_CMD } from '@/protocol/gbflash';
import { ppbUnlockGBA, ppbUnlockMBC5, readRTC, rumbleTest, setRTC } from '@/services/tool-functions';
import type { DeviceInfo } from '@/types/device-info';

import { buildGbflashSession, buildStmSession } from '../helpers/session-profile';

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
  createI18n: () => ({
    global: {
      t: (key: string) => key,
    },
  }),
}));

function createGbflashDevice(): {
  device: DeviceInfo;
  sendMock: ReturnType<typeof vi.fn>;
  setSignalsMock: ReturnType<typeof vi.fn>;
} {
  const sendMock = vi.fn(() => Promise.resolve(true));
  const setSignalsMock = vi.fn(() => Promise.resolve(undefined));
  const transport = {
    send: sendMock,
    read: vi.fn(() => Promise.resolve({ data: new Uint8Array(0) })),
    sendAndReceive: vi.fn(() => Promise.resolve({ data: new Uint8Array(0) })),
    setSignals: setSignalsMock,
    flushInput: vi.fn(() => Promise.resolve(undefined)),
    flushOutput: vi.fn(() => Promise.resolve(undefined)),
  };
  return {
    device: {
      port: null,
      connection: null,
      transport,
      connectionId: 'gbflash-session',
      firmwareProfile: {
        ...GBFLASH_FIRMWARE_PROFILE,
        label: 'GBFlash',
        firmwareVersion: 'L14',
      },
      session: buildGbflashSession(),
    },
    sendMock,
    setSignalsMock,
  };
}

describe('GBFlash operation guards', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('instantiates GBFlash GBA and MBC adapters in CartBurner with no DTR/RTS on resetCommandBuffer', async () => {
    const { device, setSignalsMock } = createGbflashDevice();
    const wrapper = mount(CartBurner, {
      props: {
        device,
        deviceReady: true,
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
        stubs: {
          RetroButton: true,
          RetroCard: { template: '<div><slot /><slot name="header" /></div>' },
          RetroSegmented: true,
          ChipOperations: true,
          RomOperations: true,
          RamOperations: true,
          DeviceSettingModal: true,
          FileNameSelectorModal: true,
          MultiCartResultModal: true,
          ProgressDisplayModal: true,
          CartridgeToolsModal: true,
          LogViewer: true,
          EmulatorModal: true,
        },
      },
    });
    await nextTick();

    const vm = wrapper.vm as unknown as {
      gbaAdapter: {
        id: string;
        resetCommandBuffer: () => Promise<void>;
      } | null;
      mbc5Adapter: { id: string } | null;
    };

    expect(vm.gbaAdapter?.id).toBe('cartridge:gbflash-gba');
    expect(vm.mbc5Adapter?.id).toBe('cartridge:gbflash-mbc');

    await vm.gbaAdapter?.resetCommandBuffer();
    expect(setSignalsMock).not.toHaveBeenCalled();
  });

  it('keeps stm/stc adapter instantiation unchanged', async () => {
    const { device } = createGbflashDevice();
    device.firmwareProfile = STM_FIRMWARE_PROFILE;
    device.session = buildStmSession();

    const wrapper = mount(CartBurner, {
      props: {
        device,
        deviceReady: true,
      },
      global: {
        mocks: { $t: (key: string) => key },
        stubs: {
          RetroButton: true,
          RetroCard: { template: '<div><slot /><slot name="header" /></div>' },
          RetroSegmented: true,
          ChipOperations: true,
          RomOperations: true,
          RamOperations: true,
          DeviceSettingModal: true,
          FileNameSelectorModal: true,
          MultiCartResultModal: true,
          ProgressDisplayModal: true,
          CartridgeToolsModal: true,
          LogViewer: true,
          EmulatorModal: true,
        },
      },
    });
    await nextTick();

    const vm = wrapper.vm as unknown as {
      gbaAdapter: { id: string } | null;
      mbc5Adapter: { id: string } | null;
    };
    expect(vm.gbaAdapter?.id).toBe('cartridge:gba');
    expect(vm.mbc5Adapter?.id).toBe('cartridge:mbc5');
  });

  it('drops the adapters of the previous connection when the session is replaced', async () => {
    const { device } = createGbflashDevice();

    const wrapper = mount(CartBurner, {
      props: { device, deviceReady: true },
      global: {
        mocks: { $t: (key: string) => key },
        stubs: {
          RetroButton: true,
          RetroCard: { template: '<div><slot /><slot name="header" /></div>' },
          RetroSegmented: true,
          ChipOperations: true,
          RomOperations: true,
          RamOperations: true,
          DeviceSettingModal: true,
          FileNameSelectorModal: true,
          MultiCartResultModal: true,
          ProgressDisplayModal: true,
          CartridgeToolsModal: true,
          LogViewer: true,
          EmulatorModal: true,
        },
      },
    });
    await nextTick();

    const vm = wrapper.vm as unknown as { gbaAdapter: { id: string } | null };
    expect(vm.gbaAdapter?.id).toBe('cartridge:gbflash-gba');

    // A reconnect publishes a new connectionId: the old GBFlash adapters must not survive.
    await wrapper.setProps({
      device: {
        ...device,
        connectionId: 'reconnected-session',
        firmwareProfile: STM_FIRMWARE_PROFILE,
        session: buildStmSession(),
      },
    });
    await nextTick();

    expect(vm.gbaAdapter?.id).toBe('cartridge:gba');
  });

  it('syncs GBFlash mode and lets the manual 5V switch override a 3.3V DMG profile', async () => {
    const sentPackets: number[][] = [];
    const device = createGbflashDevice().device;
    // Every safety command needs one ACK before the next one is allowed out.
    device.transport = {
      send: vi.fn((data: Uint8Array) => {
        sentPackets.push(Array.from(data));
        return Promise.resolve(true);
      }),
      read: vi.fn(() => Promise.resolve({ data: new Uint8Array([0x01]) })),
      sendAndReceive: vi.fn(() => Promise.resolve({ data: new Uint8Array([0x01]) })),
      setSignals: vi.fn(() => Promise.resolve(undefined)),
      flushInput: vi.fn(() => Promise.resolve(undefined)),
      flushOutput: vi.fn(() => Promise.resolve(undefined)),
    };

    const wrapper = mount(CartBurner, {
      props: { device, deviceReady: true },
      global: {
        mocks: { $t: (key: string) => key },
        stubs: {
          RetroButton: true,
          RetroCard: { template: '<div><slot /><slot name="header" /></div>' },
          RetroSegmented: true,
          ChipOperations: true,
          RomOperations: true,
          RamOperations: true,
          DeviceSettingModal: true,
          FileNameSelectorModal: true,
          MultiCartResultModal: true,
          ProgressDisplayModal: true,
          CartridgeToolsModal: true,
          LogViewer: true,
          EmulatorModal: true,
        },
      },
    });
    await nextTick();

    const vm = wrapper.vm as unknown as {
      mode: 'GBA' | 'MBC5';
      flashcartProfiles: { id: string; voltage: number; type: string }[];
    };
    await vi.waitFor(() => {
      expect(vm.flashcartProfiles.some(profile => profile.type === 'AGB')).toBe(true);
    });
    vm.mode = 'MBC5';
    await nextTick();
    await flushPromises();

    // Mode sync is a method of the adapter, not of the protocol-session wrapper, so this
    // asserts the component hands the real adapter to the binding's strategy.
    expect(sentPackets.some(p => p[0] === GBFLASH_CMD.CART_PWR_OFF)).toBe(true);
    expect(sentPackets.some(p => p[0] === GBFLASH_CMD.SET_VOLTAGE_3_3V)).toBe(true);

    const dmgProfile = await vi.waitFor(() => {
      const match = vm.flashcartProfiles.find(profile => profile.type === 'DMG' && profile.voltage === 3.3);
      if (!match) {
        throw new Error('Expected a 3.3V DMG profile');
      }
      return match;
    });
    const chipOperations = wrapper.getComponent({ name: 'ChipOperations' }).vm as unknown as {
      $emit: (event: 'flashcart-profile-change' | 'mbc-power-change', value: string | boolean) => void;
    };
    chipOperations.$emit('flashcart-profile-change', dmgProfile.id);
    await flushPromises();

    sentPackets.length = 0;
    chipOperations.$emit('mbc-power-change', true);
    await flushPromises();
    expect(sentPackets).toContainEqual([GBFLASH_CMD.SET_VOLTAGE_5V]);

    sentPackets.length = 0;
    chipOperations.$emit('mbc-power-change', false);
    await flushPromises();
    expect(sentPackets).toContainEqual([GBFLASH_CMD.SET_VOLTAGE_3_3V]);
    wrapper.unmount();
  });

  it('drops the CFI geometry when the flashcart profile changes', async () => {
    const { device } = createGbflashDevice();
    const wrapper = mount(CartBurner, {
      props: { device, deviceReady: true },
      global: {
        mocks: { $t: (key: string) => key },
        stubs: {
          RetroButton: true,
          RetroCard: { template: '<div><slot /><slot name="header" /></div>' },
          RetroSegmented: true,
          ChipOperations: true,
          RomOperations: true,
          RamOperations: true,
          DeviceSettingModal: true,
          FileNameSelectorModal: true,
          MultiCartResultModal: true,
          ProgressDisplayModal: true,
          CartridgeToolsModal: true,
          LogViewer: true,
          EmulatorModal: true,
        },
      },
    });
    await nextTick();

    const vm = wrapper.vm as unknown as {
      cfiInfo: unknown;
      chipId: unknown;
      onFlashcartProfileChange: (profileId: string) => void;
    };
    vm.cfiInfo = { eraseSectorBlocks: [{ sectorSize: 0x10000, sectorCount: 4 }] };
    vm.chipId = [0x01, 0x7E];

    vm.onFlashcartProfileChange('other-profile');

    // The old geometry belonged to the previous command set; erase/write must re-read it.
    expect(vm.cfiInfo).toBeNull();
    expect(vm.chipId).toBeUndefined();
  });

  it('blocks ChisFlash-only ppbUnlock functions on gbflash devices without touching transport', async () => {
    const { device, sendMock, setSignalsMock } = createGbflashDevice();

    await expect(ppbUnlockGBA(device)).rejects.toThrow(/no PPB unlock command/i);
    await expect(ppbUnlockMBC5(device)).rejects.toThrow(/no PPB unlock command/i);

    expect(sendMock).not.toHaveBeenCalled();
    expect(setSignalsMock).not.toHaveBeenCalled();
  });

  it('routes GBFlash readRTC, setRTC, and rumbleTest through LK_Device commands with zero DTR/RTS and zero ChisFlash bytes', async () => {
    vi.useFakeTimers();
    try {
      const sentPackets: number[][] = [];
      const rxQueue: number[] = [];
      const setSignalsMock = vi.fn(() => Promise.resolve(undefined));

      let transferSize = 2;
      let lastAddress = 0;
      let gpioEnabled = false;
      let awaitingSramByte = false;
      let selectedMbc3Reg = 0;
      const mbc3Regs: Record<number, number> = {
        0x08: 15, // sec
        0x09: 42, // min
        0x0a: 11, // hour
        0x0b: 5, // day low
        0x0c: 0, // day high
      };
      // S3511 read sequence for GBA setRTC: status (0x40 = 24h mode, battery ok)
      const s3511ReadBits = [
        0, 0, 0, 0, 0, 0, 1, 0, // 0x40 LSB-first
      ];
      let s3511BitIndex = 0;
      let lastGpioOut = 0;

      const transport = {
        send: vi.fn((data: Uint8Array) => {
          const bytes = Array.from(data);
          sentPackets.push(bytes);
          if (awaitingSramByte) {
            awaitingSramByte = false;
            mbc3Regs[selectedMbc3Reg] = bytes[0];
            rxQueue.push(0x01);
            return Promise.resolve(true);
          }

          const cmd = bytes[0];
          switch (cmd) {
            case GBFLASH_CMD.QUERY_CART_PWR:
              rxQueue.push(0x00);
              break;
            case GBFLASH_CMD.AGB_READ_GPIO_RTC:
              rxQueue.push(0x01, 0x26, 0x11, 0x22, 0x05, 0x13, 0x30, 0x00);
              break;
            case GBFLASH_CMD.SET_VARIABLE: {
              const size = bytes[1];
              const key = ((bytes[2] << 24) | (bytes[3] << 16) | (bytes[4] << 8) | bytes[5]) >>> 0;
              const val = ((bytes[6] << 24) | (bytes[7] << 16) | (bytes[8] << 8) | bytes[9]) >>> 0;
              if (size === 2 && key === 0x00 && val > 0) {
                transferSize = val;
              }
              if (size === 4 && key === 0x00) {
                lastAddress = val;
              }
              rxQueue.push(0x01);
              break;
            }
            case GBFLASH_CMD.AGB_CART_READ: {
              if (transferSize === 6) {
                const marker = gpioEnabled ? 0x02 : 0x00;
                rxQueue.push(marker, 0, 0, 0, 0, 0);
              } else {
                const bit = s3511ReadBits[s3511BitIndex % s3511ReadBits.length] ? 0x02 : 0x00;
                s3511BitIndex++;
                rxQueue.push(bit, 0x00);
              }
              break;
            }
            case GBFLASH_CMD.AGB_CART_WRITE: {
              const wordAddr = ((bytes[1] << 24) | (bytes[2] << 16) | (bytes[3] << 8) | bytes[4]) >>> 0;
              const val = ((bytes[5] << 8) | bytes[6]) & 0xFFFF;
              if (wordAddr === (0xc8 >>> 1)) {
                gpioEnabled = (val & 0x01) !== 0;
              }
              if (wordAddr === (0xc4 >>> 1)) {
                lastGpioOut = val;
              }
              rxQueue.push(0x01);
              break;
            }
            case GBFLASH_CMD.DMG_CART_WRITE: {
              const addr = ((bytes[1] << 24) | (bytes[2] << 16) | (bytes[3] << 8) | bytes[4]) >>> 0;
              const val = bytes[5];
              if (addr === 0x4000) {
                selectedMbc3Reg = val;
              }
              rxQueue.push(0x01);
              break;
            }
            case GBFLASH_CMD.DMG_CART_READ: {
              if (lastAddress === 0xa000) {
                rxQueue.push(mbc3Regs[selectedMbc3Reg] ?? 0);
              } else {
                rxQueue.push(0x00);
              }
              break;
            }
            case GBFLASH_CMD.DMG_CART_WRITE_SRAM:
              awaitingSramByte = true;
              break;
            default:
              rxQueue.push(0x01);
              break;
          }
          return Promise.resolve(true);
        }),
        read: vi.fn((length: number) => {
          const out = new Uint8Array(Math.min(length, rxQueue.length));
          for (let i = 0; i < out.length; i++) {
            out[i] = rxQueue.shift() ?? 0;
          }
          return Promise.resolve({ data: out });
        }),
        sendAndReceive: vi.fn(() => Promise.resolve({ data: new Uint8Array(0) })),
        setSignals: setSignalsMock,
        flushInput: vi.fn(() => Promise.resolve(undefined)),
        flushOutput: vi.fn(() => Promise.resolve(undefined)),
      };

      const device: DeviceInfo = {
        port: null,
        connection: null,
        transport,
        // Tool availability is a session capability, so the fixture carries the session.
        session: buildGbflashSession(),
        firmwareProfile: {
          ...GBFLASH_FIRMWARE_PROFILE,
          label: 'GBFlash',
          firmwareVersion: 'L14',
        },
        gbflashInfo: {
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
        },
      };

      // 1. GBA readRTC (native 0xCA)
      const gbaRead = await readRTC(device, 'GBA');
      expect(gbaRead.status).toBe(true);
      expect(gbaRead.time?.toFormat('yyyy-MM-dd HH:mm:ss')).toBe('2026-11-22 13:30:00');
      expect(sentPackets.some(p => p[0] === GBFLASH_CMD.AGB_READ_GPIO_RTC)).toBe(true);

      // 2. GBA setRTC
      await setRTC(device, 'GBA', {
        year: 26,
        month: 11,
        date: 22,
        day: 0,
        hour: 14,
        minute: 45,
        second: 10,
      });
      expect(sentPackets.some(p => p[0] === GBFLASH_CMD.AGB_CART_WRITE)).toBe(true);

      // 3. MBC3 setRTC & readRTC
      await setRTC(device, 'MBC3', { day: 12, hour: 9, minute: 8, second: 7 });
      const mbc3Read = await readRTC(device, 'MBC3');
      expect(mbc3Read.status).toBe(true);
      expect(mbc3Read.time?.hour).toBe(9);
      expect(mbc3Read.time?.minute).toBe(8);
      expect(mbc3Read.time?.second).toBe(7);
      expect(sentPackets.some(p => p[0] === GBFLASH_CMD.DMG_CART_WRITE_SRAM)).toBe(true);
      expect(sentPackets.some(p => p[0] === GBFLASH_CMD.DMG_CART_READ)).toBe(true);

      // 4. GBA rumbleTest
      const rumblePromise = rumbleTest(device);
      await vi.advanceTimersByTimeAsync(500);
      await rumblePromise;
      expect(lastGpioOut).toBe(0x00);

      // Zero DTR/RTS and zero ChisFlash commands (0xAA/0x55/0x02/0x03/0x12/0x13)
      expect(setSignalsMock).not.toHaveBeenCalled();
      expect(sentPackets.some(p => p[0] === 0x55 || p[0] === 0xaa)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('disables DebugToolModal send button and enables GBFlash RTC/rumble buttons while keeping PPB unlock disabled in CartridgeToolsModal', () => {
    const { device } = createGbflashDevice();

    const debugWrapper = mount(DebugToolModal, {
      props: { modelValue: true, device },
      global: {
        mocks: { $t: (key: string) => key },
        stubs: {
          RetroModal: { props: ['modelValue'], template: '<div v-if="modelValue"><slot /></div>' },
          RetroBadge: true,
          RetroSelect: { template: '<select><slot /></select>' },
          RetroButton: {
            props: ['disabled', 'text'],
            template: '<button :disabled="disabled">{{ text }}</button>',
          },
        },
      },
    });
    const debugButtons = debugWrapper.findAll('button');
    expect((debugButtons[0].element as HTMLButtonElement).disabled).toBe(true);

    const toolsWrapper = mount(CartridgeToolsModal, {
      props: { isVisible: true, device },
      global: {
        mocks: { $t: (key: string) => key },
        stubs: {
          RetroModal: { props: ['modelValue'], template: '<div v-if="modelValue"><slot /></div>' },
          RetroSegmented: true,
          RTCModal: true,
          RetroButton: {
            props: ['disabled', 'text'],
            template: '<button :disabled="disabled">{{ text }}</button>',
          },
        },
      },
    });
    const toolButtons = toolsWrapper.findAll('button');
    expect(toolButtons.length).toBe(7);
    // 4 RTC buttons + 1 rumble button are enabled; 2 PPB unlock buttons remain disabled
    for (let i = 0; i < 5; i++) {
      expect((toolButtons[i].element as HTMLButtonElement).disabled).toBe(false);
    }
    expect((toolButtons[5].element as HTMLButtonElement).disabled).toBe(true);
    expect((toolButtons[6].element as HTMLButtonElement).disabled).toBe(true);
  });
});
