<template>
  <div class="device-connect-container">
    <div v-if="toast.visible" :class="['toast', toast.type]">
      {{ toast.message }}
    </div>
    <div class="device-connect">
      <button :class="buttonClass" @click="handleConnectDisconnect" :disabled="isConnecting">
        <span class="icon">{{ buttonIcon }}</span> {{ buttonText }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'

const emit = defineEmits(['device-ready', 'device-disconnected'])

const connected = ref(false)
const isConnecting = ref(false)

const toast = reactive({
  visible: false,
  message: '',
  type: 'success',
  timer: null
})

let device = null
let endpointOut = 2
let endpointIn = 1

function showToast(message, type, duration = 3000) {
  if (toast.timer) clearTimeout(toast.timer)
  toast.message = message
  toast.type = type
  toast.visible = true
  toast.timer = setTimeout(() => {
    toast.visible = false
  }, duration)
}

async function connect() {
  if (isConnecting.value || connected.value) return

  isConnecting.value = true
  showToast('正在尝试连接设备...', 'idle')

  try {
    device = await navigator.usb.requestDevice({
      filters: []
    })
    await device.open()
    if (device.configuration === null) {
      await device.selectConfiguration(1)
    }
    
    let claimedInterface = false
    for (const iface of device.configuration.interfaces) {
      const alternate = iface.alternates.find(alt => alt.endpoints.length >= 2)
      if (alternate) {
        const outEp = alternate.endpoints.find(ep => ep.direction === 'out')
        const inEp = alternate.endpoints.find(ep => ep.direction === 'in')

        if (outEp && inEp) {
          await device.claimInterface(iface.interfaceNumber)
          endpointOut = outEp.endpointNumber
          endpointIn = inEp.endpointNumber
          claimedInterface = true
          break
        }
      }
    }

    if (!claimedInterface) {
      const iface = device.configuration.interfaces.find(i => i.alternate.endpoints.length > 0)
      if (iface) {
        await device.claimInterface(iface.interfaceNumber)
      } else {
        throw new Error('未找到可用的 USB 接口或端点。')
      }
    }

    connected.value = true
    isConnecting.value = false
    showToast('设备已连接', 'success')
    emit('device-ready', { device, endpointOut, endpointIn })
  } catch (e) {
    connected.value = false
    isConnecting.value = false
    showToast('连接失败: ' + e.message, 'error')
    if (device && device.opened) {
      await device.close().catch(err => console.error("Error closing device on connect failure:", err))
    }
    device = null
    emit('device-disconnected')
  }
}

async function disconnect() {
  if (!device) return
  isConnecting.value = true

  try {
    if (device.opened) {
      await device.close()
    }
    showToast('已断开连接', 'success')
  } catch (e) {
    console.error('断开连接时出错:', e)
    showToast('断开连接失败: ' + e.message, 'error')
  } finally {
    device = null
    connected.value = false
    isConnecting.value = false
    emit('device-disconnected')
  }
}

function handleConnectDisconnect() {
  if (connected.value) {
    disconnect()
  } else {
    connect()
  }
}

const buttonText = computed(() => {
  if (isConnecting.value && !connected.value) return '正在连接...'
  if (connected.value) return '已连接 (断开)'
  return '连接设备'
})

const buttonIcon = computed(() => {
  if (isConnecting.value && !connected.value) return '🔄'
  if (connected.value) return '✅'
  return '🔌'
})

const buttonClass = computed(() => {
  if (connected.value) return 'disconnect-btn'
  return 'connect-btn'
})

</script>

<style scoped>
.device-connect-container {
  position: relative; /* For toast positioning context */
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.toast {
  position: fixed; /* Changed from absolute to fixed for viewport positioning */
  top: 20px;
  right: 20px;
  padding: 10px 20px;
  border-radius: 6px;
  color: white;
  font-size: 0.95rem;
  z-index: 1000;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.toast.success {
  background-color: #4CAF50; /* Green */
}
.toast.error {
  background-color: #f44336; /* Red */
}
.toast.idle {
  background-color: #2196F3; /* Blue for connecting */
}

.device-connect {
  display: flex;
  justify-content: center; /* Center the button */
  align-items: center;
  margin-bottom: 12px; /* 减小底部边距 */
  width: 100%; /* Ensure it takes width for centering */
}

.connect-btn,
.disconnect-btn {
  padding: 6px 16px; /* 减小按钮padding */
  border-radius: 6px; /* 减小圆角 */
  border: none; /* Removed border, relying on background and shadow */
  background: #007bff; /* Primary blue */
  color: white;
  font-size: 1.1rem; /* Slightly larger font */
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px; /* 减小间距 */
  transition: background-color 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1); /* 减小阴影 */
}

.connect-btn:hover:not(:disabled) {
  background: #0056b3; /* Darker blue on hover */
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.connect-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.disconnect-btn {
  background: #6c757d; /* Grey for connected/disconnect */
  color: white;
}
.disconnect-btn:hover:not(:disabled) {
  background: #545b62; /* Darker grey */
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}
.disconnect-btn:active:not(:disabled) {
  transform: translateY(1px);
}

button:disabled {
  background-color: #cccccc;
  color: #666666;
  cursor: not-allowed;
  box-shadow: none;
}

.icon {
  font-size: 1.2em; /* Slightly larger icon */
}
</style>
