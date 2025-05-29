<template>
  <div class="device-connect-container">
    <div
      v-if="toast.visible"
      :class="['toast', toast.type]"
    >
      {{ toast.message }}
    </div>
    <div class="device-connect">
      <button
        :class="buttonClass"
        :disabled="isConnecting"
        @click="handleConnectDisconnect"
      >
        <span class="icon">{{ buttonIcon }}</span> {{ buttonText }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DeviceInfo } from '@/types/DeviceInfo.ts'
import { ref, computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const emit = defineEmits(['device-ready', 'device-disconnected'])

const connected = ref(false)
const isConnecting = ref(false)

const toast = reactive({
  visible: false,
  message: '',
  type: 'success',
  timer: null
} as {
  visible: boolean,
  message: string,
  type: 'success' | 'error' | 'idle',
  timer: ReturnType<typeof setTimeout> | null
})

let device: USBDevice | null = null
let endpointOut = 2
let endpointIn = 1

function showToast(message: string, type: 'success' | 'error' | 'idle', duration = 3000) {
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
  showToast(t('messages.device.tryingConnect'), 'idle')

  try {
    device = await navigator.usb.requestDevice({
      filters: []
    })
    await device.open()
    if (device.configuration === null) {
      await device.selectConfiguration(1)
    }

    let claimedInterface = false
    for (const iface of device.configuration?.interfaces || []) {
      const alternate = iface.alternates.find(alt => alt.endpoints.length >= 2)
      if (alternate) {
        const outEp = alternate.endpoints.find(ep => ep.direction === 'out' && ep.type === 'bulk')
        const inEp = alternate.endpoints.find(ep => ep.direction === 'in' && ep.type === 'bulk')

        if (outEp && inEp) {
          await device.claimInterface(iface.interfaceNumber)
          await device.selectAlternateInterface(iface.interfaceNumber, 0)
          endpointOut = outEp.endpointNumber
          endpointIn = inEp.endpointNumber
          claimedInterface = true
          break
        }
      }
    }

    if (!claimedInterface) {
      console.error(t('messages.device.noInterface'), device.configuration?.interfaces)
      throw new Error(t('messages.device.noInterface'))
    }

    connected.value = true
    isConnecting.value = false
    showToast(t('messages.device.connectionSuccess'), 'success')
    emit('device-ready', { device, endpointOut, endpointIn } as DeviceInfo)
  } catch (e) {
    connected.value = false
    isConnecting.value = false
    showToast(t('messages.device.connectionFailed', { error: (e instanceof Error ? e.message : String(e)) }), 'error')
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
    showToast(t('messages.device.disconnectionSuccess'), 'success')
  } catch (e) {
    console.error(t('messages.device.disconnectionFailed'), e)
    showToast(`${t('messages.device.disconnectionFailed')}`, 'error')
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
  if (isConnecting.value && !connected.value) return t('ui.device.connecting')
  if (connected.value) return t('ui.device.connected')
  return t('ui.device.connect')
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
  position: fixed;
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
  margin-bottom: 12px;
  width: 100%; /* Ensure it takes width for centering */
}

.connect-btn,
.disconnect-btn {
  padding: 6px 16px;
  border-radius: 6px;
  border: none; /* Removed border, relying on background and shadow */
  background: #007bff; /* Primary blue */
  color: white;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background-color 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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
  font-size: 1.2em;
}
</style>
