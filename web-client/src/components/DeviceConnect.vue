<template>
  <div
    class="device-connect-container"
    :class="{ 'compact': props.compact }"
  >
    <div
      class="device-connect"
      :class="{ 'compact': props.compact }"
    >
      <RetroButton
        :variant="connected ? 'secondary' : 'primary'"
        :disabled="isConnecting || (connected && connectionBusy)"
        :title="connectionTooltip"
        :icon="buttonIcon"
        :text="buttonText"
        @click="handleConnectDisconnect"
      />
      <!-- 手动选择其他串口：自动发现只接受 match，用户在无过滤器列表里显式选择才算数 -->
      <RetroButton
        v-if="!connected"
        variant="secondary"
        :disabled="isConnecting || connectionBusy"
        :text="t('ui.device.selectOtherPort')"
        @click="connectWithAnyPort"
      />
      <!-- 重置连接状态按钮，仅在已连接时显示 -->
      <RetroButton
        v-if="connected"
        variant="warning"
        :disabled="isConnecting || connectionBusy"
        :text="t('ui.device.resetConnection')"
        @click="() => initializeSerialState(deviceInfo, true)"
      />
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
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import PortSelectorModal from '@/components/modal/PortSelectorModal.vue';
import { RetroButton } from '@/components/retro';
import { useConnectionOperationBusy } from '@/composables/useConnectionOperationBusy';
import { useToast } from '@/composables/useToast';
import {
  buildConnectionLogReport,
  type ConnectionFailureReport,
  type ConnectionLogEntry,
} from '@/device-runtime/connection-report';
import type { ConnectionFailure } from '@/features/burner/application';
import { getRuntimeKind } from '@/platform/runtime';
import { DeviceConnectionManager, PortSelectionRequiredError } from '@/services/device-connection-manager';
import { DeviceInfo } from '@/types/device-info';
import type { SerialPortInfo } from '@/types/serial';

const props = withDefaults(defineProps<{
  compact?: boolean
}>(), {
  compact: false,
});

const { showToast } = useToast();
const { t } = useI18n();
const { connectionBusy } = useConnectionOperationBusy();
const emit = defineEmits<{
  'device-ready': [device: DeviceInfo]
  'device-disconnected': []
  /** Right-hand log entries: device/firmware, port match result and failure stage hints. */
  'connection-log': [entries: readonly ConnectionLogEntry[]]
}>();

const connected = ref(false);
const isConnecting = ref(false);
const isProcessing = ref(false);
const showPortSelector = ref(false);
const availablePorts = ref<SerialPortInfo[]>([]);

const deviceInfo = ref<DeviceInfo | null>(null);
const deviceManager = DeviceConnectionManager.getInstance();

