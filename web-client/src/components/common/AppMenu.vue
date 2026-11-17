<template>
  <div class="app-menu-container">
    <button
      class="menu-trigger"
      :class="{ active: isMenuOpen }"
      @click="toggleMenu"
    >
      <IonIcon :icon="menuOutline" />
      <span class="menu-text">{{ $t('ui.menu.tools') }}</span>
    </button>

    <div
      v-if="isMenuOpen"
      class="menu-overlay"
      @click="closeMenu"
    />

    <div
      v-if="isMenuOpen"
      class="menu-dropdown"
    >
      <div class="menu-header">
        <h4>{{ $t('ui.menu.tools') }}</h4>
      </div>

      <div class="menu-items">
        <button
          class="menu-item"
          @click="openRomTools"
        >
          <IonIcon :icon="constructOutline" />
          <div class="menu-item-content">
            <span class="menu-item-title">{{ $t('ui.menu.romTools') }}</span>
            <span class="menu-item-desc">{{ $t('ui.menu.romToolsDesc') }}</span>
          </div>
        </button>

        <button
          v-if="showDebugTool"
          class="menu-item"
          @click="openDebugTool"
        >
          <IonIcon :icon="terminalOutline" />
          <div class="menu-item-content">
            <span class="menu-item-title">{{ $t('ui.menu.debugTool') }}</span>
            <span class="menu-item-desc">{{ $t('ui.menu.debugToolDesc') }}</span>
          </div>
        </button>

        <button
          v-if="showCartridgeTools"
          class="menu-item"
          @click="openCartridgeTools"
        >
          <IonIcon :icon="buildOutline" />
          <div class="menu-item-content">
            <span class="menu-item-title">{{ $t('ui.menu.cartridgeTools') }}</span>
            <span class="menu-item-desc">{{ $t('ui.menu.cartridgeToolsDesc') }}</span>
          </div>
          <RetroBadge
            variant="warning"
            text="BETA"
          />
        </button>

        <button
          class="menu-item"
          @click="openSystemNoticeHistoryDialog"
        >
          <IonIcon :icon="notificationsOutline" />
          <div class="menu-item-content">
            <span class="menu-item-title">{{ $t('ui.menu.systemNoticeHistory') }}</span>
            <span class="menu-item-desc">{{ $t('ui.menu.systemNoticeHistoryDesc') }}</span>
          </div>
        </button>

        <!--button
          class="menu-item"
          @click="openSerialTest"
        >
          <IonIcon :icon="hardwareChipOutline" />
          <div class="menu-item-content">
            <span class="menu-item-title">{{ $t('ui.menu.serialTest') }}</span>
            <span class="menu-item-desc">{{ $t('ui.menu.serialTestDesc') }}</span>
          </div>
          <span class="beta-badge">NEW</span>
        </button-->

        <div class="menu-divider" />

        <button
          class="menu-item"
          @click="openSettings"
        >
          <IonIcon :icon="settingsOutline" />
          <div class="menu-item-content">
            <span class="menu-item-title">{{ $t('ui.menu.settings') }}</span>
            <span class="menu-item-desc">{{ $t('ui.menu.settingsDesc') }}</span>
          </div>
        </button>

        <button
          class="menu-item"
          @click="openAbout"
        >
          <IonIcon :icon="informationCircleOutline" />
          <div class="menu-item-content">
            <span class="menu-item-title">{{ $t('ui.menu.about') }}</span>
            <span class="menu-item-desc">{{ $t('ui.menu.aboutDesc') }}</span>
          </div>
        </button>
      </div>
    </div>

    <!-- 调试工具弹框 -->
    <DebugToolModal
      v-model="isDebugToolVisible"
      :device="device"
      @close="closeDebugTool"
    />

    <!-- 系统通知历史 -->
    <SystemNoticeHistoryModal
      v-model="isSystemNoticeHistoryVisible"
      @close="closeSystemNoticeHistory"
    />

    <!-- 卡带工具弹框 -->
    <CartridgeToolsModal
      v-model:is-visible="isCartridgeToolsVisible"
      :device="device"
      @close="closeCartridgeTools"
    />

    <!-- 关于弹框 -->
    <AboutModal
      v-model="isAboutVisible"
      @close="closeAbout"
    />

    <!-- 高级设置面板 -->
    <AdvancedSettingsModal
      v-model="isSettingsVisible"
      @close="closeSettings"
      @applied="onSettingsApplied"
    />
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import {
  buildOutline,
  constructOutline,
  informationCircleOutline,
  menuOutline,
  notificationsOutline,
  settingsOutline,
  terminalOutline,
} from 'ionicons/icons';
import { onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import AboutModal from '@/components/modal/AboutModal.vue';
import AdvancedSettingsModal from '@/components/modal/AdvancedSettingsModal.vue';
import CartridgeToolsModal from '@/components/modal/CartridgeToolsModal.vue';
import DebugToolModal from '@/components/modal/DebugToolModal.vue';
import SystemNoticeHistoryModal from '@/components/modal/SystemNoticeHistoryModal.vue';
import { RetroBadge } from '@/components/retro';
import { useToast } from '@/composables/useToast';
import type { DeviceInfo } from '@/types/device-info';

const { t } = useI18n();
const { showToast } = useToast();
const route = useRoute();
const router = useRouter();

const props = withDefaults(defineProps<{
  currentMode?: 'MBC5' | 'GBA';
  device?: DeviceInfo | null;
}>(), {
  currentMode: 'GBA',
  device: null,
});

const isMenuOpen = ref(false);
const isDebugToolVisible = ref(false);
const isCartridgeToolsVisible = ref(false);
const isSettingsVisible = ref(false);
const isAboutVisible = ref(false);
const isSystemNoticeHistoryVisible = ref(false);
const clickCount = ref(0);
let clickTimer: NodeJS.Timeout | null = null;

// 检查 URL 参数来决定是否启用卡带工具
const showCartridgeTools = true;// ref(route.query.cart_tools === 'true');
const showDebugTool = ref(route.query.debug_tool === 'true');

function incrementClickCount() {
  clickCount.value++;
  /*
  if (clickCount.value >= 1 && !showCartridgeTools.value) {
    showCartridgeTools.value = true;
    showToast(t('ui.menu.cartridgeToolsUnlocked'), 'success');
  }
  */
  if (clickCount.value >= 5 && !showDebugTool.value) {
    showDebugTool.value = true;
    showToast(t('ui.menu.debugToolUnlocked'), 'success');
  }

  if (clickTimer) {
    clearTimeout(clickTimer);
  }

  clickTimer = setTimeout(() => {
    clickCount.value = 0;
  }, 3000);
}

onUnmounted(() => {
  if (clickTimer) {
    clearTimeout(clickTimer);
    clickTimer = null;
  }
});

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value;
  incrementClickCount();
}

