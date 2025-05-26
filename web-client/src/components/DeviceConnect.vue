<template>
  <div>
    <button @click="connect">连接设备</button>
    <span v-if="status">{{ status }}</span>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['device-ready'])
const status = ref('')

let device = null
let endpointOut = 2 // 需根据实际端点调整
let endpointIn = 1

async function connect() {
  try {
    device = await navigator.usb.requestDevice({
      filters: [
        // { vendorId: 0x0483 }
      ]
    })
    await device.open()
    if (device.configuration === null) {
      await device.selectConfiguration(1)
    }
    // 自动选择有端点的接口
    console.log('Available interfaces:', device.configuration.interfaces)
    const iface = device.configuration.interfaces.find(i => i.alternate.endpoints.length > 1)
    if (iface) {
      await device.claimInterface(iface.interfaceNumber)
    } else {
      throw new Error('未找到可用的 USB 接口')
    }
    status.value = '设备已连接'
    emit('device-ready', { device, endpointOut, endpointIn })
  } catch (e) {
    status.value = '连接失败: ' + e
  }
}
</script>
