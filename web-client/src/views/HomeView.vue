<template>
  <div>
    <div class="top-bar">
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
        <div class="title-section">
          <h1 class="main-title">
            {{ $t('ui.app.title') }}
          </h1>
          <a
            href="https://oshwhub.com/linscon/beggar_socket"
            target="_blank"
            class="title-badge"
            rel="noopener noreferrer"
          >
            for beggar_socket
          </a>
        </div>
      </div>
      <div class="right-section">
        <LanguageSwitcher />
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
    <CartBurner
      ref="cartBurnerRef"
      :device-ready="deviceReady"
      :device="device"
    />
    <DebugPanel
      v-if="showDebugPanelModal"
      @close="showDebugPanelModal = false"
      @connect-mock-device="onConnectMockDevice"
      @clear-mock-data="onClearMockData"
    />
    <DebugLink
      v-if="showDebugPanel"
      v-model:display="showDebugPanelModal"
    />
  </div>
</template>

<script setup lang="ts">
// DeviceConnect 组件引用
import { computed, onMounted, provide, ref, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';

import CartBurner from '@/components/CartBurner.vue';
import AppMenu from '@/components/common/AppMenu.vue';
import DebugPanel from '@/components/DebugPanel.vue';
import DeviceConnect from '@/components/DeviceConnect.vue';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import DebugLink from '@/components/link/DebugLink.vue';
import MorseBorder from '@/components/MorseBorder.vue';
import { useToast } from '@/composables/useToast';
import { DebugSettings } from '@/settings/debug-settings';
import { useRomAssemblyResultStore } from '@/stores/rom-assembly-store';
import { DeviceInfo } from '@/types/device-info';

const { showToast } = useToast();
const { t } = useI18n();
const romAssemblyResultStore = useRomAssemblyResultStore();

const device = ref<DeviceInfo | null>(null);
const deviceReady = ref(false);
const showSettings = ref(false);
const showDebugPanelModal = ref(false);
const currentMode = ref<'MBC5' | 'GBA'>('GBA');

const deviceConnectRef = useTemplateRef<InstanceType<typeof DeviceConnect>>('deviceConnectRef');
const cartBurnerRef = useTemplateRef<InstanceType<typeof CartBurner>>('cartBurnerRef');

provide('showDebugPanelModal', showDebugPanelModal);
provide('setShowDebugPanelModal', (val: boolean) => { showDebugPanelModal.value = val; });

// 显示调试面板的条件：调试模式启用或者开发环境
const showDebugPanel = computed((): boolean => {
  return (DebugSettings.showDebugPanel || import.meta.env.DEV);
});

/**
 * Callback when the USB device is ready.
 * @param {DeviceInfo} dev The USB device object
 */
function onDeviceReady(dev: DeviceInfo) {
  device.value = dev;
  deviceReady.value = true;
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
function onConnectMockDevice() {
  // 启用调试模式
  DebugSettings.debugMode = true;
  console.log('[DEBUG] 连接模拟设备请求');

  // 如果当前没有连接设备，则通过 DeviceConnect 组件连接
  if (!deviceReady.value && deviceConnectRef.value) {
    // 通过 DeviceConnect 组件的 connect 方法连接模拟设备
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    deviceConnectRef.value.connect();
  } else {
    console.log('[DEBUG] 设备已连接，无需重复连接');
  }
}

/**
 * 处理清除模拟数据事件
 */
function onClearMockData() {
  console.log('[DEBUG] 开始清除所有模拟数据');

  // 1. 断开设备连接
  if (deviceConnectRef.value && deviceReady.value) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    deviceConnectRef.value.disconnect();
  }

  // 2. 重置设备状态
  device.value = null;
  deviceReady.value = false;

  // 3. 重置 FlashBurner 组件状态（如果有引用的话）
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (cartBurnerRef.value && typeof cartBurnerRef.value.resetState === 'function') {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    cartBurnerRef.value.resetState();
  }

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

// 动画定义
@keyframes wiggle {
  0%, 100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(3deg);
  }
  75% {
    transform: rotate(-3deg);
  }
}

.top-bar {
  @include mixins.flex-between;
  @include mixins.transition();

  padding: spacing-vars.$space-3 0 spacing-vars.$space-3 0;
  min-height: 60px;

  @include mixins.respond-to(lg) {
    padding: spacing-vars.$space-3 spacing-vars.$space-5;
  }
}

.morse-border-container {
  height: 4px;
  width: 100%;
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
  flex-shrink: 0;

  @include mixins.respond-to(lg) {
    gap: spacing-vars.$space-3;
  }
}

.title-section {
  position: relative;
  @include mixins.flex-column;

  align-items: flex-start;
  gap: spacing-vars.$space-1;
  margin-left: spacing-vars.$space-2;

  @include mixins.respond-to(lg) {
    @include mixins.flex-center;

    justify-content: flex-start;
    margin-left: spacing-vars.$space-4;
    gap: 0;
  }
}

.main-title {
  font-size: typography-vars.$font-size-xl;
  color: $title-color;
  margin: 0;
  font-weight: typography-vars.$font-weight-semibold;
  @include mixins.text-truncate;

  @include mixins.respond-to(lg) {
    font-size: typography-vars.$font-size-3xl;
  }
}

.title-badge {
  position: static;
  top: auto;
  right: auto;
  align-self: flex-start;

  @include badge-gradient();
  @include badge-shadow(1);
  @include mixins.transition(all, 0.3s, ease);
  animation: wiggle 2s ease-in-out infinite;

  color: white;
  padding: spacing-vars.$space-1 spacing-vars.$space-2;
  border-radius: radius-vars.$radius-2xl;
  font-size: typography-vars.$font-size-xs;
  font-weight: typography-vars.$font-weight-medium;
  text-decoration: none;
  @include mixins.text-truncate;

  &:hover {
    @include badge-gradient($badge-secondary, $badge-primary);
    @include badge-shadow(2);

    transform: scale(1.05);
    animation-play-state: paused;
  }

  @include mixins.respond-to(lg) {
    position: absolute;
    top: -8px;
    right: -120px;
  }
}
</style>
