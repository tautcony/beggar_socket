/**
 * Runtime binding wiring.
 *
 * `beggar` is shared by STM, Boost and STC (same driver family, different capabilities and
 * parameters); `flashgbx` is the GBFlash family. P0 uses skeleton drivers, so the
 * bindings exist but do not perform real IO yet.
 */
import { BEGGAR_RUNTIME_BINDING_ID, GBFLASH_RUNTIME_BINDING_ID } from '@/device/definitions';

import {
  createPendingAdapterFactory,
  createRuntimeCompositionRegistry,
  type RuntimeBinding,
  type RuntimeCompositionRegistry,
} from './composition-registry';
import { beggarDisplayContributor } from './display-contributors/beggar';
import { gbflashDisplayContributor } from './display-contributors/gbflash';
import { type BeggarProbeFacts, createBeggarDriver } from './drivers/beggar-driver';
import { createFlashgbxDriver, flashgbxCapabilitySignals, type FlashgbxProbeFacts } from './drivers/flashgbx-driver';

export function createBeggarRuntimeBinding(): RuntimeBinding<BeggarProbeFacts> {
  return {
    driver: createBeggarDriver(),
    displayContributor: beggarDisplayContributor,
    adapterFactory: createPendingAdapterFactory(BEGGAR_RUNTIME_BINDING_ID),
  };
}

export function createFlashgbxRuntimeBinding(): RuntimeBinding<FlashgbxProbeFacts> {
  return {
    driver: createFlashgbxDriver(),
    displayContributor: gbflashDisplayContributor,
    adapterFactory: createPendingAdapterFactory(GBFLASH_RUNTIME_BINDING_ID),
    capabilitySignals: flashgbxCapabilitySignals,
  };
}

/** Registers every runtime binding the catalog references. */
export function createRuntimeComposition(): RuntimeCompositionRegistry {
  const composition = createRuntimeCompositionRegistry();
  composition.register(BEGGAR_RUNTIME_BINDING_ID, createBeggarRuntimeBinding());
  composition.register(GBFLASH_RUNTIME_BINDING_ID, createFlashgbxRuntimeBinding());
  return composition;
}
