<template>
  <div class="file-upload-area">
    <div
      class="file-drop-zone"
      :class="{
        'has-file': fileData,
        'drag-over': dragOver,
        'disabled': disabled
      }"
      @click="onZoneClick"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
    >
      <input
        ref="fileInput"
        type="file"
        :accept="acceptTypes"
        :disabled="disabled"
        :multiple="multiple"
        style="display: none"
        @change="onFileChange"
      >
      <template v-if="!fileData">
        <div class="drop-zone-content">
          <div class="upload-icon">
            <slot name="icon" />
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
      </template>
      <template v-else>
        <div class="file-preview">
          <div class="file-icon">
            <slot name="icon" />
          </div>
          <div class="file-details">
            <div class="file-name">
              {{ fileName }}
            </div>
            <div class="file-size">
              {{ fileData ? formatBytes(fileData.length) : '' }}
            </div>
            <div class="file-title">
              {{ fileTitle }}
            </div>
          </div>
          <div class="file-actions">
            <button
              class="remove-file-btn"
              :disabled="disabled"
              @click.stop="clearFile"
            >
              <IonIcon :icon="closeOutline" />
            </button>
            <button
              class="download-file-btn"
              :disabled="disabled || !fileData"
              @click.stop="downloadFile"
            >
              <IonIcon :icon="downloadOutline" />
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { closeOutline, downloadOutline } from 'ionicons/icons';
import { ref, toRefs, useTemplateRef } from 'vue';

import { FileInfo } from '@/types/file-info';
import { formatBytes } from '@/utils/formatter-utils';

const props = withDefaults(defineProps<{
  disabled?: boolean;
  acceptTypes: string;
  acceptHint: string;
  mainText: string;
  fileTitle: string;
  fileData?: Uint8Array | null;
  fileName?: string;
  multiple?: boolean;
}>(), {
  disabled: false,
  fileData: null,
  fileName: '',
  multiple: false,
});
// 解构 props 为 ref，方便在函数中使用
const { fileData, fileName, disabled, multiple } = toRefs(props);

const emit = defineEmits<{
  'file-selected': [file: FileInfo | FileInfo[]];
  'file-cleared': [];
}>();

const dragOver = ref(false);
const fileInput = useTemplateRef<HTMLInputElement>('fileInput');

function onFileChange(e: Event) {
  if (e.target && (e.target as HTMLInputElement).files?.length) {
    const files = (e.target as HTMLInputElement).files;
    if (!files || files.length === 0) {
      return;
    }

    if (multiple.value) {
      processFiles(Array.from(files));
    } else {
      processFile(files[0]);
    }
  }
}

function processFiles(files: File[]) {
  const fileInfos: FileInfo[] = [];
  let processedCount = 0;

  for (const file of files) {
    const reader = new FileReader();
    reader.onload = () => {
      const data = new Uint8Array(reader.result as ArrayBuffer);
      fileInfos.push({
        name: file.name,
        data: data,
        size: data.length,
      } as FileInfo);

      processedCount++;
      if (processedCount === files.length) {
        emit('file-selected', fileInfos);
      }
    };
    reader.readAsArrayBuffer(file);
  }
}

function processFile(file: File) {
  const reader = new FileReader();
  reader.onload = () => {
    const data = new Uint8Array(reader.result as ArrayBuffer);
    emit('file-selected', {
      name: file.name,
      data: data,
      size: data.length,
    } as FileInfo);
  };
  reader.readAsArrayBuffer(file);
}

function onZoneClick(e: Event) {
  if (disabled.value) return;
  // 只允许点击空白区域或文件预览区域外部时触发文件选择
  if (!fileData.value) {
    fileInput.value?.click();
  }
}

function clearFile() {
  if (fileInput.value) fileInput.value.value = '';
  emit('file-cleared');
}

/** 下载当前文件 */
function downloadFile() {
  if (!fileData.value || !fileName.value) return;
  const blob = new Blob([fileData.value], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.value;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function handleDragOver(e: Event) {
  if (disabled.value) return;
  dragOver.value = true;
}

function handleDragLeave() {
  dragOver.value = false;
}

function handleDrop(e: DragEvent) {
  dragOver.value = false;
  if (disabled.value) return;

  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    if (multiple.value) {
      processFiles(Array.from(files));
    } else {
      processFile(files[0]);
    }
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
  padding: 0;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: #fafbfc;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  word-wrap: break-word;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.file-drop-zone > * {
  width: 100%;
  max-width: 100%;
  min-width: 0;
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
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 100%;
  min-height: 80px;
  padding: 16px;
}

.upload-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  margin-bottom: 4px;
  opacity: 0.7;
}

.upload-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
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
  max-width: 100%;
  min-width: 0;
  min-height: 80px;
  padding: 16px;
  background: white;
  border-radius: 6px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  justify-content: flex-start;
  overflow: hidden;
  box-sizing: border-box; /* 确保 padding 包含在宽度内 */
}

.file-icon {
  font-size: 2.2em;
  color: #1976d2;
  margin-bottom: 0;
  margin-right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
}

.file-details {
  flex: 1 1 0;  /* 改为固定的 flex-basis */
  min-width: 0;
  max-width: calc(100% - 80px); /* 减去图标和按钮的空间 */
  width: 0;     /* 强制设置 width 为 0，配合 flex 使用 */
  text-align: left;
  overflow: hidden;
}

.file-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;  /* 确保不超过父容器 */
  width: 100%;      /* 占满父容器宽度 */
}

.file-size {
  font-size: 0.8rem;
  color: #6c757d;
  margin-bottom: 1px;
}

.file-title {
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

.download-file-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid #007bff;
  background: #fff;
  color: #007bff;
  font-size: 0.8rem;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  padding: 0;
  margin-right: 8px; /* 右侧留出间距 */
}

.download-file-btn:hover:not(:disabled) {
  background: #007bff;
  color: white;
  transform: scale(1.1);
}

.download-file-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 按钮容器，垂直布局 */
.file-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
