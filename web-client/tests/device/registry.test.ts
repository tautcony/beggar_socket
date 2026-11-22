import { describe, expect, it } from 'vitest';

import {
  BEGGAR_STM_PACKET_LIMITS,
  createDeviceCatalog,
  createDeviceRegistry,
  type DeviceDefinition,
  type DeviceFirmwareBinding,
  type FirmwareDefinition,
  VARIANT_IDS,
} from '@/device';

const TEST_HARDWARE = {
  cartVoltages: ['5V'],
  cartPowerControl: 'none',
  modeSwitch: 'none',
  cartPresenceDetect: false,
  audioWePin: false,
} as const;

function testDevice(id: string): DeviceDefinition {
  return { id, displayName: id, hardware: TEST_HARDWARE };
}

function testFirmware(id: string): FirmwareDefinition {
  return {
    id,
    displayName: id,
    protocol: 'beggar',
    baseCapabilities: {},
    parameters: () => [],
  };
}

function testBinding(overrides: Partial<DeviceFirmwareBinding> = {}): DeviceFirmwareBinding {
  return {
    id: 'test-variant',
    deviceId: 'test-device',
    firmwareId: 'test.firmware',
    discoveryFilters: [{ vendorId: '0483', productId: '0721' }],
    identityMatchers: [{ id: 'test', vendorId: '0483', productId: '0721' }],
    transport: {
      signalInit: 'dtr-rts-pulse',
      packetLimits: BEGGAR_STM_PACKET_LIMITS,
      maxReadChunk: 0x1000,
    },
    parameterNamespace: 'test.ns',
    runtimeBindingId: 'test' as DeviceFirmwareBinding['runtimeBindingId'],
    ...overrides,
  };
}

describe('device registry', () => {
  const catalog = createDeviceCatalog({ platform: 'windows' });

  function bindingById(id: string): DeviceFirmwareBinding {
    const found = catalog.listBindings().find(item => item.id === id);
    if (!found) {
      throw new Error(`missing binding ${id}`);
    }
    return found;
  }

  it('lists the four selectable variants', () => {
    const variants = catalog.listSelectable();
    expect(variants.map(variant => variant.variantId)).toEqual([
      VARIANT_IDS.stm,
      VARIANT_IDS.stmBoost,
      VARIANT_IDS.stc,
      VARIANT_IDS.gbflash,
    ]);
    expect(variants[0].deviceName).toBe('丐中丐');
    expect(variants[3].firmwareName).toBe('FlashGBX');
  });

  it('resolves device, firmware, runtime and namespace from one binding', () => {
    const selection = catalog.selectVariant(VARIANT_IDS.gbflash);
    expect(selection.device.id).toBe('gbflash');
    expect(selection.firmware.id).toBe('flashgbx.cfw');
    expect(selection.runtimeBindingId).toBe('flashgbx');
    expect(selection.parameterNamespace).toBe('flashgbx.cfw');
    expect(selection.transport.signalInit).toBe('none');
  });

  it('shares the STM parameter namespace and runtime binding with Boost', () => {
    const stm = catalog.selectVariant(VARIANT_IDS.stm);
    const boost = catalog.selectVariant(VARIANT_IDS.stmBoost);
    expect(boost.parameterNamespace).toBe(stm.parameterNamespace);
    expect(boost.runtimeBindingId).toBe(stm.runtimeBindingId);
    expect(stm.transport.maxReadChunk).toBe(0x1000);
    expect(boost.transport.maxReadChunk).toBe(0x2000);
    expect(boost.firmware.id).not.toBe(stm.firmware.id);
  });

  it('rejects unknown variants instead of falling back', () => {
    expect(() => catalog.selectVariant('nope')).toThrow(/not registered/);
    expect(catalog.findVariant('nope')).toBeUndefined();
  });

  it('classifies USB identity per binding', () => {
    const stm = bindingById(VARIANT_IDS.stm);
    const stc = bindingById(VARIANT_IDS.stc);
    const gbflash = bindingById(VARIANT_IDS.gbflash);

    expect(catalog.matchPort(stm, { path: '/dev/stm', vendorId: '0483', productId: '0721' })).toBe('match');
    expect(catalog.matchPort(stc, { path: '/dev/rc31', vendorId: '0483', productId: '5740' })).toBe('match');
    // 0483:5740 stays a mismatch for the other Beggar variants (manual candidate only).
    expect(catalog.matchPort(stm, { path: '/dev/rc31', vendorId: '0483', productId: '5740' })).toBe('mismatch');
    expect(catalog.matchPort(gbflash, { path: '/dev/ch340', vendorId: '1a86', productId: '7523' })).toBe('match');
    expect(catalog.matchPort(gbflash, { path: '/dev/stm', vendorId: '0483', productId: '0721' })).toBe('mismatch');
    expect(catalog.matchPort(gbflash, { path: 'web-serial' })).toBe('unknown');
    expect(catalog.matchPort(gbflash, null)).toBe('unknown');
  });

  it('exposes host filterable vendor/product ids', () => {
    expect(catalog.forUsbFilters(bindingById(VARIANT_IDS.gbflash))).toEqual([
      { usbVendorId: 0x1a86, usbProductId: 0x7523 },
      { usbVendorId: 0x16c0, usbProductId: 0x27dd },
    ]);
  });

  it('resolves namespace schemas with host defaults and firmware ceilings', () => {
    const beggar = catalog.resolveNamespaceSchema('beggar.stm');
    expect(beggar?.schema.map(descriptor => descriptor.key)).toEqual([
      'romPageSize',
      'romReadPageSize',
      'ramPageSize',
    ]);
    expect(beggar?.transport.maxReadChunk).toBe(0x2000);

    const stc = catalog.resolveNamespaceSchema('beggar.stc');
    expect(stc?.schema.find(descriptor => descriptor.key === 'romReadPageSize')?.default).toBe(0x2000);
    expect(stc?.transport.maxReadChunk).toBe(0x8000);

    const flashgbx = catalog.resolveNamespaceSchema('flashgbx.cfw');
    expect(flashgbx?.schema.find(descriptor => descriptor.key === 'baudRate')?.default).toBe('auto');
    expect(flashgbx?.transport.maxReadChunk).toBe(0x100);
    expect(catalog.resolveNamespaceSchema('unknown.ns')).toBeUndefined();
  });

  it('derives host defaults from the resolved platform', () => {
    const macos = createDeviceCatalog({ platform: 'macos' });
    const schema = macos.resolveNamespaceSchema('beggar.stm')?.schema;
    expect(schema?.find(descriptor => descriptor.key === 'romReadPageSize')?.default).toBe(0x0c00);
  });
});

