<template>
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
            <option value="0x2000">
              8KB
            </option>
            <option value="0x8000">
              32KB
            </option>
            <option value="0x10000">
              64KB
            </option>
            <option value="0x20000">
              128KB
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
        icon="💾"
        :main-text="$t('ui.ram.selectFile')"
        :file-type="$t('ui.ram.title')"
        @file-selected="onFileSelected"
        @file-cleared="onFileCleared"
      />
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
      <ProgressDisplay
        :progress="ramWriteProgress"
        :detail="ramWriteDetail"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import FileDropZone from '../FileDropZone.vue'
import ProgressDisplay from '../ProgressDisplay.vue'
import { FileInfo } from '../../types/FileInfo.ts'
import { ref } from 'vue'

const props = defineProps({
  mode: {
    type: String,
    required: true
  },
  deviceReady: {
    type: Boolean,
    required: true
  },
  busy: {
    type: Boolean,
    required: true
  },
  ramFileData: {
    type: Uint8Array,
    default: null
  },
  ramFileName: {
    type: String,
    default: ''
  },
  ramWriteProgress: {
    type: Number,
    default: null
  },
  ramWriteDetail: {
    type: String,
    default: ''
  },
  selectedRamSize: {
    type: String,
    default: '0x8000'
  },
  selectedRamType: {
    type: String,
    default: 'SRAM'
  }
})

const emit = defineEmits(['file-selected', 'file-cleared', 'write-ram', 'read-ram', 'verify-ram', 'ram-size-change', 'ram-type-change'])

const selectedRamSize = ref(props.selectedRamSize)
const selectedRamType = ref(props.selectedRamType)

function onFileSelected(fileInfo: FileInfo) {
  emit('file-selected', fileInfo)
}

function onFileCleared() {
  emit('file-cleared')
}

function onRamSizeChange() {
  emit('ram-size-change', selectedRamSize.value)
}

function onRamTypeChange() {
  emit('ram-type-change', selectedRamType.value)
}
</script>

<style scoped>
.section {
  margin-bottom: 28px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
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
}

.type-selector,
.size-selector {
  display: flex;
  align-items: center;
  gap: 0px;
}

.type-label,
.size-label {
  font-size: 0.9rem;
  color: #666;
  margin: 0;
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
  gap: 16px;
  margin-bottom: 8px;
  flex-wrap: wrap;
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
  padding: 6px 18px;
  border-radius: 5px;
  border: 1px solid #bbb;
  background: #f5f7fa;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s, color 0.2s;
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
