import type { AssembledRom, FileInfo, RomAssemblyConfig, RomSlot } from '@/types/rom-assembly';

/**
 * 获取ROM组装配置
 */
export function getRomAssemblyConfig(type: 'MBC5' | 'GBA'): RomAssemblyConfig {
  if (type === 'GBA') {
    return {
      totalSize: 0x08000000, // 128MB
      alignment: 0x400000, // 4MB对齐
      slotSize: 0x400000, // 4MB每个槽位
      maxSlots: 32, // 最大32个槽位
      type: 'GBA',
    };
  } else {
    return {
      totalSize: 0x02000000, // 32MB
      alignment: 0x200000, // 默认2MB对齐
      slotSize: 0x200000, // 默认2MB每个槽位
      maxSlots: 32, // 最大32个槽位
      type: 'MBC5',
      // MBC5特殊配置：前两个槽位1MB，后续2MB
      variableSlots: true,
      slotConfigs: [
        // 前两个槽位：1MB
        { size: 0x100000, alignment: 0x100000 }, // Slot 0
        { size: 0x100000, alignment: 0x100000 }, // Slot 1
        // 后续槽位：2MB
        ...Array(15).fill(0).map(() => ({ size: 0x200000, alignment: 0x200000 })),
      ],
    };
  }
}

/**
 * 创建空的ROM槽位
 */
export function createEmptySlots(config: RomAssemblyConfig): RomSlot[] {
  const slots: RomSlot[] = [];
  let currentOffset = 0;

  for (let i = 0; i < config.maxSlots; i++) {
    // 获取当前槽位的配置
    const slotConfig = config.variableSlots && config.slotConfigs
      ? config.slotConfigs[i]
      : { size: config.slotSize, alignment: config.alignment };

    if (!slotConfig) {
      break; // 如果没有配置，则停止创建槽位
    }

    // 确保偏移量对齐
    const alignedOffset = Math.ceil(currentOffset / slotConfig.alignment) * slotConfig.alignment;

    slots.push({
      id: `slot-${i}`,
      name: `Slot ${i}`,
      offset: alignedOffset,
      size: slotConfig.size,
      color: generateSlotColor(i, config.maxSlots),
    });

    currentOffset = alignedOffset + slotConfig.size;
  }

  return slots;
}

/**
 * 检查文件是否可以放置在指定槽位
 */
export function canPlaceFile(file: FileInfo, slot: RomSlot, config: RomAssemblyConfig, slotIndex?: number): boolean {
  // 检查文件大小是否超过总容量
  if (file.size > config.totalSize) {
    return false;
  }

  // 获取当前槽位的对齐要求
  let alignment = config.alignment;
  if (config.variableSlots && config.slotConfigs && slotIndex !== undefined) {
    const slotConfig = config.slotConfigs[slotIndex];
    if (slotConfig) {
      alignment = slotConfig.alignment;
    }
  }

  // 检查对齐要求
  if (slot.offset % alignment !== 0) {
    return false;
  }

  // 如果槽位已被占用，不能放置
  if (slot.file) {
    return false;
  }

  return true;
}

/**
 * 获取文件需要占用的槽位数量（支持变长槽位）
 */
export function getRequiredSlots(fileSize: number, config: RomAssemblyConfig, startIndex = 0): number {
  if (!config.variableSlots || !config.slotConfigs) {
    // 传统模式：固定槽位大小
    return Math.ceil(fileSize / config.slotSize);
  }

  // 变长模式：计算从startIndex开始需要多少个槽位
  let remainingSize = fileSize;
  let requiredSlots = 0;
  let currentIndex = startIndex;

  while (remainingSize > 0 && currentIndex < config.maxSlots && currentIndex < config.slotConfigs.length) {
    const slotConfig = config.slotConfigs[currentIndex];
    if (!slotConfig) break;

    remainingSize -= slotConfig.size;
    requiredSlots++;
    currentIndex++;
  }

  return requiredSlots;
}

/**
 * 检查连续槽位是否可用
 */
export function checkConsecutiveSlots(startIndex: number, requiredSlots: number, slots: RomSlot[]): boolean {
  if (startIndex + requiredSlots > slots.length) {
    return false;
  }

  for (let i = startIndex; i < startIndex + requiredSlots; i++) {
    if (slots[i].file) {
      return false;
    }
  }

  return true;
}

/**
 * 在槽位中放置文件
 */
