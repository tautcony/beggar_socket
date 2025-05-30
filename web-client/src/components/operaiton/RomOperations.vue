<template>
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
    <FileDropZone
      :disabled="!deviceReady || busy"
      :file-data="romFileData"
      :file-name="romFileName"
      accept-types=".rom,.gba,.gb,.gbc"
      accept-hint=".rom,.gba,.gb,.gbc"
      icon="📁"
      :main-text="$t('ui.rom.selectFile')"
      :file-type="$t('ui.rom.title')"
      @file-selected="onFileSelected"
      @file-cleared="onFileCleared"
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
</template>

<script setup lang="ts">
import FileDropZone from '../FileDropZone.vue'
import { FileInfo } from '../../types/FileInfo.ts'
import { ref } from 'vue'

const props = defineProps({
  deviceReady: {
    type: Boolean,
    required: true
  },
  busy: {
    type: Boolean,
    required: true
  },
  romFileData: {
    type: Uint8Array,
    default: null
  },
  romFileName: {
    type: String,
    default: ''
  },
  selectedRomSize: {
    type: String,
    default: '0x200000'
  }
})

const emit = defineEmits(['file-selected', 'file-cleared', 'write-rom', 'read-rom', 'verify-rom', 'rom-size-change'])

const selectedRomSize = ref(props.selectedRomSize)

function onFileSelected(fileInfo: FileInfo) {
  emit('file-selected', fileInfo)
}

function onFileCleared() {
  emit('file-cleared')
}

function onRomSizeChange() {
  emit('rom-size-change', selectedRomSize.value)
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
