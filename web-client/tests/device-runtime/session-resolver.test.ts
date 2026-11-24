import { describe, expect, it } from 'vitest';

import {
  createDeviceCatalog,
  createParameterStore,
  type ParameterStore,
  type ProbeResult,
  type ResolvedVariantSelection,
  type SessionProfile,
  type TransportFacts,
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

/**
 * The resolver consumes the attempt snapshot (`ConnectionPlan.parameters`), so the cases
 * keep their store-shaped call and snapshot the namespace here.
 */
function resolve(
  selection: ResolvedVariantSelection,
  probe: ProbeResult<unknown>,
  transportFacts: TransportFacts,
  store: ParameterStore = createStore(),
): SessionProfile {
  return resolver.resolve(
    selection,
    probe,
    transportFacts,
    store.operationSnapshot(selection.parameterNamespace).values,
  );
}

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
    const store = createStore();
    const profile = resolve(
      selection,
      { firmwareId: selection.firmware.id, verification: 'assumed', facts: {} },
      { backend: 'serial', usb: { vendorId: '0483', productId: '0721' } },
      store,
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
    // Operation settings stay in the store; the profile only freezes connection-period values.
    expect(profile.connectionParameters).not.toHaveProperty('romPageSize');
    expect(store.operationSnapshot('beggar.stm').values.romPageSize).toBe(0x1000);
    expect(profile.diagnostics).toEqual([]);
    expect(Object.isFrozen(profile)).toBe(true);
  });

  it('exposes the stored read page separately from the effective ceiling', () => {
    const stm = registry.selectVariant(VARIANT_IDS.stm);
    const boost = registry.selectVariant(VARIANT_IDS.stmBoost);
    const store = createStore();
    // One shared namespace: a Boost sized read page stays storable.
    store.set('beggar.stm', 'romReadPageSize', 0x2000);

    const stmProfile = resolve(
      stm,
      { firmwareId: stm.firmware.id, verification: 'assumed', facts: {} },
      { backend: 'serial' },
      store,
    );
    const boostProfile = resolve(
      boost,
      { firmwareId: boost.firmware.id, verification: 'verified', facts: {} },
      { backend: 'serial' },
      store,
    );

    // The stored page is storable for the shared namespace, while the effective ceiling is
    // per binding: the plan carries the stored value, the profile carries the ceiling.
    expect(store.operationSnapshot('beggar.stm').values.romReadPageSize).toBe(0x2000);
    expect(stmProfile.transport.maxReadChunk).toBe(0x1000);
    expect(boostProfile.transport.maxReadChunk).toBe(0x2000);
  });

  it('does not leak raw probe facts into the public session', () => {
    const selection = registry.selectVariant(VARIANT_IDS.gbflash);
    const probe: FlashgbxProbeFacts = {
      firmwareInfo: flashgbxInfo({ pcbName: 'GBFlash L14', cartPowerCtrl: false }),
    };
    const profile = resolve(
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
    const withFacts = resolve(
      selection,
      { firmwareId: selection.firmware.id, verification: 'verified', facts: { firmwareInfo: flashgbxInfo() } },
      { backend: 'serial' },
      createStore(),
    );
    expect(withFacts.capabilities.has('cart.powerControl')).toBe(true);
    expect(withFacts.capabilities.has('cart.presenceDetect')).toBe(true);
    expect(withFacts.capabilities.has('cart.audioWePin')).toBe(true);
    expect(withFacts.transport.baudRate).toBe(2_000_000);

    const withoutFacts = resolve(
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
    const firstStore = createStore();
    const first = resolve(
      selection,
      { firmwareId: selection.firmware.id, verification: 'assumed', facts: {} },
      { backend: 'serial' },
      firstStore,
    );

    const fake = createFakeSettingsStorage();
    fake.values.set('beggar.stm.romPageSize', 0x800);
    const secondStore = createParameterStore({
      adapter: fake.adapter,
      platform: 'windows',
      schemas: { resolve: namespace => registry.resolveNamespaceSchema(namespace) },
    });
    const second = resolve(
      selection,
      { firmwareId: selection.firmware.id, verification: 'assumed', facts: {} },
      { backend: 'serial' },
      secondStore,
    );

    expect(firstStore.operationSnapshot('beggar.stm').values.romPageSize).toBe(0x1000);
    expect(secondStore.operationSnapshot('beggar.stm').values.romPageSize).toBe(0x800);
    expect(first.transport.maxReadChunk).toBe(second.transport.maxReadChunk);
  });

  it('rejects a probe that rewrites the firmware identity', () => {
    const selection = registry.selectVariant(VARIANT_IDS.stm);
    expect(() =>
      resolve(
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
        createStore().operationSnapshot(selection.parameterNamespace).values,
      ),
    ).toThrow(/runtime binding flashgbx is not registered/);
  });

  it('records probe-skipped as a diagnostic for simulated backends', () => {
    const selection = registry.selectVariant(VARIANT_IDS.stc);
    const profile = resolve(
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
    return resolve(
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

  it('reports a port without usable identity instead of claiming a mismatch', () => {
    // A port that reports nothing cannot confirm or deny the selected device: the verdict is
    // `unknown`, and the right-hand log gets an entry so it no longer looks like a silent pass.
    for (const usb of [undefined, {}]) {
      const profile = resolveStm({ backend: 'serial', ...(usb ? { usb } : {}) });
      expect(profile.diagnostics.map(diagnostic => diagnostic.code)).toEqual(['port-identity-unknown']);
      expect(profile.portIdentity).toEqual(expect.objectContaining({ outcome: 'unknown', reason: 'missing' }));
    }

    // A port that reports only the vendor id is `incomplete`, not a mismatch.
    const half = resolveStm({ backend: 'serial', usb: { vendorId: '0483' } });
    expect(half.portIdentity).toEqual(expect.objectContaining({ outcome: 'unknown', reason: 'incomplete' }));
    expect(half.diagnostics.map(diagnostic => diagnostic.code)).toEqual(['port-identity-incomplete']);
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

describe('profile ownership', () => {
  /**
   * `device` and `firmware` are registry objects shared by every session of the same
   * variant, and `baseCapabilities` is even shared between two firmwares. Publishing them
   * by reference would make the registry reachable — and mutable — through a session.
   */
  it('publishes its own copy of the registered device and firmware', () => {
    const selection = registry.selectVariant(VARIANT_IDS.stm);
    const profile = resolve(
      selection,
      { firmwareId: selection.firmware.id, verification: 'assumed', facts: {} },
      { backend: 'serial', usb: { vendorId: '0483', productId: '0721' } },
    );

    expect(profile.device).not.toBe(selection.device);
    expect(profile.firmware).not.toBe(selection.firmware);
    expect(profile.firmware.baseCapabilities).not.toBe(selection.firmware.baseCapabilities);
    expect(profile.device.hardware).not.toBe(selection.device.hardware);

    // Copy does not mean stale: the values are the registered ones.
    expect(profile.device.id).toBe(selection.device.id);
    expect(profile.firmware.id).toBe(selection.firmware.id);
    expect(profile.firmware.baseCapabilities['rom.write']).toEqual(selection.firmware.baseCapabilities['rom.write']);

    // ...and nothing in the copy can be written, so the registry cannot be reached.
    expect(Object.isFrozen(profile.device)).toBe(true);
    expect(Object.isFrozen(profile.device.hardware)).toBe(true);
    expect(Object.isFrozen(profile.device.hardware.cartVoltages)).toBe(true);
    expect(Object.isFrozen(profile.firmware)).toBe(true);
    expect(Object.isFrozen(profile.firmware.baseCapabilities)).toBe(true);
    expect(Object.isFrozen(profile.firmware.baseCapabilities['rom.read'])).toBe(true);
  });

  it('keeps session values independently mutable-proof across two sessions', () => {
    const selection = registry.selectVariant(VARIANT_IDS.stm);
    const first = resolve(
      selection,
      { firmwareId: selection.firmware.id, verification: 'assumed', facts: {} },
      { backend: 'serial', usb: { vendorId: '0483', productId: '0721' } },
    );
    const second = resolve(
      selection,
      { firmwareId: selection.firmware.id, verification: 'assumed', facts: {} },
      { backend: 'serial', usb: { vendorId: '0483', productId: '0721' } },
    );

    // Writing through one session, by reference or by `all()`, changes neither session.
    expect(() => {
      (first.firmware.baseCapabilities as Record<string, unknown>)['rom.read'] = { state: 'unsupported' };
    }).toThrow(TypeError);
    const view = first.capabilities.all();
    (view as Map<string, unknown>).set('rom.read', { state: 'unsupported' });
    (view as Map<string, unknown>).delete('rom.write');

    expect(first.firmware.baseCapabilities['rom.read']).toEqual({ state: 'supported' });
    expect(second.firmware.baseCapabilities['rom.read']).toEqual({ state: 'supported' });
    expect(first.capabilities.has('rom.read')).toBe(true);
    expect(first.capabilities.has('rom.write')).toBe(true);
    expect(first.capabilities.all().get('rom.read')).toEqual({ state: 'supported' });
    expect(Object.isFrozen(first.capabilities)).toBe(true);
  });
});

describe('boost transport derivation', () => {
  const boost = registry.selectVariant(VARIANT_IDS.stmBoost);
  const stm = registry.selectVariant(VARIANT_IDS.stm);

  it('is true for a verified Boost handshake', () => {
    const profile = resolve(
      boost,
      { firmwareId: boost.firmware.id, verification: 'verified', facts: {} },
      { backend: 'serial' },
      createStore(),
    );
    expect(profile.runtimeFeatures.boostTransport).toBe(true);
    expect(profile.display.badges.map(badge => badge.id)).toContain('boost');
  });

  it('is true for a simulated Boost session without a probe', () => {
    const profile = resolve(
      boost,
      { firmwareId: boost.firmware.id, verification: 'not-applicable', facts: {} },
      { backend: 'simulated' },
      createStore(),
    );
    expect(profile.runtimeFeatures.boostTransport).toBe(true);
    expect(profile.display.badges.map(badge => badge.id)).toContain('boost');
  });

  it('is false for a simulated standard STM session', () => {
    const profile = resolve(
      stm,
      { firmwareId: stm.firmware.id, verification: 'not-applicable', facts: {} },
      { backend: 'simulated' },
      createStore(),
    );
    expect(profile.runtimeFeatures.boostTransport).toBe(false);
    expect(profile.display.badges.map(badge => badge.id)).not.toContain('boost');
  });

  it('is false for an assumed standard STM session', () => {
    const profile = resolve(
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
      resolve(
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
