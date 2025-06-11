<template>
  <div class="device-connect-container">
    <div class="device-connect">
      <button
        :class="buttonClass"
        :disabled="isConnecting"
        @click="handleConnectDisconnect"
      >
        <IonIcon
          class="icon"
          :icon="buttonIcon"
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
import { IonIcon } from '@ionic/vue';
import { checkmarkDoneOutline, flashOutline, reloadOutline } from 'ionicons/icons';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  serial as polyfill, SerialPort as SerialPortPolyfill,
} from 'web-serial-polyfill';

import { useToast } from '@/composables/useToast';
import { DebugSettings } from '@/settings/debug-settings';
import { DeviceInfo } from '@/types/device-info';

const { showToast } = useToast();
const { t } = useI18n();
const emit = defineEmits(['device-ready', 'device-disconnected']);

const connected = ref(false);
const isConnecting = ref(false);
const usePolyfill = ref(false);

let port: SerialPort | null = null;
let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;

// 热重载状态恢复 - 在开发模式下处理 HMR
if (import.meta.hot) {
  // 保存当前状态到 HMR 数据
  import.meta.hot.data.deviceConnection = import.meta.hot.data.deviceConnection || {
    connected: false,
    port: null,
    reader: null,
    writer: null,
  };

  // 从 HMR 数据恢复状态
  if (import.meta.hot.data.deviceConnection.connected) {
    connected.value = import.meta.hot.data.deviceConnection.connected;
    port = import.meta.hot.data.deviceConnection.port;
    reader = import.meta.hot.data.deviceConnection.reader;
    writer = import.meta.hot.data.deviceConnection.writer;
  }

  // 监听热重载事件，保存当前状态
  import.meta.hot.dispose(() => {
    if (import.meta.hot?.data) {
      import.meta.hot.data.deviceConnection = {
        connected: connected.value,
        port,
        reader,
        writer,
      };
    }
  });

  // 热重载后验证连接状态
  import.meta.hot.accept(() => {
    // 检查串口连接是否仍然有效
    if (port && connected.value) {
      try {
        // 检查端口是否仍然连接
        if (!port.readable || !port.writable) {
          // 连接已丢失，重置状态
          connected.value = false;
          port = null;
          reader = null;
          writer = null;
          emit('device-disconnected');
        }
      } catch (e) {
        // 连接检查失败，重置状态
        connected.value = false;
        port = null;
        reader = null;
        writer = null;
        emit('device-disconnected');
      }
    }
  });
}

// 组件挂载时验证连接状态
onMounted(() => {
  // 如果显示已连接但实际连接对象为空，重置状态
  if (connected.value && (!port || !reader || !writer)) {
    console.warn('[DeviceConnect] 检测到状态不一致，重置连接状态');
    connected.value = false;
    port = null;
    reader = null;
    writer = null;
    emit('device-disconnected');
  }
});

async function connect() {
  if (isConnecting.value || connected.value) return;

  isConnecting.value = true;
  showToast(t('messages.device.tryingConnect'), 'idle');

  try {
    if (DebugSettings.debugMode) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockPort = {
        readable: new ReadableStream({ start(controller) {} }),
        writable: new WritableStream({ write(chunk) {} }),
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
    if (usePolyfill.value) {
      if (!polyfill) throw new Error('Web Serial Polyfill is not available');
      port = await polyfill.requestPort() as unknown as SerialPort;
    } else {
      if (!navigator.serial) throw new Error('Web Serial API is not supported in this browser');
      port = await navigator.serial.requestPort();
    }
    await port.open({ baudRate: 9600, dataBits: 8, parity: 'none', stopBits: 1, flowControl: 'none' });
    await port.setSignals({ dataTerminalReady: true, requestToSend: true });
    await new Promise(resolve => setTimeout(resolve, 100));
    await port.setSignals({ dataTerminalReady: false, requestToSend: false });
    reader = port.readable?.getReader() || null;
    writer = port.writable?.getWriter() || null;
    if (!reader || !writer) throw new Error('Failed to get serial port reader/writer');
    connected.value = true;
    isConnecting.value = false;
    showToast(t('messages.device.connectionSuccess'), 'success');
    emit('device-ready', { port, reader, writer } as DeviceInfo);
  } catch (e) {
    connected.value = false;
    isConnecting.value = false;
    showToast(t('messages.device.connectionFailed', { error: (e instanceof Error ? e.message : String(e)) }), 'error');
    if (reader) { try { await reader.releaseLock(); } catch {} reader = null; }
    if (writer) { try { await writer.releaseLock(); } catch {} writer = null; }
    if (port) { try { await port.close(); } catch {} port = null; }
    emit('device-disconnected');
  }
}

async function disconnect() {
  if (!port) return;
  isConnecting.value = true;
  try {
    if (reader) { await reader.cancel(); reader.releaseLock(); reader = null; }
    if (writer) { await writer.close(); writer = null; }
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

const buttonIcon = computed(() => {
  if (isConnecting.value && !connected.value) return reloadOutline;
  if (connected.value) return checkmarkDoneOutline;
  return flashOutline;
});

const buttonClass = computed(() => {
  if (connected.value) return 'disconnect-btn';
  return 'connect-btn';
});

// 暴露方法给父组件
defineExpose({
  connect,
  disconnect,
  connected: computed(() => connected.value),
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
