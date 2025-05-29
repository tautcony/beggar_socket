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
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import DeviceConnect from '@/components/DeviceConnect.vue'
import FlashBurner from '@/components/FlashBurner.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import { DeviceInfo } from '@/types/DeviceInfo'

const device = ref<DeviceInfo | null>(null)
const deviceReady = ref(false)

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
