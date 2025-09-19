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
            <slot>
              <p class="main-text">
                {{ mainText }}
              </p>
              <p class="sub-text">
                {{ $t('ui.file.dropArea') }}
              </p>
              <p class="hint-text">
                {{ $t('ui.file.accept', { format: acceptHint }) }}
              </p>
            </slot>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="file-preview">
          <div class="file-icon">
            <slot name="icon" />
          </div>
          <div class="file-details">
            <slot name="preview">
              <div class="file-name">
                {{ fileName }}
              </div>
              <div class="file-size">
                {{ fileData ? formatBytes(fileData.length) : '' }}
              </div>
              <div class="file-title">
                {{ fileTitle }}
              </div>
            </slot>
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
  const blob = new Blob([fileData.value as BlobPart], { type: 'application/octet-stream' });
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
  margin-bottom: var(--space-3);
}

.file-drop-zone {
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-lg);
  padding: 0 !important;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: var(--color-bg);
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
  border-color: var(--color-primary);
  background: #f8faff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.1);
}

.file-drop-zone.drag-over {
  border-color: var(--color-primary);
  background: #e3f2fd;
  transform: scale(1.02);
}

.file-drop-zone.has-file {
  border-color: var(--color-success);
  background: #f1f8e9;
  border-style: solid;
}

.file-drop-zone.disabled {
  cursor: not-allowed;
  opacity: 0.6;
  border-color: var(--color-border-light);
  background: var(--color-bg-secondary);
}

.drop-zone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  height: 100%;
  min-height: 80px;
  padding: var(--space-4);
}

.upload-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  margin-bottom: var(--space-1);
  opacity: 0.7;
}

.upload-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  align-items: center;
}

.main-text {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: #2c3e50;
  margin: 0;
}

.sub-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin: 0;
}

.hint-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin: 0;
}

.file-preview {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 80px;
  padding: var(--space-4);
  background: var(--color-bg);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  justify-content: flex-start;
  overflow: hidden;
  box-sizing: border-box;
}

.file-icon {
  font-size: 2.2em;
  color: var(--color-primary);
  margin-bottom: 0;
  margin-right: var(--space-2);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
}

.file-details {
  flex: 1 1 0;
  min-width: 0;
  max-width: calc(100% - 80px);
  width: 0;
  text-align: left;
  overflow: hidden;
}

.file-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: #2c3e50;
  margin-bottom: var(--space-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  width: 100%;
}

.file-size {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-half);
}

.file-title {
  font-size: var(--font-size-xs);
  color: var(--color-success);
  font-weight: var(--font-weight-medium);
}

.remove-file-btn {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-error);
  background: var(--color-bg);
  color: var(--color-error);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  padding: 0;
}

.remove-file-btn:hover:not(:disabled) {
  background: var(--color-error);
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
  border-radius: var(--radius-full);
  border: 1px solid var(--color-primary);
  background: var(--color-bg);
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  padding: 0;
  margin-right: var(--space-2);
}

.download-file-btn:hover:not(:disabled) {
  background: var(--color-primary);
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
  gap: var(--space-2);
}
</style>
