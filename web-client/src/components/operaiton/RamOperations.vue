<template>
  <div class="rom-operations-container">
    <section class="section">
      <div class="section-header">
        <h2>{{ $t('ui.ram.title') }}</h2>
        <div class="selector-container">
          <div class="type-selector">
            <label class="type-label">{{ $t('ui.ram.typeLabel') }}</label>
            <select
              v-model="selectedRamType"
              :disabled="!deviceReady || busy"
              class="type-dropdown"
              @change="onRamTypeChange"
            >
              <option value="SRAM">
                {{ $t('ui.ram.typeSRAM') }}
              </option>
              <option value="FLASH">
                {{ $t('ui.ram.typeFLASH') }}
              </option>
            </select>
          </div>
          <div class="size-selector">
            <label class="size-label">{{ $t('ui.ram.sizeLabel') }}</label>
            <select
              v-model="selectedRamSize"
              :disabled="!deviceReady || busy"
              class="size-dropdown"
              @change="onRamSizeChange"
            >
              <option
                v-for="option in RAM_SIZE_RANGE"
                :key="option.value"
                :value="option.value"
              >
                {{ option.text }}
              </option>
            </select>
          </div>
        </div>
      </div>
      <div class="ram-content">
        <FileDropZone
          :disabled="!deviceReady || busy"
          :file-data="ramFileData"
          :file-name="ramFileName"
          accept-types=".sav,.ram"
          accept-hint=".sav, .ram"
          :main-text="$t('ui.ram.selectFile')"
          :file-title="''"
          @file-selected="onFileSelected"
          @file-cleared="onFileCleared"
        >
          <template #icon>
            <IonIcon :icon="saveOutline" />
          </template>
        </FileDropZone>
        <div class="button-row">
          <button
            :disabled="!deviceReady || !ramFileData || busy"
            @click="$emit('write-ram')"
          >
            {{ $t('ui.ram.write') }}
          </button>
          <button
            :disabled="!deviceReady || busy"
            @click="$emit('read-ram')"
          >
            {{ $t('ui.ram.read') }}
          </button>
          <button
            :disabled="!deviceReady || !ramFileData || busy"
            @click="$emit('verify-ram')"
          >
            {{ $t('ui.ram.verify') }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { saveOutline } from 'ionicons/icons';
import { ref, watch } from 'vue';

import FileDropZone from '@/components/common/FileDropZone.vue';
import { FileInfo } from '@/types/file-info.ts';

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
  ramFileData: {
    type: Uint8Array,
    default: null,
  },
  ramFileName: {
    type: String,
    default: '',
  },
  selectedRamSize: {
    type: String,
    default: '0x8000',
  },
  selectedRamType: {
    type: String,
    default: 'SRAM',
  },
});

const RAM_SIZE_RANGE = [
  { value: '0x2000', size: 0x2000, text: '8KB' }, // 8KB
  { value: '0x8000', size: 0x8000, text: '32KB' }, // 32KB
  { value: '0x10000', size: 0x10000, text: '64KB' }, // 64KB
  { value: '0x20000', size: 0x20000, text: '128KB' }, // 128KB
];

const emit = defineEmits(['file-selected', 'file-cleared', 'write-ram', 'read-ram', 'verify-ram', 'ram-size-change', 'ram-type-change']);

const selectedRamSize = ref(props.selectedRamSize);
const selectedRamType = ref(props.selectedRamType);

// 当RAM文件数据变化时，根据文件大小自动更新选择的RAM大小
watch(() => props.ramFileData, (newData) => {
  if (newData && newData.length > 0) {
    const ramSize = newData.length;

    // 找到最接近且不小于RAM大小的选项
    const matchedOption = RAM_SIZE_RANGE.find(option => option.size >= ramSize) ?? RAM_SIZE_RANGE[RAM_SIZE_RANGE.length - 1];

    selectedRamSize.value = matchedOption.value;
    // 发射事件通知父组件RAM大小已更改
    emit('ram-size-change', matchedOption.value);
  }
}, { immediate: true });

function onFileSelected(fileInfo: FileInfo) {
  emit('file-selected', fileInfo);
}

function onFileCleared() {
  emit('file-cleared');
}

function onRamSizeChange() {
  emit('ram-size-change', selectedRamSize.value);
}

function onRamTypeChange() {
  emit('ram-type-change', selectedRamType.value);
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

.selector-container {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  min-width: fit-content;
}

.type-selector,
.size-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: fit-content;
  flex-shrink: 0;
}

.type-label,
.size-label {
  font-size: 0.9rem;
  color: #666;
  margin: 0;
  white-space: nowrap;
}

.type-dropdown,
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

.type-dropdown:hover:not(:disabled),
.size-dropdown:hover:not(:disabled) {
  border-color: #1976d2;
}

.type-dropdown:disabled,
.size-dropdown:disabled {
  background: #f5f5f5;
  color: #aaa;
  cursor: not-allowed;
}

.button-row {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.mode-info {
  padding: 12px 16px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  color: #6c757d;
  font-size: 0.95rem;
}

.mode-info p {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
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
