<template>
  <div class="file-section">
    <h4>{{ $t('ui.gbaMultiMenu.saveFiles') }}</h4>
    <div class="file-upload-area">
      <input
        ref="saveFileInput"
        type="file"
        accept=".sav"
        multiple
        style="display: none"
        @change="handleSaveFileChange"
      >
      <div
        v-if="saveFiles.size > 0"
        class="file-list"
      >
        <div
          v-for="[fileName, data] of saveFiles"
          :key="fileName"
          class="file-item"
        >
          <IonIcon :icon="saveOutline" />
          <span class="file-name">{{ fileName }}</span>
          <span class="file-size">({{ formatFileSize(data.byteLength) }})</span>
          <BaseButton
            variant="error"
            size="sm"
            :icon="closeCircleOutline"
            @click="removeSaveFile(fileName)"
          />
        </div>
      </div>
      <div
        v-else
        class="file-drop-zone"
        @click="() => saveFileInput?.click()"
        @dragover.prevent
        @drop.prevent="handleSaveFileDrop"
      >
        <div class="placeholder-content">
          <IonIcon
            :icon="saveOutline"
            class="placeholder-icon"
          />
          <div class="placeholder-text">
            <p>
              {{ $t('ui.gbaMultiMenu.dropSaveFiles') }}
            </p>
            <p class="hint">
              {{ $t('ui.file.browse') }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import {
  closeCircleOutline,
  saveOutline,
} from 'ionicons/icons';
import { ref } from 'vue';

import BaseButton from '@/components/common/BaseButton.vue';
import { useMultiMenu } from '@/composables/useMultiMenuState';

const { saveFiles, processSaveFile, removeSaveFile, formatFileSize } = useMultiMenu();

const saveFileInput = ref<HTMLInputElement>();

function handleSaveFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (files && files.length > 0) {
    Array.from(files).forEach(file => {
      if (file.name.toLowerCase().endsWith('.sav')) {
        processSaveFile(file);
      }
    });
  }
}

function handleSaveFileDrop(e: DragEvent) {
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    Array.from(files).forEach(file => {
      if (file.name.toLowerCase().endsWith('.sav')) {
        processSaveFile(file);
      }
    });
  }
}
</script>

<style scoped>
.file-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.file-upload-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background-color: transparent;
  padding: 0;
  cursor: pointer;
  transition: background-color 0.2s;
}

.file-upload-area:hover {
  background-color: transparent;
}

.file-drop-zone {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  min-height: 120px;
  border: var(--border-width) var(--border-style) var(--color-border);
  border-radius: var(--radius-lg);
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
  background-color: var(--color-bg-tertiary);
  padding: var(--space-4);
}

.file-list {
  border: var(--border-width) var(--border-style) var(--color-border-light);
  border-radius: var(--radius-base);
  background-color: var(--color-bg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  width: 100%;
  margin-top: 0;
  margin-bottom: auto;
}

.file-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-bottom: var(--border-width) var(--border-style) var(--color-border-light);
  background-color: var(--color-bg);
  transition: all 0.2s ease;
}

.file-item:hover {
  background-color: var(--color-bg-secondary);
}

.file-item:last-child {
  border-bottom: none;
}

.file-name {
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.file-size {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.placeholder-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  flex: 1;
  flex-direction: column;
  text-align: center;
}

.placeholder-icon {
  font-size: var(--font-size-3xl);
  color: var(--color-primary);
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.placeholder-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  text-align: left;
}

.placeholder-text p {
  margin: 0;
}

.hint {
  background: var(--color-primary);
  color: var(--color-bg);
  padding: var(--space-2) var(--space-4);
  border-radius: 20px;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  margin-top: var(--space-2);
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
}

.file-drop-zone:hover .hint {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.file-drop-zone:hover .placeholder-icon {
  color: var(--color-primary-hover);
  transform: scale(1.1);
}
</style>
