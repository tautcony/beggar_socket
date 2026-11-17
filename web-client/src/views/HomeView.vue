<template>
  <div class="home-view">
    <header class="page-header">
      <div class="header-inner">
        <div class="left-section">
          <AppMenu
            :current-mode="currentMode"
            :device="device"
          />
          <DeviceConnect
            ref="deviceConnectRef"
            :compact="true"
            @device-ready="onDeviceReady"
            @device-disconnected="onDeviceDisconnected"
          />
          <div class="header-divider" />
          <div class="title-section">
            <h1 class="main-title">
              {{ $t('ui.app.title') }}
            </h1>
            <a
              :href="titleBadgeHref"
              target="_blank"
              class="title-badge"
              :class="{ 'title-badge--build-info': !isReleaseBuild }"
              rel="noopener noreferrer"
            >
              <template v-if="isReleaseBuild">
                for beggar_socket
              </template>
              <template v-else>
                <span class="branch-name">{{ buildBranchDisplay }}</span>
                <span v-if="buildCommitDisplay">@{{ buildCommitDisplay }}</span>
              </template>
            </a>
          </div>
        </div>
        <div class="right-section">
          <ThemeSwitcher :inline="true" />
          <LanguageSwitcher :inline="true" />
        </div>
      </div>
      <div class="morse-border-container">
        <MorseBorder
          :text="'CHISFLASH-BURNER'"
          :height="4"
          :stroke-width="3"
          :dot-length="3"
          :dash-length="9"
          :spacing="3"
          :letter-spacing="12"
        />
      </div>
    </header>
    <main class="home-content">
      <CartBurner
        ref="cartBurnerRef"
        :device-ready="deviceReady"
        :device="device"
      />
    </main>
    <DebugPanel
      v-if="showDebugPanelModal"
      :device="device"
      :device-ready="deviceReady"
      @close="showDebugPanelModal = false"
      @connect-simulated-device="onConnectSimulatedDevice"
      @clear-simulated-data="onClearSimulatedData"
      @refresh-simulated-device="onRefreshSimulatedDevice"
    />
    <DebugLink
      v-if="showDebugPanel && !showDebugPanelModal"
      v-model:display="showDebugPanelModal"
    />
  </div>
</template>

