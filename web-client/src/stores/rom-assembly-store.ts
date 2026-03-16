import { defineStore } from 'pinia';

import type { AssembledRom } from '@/types/rom-assembly';

export interface RomAssemblyResultState {
  assembledRom: AssembledRom | null;
  romType: 'MBC5' | 'GBA' | null;
  timestamp: number | null;
}

// Module-level timer so it survives Pinia re-instantiation in tests
let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
const RESULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const useRomAssemblyResultStore = defineStore('romAssemblyResult', {
  state: (): RomAssemblyResultState => ({
    assembledRom: null,
    romType: null,
    timestamp: null,
  }),

  getters: {
    hasResult: (state: RomAssemblyResultState): boolean =>
      state.assembledRom !== null && state.romType !== null,
  },

  actions: {
    // 设置组装结果
    setResult(rom: AssembledRom, romType: 'MBC5' | 'GBA') {
      this.assembledRom = rom;
      this.romType = romType;
      this.timestamp = Date.now();
      // Auto-clear after TTL if the result is never consumed (prevents 32 MiB memory leak)
      if (cleanupTimer) clearTimeout(cleanupTimer);
      cleanupTimer = setTimeout(() => this.clearResult(), RESULT_TTL_MS);
    },

    // 获取并清除结果（用于主页面消费数据）
    consumeResult(): { rom: AssembledRom; romType: 'MBC5' | 'GBA' } | null {
      if (!this.assembledRom || !this.romType) {
        return null;
      }

      const result = {
        rom: this.assembledRom,
        romType: this.romType,
      };

      // 清除数据
      this.clearResult();

      return result;
    },

    // 清除结果
    clearResult() {
      this.assembledRom = null;
      this.romType = null;
      this.timestamp = null;
      if (cleanupTimer) {
        clearTimeout(cleanupTimer);
        cleanupTimer = undefined;
      }
    },
  },
});
