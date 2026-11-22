/**
 * Runtime binding wiring.
 *
 * `beggar` is shared by STM, Boost and STC (same driver family, different capabilities and
 * parameters); `flashgbx` is the GBFlash family. Each binding closes its probe-facts type
 * at the definition site so a FlashGBX contributor cannot receive Beggar facts.
 */
import { BEGGAR_RUNTIME_BINDING_ID, GBFLASH_RUNTIME_BINDING_ID } from '@/device/definitions';

import {
  createRuntimeCompositionRegistry,
  type RuntimeBinding,
  type RuntimeCompositionRegistry,
} from './composition-registry';
import {
  createBeggarAdapterFactory,
  createFlashgbxAdapterFactory,
  flashgbxModeSync,
} from './adapters/adapter-factory';
import { beggarDisplayContributor } from './display-contributors/beggar';
import { gbflashDisplayContributor } from './display-contributors/gbflash';
import { type BeggarProbeFacts, createBeggarDriver } from './drivers/beggar-driver';
import { createFlashgbxDriver, flashgbxCapabilitySignals, type FlashgbxProbeFacts } from './drivers/flashgbx-driver';

export function createBeggarRuntimeBinding(): RuntimeBinding<BeggarProbeFacts> {
  return {
    driver: createBeggarDriver(),
    displayContributor: beggarDisplayContributor,
    adapterFactory: createBeggarAdapterFactory(),
  };
}

export function createFlashgbxRuntimeBinding(): RuntimeBinding<FlashgbxProbeFacts> {
  return {
    driver: createFlashgbxDriver(),
    displayContributor: gbflashDisplayContributor,
    adapterFactory: createFlashgbxAdapterFactory(),
    modeSyncStrategy: flashgbxModeSync,
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