function closeMenu() {
  isMenuOpen.value = false;
}

function openSystemNoticeHistoryDialog() {
  closeMenu();
  isSystemNoticeHistoryVisible.value = true;
}

function openRomTools() {
  closeMenu();
  void router.push({
    name: 'rom-tools',
    params: { tab: 'split-merge' },
    query: {
      romType: props.currentMode,
    },
  });
}

function openDebugTool() {
  closeMenu();
  isDebugToolVisible.value = true;
}

function closeDebugTool() {
  isDebugToolVisible.value = false;
}

function closeSystemNoticeHistory() {
  isSystemNoticeHistoryVisible.value = false;
}

function openCartridgeTools() {
  closeMenu();
  isCartridgeToolsVisible.value = true;
}

function closeCartridgeTools() {
  isCartridgeToolsVisible.value = false;
}

function openSettings() {
  closeMenu();
  isSettingsVisible.value = true;
}

function closeSettings() {
  isSettingsVisible.value = false;
}

function onSettingsApplied() {
  showToast(t('ui.settings.messages.applied'), 'success');
}

function openAbout() {
  closeMenu();
  isAboutVisible.value = true;
}

function closeAbout() {
  isAboutVisible.value = false;
}

function openSerialTest() {
  closeMenu();
  void router.push('/serial-test');
}
</script>

<style lang="scss" scoped>
@use '@/styles/variables/colors' as color-vars;
@use '@/styles/variables/spacing' as spacing-vars;
@use '@/styles/variables/typography' as typography-vars;
@use '@/styles/variables/radius' as radius-vars;
@use '@/styles/mixins' as mixins;

.app-menu-container {
  position: relative;
}

.menu-trigger {
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-2;
  min-height: 38px;
  padding: 8px 14px;
  box-sizing: border-box;
  outline: none;
  background: var(--retro-bg-surface);
  border: 1.5px solid var(--retro-border);
  border-radius: 4px;
  box-shadow: var(--retro-shadow-btn);
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.1s ease, background-color 0.12s ease;
  font-size: typography-vars.$font-size-xs;
  font-weight: typography-vars.$font-weight-semibold;
  color: var(--retro-ink);

  &:hover {
    background: var(--retro-bg-tint);
    transform: translate(-1px, 1px);
    box-shadow: var(--retro-shadow-btn-hover);
  }

  &.active {
    background: var(--retro-primary-bg);
    color: var(--retro-primary-fg);
  }
}

.menu-text {
  font-weight: typography-vars.$font-weight-medium;
}

.menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
}

.menu-dropdown {
  position: absolute;
  top: calc(100% + spacing-vars.$space-2);
  left: 0;
  background: var(--retro-bg-surface);
  border: 1.5px solid var(--retro-border);
  border-radius: 6px;
  box-shadow: var(--retro-shadow-card);
  z-index: 1000;
  min-width: 320px;
  overflow: hidden;
}

.menu-header {
  padding: spacing-vars.$space-4 spacing-vars.$space-5 spacing-vars.$space-3;
  border-bottom: 1px solid color-vars.$color-border-light;
  background: color-vars.$color-bg-secondary;

  h4 {
    margin: 0;
    color: #2c3e50;
    font-size: typography-vars.$font-size-base;
    font-weight: typography-vars.$font-weight-semibold;
  }
}

.menu-items {
  padding: spacing-vars.$space-2 0;
}

.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-3;
  padding: spacing-vars.$space-3 spacing-vars.$space-5;
  background: none;
  border: none;
  box-shadow: none;
  cursor: pointer;
  transition: background 0.2s ease;
  text-align: left;

  &:hover:not(:disabled) {
    background: color-vars.$color-bg-secondary;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;

    .menu-item-title {
      color: color-vars.$color-border;
    }

    .menu-item-desc {
      color: color-vars.$color-border;
    }
  }
}

.menu-item-content {
  display: flex;
  flex-direction: column;
  gap: spacing-vars.$space-1;
  flex: 1;
}

.menu-item-title {
  font-weight: typography-vars.$font-weight-semibold;
  color: #2c3e50;
  font-size: typography-vars.$font-size-sm;
}

.menu-item-desc {
  font-size: typography-vars.$font-size-xs;
  color: color-vars.$color-text-secondary;
  line-height: typography-vars.$line-height-snug;
}

.menu-divider {
  height: 1px;
  background: #e9ecef;
  margin: 8px 20px;
}
</style>
