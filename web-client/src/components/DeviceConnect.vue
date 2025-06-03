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
        <IonIcon
          class="icon"
          :name="buttonIconName"
          style="font-size: 1.2em; margin-right: 4px;"
        />
        {{ buttonText }}
      </button>
      <div class="polyfill-toggle">
        <label
          class="toggle-container"
          :title="t('ui.device.usePolyfillTooltip')"
        >
          <input
            v-model="usePolyfill"
            type="checkbox"
            :disabled="connected || isConnecting"
            class="toggle-input"
          >
          <span class="toggle-slider" />
          <span class="toggle-label">{{ t('ui.device.usePolyfill') }}</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DeviceInfo } from '@/types/device-info';
import { ref, computed, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { DebugSettings } from '@/settings/debug-settings';
import {
  serial as polyfill, SerialPort as SerialPortPolyfill,
} from 'web-serial-polyfill';
import { IonIcon } from '@ionic/vue';

const { t } = useI18n();
const emit = defineEmits(['device-ready', 'device-disconnected']);

const connected = ref(false);
const isConnecting = ref(false);
const usePolyfill = ref(false);

const toast = reactive({
  visible: false,
  message: '',
  type: 'success',
  timer: null,
} as {
  visible: boolean,
  message: string,
  type: 'success' | 'error' | 'idle',
  timer: ReturnType<typeof setTimeout> | null
});

let port: SerialPort | null = null;
let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;

function showToast(message: string, type: 'success' | 'error' | 'idle', duration = 3000) {
  if (toast.timer) clearTimeout(toast.timer);
  toast.message = message;
  toast.type = type;
  toast.visible = true;
  toast.timer = setTimeout(() => {
    toast.visible = false;
  }, duration);
}

async function connect() {
  if (isConnecting.value || connected.value) return;

  isConnecting.value = true;
  showToast(t('messages.device.tryingConnect'), 'idle');

  try {
    // Check if debug mode is enabled
    if (DebugSettings.enabled) {
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create mock serial port
      const mockPort = {
        readable: new ReadableStream({
          start(controller) {
            // Mock readable stream
          },
        }),
        writable: new WritableStream({
          write(chunk) {
            // Mock writable stream
          },
        }),
        open: async () => {},
        close: async () => {},
        getInfo: () => ({ usbVendorId: 0x1234, usbProductId: 0x5678 }),
      };

      port = mockPort as unknown as SerialPort;
      reader = mockPort.readable.getReader();
      writer = mockPort.writable.getWriter();

      connected.value = true;
      isConnecting.value = false;
      showToast(t('messages.device.connectionSuccess') + ' (Debug Mode)', 'success');
      emit('device-ready', { port, reader, writer } as DeviceInfo);
      return;
    }

    // Check if Web Serial API is supported and get appropriate implementation
    if (usePolyfill.value) {
      if (!polyfill) {
        throw new Error('Web Serial Polyfill is not available');
      }
      // Request serial port using polyfill
      port = await polyfill.requestPort() as unknown as SerialPort;
    } else {
      if (!navigator.serial) {
        throw new Error('Web Serial API is not supported in this browser');
      }
      // Request serial port using native API
      port = await navigator.serial.requestPort();
    }

    // Open the serial port with specified parameters
    await port.open({
      baudRate: 9600,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      flowControl: 'none',
    });

    // Set up serial port signals
    await port.setSignals({
      dataTerminalReady: true,
      requestToSend: true,
    });

    // Brief delay then disable signals as specified
    await new Promise(resolve => setTimeout(resolve, 100));
    await port.setSignals({
      dataTerminalReady: false,
      requestToSend: false,
    });

    // Get reader and writer
    reader = port.readable?.getReader() || null;
    writer = port.writable?.getWriter() || null;

    if (!reader || !writer) {
      throw new Error('Failed to get serial port reader/writer');
    }

    connected.value = true;
    isConnecting.value = false;
    showToast(t('messages.device.connectionSuccess'), 'success');
    emit('device-ready', { port, reader, writer } as DeviceInfo);
  } catch (e) {
    connected.value = false;
    isConnecting.value = false;
    showToast(t('messages.device.connectionFailed', { error: (e instanceof Error ? e.message : String(e)) }), 'error');

    // Clean up on error
    if (reader) {
      try { await reader.releaseLock(); } catch {}
      reader = null;
    }
    if (writer) {
      try { await writer.releaseLock(); } catch {}
      writer = null;
    }
    if (port) {
      try { await port.close(); } catch {}
      port = null;
    }

    emit('device-disconnected');
  }
}

async function disconnect() {
  if (!port) return;
  isConnecting.value = true;

  try {
    // Release reader and writer locks
    if (reader) {
      await reader.cancel();
      reader.releaseLock();
      reader = null;
    }

    if (writer) {
      await writer.close();
      writer = null;
    }

    // Close the serial port
    await port.close();
    showToast(t('messages.device.disconnectionSuccess'), 'success');
  } catch (e) {
    console.error(t('messages.device.disconnectionFailed'), e);
    showToast(`${t('messages.device.disconnectionFailed')}`, 'error');
  } finally {
    port = null;
    reader = null;
    writer = null;
    connected.value = false;
    isConnecting.value = false;
    emit('device-disconnected');
  }
}

function handleConnectDisconnect() {
  if (connected.value) {
    disconnect();
  } else {
    connect();
  }
}

const buttonText = computed(() => {
  if (isConnecting.value && !connected.value) return t('ui.device.connecting');
  if (connected.value) return t('ui.device.connected');
  return t('ui.device.connect');
});

const buttonIconName = computed(() => {
  if (isConnecting.value && !connected.value) return 'reload-outline';
  if (connected.value) return 'checkmark-done-outline';
  return 'flash-outline';
});

const buttonClass = computed(() => {
  if (connected.value) return 'disconnect-btn';
  return 'connect-btn';
});

</script>

<style scoped>
.device-connect-container {
  position: relative; /* For toast positioning context */
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.toggle-container {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  font-size: 0.95rem;
}

.toggle-container[title] {
  cursor: help;
}

.toggle-input {
  display: none;
}

.toggle-slider {
  position: relative;
  width: 44px;
  height: 24px;
  background-color: #ccc;
  border-radius: 12px;
  transition: background-color 0.3s ease;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background-color: white;
  border-radius: 50%;
  transition: transform 0.3s ease;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.toggle-input:checked + .toggle-slider {
  background-color: #007bff;
}

.toggle-input:checked + .toggle-slider::before {
  transform: translateX(20px);
}

.toggle-input:disabled + .toggle-slider {
  background-color: #e0e0e0;
  cursor: not-allowed;
}

.toggle-input:disabled + .toggle-slider::before {
  background-color: #f5f5f5;
}

.toggle-container:has(.toggle-input:disabled) {
  cursor: not-allowed;
  opacity: 0.6;
}

.toggle-label {
  color: #333;
  font-weight: 500;
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
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
  width: 100%;
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
