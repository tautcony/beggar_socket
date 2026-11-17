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
              <RetroIcon icon="pixelarticons:close" />
            </button>
            <button
              class="download-file-btn"
              :disabled="disabled || !fileData"
              :title="$t('ui.file.download')"
              :aria-label="$t('ui.file.download')"
              @click.stop="downloadFile"
            >
              <RetroIcon icon="pixelarticons:download" />
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, toRefs, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';

import { RetroIcon } from '@/components/retro';
import { useToast } from '@/composables/useToast';
import { saveBinaryFile } from '@/platform/native';
import { FileInfo } from '@/types/file-info';
import { readFileAsArrayBuffer } from '@/utils/file-io';
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
const { t } = useI18n();
const { showToast } = useToast();

const emit = defineEmits<{
  'file-selected': [file: FileInfo | FileInfo[]];
  'file-cleared': [];
  'file-error': [error: { fileName: string; error: unknown }];
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
      void processFiles(Array.from(files));
    } else {
      void processFile(files[0]);
    }
  }
}

function toFileInfo(file: File, data: ArrayBuffer): FileInfo {
  const bytes = new Uint8Array(data);
  return {
    name: file.name,
    data: bytes,
    size: bytes.length,
  };
}

async function processFiles(files: File[]) {
  const results = await Promise.allSettled(
    files.map(async file => toFileInfo(file, await readFileAsArrayBuffer(file))),
  );
  const fileInfos = results
    .filter((result): result is PromiseFulfilledResult<FileInfo> => result.status === 'fulfilled')
    .map(result => result.value);

  const failures = results.flatMap((result, index) => {
    if (result.status === 'fulfilled') return [];
    console.warn('[FileDropZone] Failed to read file', result.reason);
    const failedFileName = files[index].name;
    emit('file-error', { fileName: failedFileName, error: result.reason });
    return [failedFileName];
  });

  if (failures.length > 0) {
    showToast(t('ui.file.readFailedCount', { count: failures.length }), 'error');
  }

  if (fileInfos.length > 0) {
    emit('file-selected', fileInfos);
  }
}

async function processFile(file: File) {
  try {
    emit('file-selected', toFileInfo(file, await readFileAsArrayBuffer(file)));
  } catch (error) {
    console.warn('[FileDropZone] Failed to read file', error);
    emit('file-error', { fileName: file.name, error });
    showToast(t('ui.file.readFailed', { name: file.name }), 'error');
  }
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
async function downloadFile() {
  if (disabled.value || !fileData.value || !fileName.value) return;
  const name = fileName.value;
  try {
    await saveBinaryFile(new Uint8Array(fileData.value), name);
  } catch (error) {
    console.warn('[FileDropZone] Failed to download file', error);
    showToast(t('ui.file.downloadFailed', { name }), 'error');
  }
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
      void processFiles(Array.from(files));
    } else {
      void processFile(files[0]);
    }
  }
}
</script>

<style lang="scss" scoped>
@use '@/styles/variables/colors' as color-vars;
@use '@/styles/variables/spacing' as spacing-vars;
@use '@/styles/variables/typography' as typography-vars;
@use '@/styles/variables/radius' as radius-vars;
@use '@/styles/mixins' as mixins;

.file-upload-area {
  margin-bottom: spacing-vars.$space-3;
}

.file-drop-zone {
  border: 1.5px dashed var(--retro-border-dashed);
  border-radius: 6px;
  padding: 0 !important;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
  background: var(--retro-bg-surface);
  color: var(--retro-ink);
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  word-wrap: break-word;
  width: 100%;
  height: 100%;
  box-sizing: border-box;

  > * {
    width: 100%;
    max-width: 100%;
    min-width: 0;
  }

  &:hover:not(.disabled) {
    border-color: var(--retro-border);
    background: var(--retro-bg-elevated);
  }

  &.drag-over {
    border-color: var(--retro-border);
    background: var(--retro-bg-tint);
  }

  &.has-file {
    border-color: var(--retro-border);
    background: var(--retro-bg-elevated);
    border-style: solid;
  }

  &.disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.drop-zone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: spacing-vars.$space-2;
  width: 100%;
  height: 100%;
  min-height: 80px;
  padding: spacing-vars.$space-4;
}

.upload-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  margin-bottom: spacing-vars.$space-1;
  opacity: 0.7;
}

.upload-text {
  display: flex;
  flex-direction: column;
  gap: spacing-vars.$space-1;
  align-items: center;
}

.main-text {
  font-size: typography-vars.$font-size-sm;
  font-weight: typography-vars.$font-weight-semibold;
  color: var(--retro-ink);
  margin: 0;
}

.sub-text {
  font-size: typography-vars.$font-size-xs;
  color: var(--retro-ink-muted);
  margin: 0;
}

.hint-text {
  font-size: typography-vars.$font-size-xs;
  color: var(--retro-ink-subtle);
  margin: 0;
}

.file-preview {
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-3;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 80px;
  padding: spacing-vars.$space-4;
  background: var(--retro-bg-surface);
  border-radius: 6px;
  justify-content: flex-start;
  overflow: hidden;
  box-sizing: border-box;
}

.file-icon {
  font-size: 32px;
  color: var(--retro-ink);
  margin-bottom: 0;
  margin-right: spacing-vars.$space-2;
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
  font-size: typography-vars.$font-size-sm;
  font-weight: typography-vars.$font-weight-semibold;
  color: var(--retro-ink);
  margin-bottom: spacing-vars.$space-1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  width: 100%;
}

.file-size {
  font-family: var(--retro-font-mono);
  font-size: typography-vars.$font-size-xs;
  color: var(--retro-ink-muted);
  margin-bottom: spacing-vars.$space-half;
}

.file-title {
  font-size: typography-vars.$font-size-xs;
  color: var(--retro-ink);
  font-weight: typography-vars.$font-weight-medium;
}

.remove-file-btn {
  width: 24px;
  height: 24px;
  border-radius: 3px;
  border: 1.5px solid var(--retro-border);
  background: var(--retro-bg-surface);
  color: var(--retro-danger-fg);
  font-size: typography-vars.$font-size-xs;
  font-weight: typography-vars.$font-weight-bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--retro-shadow-btn);
  transition: transform 0.1s ease, box-shadow 0.1s ease, background-color 0.12s ease;
  padding: 0;

  &:hover:not(:disabled) {
    background: var(--retro-danger-bg);
    transform: translate(-1px, 1px);
    box-shadow: var(--retro-shadow-btn-hover);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }
}

.download-file-btn {
  width: 24px;
  height: 24px;
  border-radius: 3px;
  border: 1.5px solid var(--retro-border);
  background: var(--retro-bg-surface);
  color: var(--retro-ink);
  font-size: typography-vars.$font-size-xs;
  font-weight: typography-vars.$font-weight-bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--retro-shadow-btn);
  transition: transform 0.1s ease, box-shadow 0.1s ease, background-color 0.12s ease;
  padding: 0;
  margin-right: spacing-vars.$space-2;

  &:hover:not(:disabled) {
    background: var(--retro-bg-tint);
    transform: translate(-1px, 1px);
    box-shadow: var(--retro-shadow-btn-hover);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }
}

/* 按钮容器，垂直布局 */
.file-actions {
  display: flex;
  flex-direction: column;
  gap: spacing-vars.$space-2;
}
</style>
