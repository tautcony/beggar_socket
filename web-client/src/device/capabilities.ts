/**
 * Capability model of the pure device definition layer.
 *
 * Resolution order is fixed and one-directional:
 *   `cart.*` hardware gate → firmware `baseCapabilities` → probe narrowing
 *
 * The last two steps can only narrow. Facts may satisfy a declared `conditional`
 * rule but can never enable an undeclared or unsupported capability.
 */
import type { DisplayText } from './display';
import type { HardwareTraits } from './hardware';

export const CAPABILITY_KEYS = [
  'rom.read',
  'rom.write',
  'rom.erase.chip',
  'rom.erase.sector',
  'rom.verify.crc',
  'rom.bankSwitch.32M',
  'ram.read',
  'ram.write',
  'ram.fram.gba',
  'ram.fram.gbc',
  'cart.powerControl',
  'cart.voltageSwitch',
  'cart.presenceDetect',
  'cart.audioWePin',
  'tool.rtc.gba',
  'tool.rtc.mbc3',
  'tool.rumble.gba',
  'tool.debug',
  'tool.ppbUnlock',
  'profile.flashcartDb',
] as const;

export type CapabilityKey = (typeof CAPABILITY_KEYS)[number];

export type CapabilityRuleId =
  | 'gbflash.power-control-present'
  | 'gbflash.audio-write-enabled'
  | 'gbflash.presence-detect-present';

export interface CapabilityDeclarationSupported {
  readonly state: 'supported';
}

export interface CapabilityDeclarationUnsupported {
  readonly state: 'unsupported';
  readonly reason?: DisplayText;
}

export interface CapabilityDeclarationConditional {
  readonly state: 'conditional';
  readonly ruleId: CapabilityRuleId;
  readonly reason?: DisplayText;
}

export type CapabilityDeclaration =
  | CapabilityDeclarationSupported
  | CapabilityDeclarationUnsupported
  | CapabilityDeclarationConditional;

export type ResolvedCapabilityStatus =
  | { readonly state: 'supported' }
  | { readonly state: 'unsupported'; readonly reason?: DisplayText };

export type CapabilityDeclarationMap = Partial<Record<CapabilityKey, CapabilityDeclaration>>;

/**
 * Complete declaration set: every matrix row must be declared. Definitions use this
 * type so adding a `CapabilityKey` fails type-check until all four firmwares declare it.
 */
export type CompleteCapabilityDeclarations = Readonly<Record<CapabilityKey, CapabilityDeclaration>>;

export type CapabilityMap = Partial<Record<CapabilityKey, ResolvedCapabilityStatus>>;

export interface CapabilitySet {
  /** True only for resolved `supported` capabilities. */
  has(key: CapabilityKey): boolean;
  /** Reason a capability is unavailable (UI tooltip). */
  explain(key: CapabilityKey): DisplayText | undefined;
  all(): ReadonlyMap<CapabilityKey, ResolvedCapabilityStatus>;
}

/**
 * Normalized facts consumed by conditional capability rules. Bindings normalize
 * their typed probe facts into this shape; rules never read raw probe facts.
 */
export interface CapabilitySignals {
  readonly powerControlPresent: boolean;
  readonly audioWriteEnabled: boolean;
  readonly presenceDetectPresent: boolean;
}

export const NO_CAPABILITY_SIGNALS: CapabilitySignals = {
  powerControlPresent: false,
  audioWriteEnabled: false,
  presenceDetectPresent: false,
};

export const CAPABILITY_RULES: Readonly<Record<CapabilityRuleId, (signals: CapabilitySignals) => boolean>> = {
  'gbflash.power-control-present': signals => signals.powerControlPresent,
  'gbflash.audio-write-enabled': signals => signals.audioWriteEnabled,
  'gbflash.presence-detect-present': signals => signals.presenceDetectPresent,
};

export const REGISTERED_CAPABILITY_RULE_IDS: readonly CapabilityRuleId[] = Object.keys(
  CAPABILITY_RULES,
) as CapabilityRuleId[];

