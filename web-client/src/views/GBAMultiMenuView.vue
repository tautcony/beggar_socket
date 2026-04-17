<template>
  <div class="gba-multi-menu-view">
    <!-- 加载遮罩 -->
    <div
      v-if="isLoadingLibrary"
      class="loading-overlay"
    >
      <div class="loading-content">
        <div class="loading-spinner" />
        <div class="loading-text">
          {{ $t('ui.gbaMultiMenu.loadingLibrary') }}
        </div>
        <div class="loading-description">
          {{ $t('ui.gbaMultiMenu.loadingDescription') }}
        </div>
      </div>
    </div>
    <!-- 页面头部 -->
    <div class="page-header">
      <h2 class="page-title">
        {{ $t('ui.gbaMultiMenu.title') }}
      </h2>
      <div class="header-controls">
        <div class="status-info">
          <span class="status-label">{{ $t('ui.gbaMultiMenu.status') }}:</span>
          <span
            class="status-value"
            :class="statusClass"
          >
            {{ statusText }}
          </span>
        </div>
        <div
          v-if="buildResult"
          class="result-info"
        >
          <span class="result-label">{{ $t('ui.gbaMultiMenu.romCode') }}:</span>
          <span class="result-value">{{ buildResult.code }}</span>
        </div>
        <button
          class="back-btn"
          @click="goBack"
        >
          <IonIcon :icon="arrowBackOutline" />
          返回
        </button>
      </div>
    </div>

    <div class="gba-multi-menu-content">
      <!-- 文件选择区域 - 左右布局 -->
      <div class="main-layout">
        <!-- 左侧：游戏ROM -->
        <div class="left-section">
          <GameRomPanel />
        </div>

        <!-- 右侧：存档文件 -->
        <div class="right-section">
          <SaveFilePanel />
        </div>
      </div>

      <!-- 配置、构建、下载 -->
      <RomBuildPanel />
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { arrowBackOutline } from 'ionicons/icons';
import { provide } from 'vue';

import { MULTI_MENU_KEY, useMultiMenuState } from '@/composables/useMultiMenuState';

import GameRomPanel from './gba-multi-menu/GameRomPanel.vue';
import RomBuildPanel from './gba-multi-menu/RomBuildPanel.vue';
import SaveFilePanel from './gba-multi-menu/SaveFilePanel.vue';

const state = useMultiMenuState();
provide(MULTI_MENU_KEY, state);

const { isLoadingLibrary, buildResult, statusText, statusClass, goBack } = state;
</script>

<style scoped>
.gba-multi-menu-view {
  min-height: 100vh;
  background: var(--color-bg);
  padding: 0;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  overflow-y: auto;
}

.page-header {
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border-light);
  padding: var(--space-4) var(--space-6);
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: 100;
}

.page-title {
  margin: 0;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.header-controls {
  display: flex;
  align-items: center;
  gap: var(--space-5);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background 0.2s ease;
}

.back-btn:hover {
  background: var(--color-bg-hover);
}

.back-btn:active {
  transform: scale(0.98);
}

.gba-multi-menu-content {
  padding: var(--space-6);
  max-width: 80%;
  margin: 0 auto;
}

.status-info,
.result-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
}

.status-label,
.result-label {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.status-value {
  font-weight: var(--font-weight-semibold);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
}

.status-ready {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text);
}

.status-building {
  background-color: var(--color-bg-secondary);
  color: var(--color-primary);
}

.status-success {
  background-color: var(--color-success-light);
  color: var(--color-success);
}

.main-layout {
  display: flex;
  gap: var(--space-6);
  margin-bottom: var(--space-6);
  align-items: stretch;
}

.left-section {
  flex: 3;
  display: flex;
  flex-direction: column;
  max-width: 70%;
}

.right-section {
  flex: 2;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* 加载遮罩样式 */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--color-overlay);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-content {
  text-align: center;
  padding: var(--space-8);
  background: var(--color-bg);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  border: var(--border-width) var(--border-style) var(--color-border);
}

.loading-spinner {
  width: var(--space-12);
  height: var(--space-12);
  margin: 0 auto var(--space-4) auto;
  border: var(--border-width-thick) var(--border-style) var(--color-bg-tertiary);
  border-top: var(--border-width-thick) var(--border-style) var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin-bottom: var(--space-2);
}

.loading-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}
</style>
