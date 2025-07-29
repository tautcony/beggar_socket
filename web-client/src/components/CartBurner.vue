<template>
  <div class="flashburner-container">
    <ProgressDisplayModal
      key="progress"
      v-model="showProgressModal"
      v-bind="progressInfo"
      :timeout="operationTimeout"
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
            :chip-id="chipId"
            :device-ready="deviceReady"
            :busy="busy"
            :device-size="cfiInfo?.deviceSize"
            :sector-counts="sectorCounts"
            :sector-sizes="sectorSizes"
            :buffer-write-bytes="cfiInfo?.bufferSize"
            @read-id="readCart"
            @erase-chip="eraseChip"
            @read-rom-info="readRomInfo"
          />

          <RomOperations
            key="rom-operations"
            :mode="mode"
            :device-ready="deviceReady"
            :busy="busy"
            :rom-file-data="romFileData || undefined"
            :rom-file-name="romFileName"
            :selected-rom-size="selectedRomSize"
            :selected-base-address="selectedBaseAddress"
            @file-selected="onRomFileSelected"
            @file-cleared="onRomFileCleared"
            @write-rom="writeRom"
            @read-rom="readRom"
            @verify-rom="verifyRom"
            @rom-size-change="onRomSizeChange"
            @base-address-change="onRomBaseAddressChange"
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
            :selected-base-address="selectedRamBaseAddress"
            @file-selected="onRamFileSelected"
            @file-cleared="onRamFileCleared"
            @write-ram="writeRam"
            @read-ram="readRam"
            @verify-ram="verifyRam"
            @ram-size-change="onRamSizeChange"
            @ram-type-change="onRamTypeChange"
            @base-address-change="onRamBaseAddressChange"
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
import { DateTime } from 'luxon';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import LogViewer from '@/components/LogViewer.vue';
import ProgressDisplayModal from '@/components/modal/ProgressDisplayModal.vue';
import { ChipOperations, RamOperations, RomOperations } from '@/components/operaiton';
import { useToast } from '@/composables/useToast';
import { arraysEqual, getFlashId } from '@/protocol/beggar_socket/protocol-utils';
import { CartridgeAdapter, GBAAdapter, MBC5Adapter, MockAdapter } from '@/services';
import { AdvancedSettings } from '@/settings/advanced-settings';
import { DebugSettings } from '@/settings/debug-settings';
import { CommandOptions, DeviceInfo, FileInfo, ProgressInfo } from '@/types';
import { CFIInfo } from '@/utils/cfi-parser';
import { formatBytes, formatHex } from '@/utils/formatter-utils';
import { parseRom, RomInfo } from '@/utils/rom-parser.ts';
import { calcSectorUsage } from '@/utils/sector-utils';

interface GameDetectionResult {
  startAddress: number;
  desc: string;
  romInfo: RomInfo;
}

const { showToast } = useToast();
const { t } = useI18n();

const props = defineProps<{
  device: DeviceInfo | null,
  deviceReady: boolean
}>();

const mode = ref<'GBA' | 'MBC5'>('GBA');
const busy = ref(false);
const logs = ref<{ time: string; message: string; level: 'info' | 'success' | 'warn' | 'error' }[]>([]);

// progress info object
const progressInfo = ref<ProgressInfo>({
  type: 'other',
  progress: null,
  detail: '',
  totalBytes: undefined,
  transferredBytes: undefined,
  startTime: undefined,
  currentSpeed: undefined,
  allowCancel: true,
  state: 'idle',
});

const operationTimeout = computed(() => {
  if (progressInfo.value.type === 'erase') {
    return AdvancedSettings.packageReceiveTimeout;
  } else if (progressInfo.value.type === 'write') {
    return AdvancedSettings.packageSendTimeout;
  } else if (progressInfo.value.type === 'read') {
    return AdvancedSettings.packageReceiveTimeout;
  }
  return AdvancedSettings.defaultTimeout;
});

// progress modal visibility
const showProgressModal = computed(() => {
  return progressInfo.value.progress !== null && progressInfo.value.progress !== undefined;
});

