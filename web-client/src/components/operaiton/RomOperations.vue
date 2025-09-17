<template>
  <div class="rom-operations-container">
    <section class="section">
      <div class="section-header">
        <h2>{{ $t('ui.rom.title') }}</h2>
        <div class="selector-container">
          <div class="base-address-selector">
            <label class="base-address-label">{{ $t('ui.rom.baseAddressLabel') }}</label>
            <select
              v-model="selectedBaseAddress"
              :disabled="!deviceReady || busy"
              class="base-address-dropdown"
              @change="onBaseAddressChange"
            >
              <option
                v-for="option in baseAddressOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.text }}
              </option>
            </select>
          </div>
          <div class="size-selector">
            <label class="size-label">{{ $t('ui.rom.sizeLabel') }}</label>
            <select
              v-model="selectedRomSize"
              :disabled="!deviceReady || busy"
              class="size-dropdown"
              @change="onRomSizeChange"
            >
              <option
                v-for="option in ROM_SIZE_RANGE"
                :key="option.value"
                :value="option.value"
              >
                {{ option.text }}
              </option>
            </select>
          </div>
        </div>
      </div>
      <div
        class="file-upload-container"
        :class="{ 'has-play-button': romFileData && romInfo && canPreview }"
      >
        <FileDropZone
          :disabled="busy"
          :file-data="romFileData"
          :file-name="romFileName"
          accept-types=".rom,.gba,.gb,.gbc"
          accept-hint=".rom,.gba,.gb,.gbc"
          :main-text="$t('ui.rom.selectFile')"
          :file-title="romInfo?.title || ''"
          @file-selected="onFileSelected"
          @file-cleared="onFileCleared"
        >
          <template #icon>
            <IonIcon :icon="folderOpenOutline" />
          </template>
        </FileDropZone>
        <button
          v-if="romFileData && romInfo && canPreview"
          :disabled="busy"
          class="play-button"
          @click="playRom"
        >
          <IonIcon :icon="playOutline" />
        </button>
      </div>

      <!-- ROM信息显示 -->
      <RomInfoPanel
        v-if="romFileData && romInfo"
        v-model:is-collapsed="isRomInfoCollapsed"
        :rom-info="romInfo"
        :rom-data="romFileData"
        @rom-updated="onRomUpdated"
      />

      <div class="button-row">
        <button
          v-if="hasAssembledRom"
          @click="useAssembledRom"
        >
          {{ $t('ui.rom.useAssembledRom') }}
        </button>
        <button
          :disabled="!deviceReady || !romFileData || busy"
          @click="$emit('write-rom')"
        >
          {{ $t('ui.rom.write') }}
        </button>
        <button
          :disabled="!deviceReady || busy"
          @click="$emit('read-rom')"
        >
          {{ $t('ui.rom.read') }}
        </button>
        <button
          :disabled="!deviceReady || !romFileData || busy"
          @click="$emit('verify-rom')"
        >
          {{ $t('ui.rom.verify') }}
        </button>
      </div>
    </section>

    <!-- Game Boy Color Emulator -->
    <Suspense>
      <GBCEmulator
        v-if="currentEmulator === 'GBC' || currentEmulator === 'GB'"
        :is-visible="currentEmulator === 'GBC' || currentEmulator === 'GB'"
        :rom-data="emulatorRomData"
        :rom-name="emulatorRomName"
        @close="closeEmulator"
      />
      <template #fallback>
        <div class="emulator-loading">
          <div class="loading-spinner" />
          <p>{{ $t('ui.emulator.loading') }}...</p>
        </div>
      </template>
    </Suspense>

    <!-- GBA Emulator -->
    <Suspense>
      <GBAEmulator
        v-if="currentEmulator === 'GBA'"
        :is-visible="currentEmulator === 'GBA'"
        :rom-data="emulatorRomData"
        :rom-name="emulatorRomName"
        @close="closeEmulator"
      />
      <template #fallback>
        <div class="emulator-loading">
          <div class="loading-spinner" />
          <p>{{ $t('ui.emulator.loading') }}...</p>
        </div>
      </template>
    </Suspense>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { folderOpenOutline, playOutline } from 'ionicons/icons';