export function placeFileInSlots(
  file: FileInfo,
  startIndex: number,
  slots: RomSlot[],
  config: RomAssemblyConfig,
): RomSlot[] {
  const requiredSlots = getRequiredSlots(file.size, config, startIndex);
  const newSlots = [...slots];
  const fileColor = generateFileColor(file.name);

  // 在所有需要的槽位中放置文件
  for (let i = startIndex; i < startIndex + requiredSlots; i++) {
    newSlots[i] = {
      ...newSlots[i],
      file: file, // 每个占用的槽位都应该包含文件信息
      color: fileColor, // 使用文件特定的颜色
      isFirstSlot: i === startIndex, // 标记是否为文件的第一个槽位
      slotIndex: i - startIndex, // 在文件中的槽位索引
      totalSlots: requiredSlots, // 文件占用的总槽位数
    };
  }

  return newSlots;
}

/**
 * 从槽位中移除文件
 */
export function removeFileFromSlots(slotId: string, slots: RomSlot[]): RomSlot[] {
  // 找到要移除的槽位
  const targetSlot = slots.find(slot => slot.id === slotId);
  if (!targetSlot?.file) {
    return slots;
  }

  // 如果文件占用多个槽位，需要移除同一文件的所有槽位
  const fileName = targetSlot.file.name;

  return slots.map(slot => {
    if (slot.file?.name === fileName) {
      return {
        ...slot,
        file: undefined,
        color: undefined, // 清除颜色
        isFirstSlot: undefined,
        slotIndex: undefined,
        totalSlots: undefined,
      };
    }
    return slot;
  });
}

/**
 * 组装最终的ROM数据
 */
export function assembleRom(slots: RomSlot[], config: RomAssemblyConfig): AssembledRom {
  const actualSize = calculateActualRomSize(slots);
  const data = new Uint8Array(actualSize || config.slotSize); // 至少包含一个槽位

  // 填充0xFF作为默认值
  data.fill(0xFF);

  // 复制每个槽位的文件数据（只在第一个槽位复制）
  for (const slot of slots) {
    if (slot.file && slot.isFirstSlot) {
      const fileData = slot.file.data;
      const targetOffset = slot.offset;

      // 确保不超出边界
      const copySize = Math.min(fileData.length, data.length - targetOffset);
      if (copySize > 0) {
        data.set(fileData.slice(0, copySize), targetOffset);
      }
    }
  }

  return {
    data,
    slots,
    totalSize: actualSize || config.slotSize,
  };
}

/**
 * 计算总的已使用空间
 */
export function calculateUsedSpace(slots: RomSlot[]): number {
  // 只计算第一个槽位的文件大小，避免重复计算
  return slots.reduce((total, slot) => {
    return total + (slot.file && slot.isFirstSlot ? slot.file.size : 0);
  }, 0);
}

/**
 * 生成槽位颜色（更好的区分度和视觉效果）
 */
export function generateSlotColor(index: number, total: number): string {
  // 使用黄金比例来确保颜色分布均匀
  const goldenRatio = 0.618033988749;
  const hue = (index * goldenRatio * 360) % 360;

  // 为前两个特殊槽位使用不同的配色方案
  if (index < 2) {
    // 前两个槽位使用暖色调
    const warmHues = [15, 45]; // 橙色和黄色系
    return `hsl(${warmHues[index]}, 60%, 85%)`;
  }

  // 其他槽位使用冷色调，避免与文件颜色冲突
  const coolHue = 200 + (index * 20) % 120; // 蓝绿色系
  return `hsl(${coolHue}, 40%, 90%)`;
}

/**
 * 生成文件颜色
 */
function generateFileColor(fileName: string): string {
  // 使用文件名生成一个稳定的哈希值
  let hash = 0;
  for (let i = 0; i < fileName.length; i++) {
    const char = fileName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }

  // 使用哈希值生成HSL颜色，确保更好的区分度和亮度
  const hue = Math.abs(hash) % 360;

  // 使用更高的饱和度和适中的亮度，避免暗色调
  const saturation = 70 + (Math.abs(hash >> 8) % 20); // 70-90%
  const lightness = 65 + (Math.abs(hash >> 16) % 15); // 65-80%

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * 计算实际使用的ROM大小（到最后一个有文件的槽位）
 */
export function calculateActualRomSize(slots: RomSlot[]): number {
  // 找到最后一个有文件的槽位
  let lastUsedSlotIndex = -1;
  for (let i = slots.length - 1; i >= 0; i--) {
    if (slots[i].file) {
      lastUsedSlotIndex = i;
      break;
    }
  }

  // 如果没有文件，返回0
  if (lastUsedSlotIndex === -1) {
    return 0;
  }

  // 返回到最后一个有文件槽位的结束位置
  const lastSlot = slots[lastUsedSlotIndex];
  return lastSlot.offset + lastSlot.size;
}
