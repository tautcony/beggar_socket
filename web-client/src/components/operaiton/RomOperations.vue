<template>
  <div class="rom-operations-container">
    <section class="section">
      <div class="section-header">
        <h2>{{ $t('ui.rom.title') }}</h2>
        <div class="size-selector">
          <label class="size-label">{{ $t('ui.rom.sizeLabel') }}</label>
          <select
            v-model="selectedRomSize"
            :disabled="!deviceReady || busy"
            class="size-dropdown"
            @change="onRomSizeChange"
          >
            <option value="0x80000">
              512KB
            </option>
            <option value="0x100000">
              1MB
            </option>
            <option value="0x200000">
              2MB
            </option>
            <option value="0x400000">
              4MB
            </option>
            <option value="0x800000">
              8MB
            </option>
            <option value="0x1000000">
              16MB
            </option>
            <option value="0x2000000">
              32MB
            </option>
          </select>
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
import { FileInfo } from '@/types/file-info.ts';
import { parseRom, type RomInfo } from '@/utils/rom-parser.ts';

// 动态加载模拟器组件
// const GBEmulator = defineAsyncComponent(() => import('@/components/emulator/GBEmulator.vue'));
const GBCEmulator = defineAsyncComponent(() => import('@/components/emulator/GBCEmulator.vue'));
const GBAEmulator = defineAsyncComponent(() => import('@/components/emulator/GBAEmulator.vue'));

const { t } = useI18n();
const { showToast } = useToast();

const props = defineProps({
  mode: {
    type: String,
    required: true,
  },
  deviceReady: {
    type: Boolean,
    required: true,
  },
  busy: {
    type: Boolean,
    required: true,
  },
  romFileData: {
    type: Uint8Array,
    default: null,
  },
  romFileName: {
    type: String,
    default: '',
  },
  selectedRomSize: {
    type: String,
    default: '0x800000',
  },
});

const emit = defineEmits(['file-selected', 'file-cleared', 'write-rom', 'read-rom', 'verify-rom', 'rom-size-change', 'mode-switch-required']);

// 模拟器相关状态
const currentEmulator = ref<'GB' | 'GBC' | 'GBA' | null>(null); // 当前显示的模拟器类型
const emulatorRomData = ref<Uint8Array | null>(null);
const emulatorRomName = ref('');

const selectedRomSize = ref(props.selectedRomSize);
const romInfo = ref<RomInfo | null>(null);
const isRomInfoCollapsed = ref(true); // 默认折叠

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
    if (romInfo.value) {
      if (romInfo.value.type === 'GBA' && props.mode !== 'GBA') {
        emit('mode-switch-required', 'GBA', romInfo.value.type);
      } else if ((romInfo.value.type === 'GB' || romInfo.value.type === 'GBC') && props.mode !== 'MBC5') {
        emit('mode-switch-required', 'MBC5', romInfo.value.type);
      }
    }

    // 根据ROM文件大小自动更新选择的ROM大小
    if (romInfo.value?.romSize) {
      const romSize = romInfo.value.romSize;
      // 预定义的ROM大小选项
      const sizeOptions = [
        { value: '0x80000', size: 0x80000 }, // 512KB
        { value: '0x100000', size: 0x100000 }, // 1MB
        { value: '0x200000', size: 0x200000 }, // 2MB
        { value: '0x400000', size: 0x400000 }, // 4MB
        { value: '0x800000', size: 0x800000 }, // 8MB
        { value: '0x1000000', size: 0x1000000 }, // 16MB
        { value: '0x2000000', size: 0x2000000 }, // 32MB
      ];

      // 找到最接近且不小于ROM大小的选项
      const matchedOption = sizeOptions.find(option => option.size >= romSize) || sizeOptions[sizeOptions.length - 1];

      selectedRomSize.value = matchedOption.value;
      // 发射事件通知父组件ROM大小已更改
      emit('rom-size-change', matchedOption.value);
    }
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

.size-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: fit-content;
  flex-shrink: 0;
}

.size-label {
  font-size: 0.9rem;
  color: #666;
  margin: 0;
}

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

.size-dropdown:hover:not(:disabled) {
  border-color: #1976d2;
}

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
