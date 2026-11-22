import { describe, expect, it } from 'vitest';

import {
  CAPABILITY_KEYS,
  type CapabilityDeclarationMap,
  type CapabilitySignals,
  createCapabilitySet,
  HARDWARE_GATED_CAPABILITIES,
  type HardwareTraits,
  isHardwareGated,
  NO_CAPABILITY_SIGNALS,
  resolveCapabilities,
  resolveCapabilityMap,
} from '@/device';

const HARDWARE: HardwareTraits = {
  cartVoltages: ['3.3V', '5V'],
  cartPowerControl: 'software',
  modeSwitch: 'software',
  cartPresenceDetect: true,
  audioWePin: true,
};

const NO_HARDWARE: HardwareTraits = {
  cartVoltages: ['5V'],
  cartPowerControl: 'none',
  modeSwitch: 'hardware-switch',
  cartPresenceDetect: false,
  audioWePin: false,
};

const ALL_TRUE: CapabilitySignals = {
  powerControlPresent: true,
  audioWriteEnabled: true,
  presenceDetectPresent: true,
};

describe('capability lattice', () => {
  it('treats undeclared capabilities as unsupported even with permissive facts', () => {
    const resolved = resolveCapabilities({}, HARDWARE, ALL_TRUE);
    expect(resolved.has('rom.read')).toBe(false);
    expect(resolved.explain('rom.read')).toContain('not declared');
    for (const key of CAPABILITY_KEYS) {
      expect(resolved.has(key)).toBe(false);
    }
  });

  it('never lets facts enable a declared unsupported capability', () => {
    const declarations: CapabilityDeclarationMap = {
      'tool.debug': { state: 'unsupported', reason: 'no debug command' },
    };
    const resolved = resolveCapabilities(declarations, HARDWARE, ALL_TRUE);
    expect(resolved.has('tool.debug')).toBe(false);
    expect(resolved.explain('tool.debug')).toBe('no debug command');
  });

  it('keeps a supported declaration supported regardless of facts', () => {
    const declarations: CapabilityDeclarationMap = { 'rom.write': { state: 'supported' } };
    expect(resolveCapabilities(declarations, HARDWARE, ALL_TRUE).has('rom.write')).toBe(true);
    expect(resolveCapabilities(declarations, HARDWARE, NO_CAPABILITY_SIGNALS).has('rom.write')).toBe(true);
  });

  it('evaluates conditional capabilities only through registered rules', () => {
    const declarations: CapabilityDeclarationMap = {
      'cart.powerControl': { state: 'conditional', ruleId: 'gbflash.power-control-present' },
    };
    expect(resolveCapabilities(declarations, HARDWARE, ALL_TRUE).has('cart.powerControl')).toBe(true);
    expect(resolveCapabilities(declarations, HARDWARE, NO_CAPABILITY_SIGNALS).has('cart.powerControl')).toBe(false);
  });

  it('resolves every capability key so resolved sets never keep a conditional status', () => {
    const declarations: CapabilityDeclarationMap = {
      'cart.audioWePin': { state: 'conditional', ruleId: 'gbflash.audio-write-enabled', reason: 'pin disabled' },
    };
    const map = resolveCapabilityMap(declarations, HARDWARE, ALL_TRUE);
    expect([...map.keys()]).toEqual([...CAPABILITY_KEYS]);
    for (const status of map.values()) {
      expect(['supported', 'unsupported']).toContain(status.state);
    }
  });
});

describe('hardware gating', () => {
  it('only gates the four cart capabilities with a hardware counterpart', () => {
    expect([...HARDWARE_GATED_CAPABILITIES].sort()).toEqual([
      'cart.audioWePin',
      'cart.powerControl',
      'cart.presenceDetect',
      'cart.voltageSwitch',
    ]);
    expect(isHardwareGated('rom.read')).toBe(false);
    expect(isHardwareGated('ram.write')).toBe(false);
    expect(isHardwareGated('tool.rumble.gba')).toBe(false);
    expect(isHardwareGated('profile.flashcartDb')).toBe(false);
  });

  it('does not require hardware traits for non-cart capabilities', () => {
    const declarations: CapabilityDeclarationMap = {
      'rom.read': { state: 'supported' },
      'tool.rumble.gba': { state: 'supported' },
    };
    const resolved = resolveCapabilities(declarations, NO_HARDWARE);
    expect(resolved.has('rom.read')).toBe(true);
    expect(resolved.has('tool.rumble.gba')).toBe(true);
  });

  it('narrows a cart capability through hardware before the declaration', () => {
    const declarations: CapabilityDeclarationMap = {
      'cart.powerControl': { state: 'supported' },
      'cart.voltageSwitch': { state: 'supported' },
      'cart.presenceDetect': { state: 'supported' },
      'cart.audioWePin': { state: 'supported' },
    };
    const resolved = resolveCapabilities(declarations, NO_HARDWARE);
    expect(resolved.has('cart.powerControl')).toBe(false);
    expect(resolved.has('cart.voltageSwitch')).toBe(false);
    expect(resolved.has('cart.presenceDetect')).toBe(false);
    expect(resolved.has('cart.audioWePin')).toBe(false);
    expect(resolved.explain('cart.powerControl')).toBeTruthy();
  });
});

describe('capability set', () => {
  it('exposes supported and unsupported only', () => {
    const set = createCapabilitySet(
      new Map([
        ['rom.read', { state: 'supported' }],
        ['rom.write', { state: 'unsupported', reason: 'locked' }],
      ]),
    );
    expect(set.has('rom.read')).toBe(true);
    expect(set.has('rom.write')).toBe(false);
    expect(set.explain('rom.read')).toBeUndefined();
    expect(set.explain('rom.write')).toBe('locked');
    expect(set.has('tool.debug')).toBe(false);
  });
});