/**
 * `HardwareTraits` is not a capability map: only these four `cart.*` keys have a
 * hardware counterpart and are therefore gated by hardware before declaration.
 */
export const HARDWARE_GATED_CAPABILITIES: readonly CapabilityKey[] = [
  'cart.powerControl',
  'cart.voltageSwitch',
  'cart.presenceDetect',
  'cart.audioWePin',
];

const HARDWARE_GATES: Partial<Record<CapabilityKey, (hardware: HardwareTraits) => boolean>> = {
  'cart.powerControl': hardware => hardware.cartPowerControl !== 'none',
  'cart.voltageSwitch': hardware => hardware.cartVoltages.length > 1,
  'cart.presenceDetect': hardware => hardware.cartPresenceDetect,
  'cart.audioWePin': hardware => hardware.audioWePin,
};

export function isHardwareGated(key: CapabilityKey): boolean {
  return Object.prototype.hasOwnProperty.call(HARDWARE_GATES, key);
}

const UNSUPPORTED_NO_DECLARATION = 'not declared by firmware definition';
const UNSUPPORTED_HARDWARE = 'not supported by hardware';
const UNSUPPORTED_UNKNOWN_RULE = 'unknown capability rule';

/** Resolves a complete capability map (every key is present). */
export function resolveCapabilityMap(
  declarations: CapabilityDeclarationMap,
  hardware: HardwareTraits,
  signals: CapabilitySignals = NO_CAPABILITY_SIGNALS,
): ReadonlyMap<CapabilityKey, ResolvedCapabilityStatus> {
  const resolved = new Map<CapabilityKey, ResolvedCapabilityStatus>();
  for (const key of CAPABILITY_KEYS) {
    resolved.set(key, resolveOne(key, declarations[key], hardware, signals));
  }
  return resolved;
}

function resolveOne(
  key: CapabilityKey,
  declaration: CapabilityDeclaration | undefined,
  hardware: HardwareTraits,
  signals: CapabilitySignals,
): ResolvedCapabilityStatus {
  if (!declaration) {
    return { state: 'unsupported', reason: UNSUPPORTED_NO_DECLARATION };
  }

  const gate = HARDWARE_GATES[key];
  if (gate && !gate(hardware)) {
    const declaredReason = 'reason' in declaration ? declaration.reason : undefined;
    return { state: 'unsupported', reason: declaredReason ?? UNSUPPORTED_HARDWARE };
  }

  switch (declaration.state) {
    case 'supported':
      return { state: 'supported' };
    case 'unsupported':
      return { state: 'unsupported', reason: declaration.reason };
    case 'conditional': {
      const rule = CAPABILITY_RULES[declaration.ruleId];
      if (!rule) {
        return { state: 'unsupported', reason: UNSUPPORTED_UNKNOWN_RULE };
      }
      return rule(signals) ? { state: 'supported' } : { state: 'unsupported', reason: declaration.reason };
    }
  }
}

export function createCapabilitySet(
  resolved: ReadonlyMap<CapabilityKey, ResolvedCapabilityStatus>,
): CapabilitySet {
  return {
    has: (key) => resolved.get(key)?.state === 'supported',
    explain: (key) => {
      const status = resolved.get(key);
      return status?.state === 'unsupported' ? status.reason : undefined;
    },
    all: () => resolved,
  };
}

export function resolveCapabilities(
  declarations: CapabilityDeclarationMap,
  hardware: HardwareTraits,
  signals: CapabilitySignals = NO_CAPABILITY_SIGNALS,
): CapabilitySet {
  return createCapabilitySet(resolveCapabilityMap(declarations, hardware, signals));
}

/**
 * Runtime / transport features. These are implementation strategies, not user
 * facing capabilities, so they never appear in `CapabilitySet`.
 */
export interface RuntimeFeatures {
  readonly boostTransport: boolean;
}
