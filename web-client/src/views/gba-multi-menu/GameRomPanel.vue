<template>
  <div class="file-section">
    <h4>{{ $t('ui.gbaMultiMenu.gameRoms') }}</h4>
    <div class="file-upload-area">
      <input
        ref="gameRomInput"
        type="file"
        accept=".gba"
        multiple
        style="display: none"
        @change="onGameRomsSelected"
      >
      <div
        class="file-drop-zone"
        @click="() => gameRomInput?.click()"
        @dragover.prevent
        @drop.prevent="handleGameRomDrop"
      >
        <div
          v-if="gameRomItems.length > 0"
          class="file-list"
        >
          <div
            v-for="(item, index) in gameRomItems"
            :key="item.id"
            class="file-item-container"
            draggable="true"
            @dragstart="handleDragStart($event, index)"
            @dragover.prevent
            @drop.prevent="handleDrop($event, index)"
            @dragenter.prevent
          >
            <div class="file-item">
              <button
                class="drag-handle"
                :title="$t('ui.gbaMultiMenu.dragToReorder')"
              >
                <IonIcon :icon="menuOutline" />
              </button>
              <IonIcon :icon="gameControllerOutline" />
              <div class="file-info">
                <span class="file-name">{{ item.fileName }}</span>
                <span class="file-size">({{ formatFileSize(item.data.byteLength) }})</span>
              </div>
              <div class="file-actions">
                <BaseButton
                  variant="secondary"
                  size="sm"
                  :icon="buildOutline"
                  :title="$t('ui.gbaMultiMenu.configureGame')"
                  @click.stop="toggleGameConfig(item.fileName)"
                />
                <BaseButton
                  variant="error"
                  size="sm"
                  :icon="closeCircleOutline"
                  @click.stop="removeGameRom(item.fileName)"
                />
              </div>
            </div>

            <!-- 游戏配置面板 -->
            <div
              v-if="expandedConfigs.has(item.fileName)"
              class="game-config-panel"
              @click.stop
            >
              <div class="config-row">
                <label>{{ $t('ui.gbaMultiMenu.gameTitle') }}:</label>
                <input
                  v-model="item.config.title"
                  type="text"
                  class="config-input"
                >
              </div>
              <div class="config-row">
                <label>{{ $t('ui.gbaMultiMenu.titleFont') }}:</label>
                <select
                  v-model.number="item.config.title_font"
                  class="config-select"
                >
                  <option value="1">
                    Font 1
                  </option>
                  <option value="2">
                    Font 2
                  </option>
                </select>
              </div>
              <div class="config-row">
                <label>{{ $t('ui.gbaMultiMenu.saveSlot') }}:</label>
                <input
                  v-model.number="item.config.save_slot"
                  type="number"
                  min="1"
                  max="10"
                  class="config-input"
                >
              </div>
              <div class="config-row">
                <label>
                  <input
                    v-model="item.config.enabled"
                    type="checkbox"
                  >
                  {{ $t('ui.gbaMultiMenu.enabled') }}
                </label>
              </div>
            </div>
          </div>
        </div>
        <div
          v-else
          class="file-placeholder"
        >
          <div class="placeholder-content">
            <IonIcon
              :icon="gameControllerOutline"
              class="placeholder-icon"
            />
            <div class="placeholder-text">
              <p>
                {{ $t('ui.gbaMultiMenu.dropGameRoms') }}
              </p>
              <p class="hint">
                {{ $t('ui.file.browse') }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import {
  buildOutline,
  closeCircleOutline,
  gameControllerOutline,
  menuOutline,
} from 'ionicons/icons';
import { ref } from 'vue';

import BaseButton from '@/components/common/BaseButton.vue';
import { useMultiMenu } from '@/composables/useMultiMenuState';

const {
  gameRomItems, expandedConfigs,
  processGameRomFile, removeGameRom, toggleGameConfig, reorderGameRom,
  formatFileSize,
} = useMultiMenu();

const gameRomInput = ref<HTMLInputElement>();
let draggedIndex = -1;

function onGameRomsSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (files && files.length > 0) {
    Array.from(files).forEach(file => {
      if (file.name.toLowerCase().endsWith('.gba')) {
        processGameRomFile(file);
      }
    });
  }
}

function handleGameRomDrop(e: DragEvent) {
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    Array.from(files).forEach(file => {
      if (file.name.toLowerCase().endsWith('.gba')) {
        processGameRomFile(file);
      }
    });
  }
}

function handleDragStart(e: DragEvent, index: number) {
  draggedIndex = index;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
  }
}

function handleDrop(e: DragEvent, dropIndex: number) {
  e.preventDefault();
  reorderGameRom(draggedIndex, dropIndex);
  draggedIndex = -1;
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

.file-drop-zone:has(.file-list) {
  align-items: flex-start;
  justify-content: flex-start;
  padding: 0;
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

.file-item-container {
  border-bottom: var(--border-width) var(--border-style) var(--color-border-light);
  cursor: move;
  transition: all 0.2s ease;
  background-color: var(--color-bg);
  position: relative;
}

.file-item-container:hover {
  background-color: var(--color-bg-secondary);
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

.file-item-container:last-child {
  border-bottom: none;
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

.file-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.file-name {
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-size {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.drag-handle {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: grab;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-base);
}

.drag-handle:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text);
}

.drag-handle:active {
  cursor: grabbing;
}

/* 游戏配置面板样式 */
.game-config-panel {
  margin-top: var(--space-3);
  padding: var(--space-4);
  background-color: var(--color-bg-secondary);
  border: var(--border-width) var(--border-style) var(--color-border);
  border-radius: var(--radius-base);
  border-top: var(--border-width-thick) var(--border-style) var(--color-primary);
}

.config-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.config-row:last-child {
  margin-bottom: 0;
}

.config-row label {
  min-width: 80px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.config-row label:has(input[type="checkbox"]) {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  min-width: auto;
}

.config-input,
.config-select {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  border: var(--border-width) var(--border-style) var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  background-color: var(--color-bg);
  transition: border-color 0.2s;
}

.config-input:focus,
.config-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--shadow-focus);
}
</style>
