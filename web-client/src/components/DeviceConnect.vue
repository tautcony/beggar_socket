<template>
  <div class="device-connect-container">
    <div class="device-connect">
      <button
        :class="connected ? 'disconnect-btn' : 'connect-btn'"
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
import { serial as polyfill } from 'web-serial-polyfill';

import { useToast } from '@/composables/useToast';
import { DebugSettings } from '@/settings/debug-settings';
import { DeviceInfo } from '@/types/device-info';
import { sleep } from '@/utils/async-utils';

const { showToast } = useToast();
const { t } = useI18n();
const emit = defineEmits<{
  'device-ready': [device: DeviceInfo]
  'device-disconnected': []
}>();

const connected = ref(false);
const isConnecting = ref(false);
const usePolyfill = ref(false);

let deviceInfo: DeviceInfo | null = null;

// 热重载状态恢复 - 在开发模式下处理 HMR
if (import.meta.hot) {
  const data = import.meta.hot.data as {
    connected: boolean,
    device: DeviceInfo | null,
  };

  // 保存当前状态到 HMR 数据
  data.device = data?.device ?? {
    port: null,
    reader: null,
    writer: null,
  };

  // 从 HMR 数据恢复状态
  if (data.connected) {
    // 验证恢复的状态是否完整
    if (data.device.port) {
      connected.value = data.connected;
      deviceInfo = data.device;
      console.log('[DeviceConnect] HMR: 成功恢复设备连接状态');
    } else {
      // 状态信息不完整，重置为断开状态
      console.warn('[DeviceConnect] HMR: 检测到状态信息丢失，重置为断开状态');
      resetConnectionState().catch(console.error);
    }
  }

  // 监听热重载事件，保存当前状态
  import.meta.hot.dispose(() => {
    if (import.meta.hot?.data) {
      data.device = deviceInfo;
      data.connected = connected.value;
    }
  });

  // 热重载后验证连接状态
  import.meta.hot.accept(() => {
    console.log('[DeviceConnect] HMR: 验证连接状态', { connected: connected.value, hasPort: !!deviceInfo?.port });
    if (connected.value) {
      if (!deviceInfo?.port || !deviceInfo.reader || !deviceInfo.writer) {
        console.warn('[DeviceConnect] HMR: 连接对象丢失，重置连接状态');
        resetConnectionState().catch(console.error);
        return;
      }
    }
  });
}

// 组件挂载时验证连接状态
onMounted(async () => {
  // 如果显示已连接但实际连接对象为空，重置状态
  if (connected.value) {
    if (!deviceInfo?.port || !deviceInfo.reader || !deviceInfo.writer) {
      console.warn('[DeviceConnect] 检测到状态不一致，重置连接状态');
      await resetConnectionState();
    } else {
      // 额外检查端口是否真正可用
      try {
        const portInfo = deviceInfo.port.getInfo?.();
        if (!portInfo) {
          console.warn('[DeviceConnect] 端口信息不可用，重置连接状态');
          await resetConnectionState();
        }
      } catch (error) {
        console.warn('[DeviceConnect] 端口状态检查失败，重置连接状态:', error);
        await resetConnectionState();
      }
    }
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
        readable: new ReadableStream({ start(controller) { } }),
        writable: new WritableStream({ write(chunk) { } }),
        open: async () => { },
        close: async () => { },
        getInfo: () => ({ usbVendorId: 0x0483, usbProductId: 0x0721 }),
      };
      deviceInfo = {
        port: mockPort as unknown as SerialPort,
        reader: mockPort.readable.getReader(),
        writer: mockPort.writable.getWriter(),
      };
      connected.value = true;
      isConnecting.value = false;
      showToast(t('messages.device.connectionSuccess') + ' (Debug Mode)', 'success');
      emit('device-ready', deviceInfo);
      return;
    }
    const filters = [
      { usbVendorId: 0x0483, usbProductId: 0x0721 },
    ];
    let port: SerialPort | null = null;
    if (usePolyfill.value) {
      if (!polyfill) throw new Error('Web Serial Polyfill is not available');
      if (!navigator.usb) throw new Error('WebUSB API is not supported in this browser');
      port = await polyfill.requestPort({ filters }) as unknown as SerialPort;
    } else {
      if (!navigator.serial) throw new Error('Web Serial API is not supported in this browser');
      port = await navigator.serial.requestPort({ filters });
    }
    if (!port) throw new Error('No serial port selected');
    await port.open({ baudRate: 9600, dataBits: 8, parity: 'none', stopBits: 1, flowControl: 'none' });

    // send dtr & rts signals to ensure device is ready
    await port.setSignals({ dataTerminalReady: true, requestToSend: true });
    await sleep(100);
    await port.setSignals({ dataTerminalReady: false, requestToSend: false });

    const reader = port.readable?.getReader({ mode: 'byob' }) ?? null;
    const writer = port.writable?.getWriter() ?? null;
    if (!reader || !writer) throw new Error('Failed to get serial port reader/writer');
    connected.value = true;
    isConnecting.value = false;
    showToast(t('messages.device.connectionSuccess'), 'success');
    deviceInfo = { port, reader, writer };
    emit('device-ready', deviceInfo as DeviceInfo<'byob'>);
  } catch (e) {
    showToast(t('messages.device.connectionFailed', { error: (e instanceof Error ? e.message : String(e)) }), 'error');
    await resetConnectionState();
  }
}

