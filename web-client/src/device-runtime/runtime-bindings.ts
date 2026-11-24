/**
 * Runtime binding wiring.
 *
 * `beggar` is shared by STM, Boost and STC (same driver family, different capabilities and
 * parameters); `gbflash` is the GBFlash family. Each binding closes its probe-facts type
 * at the definition site so a GBFlash contributor cannot receive Beggar facts.
 */
import { BEGGAR_RUNTIME_BINDING_ID, GBFLASH_RUNTIME_BINDING_ID } from '@/device/definitions';

import {
  createBeggarAdapterFactory,
  createGbflashAdapterFactory,
  gbflashModeSync,
} from './adapters/adapter-factory';
import {
  createRuntimeCompositionRegistry,
  type RuntimeBinding,
  type RuntimeCompositionRegistry,
} from './composition-registry';
import { beggarDisplayContributor } from './display-contributors/beggar';
import { gbflashDisplayContributor } from './display-contributors/gbflash';
import { type BeggarProbeFacts, createBeggarDriver } from './drivers/beggar-driver';
import { createGbflashDriver, gbflashCapabilitySignals, type GbflashProbeFacts } from './drivers/gbflash-driver';

export function createBeggarRuntimeBinding(): RuntimeBinding<BeggarProbeFacts> {
  return {
    driver: createBeggarDriver(),
    displayContributor: beggarDisplayContributor,
    adapterFactory: createBeggarAdapterFactory(),
  };
}

export function createGbflashRuntimeBinding(): RuntimeBinding<GbflashProbeFacts> {
  return {
    driver: createGbflashDriver(),
    displayContributor: gbflashDisplayContributor,
    adapterFactory: createGbflashAdapterFactory(),
    modeSyncStrategy: gbflashModeSync,
    capabilitySignals: gbflashCapabilitySignals,
  };
}

/** Registers every runtime binding the catalog references. */
export function createRuntimeComposition(): RuntimeCompositionRegistry {
  const composition = createRuntimeCompositionRegistry();
  composition.register(BEGGAR_RUNTIME_BINDING_ID, createBeggarRuntimeBinding());
  composition.register(GBFLASH_RUNTIME_BINDING_ID, createGbflashRuntimeBinding());
  return composition;
}
