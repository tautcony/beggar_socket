<template>
  <RetroCard
    :title="$t('ui.gbaMultiMenu.saveFiles')"
    :badge="saveFiles.size"
    fill
  >
    <template #header-right>
      <RetroButton
        size="xs"
        variant="secondary"
        :icon="addOutline"
        :text="$t('ui.file.browse')"
        @click="() => saveFileInput?.click()"
      />
    </template>

    <input
      ref="saveFileInput"
      type="file"
      accept=".sav"
      multiple
      style="display: none"
      @change="handleSaveFileChange"
    >

    <div
      class="panel-drop-area"
      @dragover.prevent
      @drop.prevent="handleSaveFileDrop"
    >
      <div
        v-if="saveFiles.size > 0"
        class="save-list"
      >
        <div
          v-for="[fileName, data] of saveFiles"
          :key="fileName"
          class="save-item-row"
        >
          <IonIcon
            :icon="saveOutline"
            class="save-icon"
          />
          <span
            class="save-name"
            :title="fileName"
          >
            {{ fileName }}
          </span>
          <span class="save-size">{{ formatFileSize(data.byteLength) }}</span>
          <RetroButton
            variant="danger"
            icon-only
            :icon="closeOutline"
            @click="removeSaveFile(fileName)"
          />
        </div>
      </div>

      <RetroDropZone
        v-else
        :icon="saveOutline"
        :title="$t('ui.gbaMultiMenu.dropSaveFiles')"
        hint=".SAV"
        accept=".sav"
        multiple
        compact
        @files-selected="processSavFiles"
      />
    </div>
  </RetroCard>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import {
  addOutline,
  closeOutline,
  saveOutline,
} from 'ionicons/icons';
import { ref } from 'vue';

import { RetroButton, RetroCard, RetroDropZone } from '@/components/retro';
import { useMultiMenu } from '@/composables/useMultiMenuState';

const { saveFiles, processSaveFile, removeSaveFile, formatFileSize } = useMultiMenu();

const saveFileInput = ref<HTMLInputElement>();

function processSavFiles(files: File[]) {
  files.forEach(file => {
    if (file.name.toLowerCase().endsWith('.sav')) {
      void processSaveFile(file);
    }
  });
}

function handleSaveFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    processSavFiles(Array.from(input.files));
    input.value = '';
  }
}

function handleSaveFileDrop(e: DragEvent) {
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    processSavFiles(Array.from(e.dataTransfer.files));
  }
}
</script>

<style scoped>
.panel-drop-area {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.save-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.save-item-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1.5px solid var(--retro-border);
  border-radius: 4px;
  background: var(--retro-bg-surface);
}

.save-icon {
  font-size: 14px;
  color: var(--retro-ink);
  flex-shrink: 0;
}

.save-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--retro-ink);
}

.save-size {
  flex-shrink: 0;
  font-family: var(--retro-font-mono);
  font-size: 11px;
  color: var(--retro-ink-muted);
}
</style>