// chip props
const chipId = ref<number[] | undefined>(undefined);
const cfiInfo = ref<CFIInfo | null>(null);

const sectorSizes = computed(() => {
  if (!cfiInfo.value) {
    return undefined;
  }
  return cfiInfo.value.eraseSectorBlocks.map((block) => block[0]);
});

const sectorCounts = computed(() => {
  if (!cfiInfo.value) {
    return undefined;
  }
  return cfiInfo.value.eraseSectorBlocks.map((block) => block[1]);
});

const currentAbortController = ref<AbortController | null>(null);

// Adapter
const gbaAdapter = ref<CartridgeAdapter | null>();
const mbc5Adapter = ref<CartridgeAdapter | null>();

// 热重载状态恢复 - 保持适配器状态和日志
if (import.meta.hot) {
  const data = import.meta.hot.data as {
    cartBurnerState?: {
      logs: { time: string ; message: string; level: 'info' | 'success' | 'warn' | 'error' }[];
    }
  };

  // 初始化或恢复状态
  data.cartBurnerState = data?.cartBurnerState ?? {
    logs: [],
  };

  // 重新初始化适配器
  initializeAdapters();

  // 从 HMR 数据恢复日志状态
  if (data.cartBurnerState.logs.length > 0) {
    logs.value = [...data.cartBurnerState.logs];
    console.log(`[CartBurner] HMR: 恢复 ${logs.value.length} 条日志`);
  }

  // 监听热重载事件，保存当前适配器和日志状态
  import.meta.hot.dispose(() => {
    if (import.meta.hot?.data) {
      data.cartBurnerState = {
        logs: [...logs.value],
      };
      console.log('[CartBurner] HMR: 保存适配器和日志状态');
    }
  });
}

// ROM
const romFileData = ref<Uint8Array | null>(null);
const romFileName = ref('');
const selectedRomSize = ref('0x00800000'); // 默认8MB
const selectedBaseAddress = ref('0x00000000'); // 默认ROM基址0x00000000

// RAM
const ramFileData = ref<Uint8Array | null>(null);
const ramFileName = ref('');
const selectedRamSize = ref('0x08000'); // 默认32KB
const selectedRamType = ref('SRAM'); // 默认SRAM
const selectedRamBaseAddress = ref('0x000000'); // 默认RAM基址0x000000

// 设备连接状态改变时，初始化适配器
function initializeAdapters() {
  if (props.deviceReady && props.device) {
    // 如果适配器已经存在且有效，不需要重新创建
    if (gbaAdapter.value && mbc5Adapter.value) {
      return;
    }

    if (DebugSettings.debugMode) {
      // 调试模式下使用 MockAdapter
      const adapter = new MockAdapter(
        undefined,
        (msg, level) => { log(msg, level); },
        updateProgress,
        t,
      );
      gbaAdapter.value = adapter;
      mbc5Adapter.value = adapter;
    } else {
      // 正常模式下使用真实适配器
      gbaAdapter.value = new GBAAdapter(
        props.device,
        (msg, level) => { log(msg, level); },
        updateProgress,
        t,
      );
      mbc5Adapter.value = new MBC5Adapter(
        props.device,
        (msg, level) => { log(msg, level); },
        updateProgress,
        t,
      );
    }
  } else {
    // 设备未连接时清空适配器
    if (gbaAdapter.value || mbc5Adapter.value) {
      gbaAdapter.value = null;
      mbc5Adapter.value = null;
      console.log('[CartBurner] 清空适配器');
    }
  }
}

watch(() => props.deviceReady, () => {
  initializeAdapters();
});

// 组件挂载时初始化适配器
onMounted(() => {
  initializeAdapters();
});

function updateProgress(info: ProgressInfo) {
  // 直接更新 progressInfo 对象
  Object.assign(progressInfo.value, info);
}

function handleProgressStop() {
  // 中止当前操作
  if (currentAbortController.value) {
    currentAbortController.value.abort();
    log(t('messages.operation.cancelled'), 'warn');
  }
}

