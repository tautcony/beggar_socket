<template>
  <RetroCard
    :title="$t('ui.gbaMultiMenu.gameRoms')"
    :badge="gameRomItems.length"
    fill
  >
    <template #header-right>
      <RetroButton
        size="xs"
        variant="secondary"
        :icon="addOutline"
        :text="$t('ui.file.browse')"
        @click="() => gameRomInput?.click()"
      />
    </template>

    <input
      ref="gameRomInput"
      type="file"
      accept=".gba"
      multiple
      style="display: none"
      @change="onGameRomsSelected"
    >

    <div
      class="panel-drop-area"
      @dragover.prevent
      @drop.prevent="handleGameRomDrop"
    >
      <div
        v-if="gameRomItems.length > 0"
        class="rom-list"
      >
        <div
          v-for="(item, index) in gameRomItems"
          :key="item.id"
          class="rom-item-card"
          draggable="true"
          @dragstart="handleDragStart($event, index)"
          @dragover.prevent
          @drop.prevent="handleDrop($event, index)"
          @dragenter.prevent
        >
          <div class="rom-item-row">
            <button
              type="button"
              class="drag-handle"
              :title="$t('ui.gbaMultiMenu.dragToReorder')"
            >
              <IonIcon :icon="menuOutline" />
            </button>
            <span class="index-badge">{{ String(index + 1).padStart(2, '0') }}</span>
            <div class="rom-info">
              <span
                class="rom-name"
                :title="item.fileName"
              >
                {{ item.fileName }}
              </span>
              <span class="rom-meta">
                {{ formatFileSize(item.data.byteLength) }} · SLOT {{ item.config.save_slot }}
              </span>
            </div>
            <div class="rom-actions">
              <RetroButton
                variant="ghost"
                icon-only
                :active="expandedConfigs.has(item.fileName)"
                :icon="buildOutline"
                :title="$t('ui.gbaMultiMenu.configureGame')"
                @click.stop="toggleGameConfig(item.fileName)"
              />
              <RetroButton
                variant="danger"
                icon-only
                :icon="closeOutline"
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
            <div class="config-field config-field-wide">
              <label>{{ $t('ui.gbaMultiMenu.gameTitle') }}</label>
              <input
                v-model="item.config.title"
                type="text"
                maxlength="48"
                class="config-input"
              >
            </div>
            <div class="config-field">
              <label>{{ $t('ui.gbaMultiMenu.titleFont') }}</label>
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
            <div class="config-field">
              <label>{{ $t('ui.gbaMultiMenu.saveSlot') }}</label>
              <input
                v-model.number="item.config.save_slot"
                type="number"
                min="1"
                max="10"
                class="config-input"
              >
            </div>
            <label class="config-checkbox">
              <input
                v-model="item.config.enabled"
                type="checkbox"
              >
              <span>{{ $t('ui.gbaMultiMenu.enabled') }}</span>
            </label>
          </div>
        </div>
      </div>

      <RetroDropZone
        v-else
        :icon="gameControllerOutline"
        :title="$t('ui.gbaMultiMenu.dropGameRoms')"
        hint=".GBA"
        accept=".gba"
        multiple
        @files-selected="processGbaFiles"
      />
    </div>
  </RetroCard>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import {
  addOutline,
  buildOutline,
  closeOutline,
  gameControllerOutline,
  menuOutline,
} from 'ionicons/icons';
import { ref } from 'vue';

import { RetroButton, RetroCard, RetroDropZone } from '@/components/retro';
import { useMultiMenu } from '@/composables/useMultiMenuState';

const {
  gameRomItems,
  expandedConfigs,
  processGameRomFile,
  removeGameRom,
  toggleGameConfig,
  reorderGameRom,
  formatFileSize,
} = useMultiMenu();

const gameRomInput = ref<HTMLInputElement>();
let draggedIndex = -1;

function processGbaFiles(files: File[]) {
  files.forEach(file => {
    if (file.name.toLowerCase().endsWith('.gba')) {
      void processGameRomFile(file);
    }
  });
}

function onGameRomsSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    processGbaFiles(Array.from(input.files));
    input.value = '';
  }
}

function handleGameRomDrop(e: DragEvent) {
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    processGbaFiles(Array.from(e.dataTransfer.files));
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
.panel-drop-area {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.rom-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rom-item-card {
  border: 1.5px solid var(--retro-border);
  border-radius: 4px;
  background: var(--retro-bg-surface);
  overflow: hidden;
}

.rom-item-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
}

.drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--retro-ink-subtle);
  cursor: grab;
  padding: 2px;
}

.drag-handle:active {
  cursor: grabbing;
}

.index-badge {
  font-family: var(--retro-font-mono);
  font-size: 11px;
  font-weight: var(--font-weight-bold);
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--retro-bg-tint);
  color: var(--retro-ink);
  border: 1px solid var(--retro-border);
  flex-shrink: 0;
}

.rom-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.rom-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--retro-ink);
}

.rom-meta {
  flex-shrink: 0;
  font-family: var(--retro-font-mono);
  font-size: 11px;
  color: var(--retro-ink-muted);
}

.rom-actions {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.game-config-panel {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr auto;
  align-items: end;
  gap: 8px;
  padding: 8px 10px;
  background: var(--retro-bg-elevated);
  border-top: 1px dashed var(--retro-border-dashed);
}

.config-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.config-field label {
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  color: var(--retro-ink-muted);
}

.config-input,
.config-select {
  width: 100%;
  padding: 4px 6px;
  border: 1.5px solid var(--retro-border);
  border-radius: 4px;
  background: var(--retro-bg-surface);
  color: var(--retro-ink);
  font-size: 12px;
}

.config-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding-bottom: 5px;
  font-size: 12px;
  color: var(--retro-ink);
  cursor: pointer;
  white-space: nowrap;
}

.config-checkbox input {
  accent-color: var(--retro-ink);
}

@media (max-width: 720px) {
  .game-config-panel {
    grid-template-columns: 1fr 1fr;
  }

  .config-field-wide {
    grid-column: 1 / -1;
  }
}
</style>
