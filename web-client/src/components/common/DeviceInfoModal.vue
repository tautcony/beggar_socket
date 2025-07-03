<template>
  <BaseModal
    :visible="isVisible"
    title="设备信息"
    @close="$emit('close')"
  >
    <div class="device-info-content">
      <!-- 设备连接状态 -->
      <div class="connection-status">
        <div class="status-item">
          <span class="status-label">连接状态:</span>
          <span
            class="status-value"
            :class="connectionStatusClass"
          >
            {{ connectionStatusText }}
          </span>
        </div>

        <button
          v-if="!isConnected"
          class="connect-btn"
          :disabled="isConnecting"
          @click="connectDevice"
        >
          <IonIcon :icon="linkOutline" />
          {{ isConnecting ? '连接中...' : '连接设备' }}
        </button>

        <button
          v-else
          class="disconnect-btn"
          @click="disconnectDevice"
        >
          <IonIcon :icon="unlinkOutline" />
          断开连接
        </button>
      </div>

      <!-- 设备版本信息 -->
      <div
        v-if="isConnected"
        class="version-info"
      >
        <div class="section-header">
          <h4>版本信息</h4>
          <button
            class="refresh-btn"
            :disabled="isLoadingVersion"
            @click="refreshVersionInfo"
          >
            <IonIcon :icon="refreshOutline" />
            {{ isLoadingVersion ? '刷新中...' : '刷新' }}
          </button>
        </div>

        <div
          v-if="versionInfo"
          class="version-details"
        >
          <div class="version-item">
            <span class="version-label">设备类型:</span>
            <span class="version-value">
              {{ versionInfo.versionType === 0 ? 'Bootloader' : 'Application' }}
            </span>
          </div>

          <div class="version-item">
            <span class="version-label">版本号:</span>
            <span class="version-value">
              {{ versionInfo.majorVersion }}.{{ versionInfo.minorVersion }}.{{ versionInfo.patchVersion }}.{{ versionInfo.buildNumber }}
            </span>
          </div>

          <div class="version-item">
            <span class="version-label">构建时间:</span>
            <span class="version-value">{{ formatTimestamp(versionInfo.timestamp) }}</span>
          </div>

          <div
            v-if="versionInfo.versionString"
            class="version-item"
          >
            <span class="version-label">版本描述:</span>
            <span class="version-value">{{ versionInfo.versionString }}</span>
          </div>
        </div>

        <div
          v-else-if="isLoadingVersion"
          class="loading-state"
        >
          <IonIcon :icon="hourglassOutline" />
          <span>正在获取版本信息...</span>
        </div>

        <div
          v-else
          class="error-state"
        >
          <IonIcon :icon="warningOutline" />
          <span>无法获取版本信息</span>
        </div>
      </div>

      <!-- 固件升级 -->
      <div
        v-if="isConnected && versionInfo"
        class="firmware-upgrade"
      >
        <div class="section-header">
          <h4>固件升级</h4>
        </div>

        <div class="upgrade-controls">
          <div class="file-input-group">
            <input
              ref="firmwareFileInput"
              type="file"
              accept=".bin,.hex"
              @change="onFirmwareFileSelected"
            >
            <button
              class="file-select-btn"
              @click="selectFirmwareFile"
            >
              <IonIcon :icon="documentOutline" />
              选择固件文件
            </button>
          </div>

          <div
            v-if="selectedFirmwareFile"
            class="selected-file"
          >
            <span class="file-name">{{ selectedFirmwareFile.name }}</span>
            <span class="file-size">({{ formatFileSize(selectedFirmwareFile.size) }})</span>
          </div>

          <div class="upgrade-actions">
            <button
              v-if="versionInfo.versionType === 1"
              class="bootloader-btn"
              :disabled="isUpgrading"
              @click="restartToBootloader"
            >
              <IonIcon :icon="refreshCircleOutline" />
              重启到Bootloader
            </button>

            <button
              v-if="versionInfo.versionType === 0"
              class="app-btn"
              :disabled="isUpgrading"
              @click="jumpToApplication"
            >
              <IonIcon :icon="playForwardOutline" />
              跳转到应用程序
            </button>

            <button
              class="upgrade-btn"
              :disabled="!canStartUpgrade"
              @click="startFirmwareUpgrade"
            >
              <IonIcon :icon="cloudUploadOutline" />
              {{ isUpgrading ? '升级中...' : '开始升级' }}
            </button>
          </div>
        </div>

        <!-- 升级进度 -->
        <div
          v-if="upgradeProgress.status !== 'idle'"
          class="upgrade-progress"
        >
          <div class="progress-header">
            <span class="progress-status">{{ upgradeProgress.message }}</span>
            <span class="progress-percent">{{ upgradeProgress.progress }}%</span>
          </div>

          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: upgradeProgress.progress + '%' }"
              :class="{ error: upgradeProgress.status === 'error' }"
            />
          </div>

          <div
            v-if="upgradeProgress.error"
            class="progress-error"
          >
            <IonIcon :icon="alertCircleOutline" />
            <span>{{ upgradeProgress.error }}</span>
          </div>
        </div>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import {
  alertCircleOutline,
  cloudUploadOutline,
  documentOutline,
  hourglassOutline,
  linkOutline,
  playForwardOutline,
  refreshCircleOutline,
  refreshOutline,
  unlinkOutline,
  warningOutline,
} from 'ionicons/icons';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseModal from '@/components/common/BaseModal.vue';
import { useToast } from '@/composables/useToast';
import { bootloader_finish_upgrade, bootloader_get_version_info, bootloader_jump_to_app, bootloader_start_upgrade, bootloader_upgrade_data, iap_get_version_info, iap_restart_to_bootloader } from '@/protocol/beggar_socket/protocol';
import type { DeviceInfo } from '@/types/device-info';
import { DeviceVersionInfo, FirmwareUpgradeProgress, FirmwareUpgradeStatus } from '@/types/device-version';
import { calculateSTM32CRC32 } from '@/utils/crc32-utils';

