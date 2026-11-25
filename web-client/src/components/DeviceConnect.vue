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
        data-testid="connect-device-btn"
        @click="handleConnectDisconnect"
        @contextmenu.prevent="openConnectContextMenu"
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
    <!-- 连接按钮右键菜单：手动选择其他串口 -->
    <Teleport to="body">
      <div
        v-if="contextMenu.visible"
        ref="contextMenuRef"
        class="connect-context-menu"
        role="menu"
        data-testid="connect-context-menu"
        :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
        @click.stop
      >
        <button
          type="button"
          class="connect-context-menu-item"
          role="menuitem"
          data-testid="select-other-port-item"
          @click="handleSelectOtherPortFromMenu"
        >
          {{ t('ui.device.selectOtherPort') }}
        </button>
      </div>
    </Teleport>
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
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
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
import { formatDeviceError, localizeConnectionLogEntries } from '@/utils/device-error';

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
const contextMenuRef = ref<HTMLElement | null>(null);
const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
});

function closeContextMenu() {
  contextMenu.visible = false;
}

function openConnectContextMenu(event: MouseEvent) {
  if (connected.value || isConnecting.value || connectionBusy.value) {
    return;
  }
  const margin = 8;
  const approxWidth = 180;
  const approxHeight = 44;
  const maxX = Math.max(margin, window.innerWidth - approxWidth - margin);
  const maxY = Math.max(margin, window.innerHeight - approxHeight - margin);
  contextMenu.x = Math.min(Math.max(event.clientX, margin), maxX);
  contextMenu.y = Math.min(Math.max(event.clientY, margin), maxY);
  contextMenu.visible = true;
}

function handleGlobalPointerDown(event: MouseEvent) {
  if (!contextMenu.visible) return;
  if (contextMenuRef.value?.contains(event.target as Node)) return;
  closeContextMenu();
}

function handleGlobalKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && contextMenu.visible) {
    closeContextMenu();
  }
}

async function handleSelectOtherPortFromMenu() {
  closeContextMenu();
  await connectWithAnyPort();
}

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
  window.addEventListener('mousedown', handleGlobalPointerDown);
  window.addEventListener('keydown', handleGlobalKeyDown);
  // 如果显示已连接但实际连接对象为空，重置状态
  if (connected.value) {
    if (!deviceInfo.value || !deviceManager.isDeviceConnected(deviceInfo.value)) {
      console.warn('[DeviceConnect] 检测到状态不一致，重置连接状态');
      await disposeConnection();
    }
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('mousedown', handleGlobalPointerDown);
  window.removeEventListener('keydown', handleGlobalKeyDown);
});

/** Maps any connection error onto the stage-aware report the log area renders. */
function toFailureReport(error: unknown): ConnectionFailureReport {
  const localizedMessage = formatDeviceError(error, t);
  const failure = (error as { failure?: ConnectionFailure } | null)?.failure;
  if (failure) {
    return {
      stage: failure.stage,
      message: localizedMessage,
      ...(failure.diagnostics ? { diagnostics: failure.diagnostics } : {}),
      ...(failure.context ? { context: failure.context } : {}),
    };
  }
  const stage = (error as { stage?: string } | null)?.stage ?? 'unknown';
  return {
    stage,
    message: localizedMessage,
  };
}

function reportConnection(device: DeviceInfo) {
  emit('connection-log', localizeConnectionLogEntries(buildConnectionLogReport({ device }), t));
}

function reportFailure(error: unknown) {
  emit('connection-log', localizeConnectionLogEntries(buildConnectionLogReport({ failure: toFailureReport(error) }), t));
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
    showToast(t('messages.device.connectionFailed', { error: formatDeviceError(e, t) }), 'error');
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
    showToast(t('messages.device.connectionFailed', { error: formatDeviceError(e, t) }), 'error');
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
    showToast(t('messages.device.refreshPortsFailed'), 'error');
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
    const errorMessage = formatDeviceError(e, t);
    console.error(t('messages.device.disconnectionFailed', { error: errorMessage }), e);
    showToast(t('messages.device.disconnectionFailed', { error: errorMessage }), 'error');
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
      showToast(t('messages.device.initializationFailed', { error: formatDeviceError(error, t) }), 'error');
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

<style scoped>
.connect-context-menu {
  position: fixed;
  z-index: 2000;
  min-width: 150px;
  padding: 4px;
  border: var(--retro-border-width) solid var(--retro-border);
  border-radius: 4px;
  background: var(--retro-bg-surface);
  box-shadow: var(--retro-shadow-btn);
}

.connect-context-menu-item {
  display: block;
  width: 100%;
  padding: 7px 12px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--retro-ink);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}

.connect-context-menu-item:hover {
  background: var(--retro-bg-tint);
}
</style>
