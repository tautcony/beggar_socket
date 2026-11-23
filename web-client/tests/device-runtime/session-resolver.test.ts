import { describe, expect, it } from 'vitest';

import {
  createDeviceCatalog,
  createParameterStore,
  type ParameterStore,
  VARIANT_IDS,
} from '@/device';
import {
  createRuntimeComposition,
  createRuntimeCompositionRegistry,
  createSessionResolver,
  type FlashgbxProbeFacts,
  SessionResolutionError,
} from '@/device-runtime';
import type { FlashgbxFirmwareInfo } from '@/protocol/flashgbx';

import { createFakeSettingsStorage } from '../helpers/fake-settings-storage';

const registry = createDeviceCatalog({ platform: 'windows' });

function createStore(): ParameterStore {
  const fake = createFakeSettingsStorage();
  return createParameterStore({
    adapter: fake.adapter,
    platform: 'windows',
    schemas: { resolve: namespace => registry.resolveNamespaceSchema(namespace) },
  });
}

const resolver = createSessionResolver({ platform: 'windows', composition: createRuntimeComposition() });

function flashgbxInfo(overrides: Partial<FlashgbxFirmwareInfo> = {}): FlashgbxFirmwareInfo {
  return {
    family: 'gbflash',
    cfwId: 'L',
    fwVer: 8,
    pcbVer: 14,
    fwTs: 0,
    ofwVer: null,
    pcbName: 'GBFlash L14',
    cartPowerCtrl: true,
    cartPresenceSwitch: true,
    cartModeSwitch: true,
    bootloaderReset: true,
    hasDeviceSerial: true,
    unregistered: false,
    audioWePin: true,
    isCdc: false,
    ...overrides,
  };
}

