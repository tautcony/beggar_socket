/**
 * Beggar display contributor: normalized device / firmware / Boost badge information.
 */
import type { DeviceDisplayModel, DisplayBadge } from '@/device/display';
import type { DisplayContributor, InternalResolveContext } from '@/device/session';

import type { BeggarProbeFacts } from '../drivers/beggar-driver';

export const beggarDisplayContributor: DisplayContributor<BeggarProbeFacts> = {
  build(context: InternalResolveContext<BeggarProbeFacts>): DeviceDisplayModel {
    const { device, firmware, probe, runtimeFeatures } = context;
    const badges: DisplayBadge[] = [];
    if (runtimeFeatures.boostTransport) {
      badges.push({ id: 'boost', text: 'Boost', tone: 'success' });
    }
    badges.push({ id: 'protocol', text: 'Beggar', tone: 'info' });

    return {
      title: device.displayName,
      subtitle: probe.firmwareVersion ?? firmware.displayName,
      badges,
      infoRows: [
        { label: 'Firmware', value: firmware.displayName },
        { label: 'Verification', value: probe.verification },
      ],
      warnings: [],
    };
  },
};
