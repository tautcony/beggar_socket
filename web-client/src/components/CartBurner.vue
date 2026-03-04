<template>
  <div class="flashburner-container">
    <ProgressDisplayModal
      key="progress"
      v-model="showProgressModal"
      v-bind="progressInfo"
      :timeout="operationTimeout"
      @stop="handleProgressStop"
      @close="handleProgressClose"
    />
    <FileNameSelectorModal
      v-model="showFileNameSelector"
      @file-name-selected="onFileNameSelected"
    />
    <MultiCartResultModal
      v-model="showMultiCartResultModal"
      :results="multiCartResults"
    />
    <div class="mode-tabs-card">
      <BaseButton
        :variant="mode === 'GBA' ? 'primary' : 'secondary'"
        :icon="gameControllerOutline"
        :text="$t('ui.mode.gba')"
        @click="mode = 'GBA'"
      />
      <BaseButton
        :variant="mode === 'MBC5' ? 'primary' : 'secondary'"
        :icon="hardwareChipOutline"
        :text="$t('ui.mode.mbc5')"
        @click="mode = 'MBC5'"
      />
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
            :mode="mode"
            :chip-id="chipId"
            :device-ready="deviceReady"
            :busy="busy"
            :device-size="cfiInfo?.deviceSize"
            :sector-counts="sectorCounts"
            :sector-sizes="sectorSizes"
            :buffer-write-bytes="cfiInfo?.bufferSize"
            :selected-mbc-type="selectedMbcType"
            :mbc-power5-v="mbcPower5V"
            @read-id="readCart"
            @erase-chip="eraseChip"
            @read-rom-info="readRomInfo"
            @mbc-type-change="(value: string) => selectedMbcType = value as MbcType"
            @mbc-power-change="mbcPower5V = $event"
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
            @verify-blank="verifyBlank"
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
            @verify-blank="verifyRamBlank"
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
import { gameControllerOutline, hardwareChipOutline } from 'ionicons/icons';
import { DateTime } from 'luxon';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseButton from '@/components/common/BaseButton.vue';
import LogViewer from '@/components/LogViewer.vue';
import FileNameSelectorModal from '@/components/modal/FileNameSelectorModal.vue';
import MultiCartResultModal from '@/components/modal/MultiCartResultModal.vue';
import ProgressDisplayModal from '@/components/modal/ProgressDisplayModal.vue';
import { ChipOperations, RamOperations, RomOperations } from '@/components/operaiton';
import { useCartBurnerFileState, useCartBurnerSessionState } from '@/composables/cartburner';
import { useToast } from '@/composables/useToast';
import { createCartridgeProtocolSession } from '@/features/burner/adapters';
import { type BurnerProtocolSession, createBurnerFacade, type GameDetectionResult } from '@/features/burner/application';
import { CartridgeAdapter, GBAAdapter, MBC5Adapter, MockAdapter } from '@/services';
import { shouldUseLargeRomPage } from '@/services/flash-chip';
import { AdvancedSettings } from '@/settings/advanced-settings';
import { DebugSettings } from '@/settings/debug-settings';
import { useRecentFileNamesStore } from '@/stores/recent-file-names-store';
import { CommandOptions, DeviceInfo } from '@/types';
import type { MbcType } from '@/types/command-options';
import { formatBytes, formatHex } from '@/utils/formatter-utils';
import { CFIInfo } from '@/utils/parsers/cfi-parser';
import { detectMbcTypeFromRom, parseRom } from '@/utils/parsers/rom-parser.ts';

type LogLevelType = 'info' | 'success' | 'warn' | 'error';
type ModeType = 'GBA' | 'MBC5';
type RamType = 'SRAM' | 'FLASH';

const { showToast } = useToast();
const { t } = useI18n();
const recentFileNamesStore = useRecentFileNamesStore();

const props = defineProps<{
  device: DeviceInfo | null,
  deviceReady: boolean
}>();

