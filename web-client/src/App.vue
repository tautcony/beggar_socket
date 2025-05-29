<template>
  <div>
    <LanguageSwitcher />
    <h1>{{ $t('ui.app.title') }}</h1>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import DeviceConnect from '@/components/DeviceConnect.vue'
import FlashBurner from '@/components/FlashBurner.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import DebugPanel from '@/components/DebugPanel.vue'
import { DeviceInfo } from '@/types/DeviceInfo'
import { DebugConfig } from '@/utils/DebugConfig'

const device = ref<DeviceInfo | null>(null)
const deviceReady = ref(false)

// 显示调试面板的条件：调试模式启用或者开发环境
const showDebugPanel = computed(() => {
  return DebugConfig.enabled || import.meta.env.DEV
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
h1 {
  text-align: center;
  font-size: 1.8rem;
  color: #2c3e50;
  margin: 16px 0;
  font-weight: 600;
  font-family: 'Segoe UI', 'PingFang SC', Arial, sans-serif;
}

div {
  font-family: 'Segoe UI', 'PingFang SC', Arial, sans-serif;
}
</style>