describe('session resolver', () => {
  it('resolves an immutable profile for a standard STM session', () => {
    const selection = registry.selectVariant(VARIANT_IDS.stm);
    const profile = resolver.resolve(
      selection,
      { firmwareId: selection.firmware.id, verification: 'assumed', facts: {} },
      { backend: 'serial', usb: { vendorId: '0483', productId: '0721' } },
      createStore(),
    );

    expect(profile.variantId).toBe(VARIANT_IDS.stm);
    expect(profile.verification).toBe('assumed');
    expect(profile.capabilities.has('rom.write')).toBe(true);
    expect(profile.capabilities.has('ram.fram.gba')).toBe(true);
    expect(profile.capabilities.has('cart.powerControl')).toBe(false);
    expect(profile.transport.backend).toBe('serial');
    expect(profile.transport.platform).toBe('windows');
    expect(profile.transport.maxReadChunk).toBe(0x1000);
    expect(profile.transport.baudRate).toBeUndefined();
    expect(profile.transport.packetLimits.windows.romRead).toBe(0x1000);
    expect(profile.connectionParameters.romPageSize).toBe(0x1000);
    expect(profile.diagnostics).toEqual([]);
    expect(Object.isFrozen(profile)).toBe(true);
  });

  it('exposes the stored read page separately from the effective ceiling', () => {
    const stm = registry.selectVariant(VARIANT_IDS.stm);
    const boost = registry.selectVariant(VARIANT_IDS.stmBoost);
    const store = createStore();
    // One shared namespace: a Boost sized read page stays storable.
    store.set('beggar.stm', 'romReadPageSize', 0x2000);

    const stmProfile = resolver.resolve(
      stm,
      { firmwareId: stm.firmware.id, verification: 'assumed', facts: {} },
      { backend: 'serial' },
      store,
    );
    const boostProfile = resolver.resolve(
      boost,
      { firmwareId: boost.firmware.id, verification: 'verified', facts: {} },
      { backend: 'serial' },
      store,
    );

    expect(stmProfile.connectionParameters.romReadPageSize).toBe(0x2000);
    expect(stmProfile.transport.maxReadChunk).toBe(0x1000);
    expect(boostProfile.connectionParameters.romReadPageSize).toBe(0x2000);
    expect(boostProfile.transport.maxReadChunk).toBe(0x2000);
  });

  it('does not leak raw probe facts into the public session', () => {
    const selection = registry.selectVariant(VARIANT_IDS.gbflash);
    const probe: FlashgbxProbeFacts = {
      firmwareInfo: flashgbxInfo({ pcbName: 'GBFlash L14', cartPowerCtrl: false }),
    };
    const profile = resolver.resolve(
      selection,
      { firmwareId: selection.firmware.id, verification: 'verified', firmwareVersion: 'L8', facts: probe },
      { backend: 'serial' },
      createStore(),
    );

    expect(profile).not.toHaveProperty('facts');
    expect(profile).not.toHaveProperty('probe');
    expect(JSON.stringify(profile)).not.toContain('firmwareInfo');
    expect(profile.firmwareVersion).toBe('L8');
    expect(profile.display.title).toBe('GBFlash L14');
  });

  it('resolves GBFlash conditional capabilities from typed facts', () => {
    const selection = registry.selectVariant(VARIANT_IDS.gbflash);
    const withFacts = resolver.resolve(
      selection,
      { firmwareId: selection.firmware.id, verification: 'verified', facts: { firmwareInfo: flashgbxInfo() } },
      { backend: 'serial' },
      createStore(),
    );
    expect(withFacts.capabilities.has('cart.powerControl')).toBe(true);
    expect(withFacts.capabilities.has('cart.presenceDetect')).toBe(true);
    expect(withFacts.capabilities.has('cart.audioWePin')).toBe(true);
    expect(withFacts.transport.baudRate).toBe(2_000_000);

    const withoutFacts = resolver.resolve(
      selection,
      { firmwareId: selection.firmware.id, verification: 'verified', facts: {} },
      { backend: 'serial' },
      createStore(),
    );
    expect(withoutFacts.capabilities.has('cart.powerControl')).toBe(false);
    expect(withoutFacts.capabilities.has('cart.voltageSwitch')).toBe(true);
    // Already resolved snapshots keep their own values.
    expect(withFacts.capabilities.has('cart.powerControl')).toBe(true);
    expect(withoutFacts.display.warnings).toContain('This PCB has no cartridge power control');
  });

  it('keeps two connection snapshots isolated', () => {
    const selection = registry.selectVariant(VARIANT_IDS.stm);
    const first = resolver.resolve(
      selection,
      { firmwareId: selection.firmware.id, verification: 'assumed', facts: {} },
      { backend: 'serial' },
      createStore(),
    );

    const fake = createFakeSettingsStorage();
    fake.values.set('beggar.stm.romPageSize', 0x800);
    const second = resolver.resolve(
      selection,
      { firmwareId: selection.firmware.id, verification: 'assumed', facts: {} },
      { backend: 'serial' },
      createParameterStore({
        adapter: fake.adapter,
        platform: 'windows',
        schemas: { resolve: namespace => registry.resolveNamespaceSchema(namespace) },
      }),
    );

    expect(first.connectionParameters.romPageSize).toBe(0x1000);
    expect(second.connectionParameters.romPageSize).toBe(0x800);
  });

  it('rejects a probe that rewrites the firmware identity', () => {
    const selection = registry.selectVariant(VARIANT_IDS.stm);
    expect(() =>
      resolver.resolve(
        selection,
        { firmwareId: 'beggar.stc', verification: 'assumed', facts: {} },
        { backend: 'serial' },
        createStore(),
      ),
    ).toThrow(SessionResolutionError);
  });

  it('fails when the runtime binding is not registered', () => {
    const empty = createSessionResolver({ platform: 'windows', composition: createRuntimeCompositionRegistry() });
    const selection = registry.selectVariant(VARIANT_IDS.gbflash);
    expect(() =>
      empty.resolve(
        selection,
        { firmwareId: selection.firmware.id, verification: 'verified', facts: {} },
        { backend: 'serial' },
        createStore(),
      ),
    ).toThrow(/runtime binding flashgbx is not registered/);
  });

  it('records probe-skipped as a diagnostic for simulated backends', () => {
    const selection = registry.selectVariant(VARIANT_IDS.stc);
    const profile = resolver.resolve(
      selection,
      { firmwareId: selection.firmware.id, verification: 'not-applicable', facts: {} },
      { backend: 'simulated' },
      createStore(),
    );
    expect(profile.transport.backend).toBe('simulated');
    expect(profile.diagnostics).toEqual([
      expect.objectContaining({ code: 'probe-skipped', severity: 'info', stage: 'probe' }),
    ]);
  });
});