const mode = ref<ModeType>('GBA');
const selectedMbcType = ref<MbcType>('MBC5');
const mbcPower5V = ref(false);
const burnerFacade = createBurnerFacade({ translate: key => t(key), formatHex: value => formatHex(value, 4) });
const {
  burnerSession,
  busy,
  logs,
  progressInfo,
  showProgressModal,
  updateProgress,
  resetProgress,
  handleProgressClose,
  handleProgressStop,
  clearLog,
  log,
  syncSessionState,
  executeOperation,
} = useCartBurnerSessionState(t);
const {
  romFileData,
  romFileName,
  selectedRomSize,
  selectedBaseAddress,
  ramFileData,
  ramFileName,
  selectedRamSize,
  selectedRamType,
  selectedRamBaseAddress,
  showFileNameSelector,
  pendingRamData,
  onRomFileSelected,
  onRomFileCleared,
  onRamFileSelected,
  onRamFileCleared,
  onRomSizeChange,
  onRomBaseAddressChange,
  onRamBaseAddressChange,
  onRamSizeChange,
  onRamTypeChange,
  onFileNameSelected,
  saveAsFile,
} = useCartBurnerFileState((message) => {
  log(message);
}, (key, params) => t(key, params as never));

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

// multi-cart result modal
const showMultiCartResultModal = ref(false);
const multiCartResults = ref<GameDetectionResult[]>([]);

// chip props
const chipId = ref<number[] | undefined>(undefined);
const cfiInfo = ref<CFIInfo | null>(null);

const sectorSizes = computed(() => {
  if (!cfiInfo.value) {
    return undefined;
  }
  return cfiInfo.value.eraseSectorBlocks.map((block) => block.sectorSize);
});

const sectorCounts = computed(() => {
  if (!cfiInfo.value) {
    return undefined;
  }
  return cfiInfo.value.eraseSectorBlocks.map((block) => block.sectorCount);
});

// Adapter
const gbaAdapter = ref<BurnerProtocolSession | null>();
const mbc5Adapter = ref<BurnerProtocolSession | null>();

function createSession(adapter: CartridgeAdapter, modeName: string): BurnerProtocolSession {
  return createCartridgeProtocolSession(adapter, modeName.toLowerCase(), {
    isActive: () => props.deviceReady && props.device !== null,
  });
}

watch(mode, (newMode) => {
  if (newMode !== 'MBC5') {
    mbcPower5V.value = false;
  }
});

