<template>
  <section class="section">
    <h2>ROM 操作</h2>
    <FileDropZone
      :disabled="!deviceReady || busy"
      :file-data="romFileData"
      :file-name="romFileName"
      accept-types=".rom,.gba,.gb,.gbc"
      accept-hint=".rom, .gba, .gb, .gbc"
      icon="📁"
      main-text="点击选择ROM文件"
      file-type="ROM 文件"
      @file-selected="onFileSelected"
      @file-cleared="onFileCleared"
    />
    <div class="button-row">
      <button
        :disabled="!deviceReady || !romFileData || busy"
        @click="$emit('write-rom')"
      >
        写入ROM
      </button>
      <button
        :disabled="!deviceReady || busy"
        @click="$emit('read-rom')"
      >
        导出ROM
      </button>
      <button
        :disabled="!deviceReady || !romFileData || busy"
        @click="$emit('verify-rom')"
      >
        校验ROM
      </button>
    </div>
    <ProgressDisplay
      :progress="writeProgress"
      :detail="writeDetail"
    />
  </section>
</template>

<script setup>
import FileDropZone from './FileDropZone.vue'
import ProgressDisplay from './ProgressDisplay.vue'

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
  writeProgress: {
    type: Number,
    default: null
  },
  writeDetail: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['file-selected', 'file-cleared', 'write-rom', 'read-rom', 'verify-rom'])

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

button {
  padding: 6px 18px;
  border-radius: 5px;
  border: 1px solid #bbb;
  background: #f5f7fa;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s, color 0.2s;
  outline: none;
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
