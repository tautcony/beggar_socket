<template>
  <div class="flashburner-container">
    <ProgressDisplay
      v-if="operateProgress !== null && operateProgress !== undefined"
      key="progress"
      :progress="operateProgress"
      :detail="operateProgressDetail"
      :total-bytes="operateTotalBytes"
      :transferred-bytes="operateTransferredBytes"
      :start-time="operateStartTime"
      :current-speed="operateCurrentSpeed"
      :allow-cancel="operateAllowCancel"
      :state="operateState"
      @stop="handleProgressStop"
      @close="resetProgress"
    />
    <div class="mode-tabs-card">
      <button
        :class="{ active: mode === 'GBA' }"
        @click="mode = 'GBA'"
      >
        <IonIcon
          class="tab-icon"
          size="medium"
          :icon="gameControllerOutline"
        />
        {{ $t('ui.mode.gba') }}
      </button>
      <button
        :class="{ active: mode === 'MBC5' }"
        @click="mode = 'MBC5'"
      >
        <IonIcon
          class="tab-icon"
          size="medium"
          :icon="hardwareChipOutline"
        />
        {{ $t('ui.mode.mbc5') }}
      </button>
    </div>
    <div class="main-layout">
      <div class="content-area">
        <TransitionGroup
          name="panel-move"
          tag="div"
          class="operations-container"
        >
          <ChipOperations
            key="chip-operations"
            :device-ready="deviceReady"
            :busy="busy"
            :id-str="idStr ?? undefined"
            :device-size="deviceSize ?? undefined"
            :sector-count="sectorCount ?? undefined"
            :sector-size="sectorSize ?? undefined"
            :buffer-write-bytes="bufferWriteBytes ?? undefined"
            @read-id="readID"
            @erase-chip="eraseChip"
          />

          <RomOperations
            key="rom-operations"
            :mode="mode"
            :device-ready="deviceReady"
            :busy="busy"
            :rom-file-data="romFileData || undefined"
            :rom-file-name="romFileName"
            :selected-rom-size="selectedRomSize"
            @file-selected="onRomFileSelected"
            @file-cleared="onRomFileCleared"
            @write-rom="writeRom"
            @read-rom="readRom"
            @verify-rom="verifyRom"
            @rom-size-change="onRomSizeChange"
            @mode-switch-required="onModeSwitchRequired"
          />

          <RamOperations
            key="ram-operations"
            :mode="mode"
            :device-ready="deviceReady"
            :busy="busy"
            :ram-file-data="ramFileData || undefined"
            :ram-file-name="ramFileName"
            :selected-ram-size="selectedRamSize"
            :selected-ram-type="selectedRamType"
            @file-selected="onRamFileSelected"
            @file-cleared="onRamFileCleared"
            @write-ram="writeRam"
            @read-ram="readRam"
            @verify-ram="verifyRam"
            @ram-size-change="onRamSizeChange"
            @ram-type-change="onRamTypeChange"
          />
        </TransitionGroup>
      </div>

      <LogViewer
        :logs="logs"
        :title="t('ui.log.title')"
        @clear-logs="clearLog"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { gameControllerOutline, hardwareChipOutline } from 'ionicons/icons';
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import LogViewer from '@/components/LogViewer.vue';
import { ChipOperations, RamOperations, RomOperations } from '@/components/operaiton';
import ProgressDisplay from '@/components/ProgressDisplay.vue';
import { useToast } from '@/composables/useToast';
import { CartridgeAdapter, GBAAdapter, MBC5Adapter, MockAdapter } from '@/services';
import { DebugSettings } from '@/settings/debug-settings';
import { DeviceInfo, FileInfo, ProgressInfo } from '@/types';
import { formatBytes } from '@/utils/formatter-utils';

const { showToast } = useToast();
const { t } = useI18n();

const props = defineProps<{
  device: DeviceInfo | null,
  deviceReady: boolean
}>();

const mode = ref<'GBA' | 'MBC5'>('GBA');
const busy = ref(false);
const logs = ref<string[]>([]);

