import type { GameBoyAdvance } from 'gbats';

const CPSR_MODE_M4 = 0x10;
const CPSR_THUMB_STATE = 0x20;
const MAX_AUDIO_TIMER_PASSES = 10_000;

const patchedCores = new WeakSet<object>();

interface CachePage {
  thumb: unknown[];
  arm: unknown[];
  invalid: boolean;
}

function createInvalidCachePage(): CachePage {
  return {
    thumb: [],
    arm: [],
    invalid: true,
  };
}

function patchCpuFetchPage(core: Pick<GameBoyAdvance, 'cpu'> & Partial<Pick<GameBoyAdvance, 'mmu'>>): void {
  const cpu = core.cpu as unknown as {
    fetchPage?: (address: number) => void;
    pageMask?: number;
    pageRegion?: number;
    pageId?: number;
    page?: CachePage;
    mmu?: {
      BASE_OFFSET: number;
      memory: ({ PAGE_MASK?: number } | undefined)[];
    };
  };

  if (typeof cpu.fetchPage !== 'function') {
    return;
  }

  const origFetchPage = cpu.fetchPage;
  cpu.fetchPage = function patchedFetchPage(address: number) {
    const mmu = this.mmu;
    if (mmu) {
      const region = address >> mmu.BASE_OFFSET;
      if (region < 0 || !mmu.memory?.[region]) {
        this.pageMask = 0;
        this.pageRegion = region;
        this.pageId = 0;
        this.page = createInvalidCachePage();
        return;
      }
    }
    origFetchPage.call(this, address);
  };
}

function patchMmu(mmu: NonNullable<GameBoyAdvance['mmu']>): void {
  const mutableMmu = mmu as unknown as {
    memory: ({ ICACHE_PAGE_BITS?: number; icache?: unknown[] } | undefined)[];
    DMA_TIMING_NOW: number;
    addressToPage: (region: number, address: number) => number;
    accessPage: (region: number, pageId: number) => CachePage;
    scheduleDma: (number: number, info: { timing: number }) => void;
  };

  const origAddressToPage = mutableMmu.addressToPage;
  mutableMmu.addressToPage = function patchedAddressToPage(region: number, address: number): number {
    const block = this.memory?.[region];
    if (!block?.ICACHE_PAGE_BITS) {
      return 0;
    }
    return origAddressToPage.call(this, region, address);
  };

  const origAccessPage = mutableMmu.accessPage;
  mutableMmu.accessPage = function patchedAccessPage(region: number, pageId: number): CachePage {
    const block = this.memory?.[region];
    if (!block?.icache) {
      return createInvalidCachePage();
    }
    return origAccessPage.call(this, region, pageId);
  };

  // Immediate DMA (DMA_TIMING_NOW) with repeat=true in gbats re-invokes scheduleDma
  // synchronously from serviceDma, overflowing the call stack.
  const origScheduleDma = mutableMmu.scheduleDma;
  const activeImmediateDmas = new Set<number>();
  mutableMmu.scheduleDma = function patchedScheduleDma(number: number, info: { timing: number }): void {
    if (info.timing === this.DMA_TIMING_NOW) {
      if (activeImmediateDmas.has(number)) {
        return;
      }
      activeImmediateDmas.add(number);
      try {
        origScheduleDma.call(this, number, info);
      } finally {
        activeImmediateDmas.delete(number);
      }
      return;
    }
    origScheduleDma.call(this, number, info);
  };
}

function patchAudio(audio: NonNullable<GameBoyAdvance['audio']>): void {
  const mutableAudio = audio as unknown as {
    cpu: { cycles: number };
    nextEvent: number;
    nextSample: number;
    updateTimers: () => void;
  };

  if (typeof mutableAudio.updateTimers !== 'function') {
    return;
  }

  // Convert gbats's recursive updateTimers tail-call into an iterative trampoline
  // and break out if neither nextEvent nor nextSample advances.
  const origUpdateTimers = mutableAudio.updateTimers;
  let inUpdateTimers = false;
  let needsAnotherPass = false;

  mutableAudio.updateTimers = function patchedUpdateTimers(): void {
    if (inUpdateTimers) {
      needsAnotherPass = true;
      return;
    }

    inUpdateTimers = true;
    try {
      for (let pass = 0; pass < MAX_AUDIO_TIMER_PASSES; pass++) {
        needsAnotherPass = false;
        const prevNextEvent = this.nextEvent;
        const prevNextSample = this.nextSample;

        origUpdateTimers.call(this);

        if (!needsAnotherPass) {
          return;
        }

        if (this.nextEvent === prevNextEvent && this.nextSample === prevNextSample) {
          break;
        }
      }

      const cycles = this.cpu?.cycles ?? 0;
      if (this.nextEvent < cycles) {
        this.nextEvent = cycles;
      }
      if (this.nextSample < cycles) {
        this.nextSample = cycles;
      }
    } finally {
      inUpdateTimers = false;
      needsAnotherPass = false;
    }
  };
}

/**
 * Applies runtime compatibility and stability patches to a gbats core instance:
 * 1. Keeps CPSR mode bit M4 writable in PRIV_MASK while excluding T bit.
 * 2. Guards MMU page/icache access against non-executable or unmapped regions.
 * 3. Prevents synchronous infinite recursion in immediate repeat DMA scheduling.
 * 4. Converts recursive audio timer catch-up into a bounded iterative loop.
 */
export function applyGbatsArmCompatibility(
  core: Pick<GameBoyAdvance, 'cpu'> & Partial<Pick<GameBoyAdvance, 'mmu' | 'audio'>>,
): void {
  core.cpu.PRIV_MASK = (core.cpu.PRIV_MASK | CPSR_MODE_M4) & ~CPSR_THUMB_STATE;

  if (patchedCores.has(core)) {
    return;
  }
  patchedCores.add(core);

  patchCpuFetchPage(core);
  if (core.mmu) {
    patchMmu(core.mmu);
  }
  if (core.audio) {
    patchAudio(core.audio);
  }
}
