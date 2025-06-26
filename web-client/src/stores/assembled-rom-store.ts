import { ref } from 'vue';

import type { AssembledRom } from '@/types/rom-assembly';

// 全局的组装ROM状态
export const assembledRomState = ref<{
  rom: AssembledRom;
  romType: 'MBC5' | 'GBA';
  timestamp: number;
} | null>(null);

/**
 * 设置组装的ROM数据
 */
export function setAssembledRom(rom: AssembledRom, romType: 'MBC5' | 'GBA') {
  assembledRomState.value = {
    rom,
    romType,
    timestamp: Date.now(),
  };
}

/**
 * 清除组装的ROM数据
 */
export function clearAssembledRom() {
  assembledRomState.value = null;
}

/**
 * 获取组装的ROM数据（如果存在且匹配类型）
 */
export function getAssembledRom(romType: 'MBC5' | 'GBA') {
  if (assembledRomState.value && assembledRomState.value.romType === romType) {
    return assembledRomState.value.rom;
  }
  return null;
}