// progress props
const operateProgress = ref<number | null | undefined>(null);
const operateProgressDetail = ref<string | undefined>('');
const operateTotalBytes = ref<number | undefined>(undefined);
const operateTransferredBytes = ref<number | undefined>(undefined);
const operateStartTime = ref<number | undefined>(undefined);
const operateCurrentSpeed = ref<number | undefined>(undefined);
const operateAllowCancel = ref<boolean>(true);
const operateState = ref<'idle' | 'running' | 'paused' | 'completed' | 'error'>('idle');

// chip props
const idStr = ref<string | null>(null);
const deviceSize = ref<number | null>(null);
const sectorCount = ref<number | null>(null);
const sectorSize = ref<number | null>(null);
const bufferWriteBytes = ref<number | null>(null);

const currentAbortController = ref<AbortController | null>(null);

// Adapter
const gbaAdapter = ref<CartridgeAdapter | null>();
const mbc5Adapter = ref<CartridgeAdapter | null>();

// ROM
const romFileData = ref<Uint8Array | null>(null);
const romFileName = ref('');
const selectedRomSize = ref('0x800000'); // 默认8MB

// RAM
const ramFileData = ref<Uint8Array | null>(null);
const ramFileName = ref('');
const selectedRamSize = ref('0x8000'); // 默认32KB
const selectedRamType = ref('SRAM'); // 默认SRAM

// 设备连接状态改变时，初始化适配器
watch(() => props.deviceReady, (newVal) => {
  if (newVal && props.device) {
    if (DebugSettings.debugMode) {
      // 调试模式下使用 MockAdapter
      const adapter = new MockAdapter(
        (msg) => log(msg),
        updateProgress,
        t,
      );
      gbaAdapter.value = adapter;
      mbc5Adapter.value = adapter;
    } else {
      // 正常模式下使用真实适配器
      gbaAdapter.value = new GBAAdapter(
        props.device,
        (msg) => log(msg),
        updateProgress,
        t,
      );
      mbc5Adapter.value = new MBC5Adapter(
        props.device,
        (msg) => log(msg),
        updateProgress,
        t,
      );
    }
  } else {
    gbaAdapter.value = null;
    mbc5Adapter.value = null;
  }
});

function updateProgress(progressInfo: ProgressInfo) {
  if (progressInfo.progress !== undefined) {
    operateProgress.value = progressInfo.progress;
  }
  if (progressInfo.detail !== undefined) {
    operateProgressDetail.value = progressInfo.detail;
  }
  if (progressInfo.totalBytes !== undefined) {
    operateTotalBytes.value = progressInfo.totalBytes;
  }
  if (progressInfo.transferredBytes !== undefined) {
    operateTransferredBytes.value = progressInfo.transferredBytes;
  }
  if (progressInfo.startTime !== undefined) {
    operateStartTime.value = progressInfo.startTime;
  }
  if (progressInfo.currentSpeed !== undefined) {
    operateCurrentSpeed.value = progressInfo.currentSpeed;
  }
  if (progressInfo.allowCancel !== undefined) {
    operateAllowCancel.value = progressInfo.allowCancel ?? true;
  }
  if (progressInfo.state !== undefined) {
    operateState.value = progressInfo.state;
  }
}

function handleProgressStop() {
  // 中止当前操作
  if (currentAbortController.value) {
    currentAbortController.value.abort();
    log(t('messages.operation.cancelled'));
  }
}

function resetProgress() {
  operateProgress.value = null;
  operateProgressDetail.value = undefined;
  operateTotalBytes.value = undefined;
  operateTransferredBytes.value = undefined;
  operateStartTime.value = undefined;
  operateCurrentSpeed.value = undefined;
  operateAllowCancel.value = true;

  // 清理取消控制器
  if (currentAbortController.value) {
    currentAbortController.value = null;
  }
}

// 创建一个新的可取消操作
function startCancellableOperation(): AbortSignal {
  // 清理之前的控制器
  if (currentAbortController.value) {
    currentAbortController.value.abort();
  }

  // 创建新的控制器
  currentAbortController.value = new AbortController();
  return currentAbortController.value.signal;
}

// 完成操作时清理控制器
function finishOperation() {
  if (currentAbortController.value) {
    currentAbortController.value = null;
  }
}

function log(msg: string) {
  const time = new Date().toLocaleTimeString();
  logs.value.push(`[${time}] ${msg}`);
  if (logs.value.length > 500) logs.value.shift();
}

function clearLog() {
  logs.value = [];
}