// 热重载状态恢复 - 保持适配器状态和日志
if (import.meta.hot) {
  const hot = import.meta.hot;
  const data = hot.data as {
    cartBurnerState?: {
      logs: { time: string ; message: string; level: LogLevelType }[];
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
    burnerSession.clearLogs();
    for (const entry of data.cartBurnerState.logs) {
      burnerSession.addLog(entry.time, entry.message, entry.level);
    }
    syncSessionState();
    console.log(`[CartBurner] HMR: 恢复 ${logs.value.length} 条日志`);
  }

  // 监听热重载事件，保存当前适配器和日志状态
  hot.dispose(() => {
    if (hot.data) {
      data.cartBurnerState = {
        logs: [...logs.value],
      };
      console.log('[CartBurner] HMR: 保存适配器和日志状态');
    }
  });
}

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
      gbaAdapter.value = createSession(adapter, 'mock');
      mbc5Adapter.value = createSession(adapter, 'mock');
    } else {
      // 正常模式下使用真实适配器
      const gbaRuntimeAdapter = new GBAAdapter(
        props.device,
        (msg, level) => { log(msg, level); },
        updateProgress,
        t,
      );
      gbaAdapter.value = createSession(gbaRuntimeAdapter, 'gba');
      const mbc5RuntimeAdapter = new MBC5Adapter(
        props.device,
        (msg, level) => { log(msg, level); },
        updateProgress,
        t,
      );
      mbc5Adapter.value = createSession(mbc5RuntimeAdapter, 'mbc5');
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

watch(romFileData, (data) => {
  if (!data) return;
  const info = parseRom(data);
  if (!info?.isValid) return;
  if (info.type === 'GB' || info.type === 'GBC') {
    const { mbcType: detected } = detectMbcTypeFromRom(data);
    if (detected !== selectedMbcType.value) {
      selectedMbcType.value = detected;
      log(t('messages.operation.detectedMbcType', { type: detected }), 'info');
    }
  }
});

// 处理自动模式切换请求
function onModeSwitchRequired(targetMode: string, romType: string) {
  const currentMode = mode.value;
  if (targetMode !== currentMode) {
    mode.value = targetMode as ModeType;
    log(t('messages.mode.autoSwitched', { from: currentMode, to: targetMode, romType }));
  }
}

function getAdapter() {
  if (!props.deviceReady || !props.device) {
    showToast(t('messages.operation.readCartInfoFirst'), 'error');
    return null;
  }

  let adapter: BurnerProtocolSession | null | undefined = null;
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

function clearChipInfo() {
  chipId.value = undefined;
  cfiInfo.value = null;
}

async function readCart() {
  clearChipInfo();
  await executeOperation({
    operation: async () => {
      const adapter = getAdapter();
      if (!adapter) {
        return;
      }

      const result = await burnerFacade.readCart(adapter, mbcPower5V.value);
      if (result.success && result.cfiInfo) {
        cfiInfo.value = result.cfiInfo;
        chipId.value = result.chipId;
        if (result.romSizeHex) {
          onRomSizeChange(result.romSizeHex);
        }
        showToast(result.message, 'success');
        log(result.message, 'success');
      } else {
        showToast(result.message, 'error');
        log(result.message, 'error');
        cfiInfo.value = null;
      }
      await burnerFacade.resetCommandBuffer(adapter);
    },
    onError: (error) => {
      showToast(t('messages.operation.readCartFailed'), 'error');
      log(`${t('messages.operation.readCartFailed')}: ${error instanceof Error ? error.message : String(error)}`, 'error');
      cfiInfo.value = null;
    },
  });
}

async function eraseChip() {
  await executeOperation({
    cancellable: true,
    resetProgressOnFinish: true,
    operation: async (signal) => {
      const adapter = getAdapter();
      if (!adapter) {
        showToast(t('messages.operation.unsupportedMode'), 'error');
        return;
      }

      if (!cfiInfo.value) {
        showToast(t('messages.operation.readCartInfoFirst'), 'error');
        resetProgress();
        return;
      }

      const response = await burnerFacade.eraseChip(
        adapter,
        cfiInfo.value,
        selectedMbcType.value,
        mbcPower5V.value,
        signal,
      );
      showToast(response.message, response.success ? 'success' : 'error');
      await burnerFacade.resetCommandBuffer(adapter);
    },
    onError: (error) => {
      showToast(t('messages.operation.eraseFailed'), 'error');
      log(`${t('messages.operation.eraseFailed')}: ${error instanceof Error ? error.message : String(error)}`, 'error');
    },
  });
}

async function writeRom() {
  await executeOperation({
    cancellable: true,
    resetProgressOnFinish: true,
    updateProgress: {
      progress: 0,
      detail: '',
    },
    operation: async (signal) => {
      const adapter = getAdapter();
      if (!adapter || !romFileData.value) {
        showToast(t('messages.operation.unsupportedMode'), 'error');
        resetProgress();
        return;
      }

      if (!cfiInfo.value) {
        showToast(t('messages.operation.readCartInfoFirst'), 'error');
        resetProgress();
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

      const option: CommandOptions = {
        baseAddress: parseInt(selectedBaseAddress.value, 16),
        cfiInfo: cfiInfo.value,
        size: romSize,
        mbcType: selectedMbcType.value,
        enable5V: mbcPower5V.value,
      };
      if (shouldUseLargeRomPage(chipId.value)) {
        option.romPageSize = 512;
      }

      const response = await burnerFacade.writeRom(adapter, alignedRomData, option, signal);
      showToast(response.message, response.success ? 'success' : 'error');
      await burnerFacade.resetCommandBuffer(adapter);
    },
    onError: (error) => {
      showToast(t('messages.rom.writeFailed'), 'error');
      log(`${t('messages.rom.writeFailed')}: ${error instanceof Error ? error.message : String(error)}`, 'error');
    },
  });
}

async function readRom() {
  await executeOperation({
    cancellable: true,
    resetProgressOnFinish: true,
    updateProgress: {
      progress: 0,
    },
    operation: async (signal) => {
      const adapter = getAdapter();
      if (!adapter) {
        showToast(t('messages.operation.unsupportedMode'), 'error');
        resetProgress();
        return;
      }

      if (!cfiInfo.value) {
        showToast(t('messages.operation.readCartInfoFirst'), 'error');
        resetProgress();
        return;
      }

      const option: CommandOptions = {
        baseAddress: parseInt(selectedBaseAddress.value, 16),
        cfiInfo: cfiInfo.value,
        mbcType: selectedMbcType.value,
        enable5V: mbcPower5V.value,
      };
      if (shouldUseLargeRomPage(chipId.value)) {
        option.romPageSize = 512;
      }

      const romSize = parseInt(selectedRomSize.value, 16);
      const response = await burnerFacade.readRom(adapter, romSize, option, signal);
      if (response.success) {
        showToast(response.message, 'success');
        if (response.data) {
          const romInfo = parseRom(response.data);

          if (romInfo.isValid) {
            recentFileNamesStore.addFileName(romInfo.fileName);
          }

          const now = DateTime.now().toLocal().toISO();

          let fileName = `exported_${now}.rom`;
          if (romInfo.type !== 'Unknown') {
            fileName = romInfo.fileName;
          }
          saveAsFile(response.data, fileName);
        }
      } else {
        showToast(response.message, 'error');
      }
      await burnerFacade.resetCommandBuffer(adapter);
    },
    onError: (error) => {
      showToast(t('messages.rom.readFailed'), 'error');
      log(`${t('messages.rom.readFailed')}: ${error instanceof Error ? error.message : String(error)}`, 'error');
    },
  });
}

async function verifyRom() {
  await executeOperation({
    cancellable: true,
    resetProgressOnFinish: true,
    updateProgress: {
      progress: 0,
    },
    operation: async (signal) => {
      const adapter = getAdapter();
      if (!adapter || !romFileData.value) {
        showToast(t('messages.operation.unsupportedMode'), 'error');
        resetProgress();
        return;
      }

      if (!cfiInfo.value) {
        showToast(t('messages.operation.readCartInfoFirst'), 'error');
        resetProgress();
        return;
      }
      if (!signal) {
        throw new Error('verifyRom requires abort signal');
      }

      const size = parseInt(selectedRomSize.value, 16);
      const response = await burnerFacade.verifyRom(adapter, romFileData.value, {
        baseAddress: parseInt(selectedBaseAddress.value, 16),
        cfiInfo: cfiInfo.value,
        size,
        mbcType: selectedMbcType.value,
        enable5V: mbcPower5V.value,
      }, signal);
      showToast(response.message, response.success ? 'success' : 'error');
      await burnerFacade.resetCommandBuffer(adapter);
    },
    onError: (error) => {
      showToast(t('messages.rom.verifyFailed'), 'error');
      log(`${t('messages.rom.verifyFailed')}: ${error instanceof Error ? error.message : String(error)}`, 'error');
    },
  });
}

async function verifyBlank(fillByte: number) {
  await executeOperation({
    cancellable: true,
    resetProgressOnFinish: true,
    updateProgress: {
      progress: 0,
    },
    operation: async (signal) => {
      const adapter = getAdapter();
      if (!adapter) {
        showToast(t('messages.operation.unsupportedMode'), 'error');
        resetProgress();
        return;
      }

      if (!cfiInfo.value) {
        showToast(t('messages.operation.readCartInfoFirst'), 'error');
        resetProgress();
        return;
      }
      if (!signal) {
        throw new Error('verifyBlank requires abort signal');
      }

      const size = parseInt(selectedRomSize.value, 16);
      const blankData = new Uint8Array(size).fill(fillByte);
      const fillLabel = fillByte === 0xFF ? '0xFF' : '0x00';
      log(t('messages.rom.verifyBlankStart', { size: formatBytes(size), fill: fillLabel }), 'info');

      const response = await burnerFacade.verifyRom(adapter, blankData, {
        baseAddress: parseInt(selectedBaseAddress.value, 16),
        cfiInfo: cfiInfo.value,
        size,
        mbcType: selectedMbcType.value,
        enable5V: mbcPower5V.value,
      }, signal);
      showToast(response.message, response.success ? 'success' : 'error');
      await burnerFacade.resetCommandBuffer(adapter);
    },
    onError: (error) => {
      showToast(t('messages.rom.verifyFailed'), 'error');
      log(`${t('messages.rom.verifyFailed')}: ${error instanceof Error ? error.message : String(error)}`, 'error');
    },
  });
}

async function writeRam() {
  await executeOperation({
    operation: async () => {
      const adapter = getAdapter();
      if (!adapter || !ramFileData.value) {
        showToast(t('messages.operation.unsupportedMode'), 'error');
        return;
      }

      if (!cfiInfo.value) {
        showToast(t('messages.operation.readCartInfoFirst'), 'error');
        return;
      }

      const response = await burnerFacade.writeRam(adapter, ramFileData.value, {
        ramType: selectedRamType.value as RamType,
        baseAddress: parseInt(selectedRamBaseAddress.value, 16),
        cfiInfo: cfiInfo.value,
        mbcType: selectedMbcType.value,
        enable5V: mbcPower5V.value,
      });
      showToast(response.message, response.success ? 'success' : 'error');
      if (response.success) {
        log(t('messages.ram.writeSuccess'), 'success');
      } else {
        log(t('messages.ram.writeFailed'), 'error');
      }
      await burnerFacade.resetCommandBuffer(adapter);
    },
    onError: (error) => {
      showToast(t('messages.ram.writeFailed'), 'error');
      log(`${t('messages.ram.writeFailed')}: ${error instanceof Error ? error.message : String(error)}`, 'error');
    },
  });
}

async function readRam() {
  await executeOperation({
    operation: async () => {
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
      const response = await burnerFacade.readRam(adapter, defaultSize, {
        ramType: selectedRamType.value as RamType,
        baseAddress: parseInt(selectedRamBaseAddress.value, 16),
        cfiInfo: cfiInfo.value,
        mbcType: selectedMbcType.value,
        enable5V: mbcPower5V.value,
      });
      if (response.success) {
        showToast(response.message, 'success');
        if (response.data) {
          const now = DateTime.now().toLocal().toFormat('yyyyMMdd-HHmmss');
          const defaultFileName = `exported_${now}.sav`;

          if (recentFileNamesStore.hasFileNames) {
            pendingRamData.value = response.data;
            showFileNameSelector.value = true;
          } else {
            saveAsFile(response.data, defaultFileName);
          }
        }
      } else {
        showToast(response.message, 'error');
      }
      await burnerFacade.resetCommandBuffer(adapter);
    },
    onError: (error) => {
      showToast(t('messages.ram.readFailed'), 'error');
      log(`${t('messages.ram.readFailed')}: ${error instanceof Error ? error.message : String(error)}`, 'error');
    },
  });
}

async function verifyRam() {
  await executeOperation({
    operation: async () => {
      const adapter = getAdapter();
      if (!adapter || !ramFileData.value) {
        showToast(t('messages.operation.unsupportedMode'), 'error');
        return;
      }

      if (!cfiInfo.value) {
        showToast(t('messages.operation.readCartInfoFirst'), 'error');
        return;
      }

      const size = parseInt(selectedRamSize.value, 16);
      const response = await burnerFacade.verifyRam(adapter, ramFileData.value, {
        ramType: selectedRamType.value as RamType,
        baseAddress: parseInt(selectedRamBaseAddress.value, 16),
        cfiInfo: cfiInfo.value,
        size,
        mbcType: selectedMbcType.value,
        enable5V: mbcPower5V.value,
      });
      showToast(response.message, response.success ? 'success' : 'error');
      if (response.success) {
        log(t('messages.ram.verifySuccess'), 'success');
      } else {
        log(t('messages.ram.verifyFailed'), 'error');
      }
      await burnerFacade.resetCommandBuffer(adapter);
    },
    onError: (error) => {
      showToast(t('messages.ram.verifyFailed'), 'error');
      log(`${t('messages.ram.verifyFailed')}: ${error instanceof Error ? error.message : String(error)}`, 'error');
    },
  });
}

async function verifyRamBlank(fillByte: number) {
  await executeOperation({
    operation: async () => {
      const adapter = getAdapter();
      if (!adapter) {
        showToast(t('messages.operation.unsupportedMode'), 'error');
        return;
      }

      if (!cfiInfo.value) {
        showToast(t('messages.operation.readCartInfoFirst'), 'error');
        return;
      }

      const size = parseInt(selectedRamSize.value, 16);
      const blankData = new Uint8Array(size).fill(fillByte);
      const fillLabel = fillByte === 0xFF ? '0xFF' : '0x00';
      log(t('messages.ram.verifyBlankStart', { size: formatBytes(size), fill: fillLabel }), 'info');

      const response = await burnerFacade.verifyRam(adapter, blankData, {
        ramType: selectedRamType.value as RamType,
        baseAddress: parseInt(selectedRamBaseAddress.value, 16),
        cfiInfo: cfiInfo.value,
        size,
        mbcType: selectedMbcType.value,
        enable5V: mbcPower5V.value,
      });
      showToast(response.message, response.success ? 'success' : 'error');
      if (response.success) {
        log(t('messages.ram.verifySuccess'), 'success');
      } else {
        log(t('messages.ram.verifyFailed'), 'error');
      }
      await burnerFacade.resetCommandBuffer(adapter);
    },
    onError: (error) => {
      showToast(t('messages.ram.verifyFailed'), 'error');
      log(`${t('messages.ram.verifyFailed')}: ${error instanceof Error ? error.message : String(error)}`, 'error');
    },
  });
}

// 重置组件状态的方法
function resetState() {
  burnerSession.completeOperation();
  burnerSession.clearLogs();
  resetProgress();
  syncSessionState();

  chipId.value = undefined;

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

  // 重置适配器
  gbaAdapter.value = null;
  mbc5Adapter.value = null;
}

async function readRomInfo() {
  await executeOperation({
    resetProgressOnFinish: true,
    operation: async () => {
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

      const gameResults = await burnerFacade.scanMultiCart(
        adapter,
        mode.value,
        cfiInfo.value,
        selectedMbcType.value,
        mbcPower5V.value,
      );

      printGameDetectionResults(gameResults);

      showToast(t('ui.operation.readMultiCartSuccess'), 'success');
      log(t('ui.operation.readMultiCartSuccess'), 'success');
      await burnerFacade.resetCommandBuffer(adapter);

      // 显示多合一结果弹窗
      multiCartResults.value = gameResults;
      showMultiCartResultModal.value = true;
    },
    onError: (error) => {
      showToast(t('ui.operation.readMultiCartFailed'), 'error');
      log(`${t('ui.operation.readMultiCartFailed')}: ${error instanceof Error ? error.message : String(error)}`, 'error');
    },
  });
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
    recentFileNamesStore.addFileName(romInfo.fileName);
    log(`${addressStr}[${desc}] => ${romInfo.title}`);
  }
}

// 暴露方法供父组件调用
defineExpose({
  resetState,
});
</script>

<style scoped>
.flashburner-container {
  max-width: 1200px;
  margin: var(--space-4) auto;
  padding: var(--space-6) var(--space-8);
  background: var(--color-bg);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
}

/* 响应式主布局 */
.main-layout {
  display: flex;
  gap: var(--space-6);
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
  overflow-x: hidden;
  padding-right: var(--space-2);
  box-sizing: border-box;
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
  background: var(--color-scrollbar-track);
  border-radius: var(--radius-sm);
}

.content-area::-webkit-scrollbar-thumb {
  background: var(--color-scrollbar-thumb);
  border-radius: var(--radius-sm);
}

.content-area::-webkit-scrollbar-thumb:hover {
  background: var(--color-scrollbar-thumb-hover);
}

/* 移动端响应式 */
@media (max-width: 1024px) {
  .flashburner-container {
    margin: var(--space-4);
    padding: var(--space-4) var(--space-5);
  }

  .main-layout {
    flex-direction: column;
    gap: var(--space-5);
    height: auto;
  }

  .content-area {
    min-width: 320px;
    max-width: 100%;
    overflow-y: visible;
    padding-right: 0;
  }
}

.mode-tabs-card {
  display: flex;
  gap: 0;
  margin-bottom: var(--space-6);
  padding: 0;
  border: unset;
  background: #e3f2fd;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.mode-tabs-card .button {
  flex: 1 1 0;
  border: none;
  background: none;
  padding: var(--space-3) 0 var(--space-3) 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
  background: #e3f2fd;
  transition: background 0.2s, color 0.2s;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
  border-radius: 0;
  box-shadow: none;
}

.mode-tabs-card .button:hover:not(.button-disabled) {
  background: var(--color-bg);
  color: var(--color-primary-hover);
  border-bottom: 2.5px solid var(--color-primary);
  transform: none;
}

.mode-tabs-card .button-primary {
  background: var(--color-bg);
  color: var(--color-primary-hover);
  border-bottom: 2.5px solid var(--color-primary);
}

.tab-icon {
  margin-right: var(--space-2);
  font-size: 1.2em;
}
</style>
