<template>
  <div>
    <div class="top-bar">
      <AppMenu
        :current-mode="currentMode"
        @rom-assembled="onRomAssembled"
      />
      <LanguageSwitcher />
    </div>
    <h1 class="title-container">
      {{ $t('ui.app.title') }}
      <a
        href="https://oshwhub.com/linscon/beggar_socket"
        target="_blank"
        class="title-badge"
        rel="noopener noreferrer"
      >
        for beggar_socket
      </a>
    </h1>
    <DeviceConnect
      ref="deviceConnectRef"
      @device-ready="onDeviceReady"
      @device-disconnected="onDeviceDisconnected"
    />
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
    <GlobalToast />
  </div>
</template>

<script setup lang="ts">
// DeviceConnect 组件引用
import { computed, provide, ref, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';

import CartBurner from '@/components/CartBurner.vue';
import AppMenu from '@/components/common/AppMenu.vue';
import GlobalToast from '@/components/common/GlobalToast.vue';
import DebugPanel from '@/components/DebugPanel.vue';
import DeviceConnect from '@/components/DeviceConnect.vue';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import DebugLink from '@/components/link/DebugLink.vue';
import { useToast } from '@/composables/useToast';
import { DebugSettings } from '@/settings/debug-settings';
import { setAssembledRom } from '@/stores/assembled-rom-store';
import { DeviceInfo } from '@/types/device-info';
import type { AssembledRom } from '@/types/rom-assembly';

const { showToast } = useToast();
const { t } = useI18n();

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
  return !!(DebugSettings.showDebugPanel || import.meta.env.DEV);
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

/**
 * 处理ROM组装完成事件
 */
function onRomAssembled(rom: AssembledRom, romType: 'MBC5' | 'GBA') {
  console.log(`[ROM Assembly] ROM assembled for ${romType}, size: ${rom.totalSize} bytes`);

  // 更新当前模式
  currentMode.value = romType;

  // 将组装的ROM数据保存到全局状态
  setAssembledRom(rom, romType);

  showToast(t('messages.romAssembly.assembledForMainInterface', {
    romType,
    size: (rom.totalSize / 1024 / 1024).toFixed(2),
  }), 'success', 4000);
}
</script>

<style scoped>
.top-bar {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  padding: 16px 20px 0;
}

h1 {
  text-align: center;
  font-size: 1.8rem;
  color: #2c3e50;
  margin: 16px 0;
  font-weight: 600;
  font-family: 'Segoe UI', 'PingFang SC', Arial, sans-serif;
}

.title-container {
  position: relative;
  display: inline-block;
  width: 100%;
}

.title-badge {
  position: absolute;
  top: -16px;
  right: calc(50% - 180px);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 500;
  text-decoration: none;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  transform-origin: center;
  animation: wiggle 2s ease-in-out infinite;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.title-badge:hover {
  background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
  animation-play-state: paused;
}

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

/* 响应式设计 */
@media (max-width: 768px) {
  .title-badge {
    right: calc(50% - 100px);
    font-size: 0.6rem;
    padding: 3px 6px;
  }
}

@media (max-width: 480px) {
  .title-badge {
    right: calc(50% - 80px);
    font-size: 0.55rem;
    padding: 2px 5px;
  }
}

div {
  font-family: 'Segoe UI', 'PingFang SC', Arial, sans-serif;
}

.debug-link {
  position: fixed;
  right: 32px;
  bottom: 100px;
  z-index: 1200;
  background: #fff;
  color: #764ba2;
  border: 2px solid #764ba2;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  font-size: 1.6rem;
  font-weight: bold;
  box-shadow: 0 2px 8px #764ba233;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, color 0.2s, box-shadow 0.2s;
}
.debug-link:hover {
  background: #764ba2;
  color: #fff;
  box-shadow: 0 4px 16px #764ba255;
}
</style>
