<template>
  <div class="gba-multi-menu-panel">
    <!-- 加载遮罩 -->
    <div
      v-if="isLoadingLibrary"
      class="loading-overlay"
    >
      <RetroCard
        padding="md"
        class="loading-card"
      >
        <div class="loading-spinner" />
        <div class="loading-text">
          {{ $t('ui.gbaMultiMenu.loadingLibrary') }}
        </div>
        <div class="loading-description">
          {{ $t('ui.gbaMultiMenu.loadingDescription') }}
        </div>
      </RetroCard>
    </div>

    <div class="panel-toolbar">
      <div class="toolbar-left">
        <div class="status-info">
          <span class="status-label">{{ $t('ui.gbaMultiMenu.status') }}</span>
          <span
            class="status-value"
            :class="statusClass"
          >
            {{ statusText }}
          </span>
        </div>
        <span class="telemetry-text">
          {{ gameRomItems.length }} ROMS ({{ formatFileSize(totalGameRomSize) }}) · {{ saveFiles.size }} SAVES
        </span>
      </div>
      <div
        v-if="buildResult"
        class="result-info"
      >
        <span class="result-label">{{ $t('ui.gbaMultiMenu.romCode') }}</span>
        <span class="result-value">{{ buildResult.code }}</span>
      </div>
    </div>

    <div class="main-layout">
      <RomBuildPanel />

      <div class="game-rom-cell">
        <GameRomPanel class="game-rom-fill" />
      </div>

      <div class="save-file-cell">
        <SaveFilePanel class="save-file-fill" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, provide } from 'vue';

import { RetroCard } from '@/components/retro';
import { MULTI_MENU_KEY, useMultiMenuState } from '@/composables/useMultiMenuState';

import GameRomPanel from '../gba-multi-menu/GameRomPanel.vue';
import RomBuildPanel from '../gba-multi-menu/RomBuildPanel.vue';
import SaveFilePanel from '../gba-multi-menu/SaveFilePanel.vue';

const state = useMultiMenuState();
provide(MULTI_MENU_KEY, state);

const {
  isLoadingLibrary,
  buildResult,
  statusText,
  statusClass,
  gameRomItems,
  saveFiles,
  formatFileSize,
} = state;

const totalGameRomSize = computed(() =>
  gameRomItems.value.reduce((sum, item) => sum + item.data.byteLength, 0),
);
</script>

<style scoped>
.gba-multi-menu-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  gap: var(--space-3);
  overflow: hidden;
  color: var(--retro-ink);
}

.panel-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  flex-shrink: 0;
  margin: 0 2px 0 4px;
  padding: 8px 14px;
  background: var(--retro-bg-canvas);
  border: 1.5px solid var(--retro-border);
  border-radius: 6px;
  box-shadow: var(--retro-shadow-card);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.status-info,
.result-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-label,
.result-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--retro-ink-muted);
}

.status-value,
.result-value {
  font-family: var(--retro-font-mono);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1.5px solid var(--retro-border);
  background: var(--retro-bg-surface);
  color: var(--retro-ink);
}

.status-value.status-ready {
  background: var(--retro-bg-tint);
}

.status-value.status-building {
  background: var(--retro-warning-bg);
}

.status-value.status-success {
  background: var(--retro-success-bg);
}

.status-value.status-error {
  background: var(--retro-danger-bg);
  color: var(--retro-danger-fg);
}

.telemetry-text {
  font-family: var(--retro-font-mono);
  font-size: var(--font-size-xs);
  color: var(--retro-ink-muted);
  letter-spacing: 0.03em;
}

.main-layout {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--space-3) var(--space-4);
  flex: 1;
  min-height: 0;
  padding: 0 2px 6px 4px;
}

.game-rom-cell {
  grid-column: 2;
  grid-row: 1;
  position: relative;
  min-height: 0;
}

.game-rom-fill {
  position: absolute;
  inset: 0;
}

.save-file-cell {
  grid-column: 2;
  grid-row: 2;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.save-file-fill {
  flex: 1;
  min-height: 0;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: var(--retro-overlay);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  border-radius: 6px;
}

.loading-card {
  text-align: center;
  max-width: 340px;
}

.loading-spinner {
  width: 28px;
  height: 28px;
  border: 2.5px solid var(--retro-bg-tint);
  border-top-color: var(--retro-ink);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto var(--space-3);
}

.loading-text {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  color: var(--retro-ink);
  margin-bottom: 4px;
}

.loading-description {
  font-size: var(--font-size-xs);
  color: var(--retro-ink-muted);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 960px) {
  .gba-multi-menu-panel {
    height: auto;
    overflow: visible;
  }

  .main-layout {
    display: flex;
    flex-direction: column;
    flex: none;
    padding: 0 2px 6px 4px;
  }

  .game-rom-cell,
  .save-file-cell {
    position: static;
  }

  .game-rom-fill {
    position: static;
  }
}
</style>
