/**
 * Static catalog: three devices, four firmwares, four bindings.
 */
import type { HostPlatform } from '@/types/host-platform';

import { createDeviceRegistry } from '../registry';
import type { DeviceRegistry, VariantId } from '../types';
import { BEGGAR_STC_BINDING, BEGGAR_STC_DEVICE, BEGGAR_STC_FIRMWARE } from './beggar-stc';
import {
  BEGGAR_STM_BINDING,
  BEGGAR_STM_BOOST_BINDING,
  BEGGAR_STM_BOOST_FIRMWARE,
  BEGGAR_STM_DEVICE,
  BEGGAR_STM_FIRMWARE,
} from './beggar-stm';
import { GBFLASH_BINDING, GBFLASH_DEVICE, GBFLASH_FIRMWARE } from './gbflash';

export const VARIANT_IDS = {
  stm: 'beggar-stm',
  stmBoost: 'beggar-stm-boost',
  stc: 'beggar-stc',
  gbflash: 'gbflash',
} as const satisfies Record<string, VariantId>;

/** v1 `firmware.profile` → registered variant id. */
export const LEGACY_PROFILE_VARIANT_IDS: Readonly<Record<string, VariantId>> = {
  stm: VARIANT_IDS.stm,
  stc: VARIANT_IDS.stc,
  gbflash: VARIANT_IDS.gbflash,
};

export interface DeviceCatalogOptions {
  readonly platform: HostPlatform;
}

export function createDeviceCatalog(options: DeviceCatalogOptions): DeviceRegistry {
  const registry = createDeviceRegistry({ platform: options.platform });
  registry.register(
    BEGGAR_STM_DEVICE,
    [BEGGAR_STM_FIRMWARE, BEGGAR_STM_BOOST_FIRMWARE],
    [BEGGAR_STM_BINDING, BEGGAR_STM_BOOST_BINDING],
  );
  registry.register(BEGGAR_STC_DEVICE, [BEGGAR_STC_FIRMWARE], [BEGGAR_STC_BINDING]);
  registry.register(GBFLASH_DEVICE, [GBFLASH_FIRMWARE], [GBFLASH_BINDING]);
  return registry;
}

export { BEGGAR_STC_BINDING, BEGGAR_STC_CAPABILITIES, BEGGAR_STC_DEVICE, BEGGAR_STC_FIRMWARE } from './beggar-stc';
export {
  BEGGAR_RUNTIME_BINDING_ID,
  BEGGAR_STM_BINDING,
  BEGGAR_STM_BOOST_BINDING,
  BEGGAR_STM_BOOST_FIRMWARE,
  BEGGAR_STM_CAPABILITIES,
  BEGGAR_STM_DEVICE,
  BEGGAR_STM_FIRMWARE,
} from './beggar-stm';
export {
  GBFLASH_AUTO_BAUD_RATE,
  GBFLASH_BINDING,
  GBFLASH_CAPABILITIES,
  GBFLASH_DEVICE,
  GBFLASH_FIRMWARE,
  GBFLASH_RUNTIME_BINDING_ID,
} from './gbflash';
export { BEGGAR_STC_PACKET_LIMITS, BEGGAR_STM_PACKET_LIMITS, GBFLASH_PACKET_LIMITS } from './packet-limits';
