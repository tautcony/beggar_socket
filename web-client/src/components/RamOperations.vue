<template>
  <section class="section">
    <h2>RAM 操作</h2>
    <div
      v-if="mode === 'GBA'"
      class="ram-content"
    >
      <FileDropZone
        :disabled="!deviceReady || busy"
        :file-data="ramFileData"
        :file-name="ramFileName"
        accept-types=".sav,.ram"
        accept-hint=".sav, .ram"
        icon="💾"
        main-text="点击选择RAM文件"
        file-type="RAM 文件"
        @file-selected="onFileSelected"
        @file-cleared="onFileCleared"
      />
      <div class="button-row">
        <button
          :disabled="!deviceReady || !ramFileData || busy"
          @click="$emit('write-ram')"
        >
          写入RAM
        </button>
        <button
          :disabled="!deviceReady || busy"
          @click="$emit('read-ram')"
        >
          导出RAM
        </button>
        <button
          :disabled="!deviceReady || !ramFileData || busy"
          @click="$emit('verify-ram')"
        >
          校验RAM
        </button>
      </div>
      <ProgressDisplay
        :progress="ramWriteProgress"
        :detail="ramWriteDetail"
      />
    </div>
    <div
      v-else
      class="mode-info"
    >
      <p>💡 MBC5 模式下 RAM 操作不可用</p>
    </div>
  </section>
</template>

<script setup>
import FileDropZone from './FileDropZone.vue'
import ProgressDisplay from './ProgressDisplay.vue'

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
  }
})

const emit = defineEmits(['file-selected', 'file-cleared', 'write-ram', 'read-ram', 'verify-ram'])

function onFileSelected(fileInfo) {
  emit('file-selected', fileInfo)
}

function onFileCleared() {
  emit('file-cleared')
}
</script>

<style scoped>
.section {
  margin-bottom: 28px;
}

.section h2 {
  font-size: 1.15rem;
  margin-bottom: 10px;
  color: #2c3e50;
  font-weight: 600;
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