describe('session diagnostics', () => {
  const stm = registry.selectVariant(VARIANT_IDS.stm);

  function resolveStm(
    transportFacts: { backend: 'serial' | 'simulated'; usb?: { vendorId?: string; productId?: string } },
    probeDiagnostics?: readonly { code: string; severity: 'info' | 'warning' | 'error'; message: string; stage?: 'probe' }[],
  ) {
    return resolver.resolve(
      stm,
      {
        firmwareId: stm.firmware.id,
        verification: 'assumed',
        facts: {},
        ...(probeDiagnostics ? { diagnostics: probeDiagnostics } : {}),
      },
      transportFacts,
      createStore(),
    );
  }

  it('records a port mismatch as a transport warning without failing the session', () => {
    const profile = resolveStm({ backend: 'serial', usb: { vendorId: '1A86', productId: '7523' } });

    expect(profile.diagnostics).toHaveLength(1);
    expect(profile.diagnostics[0]).toEqual(expect.objectContaining({
      code: 'port-mismatch',
      severity: 'warning',
      stage: 'transport',
    }));
    const message = profile.diagnostics[0]?.message;
    if (typeof message !== 'string') {
      throw new Error('expected a plain-text diagnostic message');
    }
    expect(message).toContain('1a86:7523');
    expect(message).toContain('0483:0721');
  });

  it('stays silent when the port matches the selected identity', () => {
    const profile = resolveStm({ backend: 'serial', usb: { vendorId: '0483', productId: '0721' } });
    expect(profile.diagnostics).toEqual([]);
  });

  it('stays silent when the port reports no USB identity at all', () => {
    expect(resolveStm({ backend: 'serial' }).diagnostics).toEqual([]);
    expect(resolveStm({ backend: 'serial', usb: {} }).diagnostics).toEqual([]);
  });

  it('does not claim a mismatch on a simulated backend', () => {
    const profile = resolveStm({ backend: 'simulated', usb: { vendorId: '1a86', productId: '7523' } });
    expect(profile.diagnostics.map(diagnostic => diagnostic.code)).toEqual(['probe-skipped']);
  });

  it('forwards driver-reported non-fatal diagnostics in order', () => {
    const profile = resolveStm(
      { backend: 'serial', usb: { vendorId: '1a86', productId: '7523' } },
      [
        { code: 'boost-probe-timeout', severity: 'info', message: 'boost probe timed out', stage: 'probe' },
        { code: 'version-unreadable', severity: 'warning', message: 'firmware version not reported', stage: 'probe' },
      ],
    );

    expect(profile.diagnostics.map(diagnostic => diagnostic.code)).toEqual([
      'port-mismatch',
      'boost-probe-timeout',
      'version-unreadable',
    ]);
  });

  it('keeps the diagnostics snapshot immutable, including each entry', () => {
    const driverDiagnostics = [
      { code: 'version-unreadable' as const, severity: 'warning' as const, message: 'firmware version not reported', stage: 'probe' as const },
    ];
    const profile = resolveStm({ backend: 'serial' }, driverDiagnostics);

    expect(Object.isFrozen(profile.diagnostics)).toBe(true);
    expect(profile.diagnostics.every(diagnostic => Object.isFrozen(diagnostic))).toBe(true);
    expect(profile.diagnostics[0]).not.toBe(driverDiagnostics[0]);
  });
});

describe('boost transport derivation', () => {
  const boost = registry.selectVariant(VARIANT_IDS.stmBoost);
  const stm = registry.selectVariant(VARIANT_IDS.stm);

  it('is true for a verified Boost handshake', () => {
    const profile = resolver.resolve(
      boost,
      { firmwareId: boost.firmware.id, verification: 'verified', facts: {} },
      { backend: 'serial' },
      createStore(),
    );
    expect(profile.runtimeFeatures.boostTransport).toBe(true);
    expect(profile.display.badges.map(badge => badge.id)).toContain('boost');
  });

  it('is true for a simulated Boost session without a probe', () => {
    const profile = resolver.resolve(
      boost,
      { firmwareId: boost.firmware.id, verification: 'not-applicable', facts: {} },
      { backend: 'simulated' },
      createStore(),
    );
    expect(profile.runtimeFeatures.boostTransport).toBe(true);
    expect(profile.display.badges.map(badge => badge.id)).toContain('boost');
  });

  it('is false for a simulated standard STM session', () => {
    const profile = resolver.resolve(
      stm,
      { firmwareId: stm.firmware.id, verification: 'not-applicable', facts: {} },
      { backend: 'simulated' },
      createStore(),
    );
    expect(profile.runtimeFeatures.boostTransport).toBe(false);
    expect(profile.display.badges.map(badge => badge.id)).not.toContain('boost');
  });

  it('is false for an assumed standard STM session', () => {
    const profile = resolver.resolve(
      stm,
      { firmwareId: stm.firmware.id, verification: 'assumed', facts: {} },
      { backend: 'serial' },
      createStore(),
    );
    expect(profile.runtimeFeatures.boostTransport).toBe(false);
  });

  it('fails instead of downgrading an unverified Boost selection', () => {
    let error: unknown;
    try {
      resolver.resolve(
        boost,
        { firmwareId: boost.firmware.id, verification: 'assumed', facts: {} },
        { backend: 'serial' },
        createStore(),
      );
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(SessionResolutionError);
    expect((error as SessionResolutionError).code).toBe('boost-verification-failed');
  });
});
