<template>
  <div>
    <h1>ChisFlashBurner Client</h1>
    <DeviceConnect @device-ready="onDeviceReady" />
    <FileUploader v-if="deviceReady" @file-selected="onFileSelected" />
    <FlashBurner
      :deviceReady="deviceReady"
      :fileReady="!!fileData"
      :fileData="fileData"
      :device="device"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import DeviceConnect from './components/DeviceConnect.vue'
import FileUploader from './components/FileUploader.vue'
import FlashBurner from './components/FlashBurner.vue'

const device = ref(null)
const deviceReady = ref(false)
const fileData = ref(null)

function onDeviceReady(dev) {
  device.value = dev
  deviceReady.value = true
}
function onFileSelected(data) {
  fileData.value = data
}
</script>