// 文件处理函数
function onRomFileSelected(fileInfo: FileInfo) {
  romFileName.value = fileInfo.name;
  romFileData.value = fileInfo.data;
  log(t('messages.file.selectRom', { name: fileInfo.name, size: formatBytes(fileInfo.size) }));
}

function onRomFileCleared() {
  romFileData.value = null;
  romFileName.value = '';
  log(t('messages.file.clearRom'));
}

function onRamFileSelected(fileInfo: FileInfo) {
  ramFileName.value = fileInfo.name;
  ramFileData.value = fileInfo.data;
  log(t('messages.file.selectRam', { name: fileInfo.name, size: formatBytes(fileInfo.size) }));
}

function onRamFileCleared() {
  ramFileData.value = null;
  ramFileName.value = '';
  log(t('messages.file.clearRam'));
}

// 大小选择处理函数
function onRomSizeChange(hexSize: string) {
  selectedRomSize.value = hexSize;
  log(t('messages.rom.sizeChanged', { size: formatBytes(parseInt(hexSize, 16)) }));
}

function onRamSizeChange(hexSize: string) {
  selectedRamSize.value = hexSize;
  log(t('messages.ram.sizeChanged', { size: formatBytes(parseInt(hexSize, 16)) }));
}

function onRamTypeChange(type: string) {
  selectedRamType.value = type;
  log(t('messages.ram.typeChanged', { type }));
}

// 处理自动模式切换请求
function onModeSwitchRequired(targetMode: string, romType: string) {
  const currentMode = mode.value;
  if (targetMode !== currentMode) {
    mode.value = targetMode as 'GBA' | 'MBC5';
    log(t('messages.mode.autoSwitched', { from: currentMode, to: targetMode, romType }));
  }
}

function getAdapter() {
  if (mode.value === 'GBA') {
    return gbaAdapter.value;
  } else if (mode.value === 'MBC5') {
    return mbc5Adapter.value;
  }
  showToast(t('messages.operation.unsupportedMode'), 'error');
  return null;
}

async function readID() {
  busy.value = true;

  try {
    const adapter = getAdapter();
    if (!adapter) {
      return;
    }

    const response = await adapter.readID();
    if (response.success) {
      idStr.value = response.idStr || '';
      showToast(response.message, 'success');
      try {
        const sizeInfo = await adapter.getROMSize();
        deviceSize.value = sizeInfo.deviceSize;
        sectorCount.value = sizeInfo.sectorCount;
        sectorSize.value = sizeInfo.sectorSize;
        bufferWriteBytes.value = sizeInfo.bufferWriteBytes;
      } catch (e) {
        deviceSize.value = sectorCount.value = sectorSize.value = bufferWriteBytes.value = null;
      }
    } else {
      showToast(response.message, 'error');
      deviceSize.value = sectorCount.value = sectorSize.value = bufferWriteBytes.value = null;
    }
  } catch (e) {
    showToast(t('messages.operation.readIdFailed'), 'error');
    log(`${t('messages.operation.readIdFailed')}: ${e instanceof Error ? e.message : String(e)}`);
    deviceSize.value = sectorCount.value = sectorSize.value = bufferWriteBytes.value = null;
  } finally {
    busy.value = false;
  }
}

async function eraseChip() {
  busy.value = true;
  operateProgress.value = 0;
  const abortSignal = startCancellableOperation();

  try {
    const adapter = getAdapter();
    if (!adapter) {
      return;
    }

    const response = await adapter.eraseChip(abortSignal);
    showToast(response.message, response.success ? 'success' : 'error');
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      // 操作被取消，不显示错误消息，因为这是用户主动取消的
      return;
    }
    showToast(t('messages.operation.eraseFailed'), 'error');
    log(`${t('messages.operation.eraseFailed')}: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    busy.value = false;
    finishOperation();
    // setTimeout(() => { operateProgress.value = null; operateProgressDetail.value = '' }, 1500)
  }
}

async function writeRom() {
  busy.value = true;
  operateProgress.value = 0;
  operateProgressDetail.value = '';
  const abortSignal = startCancellableOperation();

  try {
    const adapter = getAdapter();
    if (!adapter || !romFileData.value) {
      showToast(t('messages.operation.unsupportedMode'), 'error');
      return;
    }

    const response = await adapter.writeROM(romFileData.value, { baseAddress: 0 }, abortSignal);
    showToast(response.message, response.success ? 'success' : 'error');
  } catch (e) {
    showToast(t('messages.rom.writeFailed'), 'error');
    log(`${t('messages.rom.writeFailed')}: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    busy.value = false;
    // setTimeout(() => { operateProgress.value = null; operateProgressDetail.value = '' }, 1500)
  }
}