const { showToast } = useToast();

const props = defineProps<{
  isVisible: boolean;
  device?: DeviceInfo;
}>();

const emit = defineEmits<{
  close: [];
  deviceConnected: [device: DeviceInfo];
  deviceDisconnected: [];
}>();

// 连接状态
const isConnected = ref(false);
const isConnecting = ref(false);
const currentDevice = ref<DeviceInfo | undefined>();

// 版本信息
const versionInfo = ref<DeviceVersionInfo | undefined>();
const isLoadingVersion = ref(false);

// 固件升级
const selectedFirmwareFile = ref<File | undefined>();
const firmwareFileInput = ref<HTMLInputElement>();
const isUpgrading = ref(false);
const upgradeProgress = ref<FirmwareUpgradeProgress>({
  status: 'idle' as FirmwareUpgradeStatus,
  progress: 0,
  message: '',
});

// 计算属性
const connectionStatusClass = computed(() => ({
  connected: isConnected.value,
  disconnected: !isConnected.value,
  connecting: isConnecting.value,
}));

const connectionStatusText = computed(() => {
  if (isConnecting.value) return '连接中...';
  return isConnected.value ? '已连接' : '未连接';
});

const canStartUpgrade = computed(() => {
  return selectedFirmwareFile.value &&
         isConnected.value &&
         versionInfo.value &&
         !isUpgrading.value;
});

// 监听设备prop变化
watch(() => props.device, async (newDevice) => {
  if (newDevice) {
    currentDevice.value = newDevice;
    isConnected.value = true;
    await refreshVersionInfo();
  } else {
    currentDevice.value = undefined;
    isConnected.value = false;
    versionInfo.value = undefined;
  }
}, { immediate: true });