async function disconnect() {
  if (!deviceInfo) return;
  isConnecting.value = true;
  try {
    await deviceInfo.reader?.cancel();
    deviceInfo.reader?.releaseLock();
    await deviceInfo.writer?.close();
    await deviceInfo.port?.close();
    deviceInfo.port = null;
    deviceInfo.reader = null;
    deviceInfo.writer = null;
    showToast(t('messages.device.disconnectionSuccess'), 'success');
  } catch (e) {
    console.error(t('messages.device.disconnectionFailed'), e);
    showToast(t('messages.device.disconnectionFailed'), 'error');
  } finally {
    isConnecting.value = false;
    connected.value = false;
    emit('device-disconnected');
  }
}

async function resetConnectionState() {
  connected.value = false;
  isConnecting.value = false;

  if (deviceInfo !== null) {
    // 安全地清理资源
    try {
      if (deviceInfo.reader) {
        await deviceInfo.reader.cancel().catch(() => {});
        deviceInfo.reader.releaseLock();
      }
    } catch {}

    try {
      if (deviceInfo.writer) {
        await deviceInfo.writer.close().catch(() => {});
      }
    } catch {}

    try {
      if (deviceInfo.port) {
        await deviceInfo.port.close().catch(() => {});
      }
    } catch {}

    deviceInfo.port = null;
    deviceInfo.reader = null;
    deviceInfo.writer = null;
    deviceInfo = null;
  }

  emit('device-disconnected');
}

async function handleConnectDisconnect() {
  if (connected.value) {
    await disconnect();
  } else {
    await connect();
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

// 暴露方法给父组件
defineExpose({
  connect,
  disconnect,
  connected: computed(() => connected.value),
});
</script>

<style scoped>
.device-connect-container {
  position: relative;
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
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-input:checked+.toggle-slider {
  background-color: #007bff;
}

.toggle-input:checked+.toggle-slider::before {
  transform: translateX(20px);
}

.toggle-input:disabled+.toggle-slider {
  background-color: #e0e0e0;
  cursor: not-allowed;
}

.toggle-input:disabled+.toggle-slider::before {
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
  border: none;
  /* Removed border, relying on background and shadow */
  background: #007bff;
  /* Primary blue */
  color: white;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background-color 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.connect-btn:hover:not(:disabled) {
  background: #0056b3;
  /* Darker blue on hover */
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.connect-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.disconnect-btn {
  background: #6c757d;
  /* Grey for connected/disconnect */
  color: white;
}

.disconnect-btn:hover:not(:disabled) {
  background: #545b62;
  /* Darker grey */
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
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