import { DateTime } from 'luxon';
import { computed, defineAsyncComponent, onErrorCaptured, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import FileDropZone from '@/components/common/FileDropZone.vue';
import RomInfoPanel from '@/components/common/RomInfoPanel.vue';
import { useToast } from '@/composables/useToast';
import { useRecentFileNamesStore } from '@/stores/recent-file-names-store';
import { useRomAssemblyResultStore } from '@/stores/rom-assembly-store';
import { FileInfo } from '@/types/file-info.ts';
import type { AssembledRom } from '@/types/rom-assembly';
import { GBA_ROM_BASE_ADDRESS, MBC5_ROM_BASE_ADDRESS } from '@/utils/address-utils';
import { formatHex } from '@/utils/formatter-utils';
import { parseRom, type RomInfo } from '@/utils/parsers/rom-parser.ts';

// 动态加载模拟器组件
// const GBEmulator = defineAsyncComponent(() => import('@/components/emulator/GBEmulator.vue'));
const GBCEmulator = defineAsyncComponent(() => import('@/components/emulator/GBCEmulator.vue'));
const GBAEmulator = defineAsyncComponent(() => import('@/components/emulator/GBAEmulator.vue'));

const { t } = useI18n();
const { showToast } = useToast();
const romAssemblyResultStore = useRomAssemblyResultStore();
const recentFileNamesStore = useRecentFileNamesStore();

const props = withDefaults(defineProps<{
  mode: 'MBC5' | 'GBA';
  deviceReady: boolean;
  busy: boolean;
  romFileData?: Uint8Array | null;
  romFileName?: string;
  selectedRomSize?: string;
  selectedBaseAddress?: string;
}>(), {
  romFileData: null,
  romFileName: '',
  selectedRomSize: '0x00800000',
  selectedBaseAddress: '0x00000000',
});

const ROM_SIZE_RANGE = [
  { value: '0x00040000', size: 0x00040000, text: '256KiB' },
  { value: '0x00080000', size: 0x00080000, text: '512KiB' },
  { value: '0x00100000', size: 0x00100000, text: '1MiB' },
  { value: '0x00200000', size: 0x00200000, text: '2MiB' },
];

for (let i = 1; i <= 32; ++i) {
  ROM_SIZE_RANGE.push({ value: formatHex(0x00400000 * i, 4), size: 0x00400000 * i, text: `${i * 4}MiB` });
}

// 不同cartType的baseAddress选项
const getBaseAddressOptions = (romType: 'GBA' | 'MBC5') => {
  const options: Record<string, { value: string; text: string }[]> = {
    MBC5: [
      { value: '0x00000000', text: t('ui.rom.baseAddressOptions.fullCart') },
      { value: '0x00000000', text: t('ui.rom.baseAddressOptions.menu') },
    ],
    GBA: [
      { value: '0x00000000', text: t('ui.rom.baseAddressOptions.fullCart') },
    ],
  };

  for (let i = 0; i < MBC5_ROM_BASE_ADDRESS.length; ++i) {
    options.MBC5.push({ value: formatHex(MBC5_ROM_BASE_ADDRESS[i], 4), text: t('ui.rom.baseAddressOptions.game', { index: i + 1 }) });
  }
  for (let i = 0; i < GBA_ROM_BASE_ADDRESS.length; ++i) {
    options.GBA.push({ value: formatHex(GBA_ROM_BASE_ADDRESS[i], 4), text: t('ui.rom.baseAddressOptions.bank', { index: i }) });
  }

  return options[romType] ?? [];
};

const emit = defineEmits<{
  'file-selected': [file: FileInfo | FileInfo[]];
  'file-cleared': [];
  'mode-switch-required': [newMode: 'MBC5' | 'GBA', romType: string];
  'rom-size-change': [size: string];
  'base-address-change': [address: string];
  'write-rom': [];
  'read-rom': [];
  'verify-rom': [];
}>();

// 模拟器相关状态
const currentEmulator = ref<'GB' | 'GBC' | 'GBA' | null>(null); // 当前显示的模拟器类型
const emulatorRomData = ref<Uint8Array | null>(null);
const emulatorRomName = ref('');

onErrorCaptured((err, instance, info) => {
  console.error('error captured:', err, info);

  if (info.includes('async component') || err.message?.includes('dynamically imported module')) {
    showToast(t('ui.emulator.errors.error'), 'error');

    currentEmulator.value = null;
    emulatorRomData.value = null;
    emulatorRomName.value = '';
  }

  return false;
});

const selectedRomSize = ref(props.selectedRomSize);
// 同步父组件设置的 selectedRomSize
watch(() => props.selectedRomSize, newVal => {
  selectedRomSize.value = newVal;
});
const selectedBaseAddress = ref(props.selectedBaseAddress);
// 同步父组件设置的 selectedBaseAddress
watch(() => props.selectedBaseAddress, newVal => {
  selectedBaseAddress.value = newVal;
});
const romInfo = ref<RomInfo | null>(null);
const isRomInfoCollapsed = ref(true); // 默认折叠

// 计算baseAddress选项
const baseAddressOptions = computed(() => {
  return getBaseAddressOptions(props.mode);
});

// 计算是否可以预览ROM
const canPreview = computed(() => {
  if (!romInfo.value) return false;

  // 只支持 Game Boy, Game Boy Color 和 Game Boy Advance ROM
  const supportedTypes = ['GB', 'GBC', 'GBA'];
  return supportedTypes.includes(romInfo.value.type);
});

// 当ROM文件数据变化时，解析ROM信息
watch(() => props.romFileData, (newData) => {
  if (newData && newData.length > 0) {
    romInfo.value = parseRom(newData);

    // 添加文件名到最近列表
    if (romInfo.value?.isValid) {
      recentFileNamesStore.addFileName(romInfo.value.fileName);
    }

    // 检查ROM类型，根据类型自动切换模式
    if (romInfo.value?.isValid) {
      if (romInfo.value.type === 'GBA' && props.mode !== 'GBA') {
        emit('mode-switch-required', 'GBA', romInfo.value.type);
      } else if ((romInfo.value.type === 'GB' || romInfo.value.type === 'GBC') && props.mode !== 'MBC5') {
        emit('mode-switch-required', 'MBC5', romInfo.value.type);
      }
    }

    // 根据ROM文件大小自动更新选择的ROM大小
    const romSize = newData.byteLength;

    // 找到最接近且不小于ROM大小的选项
    const matchedOption = ROM_SIZE_RANGE.find(option => option.size >= romSize) ?? ROM_SIZE_RANGE[ROM_SIZE_RANGE.length - 1];

    selectedRomSize.value = matchedOption.value;
    // 发射事件通知父组件ROM大小已更改
    emit('rom-size-change', matchedOption.value);
  } else {
    romInfo.value = null;
  }
}, { immediate: true });

function onFileSelected(fileInfo: FileInfo | FileInfo[]) {
  emit('file-selected', fileInfo);
}

function onFileCleared() {
  emit('file-cleared');
}

function onRomSizeChange() {
  emit('rom-size-change', selectedRomSize.value);
}

function onBaseAddressChange() {
  emit('base-address-change', selectedBaseAddress.value);
}

function playRom() {
  if (!props.romFileData || !props.romFileName || !romInfo.value) {
    showToast(t('messages.operation.noRomFile'), 'error');
    return;
  }

  // 设置模拟器数据
  emulatorRomData.value = props.romFileData;
  emulatorRomName.value = props.romFileName;

  // 根据ROM类型选择正确的模拟器
  if (romInfo.value.type === 'Unknown') {
    showToast(t('messages.emulator.unsupportedRom'), 'error');
    return;
  }
  currentEmulator.value = romInfo.value.type;
  showToast(t('messages.emulator.launched', { name: props.romFileName }), 'success');
}

function closeEmulator() {
  currentEmulator.value = null;
  emulatorRomData.value = null;
  emulatorRomName.value = '';
  showToast(t('messages.emulator.closed'), 'success');
}

function onRomAssembled(assembled: AssembledRom) {
  // 将组装的ROM数据作为单个文件传递给父组件
  const assembledFileInfo: FileInfo = {
    name: `assembled_${props.mode.toLowerCase()}_${DateTime.now().toFormat('yyyyMMddTHHmmss')}.bin`,
    data: assembled.data,
    size: assembled.data.length,
  };

  emit('file-selected', assembledFileInfo);
  showToast(t('messages.romAssembly.assembled', {
    size: assembled.totalSize.toString(),
    usedSlots: assembled.slots.filter(s => s.file).length.toString(),
  }), 'success');
}

// 使用组装的ROM
function useAssembledRom() {
  const result = romAssemblyResultStore.consumeResult();

  if (result && result.romType === props.mode) {
    const fileInfo: FileInfo = {
      name: `assembled_${props.mode.toLowerCase()}_${Date.now()}.bin`,
      data: result.rom.data,
      size: result.rom.data.length,
    };

    // 将组装的ROM作为文件选择
    emit('file-selected', fileInfo);

    showToast(t('messages.rom.assembledRomApplied'), 'success');
  } else if (result && result.romType !== props.mode) {
    // 如果类型不匹配，将结果放回store
    romAssemblyResultStore.setResult(result.rom, result.romType);

    showToast(t('messages.rom.assembledRomTypeMismatch', {
      assembled: result.romType,
      current: props.mode,
    }), 'error');
  } else {
    showToast(t('messages.rom.noAssembledRom'), 'error');
  }
}

// 处理ROM信息更新
function onRomUpdated(newRomData: Uint8Array) {
  // 使用更新后的ROM数据重新解析信息
  const updatedRomInfo = parseRom(newRomData);

  // 将更新后的ROM数据作为新文件传递给父组件
  const updatedFileInfo: FileInfo = {
    name: props.romFileName ?? 'updated_rom.bin',
    data: newRomData,
    size: newRomData.length,
  };

  emit('file-selected', updatedFileInfo);
  showToast(t('messages.rom.romInfoUpdated'), 'success');
}

// 计算是否存在已组装的ROM
const hasAssembledRom = computed(() => {
  return romAssemblyResultStore.hasResult && romAssemblyResultStore.romType === props.mode;
});
</script>

<style scoped>
.section {
  margin-bottom: 28px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 12px;
  flex-wrap: wrap;
}

.section h2 {
  font-size: 1.15rem;
  margin: 0;
  color: #2c3e50;
  font-weight: 600;
}

.selector-container {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  min-width: fit-content;
}

.base-address-selector,
.size-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: fit-content;
  flex-shrink: 0;
}