// 设备连接
async function connectDevice() {
  isConnecting.value = true;

  try {
    // 请求串口连接
    if (!('serial' in navigator)) {
      throw new Error('您的浏览器不支持Web Serial API');
    }

    const port = await navigator.serial.requestPort({
      filters: [
        { usbVendorId: 0x0483, usbProductId: 0x0721 },
      ],
    });

    await port.open({
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      flowControl: 'none',
    });

    const reader = port.readable?.getReader({ mode: 'byob' });
    const writer = port.writable?.getWriter();

    if (!reader || !writer) {
      throw new Error('无法获取读写器');
    }

    const device: DeviceInfo = {
      port,
      reader,
      writer,
    };

    currentDevice.value = device;
    isConnected.value = true;
    emit('deviceConnected', device);

    await refreshVersionInfo();
    showToast('设备连接成功', 'success');
  } catch (error) {
    console.error('连接设备失败:', error);
    showToast(`连接失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
  } finally {
    isConnecting.value = false;
  }
}

// 断开设备连接
async function disconnectDevice() {
  if (currentDevice.value) {
    try {
      await currentDevice.value.reader?.cancel();
      await currentDevice.value.writer?.close();
      await currentDevice.value.port.close();
    } catch (error) {
      console.error('断开连接时出错:', error);
    }

    currentDevice.value = undefined;
    isConnected.value = false;
    versionInfo.value = undefined;
    emit('deviceDisconnected');
    showToast('设备已断开连接', 'info');
  }
}

// 刷新版本信息
async function refreshVersionInfo() {
  if (!currentDevice.value) return;

  isLoadingVersion.value = true;
  versionInfo.value = undefined;

  try {
    versionInfo.value = await iap_get_version_info(currentDevice.value);

    showToast('版本信息已更新', 'success');
  } catch (error) {
    console.error('获取版本信息失败:', error);
    showToast(`获取版本信息失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
  } finally {
    isLoadingVersion.value = false;
  }
}

// 重启到Bootloader
async function restartToBootloader() {
  if (!currentDevice.value || !versionInfo.value) return;

  try {
    const success = await iap_restart_to_bootloader(currentDevice.value);
    if (success) {
      showToast('设备正在重启到Bootloader模式...', 'info');
      // 等待一段时间后刷新版本信息
      // await new Promise(resolve => setTimeout(resolve, 2000));
      // await refreshVersionInfo();
    } else {
      throw new Error('重启命令失败');
    }
  } catch (error) {
    console.error('重启到Bootloader失败:', error);
    showToast(`重启失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
  }
}

// 跳转到应用程序
async function jumpToApplication() {
  if (!currentDevice.value || !versionInfo.value) return;

  try {
    const success = await bootloader_jump_to_app(currentDevice.value);
    if (success) {
      showToast('设备正在跳转到应用程序...', 'info');
      // 等待一段时间后刷新版本信息
      // await new Promise(resolve => setTimeout(resolve, 2000));
      // await refreshVersionInfo();
    } else {
      throw new Error('跳转命令失败');
    }
  } catch (error) {
    console.error('跳转到应用程序失败:', error);
    showToast(`跳转失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
  }
}

// 选择固件文件
function selectFirmwareFile() {
  firmwareFileInput.value?.click();
}

function onFirmwareFileSelected(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    selectedFirmwareFile.value = file;
    showToast(`已选择固件文件: ${file.name}`, 'info');
  }
}

// 开始固件升级
async function startFirmwareUpgrade() {
  if (!canStartUpgrade.value || !selectedFirmwareFile.value || !currentDevice.value || !versionInfo.value) {
    return;
  }

  isUpgrading.value = true;
  upgradeProgress.value = {
    status: FirmwareUpgradeStatus.PREPARING,
    progress: 0,
    message: '正在准备升级...',
  };

  try {
    const file = selectedFirmwareFile.value;
    const device = currentDevice.value;

    // 1. 读取固件文件
    upgradeProgress.value.message = '正在读取固件文件...';
    upgradeProgress.value.progress = 5;

    const arrayBuffer = await file.arrayBuffer();
    const firmwareData = new Uint8Array(arrayBuffer);

    if (firmwareData.length === 0) {
      throw new Error('固件文件为空');
    }

    // 2. 计算固件CRC32
    upgradeProgress.value.message = '正在计算固件校验值...';
    upgradeProgress.value.progress = 10;

    const firmwareCrc = calculateSTM32CRC32(firmwareData);
    console.log(`固件大小: ${firmwareData.length} 字节, CRC32: 0x${firmwareCrc.toString(16).toUpperCase()}`);

    // 3. 如果是Application模式，先重启到Bootloader
    if (versionInfo.value.versionType === 1) {
      upgradeProgress.value.message = '正在重启到Bootloader模式...';
      upgradeProgress.value.progress = 15;

      const restartSuccess = await iap_restart_to_bootloader(device);
      if (!restartSuccess) {
        throw new Error('重启到Bootloader失败');
      }

      // 等待设备重启
      upgradeProgress.value.message = '等待设备重启...';
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 刷新版本信息以确认处于Bootloader模式
      try {
        versionInfo.value = await bootloader_get_version_info(device);
        if (versionInfo.value.versionType !== 0) {
          throw new Error('设备未进入Bootloader模式');
        }
      } catch (error) {
        throw new Error('无法连接到Bootloader模式');
      }
    }

    // 4. 发送升级开始命令
    upgradeProgress.value.message = '正在启动升级流程...';
    upgradeProgress.value.progress = 20;

    const startSuccess = await bootloader_start_upgrade(device, firmwareData.length, firmwareCrc);
    if (!startSuccess) {
      throw new Error('启动升级流程失败');
    }

    // 5. 分包发送固件数据
    const PACKET_SIZE = 512; // 每包512字节，与MCU端BATCH_SIZE_RW保持一致
    const totalPackets = Math.ceil(firmwareData.length / PACKET_SIZE);

    for (let packetNum = 0; packetNum < totalPackets; packetNum++) {
      const startOffset = packetNum * PACKET_SIZE;
      const endOffset = Math.min(startOffset + PACKET_SIZE, firmwareData.length);
      const packetData = firmwareData.slice(startOffset, endOffset);

      upgradeProgress.value.message = `正在传输固件数据... (${packetNum + 1}/${totalPackets})`;
      upgradeProgress.value.progress = 20 + Math.floor((packetNum / totalPackets) * 70);

      const dataSuccess = await bootloader_upgrade_data(device, packetNum, packetData);
      if (!dataSuccess) {
        throw new Error(`传输数据包 ${packetNum} 失败`);
      }

      console.log(`已传输包 ${packetNum + 1}/${totalPackets}, 字节: ${startOffset}-${endOffset - 1}`);
    }

    // 6. 发送升级完成命令
    upgradeProgress.value.message = '正在完成升级...';
    upgradeProgress.value.progress = 95;

    const finishSuccess = await bootloader_finish_upgrade(device);
    if (!finishSuccess) {
      throw new Error('完成升级失败');
    }

    // 7. 升级成功
    upgradeProgress.value = {
      status: FirmwareUpgradeStatus.SUCCESS,
      progress: 100,
      message: '固件升级完成！',
    };

    showToast('固件升级成功！', 'success');

    // 等待一下后刷新版本信息
    setTimeout(() => {
      refreshVersionInfo().catch((error: unknown) => {
        console.error('刷新版本信息失败:', error);
      });
    }, 2000);

  } catch (error) {
    console.error('固件升级失败:', error);
    upgradeProgress.value = {
      status: FirmwareUpgradeStatus.ERROR,
      progress: 0,
      message: '升级失败',
      error: error instanceof Error ? error.message : '未知错误',
    };
    showToast(`固件升级失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
  } finally {
    isUpgrading.value = false;
  }
}

// 格式化时间戳
function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('zh-CN');
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}
</script>

<style scoped>
.device-info-content {
  padding: 20px;
  max-width: 600px;
}

.connection-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 20px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-label {
  font-weight: 500;
  color: #495057;
}

.status-value {
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.9rem;
}

.status-value.connected {
  color: #28a745;
  background: #d4edda;
}

.status-value.disconnected {
  color: #dc3545;
  background: #f8d7da;
}

.status-value.connecting {
  color: #ffc107;
  background: #fff3cd;
}

.connect-btn,
.disconnect-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.connect-btn {
  background: #007bff;
  color: white;
}

.connect-btn:hover:not(:disabled) {
  background: #0056b3;
}

.connect-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.disconnect-btn {
  background: #dc3545;
  color: white;
}

.disconnect-btn:hover {
  background: #c82333;
}

.version-info,
.firmware-upgrade {
  margin-bottom: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-header h4 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.1rem;
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

.refresh-btn:hover:not(:disabled) {
  background: #5a6268;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.version-details {
  background: white;
  border: 1px solid #e1e8ed;
  border-radius: 8px;
  padding: 16px;
}

.version-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f1f3f4;
}

.version-item:last-child {
  border-bottom: none;
}

.version-label {
  font-weight: 500;
  color: #495057;
}

.version-value {
  color: #2c3e50;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 0.9rem;
}

.loading-state,
.error-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px;
  color: #6c757d;
  font-style: italic;
}

.error-state {
  color: #dc3545;
}

.upgrade-controls {
  background: white;
  border: 1px solid #e1e8ed;
  border-radius: 8px;
  padding: 16px;
}

.file-input-group {
  margin-bottom: 12px;
}

.file-input-group input[type="file"] {
  display: none;
}

.file-select-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s ease;
}

.file-select-btn:hover {
  background: #5a6268;
}

.selected-file {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #e7f3ff;
  border: 1px solid #b3d7ff;
  border-radius: 6px;
  margin-bottom: 12px;
  font-size: 0.9rem;
}

.file-name {
  font-weight: 500;
  color: #0066cc;
}

.file-size {
  color: #666;
  font-size: 0.8rem;
}

.upgrade-actions {
  display: flex;
  gap: 12px;
}

.bootloader-btn,
.app-btn,
.upgrade-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.bootloader-btn {
  background: #ffc107;
  color: #212529;
}

.bootloader-btn:hover:not(:disabled) {
  background: #e0a800;
}

.app-btn {
  background: #17a2b8;
  color: white;
}

.app-btn:hover:not(:disabled) {
  background: #138496;
}

.upgrade-btn {
  background: #28a745;
  color: white;
}

.upgrade-btn:hover:not(:disabled) {
  background: #218838;
}

.bootloader-btn:disabled,
.app-btn:disabled,
.upgrade-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.upgrade-progress {
  margin-top: 16px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.progress-status {
  font-weight: 500;
  color: #495057;
}

.progress-percent {
  font-weight: 600;
  color: #007bff;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #007bff;
  transition: width 0.3s ease;
}

.progress-fill.error {
  background: #dc3545;
}

.progress-error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  color: #dc3545;
  font-size: 0.9rem;
}
</style>