function resetProgress() {
  // 重置进度信息到初始状态
  progressInfo.value = {
    progress: null,
    detail: '',
    totalBytes: undefined,
    transferredBytes: undefined,
    startTime: undefined,
    currentSpeed: undefined,
    allowCancel: true,
    state: 'idle',
  };

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

function log(msg: string, level: 'info' | 'success' | 'warn' | 'error' = 'info') {
  const time = new Date().toLocaleTimeString();
  const message = msg;
  logs.value.push({ time, message, level });
  console.log(`[${time}] [${level}] ${message}`);
  if (logs.value.length > 500) logs.value.shift();
}

function clearLog() {
  logs.value = [];
}

// 文件处理函数
function onRomFileSelected(fileInfo: FileInfo | FileInfo[]) {
  if (Array.isArray(fileInfo)) {
    fileInfo = fileInfo[0];
  }
  romFileName.value = fileInfo.name;
  romFileData.value = fileInfo.data;
  log(t('messages.file.selectRom', { name: fileInfo.name, size: formatBytes(fileInfo.size) }));
}

function onRomFileCleared() {
  romFileData.value = null;
  romFileName.value = '';
  log(t('messages.file.clearRom'));
}

function onRamFileSelected(fileInfo: FileInfo | FileInfo[]) {
  if (Array.isArray(fileInfo)) {
    fileInfo = fileInfo[0];
  }
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

function onRomBaseAddressChange(hexAddress: string) {
  selectedBaseAddress.value = hexAddress;
  log(t('messages.rom.baseAddressChanged', { address: hexAddress }));
}

function onRamBaseAddressChange(hexAddress: string) {
  selectedRamBaseAddress.value = hexAddress;
  log(t('messages.ram.baseAddressChanged', { address: hexAddress }));
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
  let adapter: CartridgeAdapter | null | undefined = null;
  if (mode.value === 'GBA') {
    adapter = gbaAdapter.value;
  } else if (mode.value === 'MBC5') {
    adapter = mbc5Adapter.value;
  }
  if (!adapter) {
    showToast(t('messages.operation.unsupportedMode'), 'error');
  }
  return adapter;
}

async function readCart() {
  // 先清空芯片信息，防止显示旧数据
  clearChipInfo();
  busy.value = true;

  try {
    const adapter = getAdapter();
    if (!adapter) {
      return;
    }

    const response = await adapter.readID();
    if (response.success) {
      chipId.value = response.id;
    } else {
      cfiInfo.value = null;
    }
    const info = response.success ? await adapter.getCartInfo() : null;
    if (info) {
      cfiInfo.value = info;
      onRomSizeChange(formatHex(info.deviceSize, 4));
    }
    if (chipId.value && cfiInfo.value) {
      showToast(t('messages.operation.readCartSuccess'), 'success');
      log(t('messages.operation.readCartSuccess'), 'success');
    } else {
      showToast(t('messages.operation.readCartFailed'), 'error');
      log(t('messages.operation.readCartFailed'), 'error');
    }
  } catch (e) {
    showToast(t('messages.operation.readCartFailed'), 'error');
    log(`${t('messages.operation.readCartFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
    cfiInfo.value = null;
  } finally {
    busy.value = false;
  }
}

async function eraseChip() {
  busy.value = true;
  const abortSignal = startCancellableOperation();

  try {
    const adapter = getAdapter();
    if (!adapter) {
      showToast(t('messages.operation.unsupportedMode'), 'error');
      return;
    }

    if (!cfiInfo.value) {
      showToast(t('messages.operation.readCartInfoFirst'), 'error');
      progressInfo.value.progress = null;
      return;
    }

    const sectorInfo = calcSectorUsage(cfiInfo.value.eraseSectorBlocks, cfiInfo.value.deviceSize, 0x00);
    for (const { startAddress, endAddress, sectorSize } of sectorInfo) {
      const response = await adapter.eraseSectors(startAddress, endAddress, sectorSize, abortSignal);
      showToast(response.message, response.success ? 'success' : 'error');
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      // 操作被取消，不显示错误消息，因为这是用户主动取消的
      return;
    }
    showToast(t('messages.operation.eraseFailed'), 'error');
    log(`${t('messages.operation.eraseFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
  } finally {
    busy.value = false;
    finishOperation();
  }
}

async function writeRom() {
  busy.value = true;
  progressInfo.value.progress = 0;
  progressInfo.value.detail = '';
  const abortSignal = startCancellableOperation();

  try {
    const adapter = getAdapter();
    if (!adapter || !romFileData.value) {
      showToast(t('messages.operation.unsupportedMode'), 'error');
      progressInfo.value.progress = null;
      return;
    }

    if (!cfiInfo.value) {
      showToast(t('messages.operation.readCartInfoFirst'), 'error');
      progressInfo.value.progress = null;
      return;
    }
    const romSize = parseInt(selectedRomSize.value, 16);

    let alignedRomData = romFileData.value;
    if (romFileData.value.length < romSize) {
      const padded = new Uint8Array(romSize);
      padded.set(romFileData.value);
      padded.fill(0xff, romFileData.value.length);
      alignedRomData = padded;
    }

    const option: CommandOptions = { baseAddress: parseInt(selectedBaseAddress.value, 16), cfiInfo: cfiInfo.value };
    if (arraysEqual(chipId.value, getFlashId('S29GL256N'))) {
      option.pageSize = 512;
    }

    const response = await adapter.writeROM(alignedRomData, option, abortSignal);
    showToast(response.message, response.success ? 'success' : 'error');
  } catch (e) {
    showToast(t('messages.rom.writeFailed'), 'error');
    log(`${t('messages.rom.writeFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
  } finally {
    busy.value = false;
    finishOperation();
  }
}

async function readRom() {
  busy.value = true;
  progressInfo.value.progress = 0;
  const abortSignal = startCancellableOperation();

  try {
    const adapter = getAdapter();
    if (!adapter) {
      showToast(t('messages.operation.unsupportedMode'), 'error');
      progressInfo.value.progress = null;
      return;
    }

    if (!cfiInfo.value) {
      showToast(t('messages.operation.readCartInfoFirst'), 'error');
      progressInfo.value.progress = null;
      return;
    }

    const option: CommandOptions = { baseAddress: parseInt(selectedBaseAddress.value, 16), cfiInfo: cfiInfo.value };
    if (arraysEqual(chipId.value, getFlashId('S29GL256N'))) {
      option.pageSize = 512;
    }

    const romSize = parseInt(selectedRomSize.value, 16);
    const response = await adapter.readROM(romSize, option, abortSignal);
    if (response.success) {
      showToast(response.message, 'success');
      if (response.data) {
        const romInfo = parseRom(response.data);
        const now = DateTime.now().toLocal().toISO();

        let fileName = `exported_${now}.rom`;
        if (romInfo.type !== 'Unknown') {
          fileName = `${romInfo.title} (${romInfo.region}).rom`;
        }
        saveAsFile(response.data, fileName);
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
    log(`${t('messages.rom.readFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
  } finally {
    busy.value = false;
    finishOperation();
  }
}

async function verifyRom() {
  busy.value = true;
  progressInfo.value.progress = 0;
  const abortSignal = startCancellableOperation();

  try {
    const adapter = getAdapter();
    if (!adapter || !romFileData.value) {
      showToast(t('messages.operation.unsupportedMode'), 'error');
      progressInfo.value.progress = null;
      return;
    }

    if (!cfiInfo.value) {
      showToast(t('messages.operation.readCartInfoFirst'), 'error');
      progressInfo.value.progress = null;
      return;
    }

    const response = await adapter.verifyROM(romFileData.value, { baseAddress: parseInt(selectedBaseAddress.value, 16), cfiInfo: cfiInfo.value }, abortSignal);
    showToast(response.message, response.success ? 'success' : 'error');

  } catch (e) {
    showToast(t('messages.rom.verifyFailed'), 'error');
    log(`${t('messages.rom.verifyFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
  } finally {
    busy.value = false;
    finishOperation();
  }
}

async function writeRam() {
  busy.value = true;

  try {
    const adapter = getAdapter();
    if (!adapter || !ramFileData.value) {
      showToast(t('messages.operation.unsupportedMode'), 'error');
      return;
    }

    if (!cfiInfo.value) {
      showToast(t('messages.operation.readCartInfoFirst'), 'error');
      return;
    }

    const response = await adapter.writeRAM(ramFileData.value, {
      ramType: selectedRamType.value as 'SRAM' | 'FLASH',
      baseAddress: parseInt(selectedRamBaseAddress.value, 16),
      cfiInfo: cfiInfo.value,
    });
    showToast(response.message, response.success ? 'success' : 'error');
  } catch (e) {
    showToast(t('messages.ram.writeFailed'), 'error');
    log(`${t('messages.ram.writeFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
  } finally {
    busy.value = false;
  }
}

async function readRam() {
  busy.value = true;

  try {
    const adapter = getAdapter();
    if (!adapter) {
      showToast(t('messages.operation.unsupportedMode'), 'error');
      return;
    }

    if (!cfiInfo.value) {
      showToast(t('messages.operation.readCartInfoFirst'), 'error');
      return;
    }

    const defaultSize = ramFileData.value ? ramFileData.value.length : parseInt(selectedRamSize.value, 16);
    const response = await adapter.readRAM(defaultSize, {
      ramType: selectedRamType.value as 'SRAM' | 'FLASH',
      baseAddress: parseInt(selectedRamBaseAddress.value, 16),
      cfiInfo: cfiInfo.value,
    });
    if (response.success) {
      showToast(response.message, 'success');
      if (response.data) {
        const now = DateTime.now().toLocal().toFormat('yyyyMMdd-HHmmss');

        saveAsFile(response.data, `exported_${now}.sav`);
      }
    } else {
      showToast(response.message, 'error');
    }
  } catch (e) {
    showToast(t('messages.ram.readFailed'), 'error');
    log(`${t('messages.ram.readFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
  } finally {
    busy.value = false;
  }
}

async function verifyRam() {
  busy.value = true;

  try {
    const adapter = getAdapter();
    if (!adapter || !ramFileData.value) {
      showToast(t('messages.operation.unsupportedMode'), 'error');
      return;
    }

    if (!cfiInfo.value) {
      showToast(t('messages.operation.readCartInfoFirst'), 'error');
      return;
    }

    const response = await adapter.verifyRAM(ramFileData.value, {
      ramType: selectedRamType.value as 'SRAM' | 'FLASH',
      baseAddress: parseInt(selectedRamBaseAddress.value, 16),
      cfiInfo: cfiInfo.value,
    });
    showToast(response.message, response.success ? 'success' : 'error');
  } catch (e) {
    showToast(t('messages.ram.verifyFailed'), 'error');
    log(`${t('messages.ram.verifyFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
  } finally {
    busy.value = false;
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
  chipId.value = undefined;

  // 重置进度状态
  resetProgress();

  // 重置设备信息
  cfiInfo.value = null;

  // 重置文件数据
  romFileData.value = null;
  romFileName.value = '';
  ramFileData.value = null;
  ramFileName.value = '';

  // 重置选择的大小为默认值
  selectedRomSize.value = '0x800000'; // 默认8MB
  selectedBaseAddress.value = '0x00'; // 默认ROM基址0x00
  selectedRamSize.value = '0x8000'; // 默认32KB
  selectedRamType.value = 'SRAM'; // 默认SRAM
  selectedRamBaseAddress.value = '0x00000'; // 默认RAM基址0x00000

  // 重置模式为默认值
  mode.value = 'GBA';

  // 清空日志
  logs.value = [];

  // 重置适配器
  gbaAdapter.value = null;
  mbc5Adapter.value = null;
}

async function readRomInfo() {
  busy.value = true;

  try {
    const adapter = getAdapter();
    if (!adapter) {
      showToast(t('messages.operation.unsupportedMode'), 'error');
      return;
    }

    if (!cfiInfo.value) {
      showToast(t('messages.operation.readCartInfoFirst'), 'error');
      return;
    }

    log(t('ui.operation.startReadingMultiCart'));

    const cfi = cfiInfo.value;
    const deviceSize = cfi.deviceSize;
    let gameResults: GameDetectionResult[];

    if (mode.value === 'GBA') {
      gameResults = await readGBAMultiCartRoms(adapter, deviceSize, cfi);
    } else if (mode.value === 'MBC5') {
      gameResults = await readMBC5MultiCartRoms(adapter, deviceSize, cfi);
    } else {
      showToast(t('messages.operation.unsupportedMode'), 'error');
      return;
    }

    printGameDetectionResults(gameResults);

    showToast(t('ui.operation.readMultiCartSuccess'), 'success');
  } catch (e) {
    showToast(t('ui.operation.readMultiCartFailed'), 'error');
    log(`${t('ui.operation.readMultiCartFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
  } finally {
    busy.value = false;
    resetProgress();
  }
}

async function readGBAMultiCartRoms(adapter: CartridgeAdapter, deviceSize: number, cfi: CFIInfo) {
  const results: GameDetectionResult[] = [];

  const bankCount = Math.floor(deviceSize / 0x400000);

  for (let i = 0; i < bankCount; i++) {
    const baseAddress = i * 0x400000;
    const headerResult = await adapter.readROM(0x150, { baseAddress, cfiInfo: cfi });

    if (headerResult.success && headerResult.data) {
      const romInfo = parseRom(headerResult.data);

      if (romInfo.isValid) {
        results.push({
          startAddress: baseAddress,
          desc: `Bank ${i.toString().padStart(2, '0')}`,
          romInfo,
        });
      }
    }
  }

  return results;
}

async function readMBC5MultiCartRoms(adapter: CartridgeAdapter, deviceSize: number, cfi: CFIInfo): Promise<GameDetectionResult[]> {
  const results: GameDetectionResult[] = [];

  // MBC5 N合1卡带的地址范围定义
  const multiCardRanges = [
    { from: 0x000000, name: 'Menu   ' }, // 菜单
    { from: 0x100000, name: 'Game 01' }, // 游戏1
  ];
  for (let i = 1; i < 16; ++i) {
    multiCardRanges.push({ from: 0x200000 * i, name: `Game ${(i + 1).toString().padStart(2, '0')}` });
  }

  // 检查每个可能的游戏位置
  for (const range of multiCardRanges) {
    if (range.from >= deviceSize) break; // 超出芯片容量

    // 解析完整ROM信息
    const fullHeaderResult = await adapter.readROM(0x150, { baseAddress: range.from, cfiInfo: cfi });
    if (fullHeaderResult.success && fullHeaderResult.data) {
      const romInfo = parseRom(fullHeaderResult.data);
      if (romInfo.isValid) {
        results.push({
          startAddress: range.from,
          desc: range.name,
          romInfo,
        });
      }
    }
  }

  return results;
}

function printGameDetectionResults(gameResults: GameDetectionResult[]) {
  if (gameResults.length === 0) {
    log(t('ui.operation.noValidGameFound'));
    return;
  }

  if (gameResults.length === 1 && gameResults[0].startAddress === 0) {
    log(t('ui.operation.singleGameDetected'));
  } else {
    log(t('ui.operation.multiCartDetected'));
  }

  for (const result of gameResults) {
    const { startAddress, desc, romInfo } = result;
    const addressStr = formatHex(startAddress, 4);
    log(`${addressStr}[${desc}] => ${romInfo.title}`);
  }
}

// 暴露方法供父组件调用
defineExpose({
  resetState,
});

function clearChipInfo() {
  chipId.value = undefined;
  cfiInfo.value = null;
}
</script>

<style scoped>
.flashburner-container {
  max-width: 1200px;
  margin: 32px auto;
  padding: 24px 32px;
  background: #fafbfc;
  border-radius: 14px;
  box-shadow: 0 2px 16px #0002;
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
  min-width: 450px;
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