async function readRom() {
  busy.value = true;
  operateProgress.value = 0;
  const abortSignal = startCancellableOperation();

  try {
    const adapter = getAdapter();
    if (!adapter) {
      return;
    }

    const romSize = parseInt(selectedRomSize.value, 16);
    const response = await adapter.readROM(romSize, 0, abortSignal);
    if (response.success) {
      showToast(response.message, 'success');
      if (response.data) {
        saveAsFile(response.data, 'exported.rom');
      }
    } else {
      showToast(response.message, 'error');
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      // 操作被取消，不显示错误消息，因为这是用户主动取消的
      return;
    }
    showToast(t('messages.rom.readFailed'), 'error');
    log(`${t('messages.rom.readFailed')}: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    busy.value = false;
    finishOperation();
    // setTimeout(() => { operateProgress.value = null; operateProgressDetail.value = '' }, 1500)
  }
}

async function verifyRom() {
  busy.value = true;
  operateProgress.value = 0;
  const abortSignal = startCancellableOperation();

  try {
    const adapter = getAdapter();
    if (!adapter || !romFileData.value) {
      showToast(t('messages.operation.unsupportedMode'), 'error');
      return;
    }

    const response = await adapter.verifyROM(romFileData.value, 0, abortSignal);
    showToast(response.message, response.success ? 'success' : 'error');

  } catch (e) {
    showToast(t('messages.rom.verifyFailed'), 'error');
    log(`${t('messages.rom.verifyFailed')}: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    busy.value = false;
    // setTimeout(() => { operateProgress.value = null; operateProgressDetail.value = '' }, 1500)
  }
}

async function writeRam() {
  busy.value = true;
  operateProgress.value = 0;
  operateProgressDetail.value = '';

  try {
    const adapter = getAdapter();
    if (!adapter || !ramFileData.value) {
      showToast(t('messages.operation.unsupportedMode'), 'error');
      return;
    }

    const response = await adapter.writeRAM(ramFileData.value, { ramType: selectedRamType.value as 'SRAM' | 'FLASH' });
    showToast(response.message, response.success ? 'success' : 'error');
  } catch (e) {
    showToast(t('messages.ram.writeFailed'), 'error');
    log(`${t('messages.ram.writeFailed')}: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    busy.value = false;
    // setTimeout(() => { operateProgress.value = null; operateProgressDetail.value = '' }, 1500)
  }
}

async function readRam() {
  busy.value = true;
  operateProgress.value = 0;

  try {
    const adapter = getAdapter();
    if (!adapter) {
      return;
    }

    const defaultSize = ramFileData.value ? ramFileData.value.length : parseInt(selectedRamSize.value, 16);
    const response = await adapter.readRAM(defaultSize, { ramType: selectedRamType.value as 'SRAM' | 'FLASH' });
    if (response.success) {
      showToast(response.message, 'success');
      if (response.data) {
        saveAsFile(response.data, 'exported.sav');
      }
    } else {
      showToast(response.message, 'error');
    }
  } catch (e) {
    showToast(t('messages.ram.readFailed'), 'error');
    log(`${t('messages.ram.readFailed')}: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    busy.value = false;
    // setTimeout(() => { operateProgress.value = null; operateProgressDetail.value = '' }, 1500)
  }
}

async function verifyRam() {
  busy.value = true;
  operateProgress.value = 0;

  try {
    const adapter = getAdapter();
    if (!adapter || !ramFileData.value) {
      showToast(t('messages.operation.unsupportedMode'), 'error');
      return;
    }

    const response = await adapter.verifyRAM(ramFileData.value, { ramType: selectedRamType.value as 'SRAM' | 'FLASH' });
    showToast(response.message, response.success ? 'success' : 'error');
  } catch (e) {
    showToast(t('messages.ram.verifyFailed'), 'error');
    log(`${t('messages.ram.verifyFailed')}: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    busy.value = false;
    // setTimeout(() => { operateProgress.value = null; operateProgressDetail.value = '' }, 1500)
  }
}

function saveAsFile(data: Uint8Array, filename: string) {
  const blob = new Blob([data], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// 重置组件状态的方法
function resetState() {
  // 重置基本状态
  busy.value = false;
  idStr.value = '';

  // 重置进度状态
  resetProgress();

  // 重置设备信息
  deviceSize.value = null;
  sectorCount.value = null;
  sectorSize.value = null;
  bufferWriteBytes.value = null;

  // 重置文件数据
  romFileData.value = null;
  romFileName.value = '';
  ramFileData.value = null;
  ramFileName.value = '';

  // 重置选择的大小为默认值
  selectedRomSize.value = '0x800000'; // 默认8MB
  selectedRamSize.value = '0x8000'; // 默认32KB
  selectedRamType.value = 'SRAM'; // 默认SRAM

  // 重置模式为默认值
  mode.value = 'GBA';

  // 清空日志
  logs.value = [];

  // 重置适配器
  gbaAdapter.value = null;
  mbc5Adapter.value = null;
}

// 暴露方法供父组件调用
defineExpose({
  resetState,
});
</script>

<style scoped>
.flashburner-container {
  max-width: 1200px;
  margin: 32px auto;
  padding: 24px 32px;
  background: #fafbfc;
  border-radius: 14px;
  box-shadow: 0 2px 16px #0002;
  font-family: 'Segoe UI', 'PingFang SC', Arial, sans-serif;
}

/* 响应式主布局 */
.main-layout {
  display: flex;
  gap: 24px;
  height: 820px;
  align-items: stretch;
}

/* 内容区域 */
.content-area {
  flex: 1;
  min-width: 400px;
  max-width: 450px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;  /* 隐藏水平溢出 */
  padding-right: 8px;
  box-sizing: border-box;  /* 确保 padding 包含在宽度内 */
}

/* 操作容器 */
.operations-container {
  display: flex;
  flex-direction: column;
  position: relative;
}

/* TransitionGroup 动画 - 面板移动效果 */
.panel-move-move,
.panel-move-enter-active,
.panel-move-leave-active {
  transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.panel-move-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.panel-move-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* 确保离开的元素不占用布局空间 */
.panel-move-leave-active {
  position: absolute;
  width: 100%;
  z-index: -1;
}

/* 为操作面板添加平滑的位置变化动画 */
.content-area > * {
  transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94),
              margin 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

/* 操作面板向上移动时的优化 */
.content-area > *:not(:first-child) {
  transform-origin: top center;
}

/* 美化滚动条 */
.content-area::-webkit-scrollbar {
  width: 6px;
}

.content-area::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.content-area::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.content-area::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}

/* 移动端响应式 */
@media (max-width: 768px) {
  .flashburner-container {
    margin: 16px;
    padding: 16px 20px;
  }

  .main-layout {
    flex-direction: column;
    gap: 20px;
    height: auto;
  }

  .content-area {
    min-width: 320px;
    max-width: 100%;
    overflow-y: visible;
    padding-right: 0;
  }

  .mode-tabs-card button {
    font-size: 1rem;
    padding: 10px 0 8px 0;
  }
}

/* 小屏幕进一步优化 */
@media (max-width: 480px) {
  .flashburner-container {
    margin: 8px;
    padding: 12px 16px;
  }

  .content-area {
    min-width: 280px;
  }
}

.mode-tabs-card {
  display: flex;
  gap: 0;
  margin-bottom: 22px;
  background: #e3f2fd;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px #0001;
}

.mode-tabs-card button {
  flex: 1 1 0;
  border: none;
  background: none;
  padding: 12px 0 10px 0;
  font-size: 1.08rem;
  font-weight: 600;
  color: #1976d2;
  background: #e3f2fd;
  transition: background 0.2s, color 0.2s;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
}

.mode-tabs-card button:focus {
  outline: none;
}

.mode-tabs-card button.active {
  background: #fff;
  color: #1565c0;
  border-bottom: 2.5px solid #1976d2;
  z-index: 1;
}

.tab-icon {
  margin-right: 6px;
  font-size: 1.2em;
}
</style>
