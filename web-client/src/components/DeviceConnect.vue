<template>
  <div class="device-connect-container">
    <div class="device-connect">
      <BaseButton
        :variant="connected ? 'secondary' : 'primary'"
        :disabled="isConnecting"
        :title="connectionTooltip"
        :icon="buttonIcon"
        :text="buttonText"
        @click="handleConnectDisconnect"
      />
      <!-- 重置连接状态按钮，仅在已连接时显示 -->
      <BaseButton
        v-if="connected"
        variant="warning"
        :disabled="isConnecting"
        text="重置"
        @click="() => initializeSerialState(deviceInfo, true)"
      />
      <!--div class="polyfill-toggle">
        <ToggleSwitch
          v-model="usePolyfill"
          :label="t('ui.device.usePolyfill')"
          :tooltip="t('ui.device.usePolyfillTooltip')"
          :disabled="connected || isConnecting"
        />
      </div-->
    </div>
    <!-- 串口选择模态框 -->
    <PortSelectorModal
      :visible="showPortSelector"
      :ports="availablePorts"
      @select="onPortSelected"
      @cancel="onPortSelectionCanceled"
      @refresh="onRefreshPorts"
    />
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { checkmarkDoneOutline, flashOutline, reloadOutline } from 'ionicons/icons';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseButton from '@/components/common/BaseButton.vue';
import PortSelectorModal from '@/components/modal/PortSelectorModal.vue';
import { useToast } from '@/composables/useToast';
import { DeviceConnectionManager, PortSelectionRequiredError } from '@/services/device-connection-manager';
import { type SerialPortInfo, SerialService } from '@/services/serial-service';
import { DeviceInfo } from '@/types/device-info';
import { isElectron } from '@/utils/electron';
import { PortFilters } from '@/utils/port-filter';
// import ToggleSwitch from '@/components/common/ToggleSwitch.vue';

const { showToast } = useToast();
const { t } = useI18n();
const emit = defineEmits<{
  'device-ready': [device: DeviceInfo]
  'device-disconnected': []
}>();

const connected = ref(false);
const isConnecting = ref(false);
const usePolyfill = ref(false);
const showPortSelector = ref(false);
const availablePorts = ref<SerialPortInfo[]>([]);

let deviceInfo: DeviceInfo | null = null;
const deviceManager = DeviceConnectionManager.getInstance();
const serialService = SerialService.getInstance();

// 热重载状态恢复 - 在开发模式下处理 HMR
if (import.meta.hot) {
  const data = import.meta.hot.data as {
    connected: boolean,
    device: DeviceInfo | null,
  };

  // 保存当前状态到 HMR 数据
  data.device = data?.device ?? {
    port: null,
  };

  // 从 HMR 数据恢复状态
  if (data.connected) {
    // 验证恢复的状态是否完整
    if (data.device && deviceManager.isDeviceConnected(data.device)) {
      connected.value = data.connected;
      deviceInfo = data.device;
      console.log('[DeviceConnect] HMR: 成功恢复设备连接状态');
    } else {
      // 状态信息不完整，重置为断开状态
      console.warn('[DeviceConnect] HMR: 检测到状态信息丢失，重置为断开状态');
      disposeConnection().catch(console.error);
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
    if (connected.value) {
      if (!deviceInfo || !deviceManager.isDeviceConnected(deviceInfo)) {
        console.warn('[DeviceConnect] HMR: 连接对象丢失，重置连接状态');
        disposeConnection().catch(console.error);
        return;
      }
    }
  });
}

// 组件挂载时验证连接状态
onMounted(async () => {
  // 如果显示已连接但实际连接对象为空，重置状态
  if (connected.value) {
    if (!deviceInfo || !deviceManager.isDeviceConnected(deviceInfo)) {
      console.warn('[DeviceConnect] 检测到状态不一致，重置连接状态');
      await disposeConnection();
    }
  }
});

