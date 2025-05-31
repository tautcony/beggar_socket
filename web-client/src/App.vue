<template>
  <div>
    <div class="top-bar">
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
      @device-ready="onDeviceReady"
      @device-disconnected="onDeviceDisconnected"
    />
    <FlashBurner
      :device-ready="deviceReady"
      :device="device"
    />
    <!-- 调试面板悬浮在最上层 -->
    <DebugPanel v-if="showDebugPanel" />
    <!-- 高级设置弹窗 -->
    <AdvancedSettings 
      v-if="showSettings" 
      @close="showSettings = false" 
    />
    <!-- 设置按钮悬浮在右下角，GitHub 链接上方 -->
    <SettingsLink @click="showSettings = true" />
    <!-- GitHub 链接悬浮在右下角 -->
    <GitHubLink />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import DeviceConnect from '@/components/DeviceConnect.vue'
import FlashBurner from '@/components/CartBurner.vue'
import LanguageSwitcher from '@/components/common/LanguageSwitcher.vue'
import DebugPanel from '@/components/common/DebugPanel.vue'
import GitHubLink from '@/components/common/GitHubLink.vue'
import AdvancedSettings from '@/components/settings/AdvancedSettings.vue'
import SettingsLink from '@/components/settings/SettingsLink.vue'
import { DeviceInfo } from '@/types/DeviceInfo'
import { DebugConfig } from '@/utils/DebugConfig'

const device = ref<DeviceInfo | null>(null)
const deviceReady = ref(false)
const showSettings = ref(false)

// 显示调试面板的条件：调试模式启用或者开发环境
const showDebugPanel = computed(() => {
  return DebugConfig.showDebugPanel || import.meta.env.DEV
})

/**
 * Callback when the USB device is ready.
 * @param {DeviceInfo} dev The USB device object
 */
function onDeviceReady(dev: DeviceInfo) {
  device.value = dev
  deviceReady.value = true
}

/**
 * Callback when the USB device is disconnected.
 */
function onDeviceDisconnected() {
  device.value = null
  deviceReady.value = false
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
</style>
