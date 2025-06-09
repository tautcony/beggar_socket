// Operation Components Index - 导出所有操作组件
// 操作组件
export { default as ChipOperations } from './ChipOperations.vue';
export { default as RamOperations } from './RamOperations.vue';
export { default as RomOperations } from './RomOperations.vue';

// 导入用于默认导出
import ChipOperations from './ChipOperations.vue';
import RamOperations from './RamOperations.vue';
import RomOperations from './RomOperations.vue';

// 默认导出
export default {
  ChipOperations,
  RamOperations,
  RomOperations,
};