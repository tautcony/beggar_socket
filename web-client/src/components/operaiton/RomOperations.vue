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
          icon="folder-open-outline"
          :main-text="$t('ui.rom.selectFile')"
          :file-title="romInfo?.title || ''"
          @file-selected="onFileSelected"
          @file-cleared="onFileCleared"
        />
        <button
          v-if="romFileData && romInfo && canPreview"
          :disabled="busy"
          class="play-button"
          @click="playRom"
        >
          <IonIcon name="play-outline" />
        </button>
      </div>

      <!-- ROM信息显示 -->
      <div
        v-if="romFileData && romInfo"
        class="rom-info-panel"
      >
        <h3
          class="rom-info-title"
          @click="toggleRomInfoCollapsed"
        >
          <IonIcon
            name="information-circle-outline"
            class="info-icon"
          />
          {{ $t('ui.rom.info') }}
          <IonIcon
            :name="isRomInfoCollapsed ? 'chevron-down' : 'chevron-up'"
            class="collapse-icon"
          />
        </h3>
        <div
          class="rom-info-content"
          :class="{ 'collapsed': isRomInfoCollapsed }"
        >
          <div class="rom-info-grid">
            <div class="rom-info-item">
              <span class="rom-info-label">{{ $t('ui.rom.romTitle') }}:</span>
              <span class="rom-info-value">{{ romInfo.title }}</span>
            </div>
            <div class="rom-info-item">
              <span class="rom-info-label">{{ $t('ui.rom.type') }}:</span>
              <span
                class="rom-info-value rom-type"
                :class="romInfo.type.toLowerCase()"
              >{{ romInfo.type }}</span>
            </div>
            <div
              v-if="romInfo.gameCode"
              class="rom-info-item"
            >
              <span class="rom-info-label">{{ $t('ui.rom.gameCode') }}:</span>
              <span class="rom-info-value">{{ romInfo.gameCode }}</span>
            </div>
            <div
              v-if="romInfo.makerCode"
              class="rom-info-item"
            >
              <span class="rom-info-label">{{ $t('ui.rom.maker') }}:</span>
              <span class="rom-info-value">{{ romInfo.makerCode }}</span>
            </div>
            <div
              v-if="romInfo.version !== undefined"
              class="rom-info-item"
            >
              <span class="rom-info-label">{{ $t('ui.rom.version') }}:</span>
              <span class="rom-info-value">v{{ romInfo.version }}</span>
            </div>
            <div
              v-if="romInfo.region"
              class="rom-info-item"
            >
              <span class="rom-info-label">{{ $t('ui.rom.region') }}:</span>
              <span class="rom-info-value">{{ romInfo.region }}</span>
            </div>
            <div class="rom-info-item">
              <span class="rom-info-label">{{ $t('ui.rom.romSize') }}:</span>
              <span class="rom-info-value">{{ formatBytes(romInfo.romSize) }}</span>
            </div>
            <div
              v-if="romInfo.ramSize !== undefined && romInfo.ramSize > 0"
              class="rom-info-item"
            >
              <span class="rom-info-label">{{ $t('ui.rom.ramSize') }}:</span>
              <span class="rom-info-value">{{ formatBytes(romInfo.ramSize) }}</span>
            </div>
            <div
              v-if="romInfo.cartType !== undefined"
              class="rom-info-item"
            >
              <span class="rom-info-label">{{ $t('ui.rom.cartType') }}:</span>
              <span class="rom-info-value">{{ CartridgeTypeMapper[romInfo.cartType] }}</span>
            </div>
            <div class="rom-info-item">
              <span class="rom-info-label">{{ $t('ui.rom.valid') }}:</span>
              <span
                class="rom-info-value rom-validity"
                :class="romInfo.isValid ? 'valid' : 'invalid'"
              >
                <IonIcon
                  :name="romInfo.isValid ? 'checkmark-circle' : 'close-circle'"
                  class="validity-icon"
                />
                {{ romInfo.isValid ? $t('ui.common.yes') : $t('ui.common.no') }}
              </span>
            </div>
          </div>
        </div>
      </div>

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

    <!-- Game Boy Emulator -->
    <Suspense>
      <GBEmulator
        v-if="showEmulator"
        :rom-data="emulatorRomData"
        :rom-name="emulatorRomName"
        :is-visible="showEmulator"
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
        v-if="showGBAEmulator"
        :rom-data="emulatorRomData"
        :rom-name="emulatorRomName"
        :is-visible="showGBAEmulator"
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
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import FileDropZone from '@/components/common/FileDropZone.vue';
import { useToast } from '@/composables/useToast';
import { FileInfo } from '@/types/file-info.ts';
import { formatBytes } from '@/utils/formatter-utils';
import { CartridgeTypeMapper, parseRom, type RomInfo } from '@/utils/rom-parser.ts';

