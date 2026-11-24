/**
 * Real `SessionProfile` factory for tests.
 *
 * Sessions are produced by the production resolver instead of hand-written literals, so a
 * fixture can never drift from the capability matrix, the packet limits or the display
 * model that the app actually publishes.
 */
import { VARIANT_IDS } from '@/device/definitions';
import type { ProbeResult, SessionProfile, TransportFacts } from '@/device/session';
import type { VerificationStatus } from '@/device/types';
import { createDeviceRuntime, type DeviceRuntime } from '@/device-runtime';
import { getDeviceRuntime } from '@/device-runtime/runtime-instance';
import type { GbflashFirmwareInfo } from '@/protocol/gbflash';
import type { HostPlatform } from '@/types/host-platform';

export const TEST_GBFLASH_INFO: GbflashFirmwareInfo = {
  family: 'gbflash',
  cfwId: 'L',
  fwVer: 14,
  pcbVer: 13,
  fwTs: 0,
  ofwVer: null,
  pcbName: 'GBFlash',
  cartPowerCtrl: true,
  cartPresenceSwitch: false,
  cartModeSwitch: false,
  bootloaderReset: true,
  hasDeviceSerial: false,
  unregistered: false,
  audioWePin: true,
  isCdc: false,
};

export interface BuildTestSessionOptions {
  /** `simulated` skips every hardware probe, like the debug backend. */
  readonly backend?: 'serial' | 'simulated';
  readonly usb?: { readonly vendorId?: string; readonly productId?: string };
  readonly firmwareVersion?: string;
  readonly verification?: VerificationStatus;
  /** Only used by the GBFlash variants; defaults to {@link TEST_GBFLASH_INFO}. */
  readonly gbflashInfo?: GbflashFirmwareInfo | null;
  readonly boostBanner?: string;
  /** Overrides the detected host so packet limits can be asserted per platform. */
  readonly hostPlatform?: HostPlatform;
}

const runtimesByPlatform = new Map<HostPlatform, DeviceRuntime>();

function runtimeFor(platform?: HostPlatform): DeviceRuntime {
  if (!platform) {
    return getDeviceRuntime();
  }
  let runtime = runtimesByPlatform.get(platform);
  if (!runtime) {
    runtime = createDeviceRuntime({ platform });
    runtimesByPlatform.set(platform, runtime);
  }
  return runtime;
}

export function buildTestSession(
  variantId: string,
  options: BuildTestSessionOptions = {},
): SessionProfile {
  const runtime = runtimeFor(options.hostPlatform);
  const selection = runtime.registry.selectVariant(variantId);
  const backend = options.backend ?? 'serial';
  const facts = selection.firmware.protocol === 'gbflash'
    ? { firmwareInfo: options.gbflashInfo === undefined ? TEST_GBFLASH_INFO : options.gbflashInfo ?? undefined }
    : {
      ...(variantId === VARIANT_IDS.stmBoost ? { boostSupported: true } : {}),
      ...(options.boostBanner ? { boostBanner: options.boostBanner } : {}),
    };

  const probe: ProbeResult<unknown> = {
    firmwareId: selection.firmware.id,
    verification: options.verification ?? (backend === 'simulated' ? 'not-applicable' : 'verified'),
    ...(options.firmwareVersion !== undefined ? { firmwareVersion: options.firmwareVersion } : {}),
    facts,
  };
  const transportFacts: TransportFacts = {
    backend,
    ...(options.usb ? { usb: options.usb } : {}),
  };

  return runtime.resolver.resolve(
    selection,
    probe,
    transportFacts,
    runtime.store.operationSnapshot(selection.parameterNamespace).values,
  );
}

/** Convenience: GBFlash session with an STM-style default port identity. */
export function buildGbflashSession(options: BuildTestSessionOptions = {}): SessionProfile {
  return buildTestSession(VARIANT_IDS.gbflash, {
    firmwareVersion: 'L14',
    ...options,
  });
}

/** Convenience: standard STM (丐中丐) session. */
export function buildStmSession(options: BuildTestSessionOptions = {}): SessionProfile {
  return buildTestSession(VARIANT_IDS.stm, options);
}
