import { beforeEach, describe, expect, it } from 'vitest';

import { CartridgeAdapter } from '@/services/cartridge-adapter';
import { AdvancedSettings } from '@/settings/advanced-settings';

class ChunkAdapter extends CartridgeAdapter {
  constructor(private readonly simulated: boolean) {
    super({ port: null });
  }

  protected override isSimulatedDevice(): boolean {
    return this.simulated;
  }

  pageSizes(requested?: number): number[] {
    return [this.resolveRomPageSize(requested), this.resolveRamPageSize(requested)];
  }
}

describe('Cartridge adapter transfer chunks', () => {
  beforeEach(() => {
    AdvancedSettings.romPageSize = 0x1000;
    AdvancedSettings.ramPageSize = 0x1000;
  });

  it('keeps accelerated simulation aligned to the smallest cartridge window', () => {
    const adapter = new ChunkAdapter(true);
    expect(adapter.pageSizes()).toEqual([0x2000, 0x2000]);
    expect(adapter.pageSizes(0x40)).toEqual([0x2000, 0x2000]);
    expect(adapter.pageSizes(0xffff)).toEqual([0x2000, 0x2000]);
  });

  it('preserves configured and requested page sizes for hardware', () => {
    const adapter = new ChunkAdapter(false);
    expect(adapter.pageSizes()).toEqual([0x1000, 0x1000]);
    expect(adapter.pageSizes(0x100)).toEqual([0x100, 0x100]);
    expect(adapter.pageSizes(0xffff)).toEqual([0x1000, 0x1000]);
  });
});