.base-address-label,
.size-label {
  font-size: 0.9rem;
  color: #666;
  margin: 0;
  white-space: nowrap;
}

.base-address-dropdown,
.size-dropdown {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  font-size: 0.9rem;
  color: #333;
  cursor: pointer;
  transition: border-color 0.2s;
  min-width: 80px;
  white-space: nowrap;
}

.base-address-dropdown:hover:not(:disabled),
.size-dropdown:hover:not(:disabled) {
  border-color: #1976d2;
}

.base-address-dropdown:disabled,
.size-dropdown:disabled {
  background: #f5f5f5;
  color: #aaa;
  cursor: not-allowed;
}

.file-upload-container {
  display: flex;
  align-items: stretch;
  gap: 12px;
  width: 100%;
}

/* 默认情况下，FileDropZone 占满整个宽度 */
.file-upload-container > *:first-child {
  flex: 1;
  width: 100%;
}

/* 当有播放按钮时的布局 */
.file-upload-container.has-play-button > *:first-child {
  flex: 0 0 80%;
  width: 80%;
}

.file-upload-container.has-play-button .play-button {
  max-width: none;
  margin-bottom: 12px;
}

.play-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  min-width: 48px;
  background: linear-gradient(135deg, #4caf50 0%, #45a049 100%) !important;
  color: white !important;
  border: none !important;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 1.2rem;
}

.play-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #45a049 0%, #3e8e41 100%) !important;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
}

.play-button:disabled {
  background: #e9ecef !important;
  color: #6c757d !important;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.button-row {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

button {
  padding: 6px 16px;
  border-radius: 5px;
  border: 1px solid #bbb;
  background: #f5f7fa;
  cursor: pointer;
  font-size: 0.95rem;
  transition: background 0.2s, color 0.2s;
  outline: none;
  white-space: nowrap;
  min-width: fit-content;
  flex: 1 1 auto;
}

button:focus {
  outline: none;
}

button:disabled {
  background: #eee;
  color: #aaa;
  cursor: not-allowed;
}

button:not(:disabled):hover {
  background: #e3f2fd;
  color: #1976d2;
}
</style>