describe('registry registration guards', () => {
  it('rejects duplicate ids and unknown references before mutating state', () => {
    const registry = createDeviceRegistry({ platform: 'windows' });
    registry.register(testDevice('test-device'), [testFirmware('test.firmware')], [testBinding()]);

    expect(() => { registry.register(testDevice('test-device'), [], []); }).toThrow(/duplicate device id/);
    expect(() => { registry.register(testDevice('other'), [testFirmware('test.firmware')], []); }).toThrow(
      /duplicate firmware id/,
    );
    expect(() => { registry.register(testDevice('other'), [testFirmware('other.firmware')], [testBinding({ deviceId: 'other' })]); },
    ).toThrow(/duplicate variant id/);

    const fresh = createDeviceRegistry({ platform: 'windows' });
    expect(() => { fresh.register(testDevice('d'), [testFirmware('f')], [testBinding({ deviceId: 'd', firmwareId: 'missing' })]); }).toThrow(
      /unknown firmware/,
    );
    expect(() => { fresh.register(testDevice('d'), [testFirmware('f')], [testBinding({ deviceId: 'missing-device' })]); },
    ).toThrow(/unknown device/);
    // A failed registration leaves nothing behind.
    expect(fresh.listBindings()).toHaveLength(0);
  });

  it('rejects bindings without a runtime binding id or parameter namespace', () => {
    const registry = createDeviceRegistry({ platform: 'windows' });
    expect(() => {
      registry.register(
        testDevice('d'),
        [testFirmware('f')],
        [testBinding({ runtimeBindingId: '' as DeviceFirmwareBinding['runtimeBindingId'] })],
      );
    },
    ).toThrow(/runtimeBindingId/);
    expect(() => { registry.register(testDevice('d'), [testFirmware('f')], [testBinding({ parameterNamespace: '' })]); },
    ).toThrow(/parameterNamespace/);
  });

  it('rejects namespace groups that disagree on packet limits', () => {
    const registry = createDeviceRegistry({ platform: 'windows' });
    const conflicting = testBinding({
      transport: {
        signalInit: 'dtr-rts-pulse',
        packetLimits: {
          ...BEGGAR_STM_PACKET_LIMITS,
          windows: { romWrite: 0x800, romRead: 0x800, ramPage: 0x800 },
        },
        maxReadChunk: 0x1000,
      },
    });
    expect(() => {
      registry.register(
        testDevice('test-device'),
        [testFirmware('test.firmware')],
        [testBinding(), { ...conflicting, id: 'test-variant-2' }],
      );
    },
    ).toThrow(/packetLimits/);
  });
});
