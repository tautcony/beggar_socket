<template>
  <div>
    <h1>ChisFlashBurner Client</h1>
    <DeviceConnect @device-ready="onDeviceReady" @device-disconnected="onDeviceDisconnected" />
    <FlashBurner
      :deviceReady="deviceReady"
      :device="device"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import DeviceConnect from './components/DeviceConnect.vue'
import FlashBurner from './components/FlashBurner.vue'

const device = ref(null)
const deviceReady = ref(false)

function onDeviceReady(dev) {
  device.value = dev
  deviceReady.value = true
}

function onDeviceDisconnected() {
  device.value = null
  deviceReady.value = false
}
</script>

<style scoped>
h1 {
  text-align: center;
  font-size: 1.8rem; /* 缩小标题 */
  color: #2c3e50;
  margin: 16px 0; /* 减小上下边距 */
  font-weight: 600;
  font-family: 'Segoe UI', 'PingFang SC', Arial, sans-serif;
}

div {
  font-family: 'Segoe UI', 'PingFang SC', Arial, sans-serif;
}
</style>
