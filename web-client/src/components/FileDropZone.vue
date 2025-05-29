<template>
  <div class="file-upload-area">
    <div 
      class="file-drop-zone"
      :class="{ 
        'has-file': fileData,
        'drag-over': dragOver,
        'disabled': disabled
      }"
      @click="triggerFileSelect"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
    >
      <input 
        ref="fileInput"
        type="file" 
        :disabled="disabled" 
        style="display: none"
        :accept="acceptTypes"
        @change="onFileChange"
      >
      <div
        v-if="!fileData"
        class="drop-zone-content"
      >
        <div class="upload-icon">
          {{ icon }}
        </div>
        <div class="upload-text">
          <p class="main-text">
            {{ mainText }}
          </p>
          <p class="sub-text">
            {{ $t('ui.file.dropArea') }}
          </p>
          <p class="hint-text">
            {{ $t('ui.file.accept', { format: acceptHint }) }}
          </p>
        </div>
      </div>
      <div
        v-else
        class="file-preview"
      >
        <div class="file-icon">
          {{ icon }}
        </div>
        <div class="file-details">
          <div class="file-name">
            {{ fileName }}
          </div>
          <div class="file-size">
            {{ formatFileSize(fileData.length) }}
          </div>
          <div class="file-type">
            {{ fileType }}
          </div>
        </div>
        <button 
          class="remove-file-btn"
          :disabled="disabled"
          @click.stop="clearFile"
        >
          ✕
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { FileInfo } from '@/types/FileInfo.ts'

const props = defineProps({
  disabled: {
    type: Boolean,
    default: false
  },
  acceptTypes: {
    type: String,
    required: true
  },
  acceptHint: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    required: true
  },
  mainText: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  fileData: {
    type: Uint8Array,
    default: null
  },
  fileName: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['file-selected', 'file-cleared'])

const dragOver = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function onFileChange(e: Event) {
if (e.target && (e.target as HTMLInputElement).files && (e.target as HTMLInputElement).files?.length) {
    const files = (e.target as HTMLInputElement).files;
    if (!files || files.length === 0) {
      return
    }
    processFile(files[0])
  }
}

function processFile(file: File) {
  const reader = new FileReader()
  reader.onload = () => {
    const data = new Uint8Array(reader.result as ArrayBuffer)
    emit('file-selected', {
      name: file.name,
      data: data,
      size: data.length
    } as FileInfo)
  }
  reader.readAsArrayBuffer(file)
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function triggerFileSelect() {
  if (props.disabled) return
  fileInput?.value?.click()
}

function clearFile() {
  if (fileInput.value) fileInput.value.value = ''
  emit('file-cleared')
}

function handleDragOver(e: Event) {
  if (props.disabled) return
  dragOver.value = true
}

function handleDragLeave() {
  dragOver.value = false
}

function handleDrop(e: DragEvent) {
  dragOver.value = false
  if (props.disabled) return

  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    processFile(files[0])
  }
}
</script>

<style scoped>
.file-upload-area {
  margin-bottom: 12px;
}

.file-drop-zone {
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: #fafbfc;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-drop-zone:hover:not(.disabled) {
  border-color: #1976d2;
  background: #f8faff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.1);
}

.file-drop-zone.drag-over {
  border-color: #1976d2;
  background: #e3f2fd;
  transform: scale(1.02);
}

.file-drop-zone.has-file {
  border-color: #4caf50;
  background: #f1f8e9;
  border-style: solid;
}

.file-drop-zone.disabled {
  cursor: not-allowed;
  opacity: 0.6;
  border-color: #e0e0e0;
  background: #f5f5f5;
}

.drop-zone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.upload-icon {
  font-size: 2rem;
  margin-bottom: 4px;
  opacity: 0.7;
}

.upload-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.main-text {
  font-size: 0.95rem;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;
}

.sub-text {
  font-size: 0.85rem;
  color: #6c757d;
  margin: 0;
}

.hint-text {
  font-size: 0.75rem;
  color: #9ca3af;
  margin: 0;
}

.file-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 6px 8px;
  background: white;
  border-radius: 6px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.file-icon {
  font-size: 1.8rem;
  opacity: 0.8;
}

.file-details {
  flex: 1;
  text-align: left;
}

.file-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 2px;
  word-break: break-all;
}

.file-size {
  font-size: 0.8rem;
  color: #6c757d;
  margin-bottom: 1px;
}

.file-type {
  font-size: 0.75rem;
  color: #4caf50;
  font-weight: 500;
}

.remove-file-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid #dc3545;
  background: #fff;
  color: #dc3545;
  font-size: 0.8rem;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  padding: 0;
}

.remove-file-btn:hover:not(:disabled) {
  background: #dc3545;
  color: white;
  transform: scale(1.1);
}

.remove-file-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