// 热重载状态恢复 - 在开发模式下处理 HMR
if (import.meta.hot) {
  const data = ((import.meta.hot.data as {
    connected?: boolean,
    device?: DeviceInfo | null,
  } | undefined) ?? {});

  // 保存当前状态到 HMR 数据
  data.device ??= {
    port: null,
  };

  // 从 HMR 数据恢复状态
  if (data.connected) {
    // 验证恢复的状态是否完整
    if (data.device && deviceManager.isDeviceConnected(data.device)) {
      connected.value = data.connected;
      deviceInfo.value = data.device;
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
      data.device = deviceInfo.value;
      data.connected = connected.value;
    }
  });

  // 热重载后验证连接状态
  import.meta.hot.accept(() => {
    if (connected.value) {
      if (!deviceInfo.value || !deviceManager.isDeviceConnected(deviceInfo.value)) {
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
    if (!deviceInfo.value || !deviceManager.isDeviceConnected(deviceInfo.value)) {
      console.warn('[DeviceConnect] 检测到状态不一致，重置连接状态');
      await disposeConnection();
    }
  }
});

/** Maps any connection error onto the stage-aware report the log area renders. */
function toFailureReport(error: unknown): ConnectionFailureReport {
  const failure = (error as { failure?: ConnectionFailure } | null)?.failure;
  if (failure) {
    return {
      stage: failure.stage,
      message: failure.message,
      ...(failure.diagnostics ? { diagnostics: failure.diagnostics } : {}),
    };
  }
  const stage = (error as { stage?: string } | null)?.stage ?? 'unknown';
  return {
    stage,
    message: error instanceof Error ? error.message : String(error),
  };
}

function reportConnection(device: DeviceInfo) {
  emit('connection-log', buildConnectionLogReport({ device }));
}

function reportFailure(error: unknown) {
  emit('connection-log', buildConnectionLogReport({ failure: toFailureReport(error) }));
}

async function connect(options: { allowAnyPort?: boolean } = {}) {
  if (isProcessing.value || connected.value) return;

  isProcessing.value = true;
  isConnecting.value = true;
  showToast(t('messages.device.tryingConnect'), 'idle');

  try {
    // 连接配置由高级设置决定；串口发现只影响候选顺序与诊断
    const device = await deviceManager.requestDevice({
      ...(options.allowAnyPort ? { allowAnyPort: true } : {}),
    });

    connected.value = true;
    isConnecting.value = false;
    showToast(t('messages.device.connectionSuccess'), 'success');
    deviceInfo.value = device;
    reportConnection(device);
    emit('device-ready', deviceInfo.value);
  } catch (e) {
    // 检查是否需要用户选择串口
    if (e instanceof PortSelectionRequiredError) {
      console.warn('[DeviceConnect] port selection required', e.availablePorts);
      availablePorts.value = e.availablePorts;
      showPortSelector.value = true;
      return;
    }

    console.error('[DeviceConnect] connect failed', e);
    reportFailure(e);
    showToast(t('messages.device.connectionFailed', { error: (e instanceof Error ? e.message : String(e)) }), 'error');
    await disposeConnection();
  } finally {
    isConnecting.value = false;
    isProcessing.value = false;
  }
}

/** 手动入口：不过滤端口，用户显式选择 mismatch 端口后按已保存 variant 连接 */
async function connectWithAnyPort() {
  await connect({ allowAnyPort: true });
}

// 处理串口选择
async function onPortSelected(selectedPort: SerialPortInfo) {
  if (isProcessing.value) return;

  showPortSelector.value = false;
  isProcessing.value = true;
  isConnecting.value = true;

  try {
    // 使用选定的串口连接
    const device = await deviceManager.connectWithSelectedPort(selectedPort);

    connected.value = true;
    isConnecting.value = false;
    showToast(t('messages.device.connectionSuccess'), 'success');
    deviceInfo.value = device;
    reportConnection(device);
    emit('device-ready', deviceInfo.value);
  } catch (e) {
    console.error('[DeviceConnect] connect with selected port failed', {
      selectedPort,
      error: e,
    });
    reportFailure(e);
    showToast(t('messages.device.connectionFailed', { error: (e instanceof Error ? e.message : String(e)) }), 'error');
    await disposeConnection();
  } finally {
    isConnecting.value = false;
    isProcessing.value = false;
  }
}

// 处理串口选择取消
function onPortSelectionCanceled() {
  showPortSelector.value = false;
  isConnecting.value = false;
}

// 刷新串口列表：优先保留与已保存 variant 匹配的端口，无匹配时才给完整列表
async function onRefreshPorts() {
  try {
    const all = await deviceManager.listAvailablePorts();
    const matching = await deviceManager.listPortsMatchingSelection();
    availablePorts.value = matching.length > 0 ? matching : all;
  } catch (error) {
    console.error('Failed to refresh ports:', error);
    showToast('刷新串口列表失败', 'error');
  }
}

async function disconnect() {
  if (isProcessing.value || !deviceInfo.value) return;
  isProcessing.value = true;
  isConnecting.value = true;
  let rejectedAsBusy = false;
  try {
    await deviceManager.disconnectDevice(deviceInfo.value);
    showToast(t('messages.device.disconnectionSuccess'), 'success');
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code?: unknown }).code === 'busy') {
      rejectedAsBusy = true;
      showToast(t('ui.operation.busy'), 'error');
      return;
    }
    console.error(t('messages.device.disconnectionFailed', { error: (e instanceof Error ? e.message : String(e)) }), e);
    showToast(t('messages.device.disconnectionFailed', { error: (e instanceof Error ? e.message : String(e)) }), 'error');
  } finally {
    isProcessing.value = false;
    isConnecting.value = false;
    if (!rejectedAsBusy) {
      connected.value = false;
      deviceInfo.value = null;
      emit('device-disconnected');
    }
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
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'busy') {
      if (toast) {
        showToast(t('ui.operation.busy'), 'error');
      }
      return;
    }
    console.error('Failed to initialize device:', error);
    if (toast) {
      showToast(t('messages.device.initializationFailed', { error: error instanceof Error ? error.message : String(error) }), 'error');
    }
  }
}

async function disposeConnection() {
  connected.value = false;
  isConnecting.value = false;
  isProcessing.value = false;

  if (deviceInfo.value !== null) {
    // 安全地清理资源
    try {
      await deviceManager.disconnectDevice(deviceInfo.value);
    } catch (error) {
      console.warn('Error during device cleanup:', error);
    }
    deviceInfo.value = null;
  }

  emit('device-disconnected');
}

async function handleConnectDisconnect() {
  if (isProcessing.value) {
    return;
  }
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
  if (isConnecting.value && !connected.value) return 'pixelarticons:reload';
  if (connected.value) return 'pixelarticons:check-double';
  return 'pixelarticons:zap';
});

const connectionTooltip = computed(() => {
  const baseMessage = connected.value
    ? t('ui.device.connected')
    : t('ui.device.connect');

  const envMessage = getRuntimeKind() === 'tauri' ? 'Tauri Serial' : 'Web Serial API';

  return `${baseMessage} - ${envMessage}`;
});

// 暴露方法给父组件
defineExpose({
  connect,
  connectWithAnyPort,
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

.device-connect-container.compact {
  width: auto;
  position: static;
  flex-shrink: 0;
}

.device-connect.compact {
  gap: var(--space-2);
  margin-bottom: 0;
  width: auto;
  justify-content: flex-start;
}
</style>