// 动态加载模拟器组件
const GBEmulator = defineAsyncComponent(() => import('@/components/emulator/GBEmulator.vue'));
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
const showEmulator = ref(false);
const showGBAEmulator = ref(false);
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

// 切换ROM信息折叠状态
function toggleRomInfoCollapsed() {
  isRomInfoCollapsed.value = !isRomInfoCollapsed.value;
}

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
  if (romInfo.value.type === 'GBA') {
    showGBAEmulator.value = true;
    showEmulator.value = false;
    showToast(t('messages.emulator.launched', { name: props.romFileName }), 'success');
  } else if (romInfo.value.type === 'GB' || romInfo.value.type === 'GBC') {
    showEmulator.value = true;
    showGBAEmulator.value = false;
    showToast(t('messages.emulator.launched', { name: props.romFileName }), 'success');
  } else {
    showToast(t('messages.emulator.unsupportedRom'), 'error');
    return;
  }
}

function closeEmulator() {
  showEmulator.value = false;
  showGBAEmulator.value = false;
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

/* ROM信息面板样式 */
.rom-info-panel {
  margin-bottom: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 1px solid #dee2e6;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.rom-info-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #495057;
  cursor: pointer;
  transition: color 0.2s ease;
  user-select: none;
}

.rom-info-title:hover {
  color: #007bff;
}

.info-icon {
  font-size: 1.2rem;
  color: #007bff;
}

.collapse-icon {
  margin-left: auto;
  font-size: 1rem;
  transition: transform 0.3s ease;
  color: #6c757d;
}

.rom-info-content {
  background: #ffffff;
  border-radius: 6px;
  padding: 16px;
  border: 1px solid #e9ecef;
  overflow: hidden;
  transition: max-height 0.3s ease, opacity 0.3s ease, padding 0.3s ease;
  max-height: 500px;
  opacity: 1;
  margin-top: 16px;
}

.rom-info-content.collapsed {
  max-height: 0;
  opacity: 0;
  padding: 0 16px;
  margin-top: 0;
}

.rom-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
}

.rom-info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 4px;
  border-left: 3px solid #007bff;
}

.rom-info-label {
  font-weight: 500;
  color: #495057;
  white-space: nowrap;
}

.rom-info-value {
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  color: #212529;
  text-align: right;
  word-break: break-all;
}

.rom-type {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
}

.rom-type.gba {
  background: linear-gradient(45deg, #4e54c8, #8f94fb);
  color: white;
}

.rom-type.gb {
  background: linear-gradient(45deg, #90a955, #b8c77a);
  color: white;
}

.rom-type.gbc {
  background: linear-gradient(45deg, #ff6b6b, #ffa726);
  color: white;
}

.rom-type.unknown {
  background: linear-gradient(45deg, #6c757d, #adb5bd);
  color: white;
}

.rom-validity {
  display: flex;
  align-items: center;
  gap: 4px;
}

.validity-icon {
  font-size: 1.1rem;
}

.rom-validity.valid {
  color: #28a745;
}

.rom-validity.invalid {
  color: #dc3545;
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
