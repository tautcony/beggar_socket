import { describe, expect, it } from 'vitest';

import { BEGGAR_RUNTIME_BINDING_ID, GBFLASH_RUNTIME_BINDING_ID } from '@/device/definitions';
import {
  type BeggarProbeFacts,
  createBeggarRuntimeBinding,
  createFlashgbxRuntimeBinding,
  createPendingAdapterFactory,
  createRuntimeComposition,
  createRuntimeCompositionRegistry,
  type FlashgbxProbeFacts,
  type RuntimeBinding,
} from '@/device-runtime';

type IsAssignable<A, B> = [A] extends [B] ? true : false;

/**
 * Type-level closure: a Beggar binding must never satisfy a FlashGBX binding. If the
 * facts type stopped constraining the driver / contributor, this assignment would fail
 * to compile because `true` is not assignable to `false`.
 */
const BEGGAR_BINDING_IS_NOT_FLASHGBX: IsAssignable<
  RuntimeBinding<BeggarProbeFacts>,
  RuntimeBinding<FlashgbxProbeFacts>
> = false;

describe('runtime composition registry', () => {
  it('keeps the facts type closed at the binding definition site', () => {
    expect(BEGGAR_BINDING_IS_NOT_FLASHGBX).toBe(false);

    const beggar: RuntimeBinding<BeggarProbeFacts> = createBeggarRuntimeBinding();
    const flashgbx: RuntimeBinding<FlashgbxProbeFacts> = createFlashgbxRuntimeBinding();
    expect(beggar.driver).toBeDefined();
    expect(flashgbx.driver).toBeDefined();
  });

  it('registers both runtime families', () => {
    const composition = createRuntimeComposition();
    expect(composition.ids()).toEqual([BEGGAR_RUNTIME_BINDING_ID, GBFLASH_RUNTIME_BINDING_ID]);
    expect(composition.has(BEGGAR_RUNTIME_BINDING_ID)).toBe(true);
  });

  it('only exposes capability signals for firmwares with conditional capabilities', () => {
    const composition = createRuntimeComposition();
    const beggar = composition.resolve<BeggarProbeFacts>(BEGGAR_RUNTIME_BINDING_ID);
    const flashgbx = composition.resolve<FlashgbxProbeFacts>(GBFLASH_RUNTIME_BINDING_ID);

    expect(beggar.capabilitySignals).toBeUndefined();
    expect(
      flashgbx.capabilitySignals?.({
        firmwareInfo: {
          family: 'gbflash',
          cfwId: 'L',
          fwVer: 8,
          pcbVer: 14,
          fwTs: 0,
          ofwVer: null,
          pcbName: 'GBFlash L14',
          cartPowerCtrl: true,
          cartPresenceSwitch: false,
          cartModeSwitch: true,
          bootloaderReset: true,
          hasDeviceSerial: true,
          unregistered: false,
          audioWePin: true,
          isCdc: true,
        },
      }),
    ).toEqual({ powerControlPresent: true, audioWriteEnabled: true, presenceDetectPresent: false });
    expect(flashgbx.capabilitySignals?.({})).toEqual({
      powerControlPresent: false,
      audioWriteEnabled: false,
      presenceDetectPresent: false,
    });
  });

  it('rejects duplicate registrations and unknown lookups', () => {
    const composition = createRuntimeCompositionRegistry();
    composition.register(BEGGAR_RUNTIME_BINDING_ID, createBeggarRuntimeBinding());
    expect(() => { composition.register(BEGGAR_RUNTIME_BINDING_ID, createBeggarRuntimeBinding()); }).toThrow(
      /duplicate runtime binding/,
    );
    expect(() => composition.resolve<BeggarProbeFacts>(GBFLASH_RUNTIME_BINDING_ID)).toThrow(/not registered/);
  });

  it('fails loudly for adapter factories that arrive with a later change', () => {
    const factory = createPendingAdapterFactory(GBFLASH_RUNTIME_BINDING_ID);
    expect(() => factory.create('gba', undefined as never)).toThrow(/refactor-device-lifecycle-drivers/);
  });
});