<script setup lang="ts">
// DeviceConnect 组件引用
import { computed, provide, ref, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';

import CartBurner from '@/components/CartBurner.vue';
import AppMenu from '@/components/common/AppMenu.vue';
import DebugPanel from '@/components/DebugPanel.vue';
import DeviceConnect from '@/components/DeviceConnect.vue';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import DebugLink from '@/components/link/DebugLink.vue';
import MorseBorder from '@/components/MorseBorder.vue';
import ThemeSwitcher from '@/components/ThemeSwitcher.vue';
import { useToast } from '@/composables/useToast';
import { DebugSettings } from '@/settings/debug-settings';
import { DeviceInfo } from '@/types/device-info';

const { showToast } = useToast();
const { t } = useI18n();

const device = ref<DeviceInfo | null>(null);
const deviceReady = ref(false);
const showDebugPanelModal = ref(false);
const currentMode = ref<'MBC5' | 'GBA'>('GBA');
const buildBranch = (import.meta.env.VITE_BUILD_BRANCH ?? '').trim();
const buildCommit = (import.meta.env.VITE_BUILD_COMMIT ?? '').trim();
const isReleaseBuild = import.meta.env.VITE_BUILD_IS_RELEASE === 'true';

const deviceConnectRef = useTemplateRef<InstanceType<typeof DeviceConnect>>('deviceConnectRef');
const cartBurnerRef = useTemplateRef<InstanceType<typeof CartBurner>>('cartBurnerRef');

interface CartBurnerExpose {
  logDeviceFirmwareProfile: (deviceInfo: DeviceInfo) => void;
  resetState: () => void;
}

function getCartBurnerExpose(): CartBurnerExpose | null {
  return cartBurnerRef.value as CartBurnerExpose | null;
}

provide('showDebugPanelModal', showDebugPanelModal);
provide('setShowDebugPanelModal', (val: boolean) => { showDebugPanelModal.value = val; });

// 显示调试面板的条件：调试模式启用或者开发环境
const showDebugPanel = computed((): boolean => {
  return (DebugSettings.showDebugPanel || import.meta.env.DEV);
});

const githubRepoUrl = 'https://github.com/tautcony/beggar_socket';
const buildBranchDisplay = computed((): string => buildBranch || 'dev-build');
const buildCommitDisplay = computed((): string => (buildCommit ? buildCommit.slice(0, 8) : ''));
const titleBadgeHref = computed((): string => {
  if (buildCommit) {
    return `${githubRepoUrl}/commit/${buildCommit}`;
  }

  if (buildBranch) {
    return `${githubRepoUrl}/tree/${encodeURIComponent(buildBranch)}`;
  }

  return githubRepoUrl;
});

/**
 * Callback when the USB device is ready.
 * @param {DeviceInfo} dev The USB device object
 */
function onDeviceReady(dev: DeviceInfo) {
  device.value = dev;
  deviceReady.value = true;
  getCartBurnerExpose()?.logDeviceFirmwareProfile(dev);
}

/**
 * Callback when the USB device is disconnected.
 */
function onDeviceDisconnected() {
  device.value = null;
  deviceReady.value = false;
}

/**
 * 处理连接模拟设备事件
 */
function onConnectSimulatedDevice() {
  // 启用调试模式
  DebugSettings.debugMode = true;
  console.log('[DEBUG] 连接模拟设备请求');

  // 如果当前没有连接设备，则通过 DeviceConnect 组件连接
  if (!deviceReady.value && deviceConnectRef.value) {
    // 通过 DeviceConnect 组件的 connect 方法连接模拟设备
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    deviceConnectRef.value.connect();
  } else {
    console.log('[DEBUG] 设备已连接，无需重复连接');
  }
}

/**
 * 处理清除模拟数据事件
 */
async function onRefreshSimulatedDevice() {
  if (!deviceConnectRef.value || !deviceReady.value || device.value?.serialHandle?.platform !== 'simulated') {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  await deviceConnectRef.value.disconnect();

  getCartBurnerExpose()?.resetState();

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  await deviceConnectRef.value.connect();
}

function onClearSimulatedData() {
  console.log('[DEBUG] 开始清除所有模拟数据');

  // 1. 断开设备连接
  if (deviceConnectRef.value && deviceReady.value) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    deviceConnectRef.value.disconnect();
  }

  // 2. 重置设备状态
  device.value = null;
  deviceReady.value = false;

  // 3. 重置 FlashBurner 组件状态（如果有引用的话）
  getCartBurnerExpose()?.resetState();

  console.log('[DEBUG] 模拟数据清除完成');

  showToast(t('messages.debug.mockDataCleared'), 'success', 2000);
}
</script>

<style lang="scss" scoped>
@use '@/styles/variables/colors' as color-vars;
@use '@/styles/variables/spacing' as spacing-vars;
@use '@/styles/variables/typography' as typography-vars;
@use '@/styles/variables/radius' as radius-vars;
@use '@/styles/mixins' as mixins;

// 定义主题颜色变量
$badge-primary: #667eea;
$badge-secondary: #764ba2;
$title-color: #2c3e50;

// Badge渐变背景混入
@mixin badge-gradient($primary: $badge-primary, $secondary: $badge-secondary) {
  @include mixins.gradient(135deg, $primary 0%, $secondary 100%);
}

// Badge阴影混入
@mixin badge-shadow($level: 1) {
  @if $level == 1 {
    box-shadow: 0 2px 8px rgba($badge-primary, 0.3);
  } @else if $level == 2 {
    box-shadow: 0 4px 12px rgba($badge-primary, 0.5);
  }
}

.home-view {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.page-header {
  position: sticky;
  top: 0;
  z-index: 100;
  width: 100%;
  background: var(--retro-bg-surface);
}

.header-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: spacing-vars.$space-3 spacing-vars.$space-6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: spacing-vars.$space-4;
  flex-wrap: wrap;
  box-sizing: border-box;
}

.home-content {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: spacing-vars.$space-5 spacing-vars.$space-6;
  box-sizing: border-box;
}

.header-divider {
  width: 1px;
  height: 22px;
  background: var(--retro-divider);
  flex-shrink: 0;
}

.morse-border-container {
  height: 4px;
  width: 100%;
  background: var(--retro-bg-canvas);
  @include mixins.transition(all, 0.3s, ease);

  position: relative;
  overflow: hidden;
}

.left-section {
  @include mixins.flex-center;

  justify-content: flex-start;
  gap: spacing-vars.$space-2;
  flex: 1;
  min-width: 0;

  @include mixins.respond-to(lg) {
    gap: spacing-vars.$space-3;
  }
}

.right-section {
  @include mixins.flex-center;

  gap: spacing-vars.$space-2;
  min-width: 0;
  flex-shrink: 0;

  @include mixins.respond-to(lg) {
    gap: spacing-vars.$space-3;
  }
}

.title-section {
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-2;
  min-width: 0;
}

.main-title {
  font-size: typography-vars.$font-size-lg;
  color: var(--retro-ink);
  margin: 0;
  font-weight: typography-vars.$font-weight-semibold;
  letter-spacing: -0.01em;
  @include mixins.text-truncate;
}

.title-badge {
  align-self: center;
  background: var(--retro-bg-tint);
  color: var(--retro-ink);
  border: 1.5px solid var(--retro-border);
  border-radius: 4px;
  box-shadow: var(--retro-shadow-btn);
  padding: 2px 8px;
  font-family: var(--retro-font-mono);
  font-size: 11px;
  font-weight: typography-vars.$font-weight-bold;
  text-decoration: none;
  transition: transform 0.1s ease, box-shadow 0.1s ease, background-color 0.12s ease;
  flex-shrink: 0;

  &:hover {
    background: var(--retro-bg-tint-hover);
    transform: translate(-1px, 1px);
    box-shadow: var(--retro-shadow-btn-hover);
  }
}

.title-badge--build-info {
  background: var(--retro-warning-bg);
  color: var(--retro-ink);
}

.branch-name {
  font-weight: typography-vars.$font-weight-bold;
}
</style>
