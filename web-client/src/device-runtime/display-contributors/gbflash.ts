/**
 * GBFlash display contributor: PCB variant, transport flavour and per-PCB warnings.
 */
import type { DeviceDisplayModel, DisplayBadge, DisplayText } from '@/device/display';
import type { DisplayContributor, InternalResolveContext } from '@/device/session';

import type { GbflashProbeFacts } from '../drivers/gbflash-driver';

export const gbflashDisplayContributor: DisplayContributor<GbflashProbeFacts> = {
  build(context: InternalResolveContext<GbflashProbeFacts>): DeviceDisplayModel {
    const { device, firmware, probe, capabilities } = context;
    const info = probe.facts.firmwareInfo;
    const badges: DisplayBadge[] = [{ id: 'protocol', text: 'GBFlash', tone: 'info' }];
    if (info) {
      badges.push({ id: 'transport', text: info.isCdc ? 'CDC' : 'CH340', tone: 'info' });
    }

    const warnings: DisplayText[] = [];
    if (!capabilities.has('cart.powerControl')) {
      warnings.push('This PCB has no cartridge power control');
    }

    return {
      title: info?.pcbName ?? device.displayName,
      subtitle: probe.firmwareVersion ?? firmware.displayName,
      badges,
      infoRows: [
        { label: 'Firmware', value: firmware.displayName },
        { label: 'Verification', value: probe.verification },
        ...(info ? [{ label: 'PCB', value: info.pcbName }] : []),
      ],
      warnings,
    };
  },
};
