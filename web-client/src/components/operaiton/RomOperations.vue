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
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import FileDropZone from '@/components/common/FileDropZone.vue';
import RomInfoPanel from '@/components/common/RomInfoPanel.vue';
import { useToast } from '@/composables/useToast';
import { assembledRomState, clearAssembledRom } from '@/stores/assembled-rom-store';
import { FileInfo } from '@/types/file-info.ts';
import type { AssembledRom } from '@/types/rom-assembly';
import { formatHex } from '@/utils/formatter-utils';
import { parseRom, type RomInfo } from '@/utils/rom-parser.ts';

// 动态加载模拟器组件
// const GBEmulator = defineAsyncComponent(() => import('@/components/emulator/GBEmulator.vue'));
const GBCEmulator = defineAsyncComponent(() => import('@/components/emulator/GBCEmulator.vue'));
const GBAEmulator = defineAsyncComponent(() => import('@/components/emulator/GBAEmulator.vue'));

const { t } = useI18n();
const { showToast } = useToast();

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
  { value: '0x00040000', size: 0x00040000, text: '256KB' },
  { value: '0x00080000', size: 0x00080000, text: '512KB' },
  { value: '0x00100000', size: 0x00100000, text: '1MB' },
  { value: '0x00200000', size: 0x00200000, text: '2MB' },
];

for (let i = 1; i <= 32; ++i) {
  ROM_SIZE_RANGE.push({ value: formatHex(0x00400000 * i, 4), size: 0x00400000 * i, text: `${i * 4}MB` });
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

  for (let i = 1; i <= 16; ++i) {
    options.MBC5.push({ value: formatHex(0x100000 * i, 4), text: t('ui.rom.baseAddressOptions.game', { index: i }) });
  }
  for (let i = 0; i < 32; ++i) {
    options.GBA.push({ value: formatHex(0x400000 * i, 4), text: t('ui.rom.baseAddressOptions.bank', { index: i }) });
  }

  return options[romType] ?? [];
};

const emit = defineEmits(['file-selected', 'file-cleared', 'write-rom', 'read-rom', 'verify-rom', 'rom-size-change', 'base-address-change', 'mode-switch-required']);

// 模拟器相关状态
const currentEmulator = ref<'GB' | 'GBC' | 'GBA' | null>(null); // 当前显示的模拟器类型
const emulatorRomData = ref<Uint8Array | null>(null);
const emulatorRomName = ref('');

const selectedRomSize = ref(props.selectedRomSize);
const selectedBaseAddress = ref(props.selectedBaseAddress);
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

function onFileSelected(fileInfo: FileInfo) {
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
    name: `assembled_${props.mode.toLowerCase()}_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.bin`,
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
  if (assembledRomState.value && assembledRomState.value.romType === props.mode) {
    const fileInfo: FileInfo = {
      name: `assembled_${props.mode.toLowerCase()}_${Date.now()}.bin`,
      data: assembledRomState.value.rom.data,
      size: assembledRomState.value.rom.data.length,
    };

    // 将组装的ROM作为文件选择
    emit('file-selected', fileInfo);

    // 清除组装的ROM状态
    clearAssembledRom();

    showToast(t('messages.rom.assembledRomApplied'), 'success');
  } else if (assembledRomState.value && assembledRomState.value.romType !== props.mode) {
    showToast(t('messages.rom.assembledRomTypeMismatch', {
      assembled: assembledRomState.value.romType,
      current: props.mode,
    }), 'error');
  } else {
    showToast(t('messages.rom.noAssembledRom'), 'error');
  }
}

// 计算是否存在已组装的ROM
const hasAssembledRom = computed(() => {
  return assembledRomState.value !== null && assembledRomState.value.romType === props.mode;
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

.preview-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  color: white !important;
  border: none !important;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
}

.preview-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%) !important;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.preview-button:disabled {
  background: #e9ecef !important;
  color: #6c757d !important;
}

.button-icon {
  font-size: 1rem;
}
</style>