async function connect() {
  if (isConnecting.value || connected.value) return;

  isConnecting.value = true;
  showToast(t('messages.device.tryingConnect'), 'idle');

  try {
    // 使用统一的设备连接管理器
    const filter = PortFilters.device('0483', '0721');

    const device = await deviceManager.requestDevice(filter);

    // 初始化设备状态
    await deviceManager.initializeDevice(device);

    connected.value = true;
    isConnecting.value = false;
    showToast(t('messages.device.connectionSuccess'), 'success');
    deviceInfo = device;
    emit('device-ready', deviceInfo);
  } catch (e) {
    // 检查是否需要用户选择串口
    if (e instanceof PortSelectionRequiredError) {
      availablePorts.value = e.availablePorts;
      showPortSelector.value = true;
      isConnecting.value = false;
      return;
    }

    showToast(t('messages.device.connectionFailed', { error: (e instanceof Error ? e.message : String(e)) }), 'error');
    await disposeConnection();
  }
}

// 处理串口选择
async function onPortSelected(selectedPort: SerialPortInfo) {
  showPortSelector.value = false;
  isConnecting.value = true;

  try {
    // 使用选定的串口连接
    const device = await deviceManager.connectWithSelectedPort(selectedPort);

    // 初始化设备状态
    await deviceManager.initializeDevice(device);

    connected.value = true;
    isConnecting.value = false;
    showToast(t('messages.device.connectionSuccess'), 'success');
    deviceInfo = device;
    emit('device-ready', deviceInfo);
  } catch (e) {
    showToast(t('messages.device.connectionFailed', { error: (e instanceof Error ? e.message : String(e)) }), 'error');
    await disposeConnection();
  }
}

// 处理串口选择取消
function onPortSelectionCanceled() {
  showPortSelector.value = false;
  isConnecting.value = false;
}

// 刷新串口列表
async function onRefreshPorts() {
  try {
    const filter = PortFilters.device('0483', '0721');

    // 重新获取串口列表
    const portResult = await serialService.listPorts(filter);

    if (Array.isArray(portResult)) {
      availablePorts.value = portResult;
    } else {
      // 如果只有一个端口，也放入列表中
      availablePorts.value = portResult ? [portResult] : [];
    }
  } catch (error) {
    console.error('Failed to refresh ports:', error);
    showToast('刷新串口列表失败', 'error');
  }
}

async function disconnect() {
  if (!deviceInfo) return;
  isConnecting.value = true;
  try {
    await deviceManager.disconnectDevice(deviceInfo);
    showToast(t('messages.device.disconnectionSuccess'), 'success');
  } catch (e) {
    console.error(t('messages.device.disconnectionFailed', { error: (e instanceof Error ? e.message : String(e)) }), e);
    showToast(t('messages.device.disconnectionFailed', { error: (e instanceof Error ? e.message : String(e)) }), 'error');
  } finally {
    isConnecting.value = false;
    connected.value = false;
    deviceInfo = null;
    emit('device-disconnected');
  }
}

async function initializeSerialState(device?: DeviceInfo | null, toast = false) {
  if (!device) {
    console.warn('[DeviceConnect] 初始化失败：设备未定义');
    return;
  }

  try {
    await deviceManager.initializeDevice(device);
    if (toast) {
      showToast(t('messages.device.initializationSuccess'), 'success');
    }
  } catch (error) {
    console.error('Failed to initialize device:', error);
    if (toast) {
      showToast(t('messages.device.initializationFailed', { error: error instanceof Error ? error.message : String(error) }), 'error');
    }
  }
}

async function disposeConnection() {
  connected.value = false;
  isConnecting.value = false;

  if (deviceInfo !== null) {
    // 安全地清理资源
    try {
      await deviceManager.disconnectDevice(deviceInfo);
    } catch (error) {
      console.warn('Error during device cleanup:', error);
    }
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

const connectionTooltip = computed(() => {
  const baseMessage = connected.value
    ? t('ui.device.connected')
    : t('ui.device.connect');

  const envMessage = isElectron()
    ? 'SerialPort'
    : 'Web Serial API';

  return `${baseMessage} - ${envMessage}`;
});

// 暴露方法给父组件
defineExpose({
  connect,
  disconnect,
  reset: disposeConnection,
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

.device-connect {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-3);
  width: 100%;
}
</style>
