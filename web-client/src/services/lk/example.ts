// example.ts - 使用示例

import { BuildInput, buildRom, FullConfig } from './index';

// 示例：如何在网页中使用ROM构建器
export async function exampleBuildRom() {
  // 示例配置
  const config: FullConfig = {
    cartridge: {
      type: 1, // MSP55LV100S
      battery_present: true,
      min_rom_size: 0x400000,
    },
    games: [
      {
        enabled: true,
        file: 'game1.gba',
        title: 'Game 1',
        title_font: 1,
        save_slot: 1,
      },
      {
        enabled: true,
        file: 'game2.gba',
        title: 'Game 2',
        title_font: 1,
        save_slot: 2,
      },
    ],
  };

  // 示例文件数据（在实际使用中，这些会从文件输入中获取）
  const menuRom = new ArrayBuffer(0); // 菜单ROM数据
  const romFiles = new Map<string, ArrayBuffer>();
  const saveFiles = new Map<string, ArrayBuffer>();

  // 添加ROM文件
  // romFiles.set('game1.gba', game1Data);
  // romFiles.set('game2.gba', game2Data);

  // 添加存档文件（可选）
  // saveFiles.set('game1.sav', save1Data);

  // 构建选项
  const options = {
    split: false,
    noLog: false,
    output: 'LK_MULTIMENU_<CODE>.gba',
    // bgImage: bgData, // 可选：背景图像ArrayBuffer（支持PNG/JPG等格式，会自动转换为GBA兼容格式）
  };

  // 构建输入
  const input: BuildInput = {
    config,
    menuRom,
    romFiles,
    saveFiles,
    options,
  };

  try {
    // 构建ROM
    const result = await buildRom(input);

    // 处理结果
    console.log('Build successful!');
    console.log('ROM Code:', result.code);
    console.log('Log:', result.log);

    // 下载ROM文件
    const blob = new Blob([result.rom], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LK_MULTIMENU_${result.code}.gba`;
    a.click();
    URL.revokeObjectURL(url);

  } catch (error) {
    console.error('Build failed:', error);
  }
}

// 在Vue组件中的使用示例
/*
<template>
  <div>
    <input type="file" @change="handleMenuRomSelect" accept=".gba">
    <input type="file" @change="handleRomSelect" accept=".gba" multiple>
    <input type="file" @change="handleBgImageSelect" accept="image/*"> <!-- 背景图像 -->
    <button @click="buildRom">构建ROM</button>
  </div>
</template>

<script setup lang="ts">
import { buildRom, BuildInput } from '@/services/lk';

const menuRom = ref<ArrayBuffer | null>(null);
const romFiles = ref(new Map<string, ArrayBuffer>());
const bgImage = ref<ArrayBuffer | null>(null); // 背景图像

const handleMenuRomSelect = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    file.arrayBuffer().then(data => menuRom.value = data);
  }
};

const handleRomSelect = (event: Event) => {
  const files = (event.target as HTMLInputElement).files;
  if (files) {
    Array.from(files).forEach(async (file) => {
      const data = await file.arrayBuffer();
      romFiles.value.set(file.name, data);
    });
  }
};

const handleBgImageSelect = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    file.arrayBuffer().then(data => bgImage.value = data);
  }
};

const buildRom = async () => {
  if (!menuRom.value) return;

  const input: BuildInput = {
    config: {
      cartridge: { type: 1, battery_present: true, min_rom_size: 0x400000 },
      games: Array.from(romFiles.value.keys()).map((file, index) => ({
        enabled: true,
        file,
        title: file.replace('.gba', ''),
        title_font: 1,
        save_slot: index + 1,
      })),
    },
    menuRom: menuRom.value,
    romFiles: romFiles.value,
    saveFiles: new Map(),
    options: {
      split: false,
      noLog: false,
      output: 'LK_MULTIMENU_<CODE>.gba',
      bgImage: bgImage.value || undefined, // 可选背景图像
    },
  };

  try {
    const result = await buildRom(input);
    // 下载ROM...
  } catch (error) {
    console.error('构建失败:', error);
  }
};
</script>
*/
