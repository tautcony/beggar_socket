import { defineStore } from 'pinia';

import type { AssembledRom } from '@/types/rom-assembly';

export interface RomAssemblyResultState {
  assembledRom: AssembledRom | null;
  romType: 'MBC5' | 'GBA' | null;
  timestamp: number | null;
}

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
    },
  },
});
