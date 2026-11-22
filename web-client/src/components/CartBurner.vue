<template>
  <div class="flashburner-container">
    <ProgressDisplayModal
      key="progress"
      v-model="showProgressModal"
      v-bind="progressInfo"
      :timeout="operationTimeout"
      :latest-log="logs.length > 0 ? logs[logs.length - 1] : undefined"
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
    <div class="mode-tabs-bar">
      <RetroSegmented
        :model-value="mode"
        :options="[
          { value: 'GBA', label: $t('ui.mode.gba'), icon: 'pixelarticons:gamepad' },
          { value: 'MBC5', label: $t('ui.mode.mbc5'), icon: 'pixelarticons:cpu' },
        ]"
        @update:model-value="mode = $event as ModeType"
      />
    </div>
    <RetroCard
      v-if="pendingPreviewResult"
      class="preview-save-recovery"
    >
      <p>{{ t('messages.emulator.pendingSaveRecovery', { rom: pendingPreviewResult.launch.romName, save: pendingPreviewResult.launch.saveName || defaultSaveName(pendingPreviewResult.launch.romName) }) }}</p>
      <div class="preview-recovery-actions">
        <RetroButton
          variant="primary"
          :text="t('ui.emulator.exportSave')"
          @click="exportPendingPreviewResult"
        />
        <RetroButton
          variant="secondary"
          :text="t('ui.emulator.discardSaveResult')"
          @click="discardPendingPreviewResult"
        />
      </div>
    </RetroCard>
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
            :firmware-profile="props.device?.firmwareProfile"
            :flashcart-profiles="flashcartProfiles"
            :selected-flashcart-profile-id="selectedFlashcartProfileId"
            :ambiguous-flashcart-profiles="ambiguousFlashcartProfiles"
            @read-id="readCart"
            @erase-chip="eraseChip"
            @read-rom-info="readRomInfo"
            @mbc-type-change="(value: string) => selectedMbcType = value as MbcType"
            @mbc-power-change="mbcPower5V = $event"
            @flashcart-profile-change="onFlashcartProfileChange"
          />

          <RomOperations
            key="rom-operations"
            :mode="mode"
            :device-ready="deviceReady"
            :busy="busy"
            :rom-file-data="romFileData || undefined"
            :rom-file-name="romFileName"
            :ram-file-data="ramFileData"
            :ram-file-name="ramFileName"
            :rom-revision="romRevision"
            :ram-revision="ramRevision"
            :preview-blocked="Boolean(pendingPreviewResult)"
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
            @preview-save-checkpoint="onPreviewSaveCheckpoint"
            @preview-save-result="onPreviewSaveResult"
            @preview-session-started="onPreviewSessionStarted"
            @preview-session-ended="onPreviewSessionEnded"
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
            :firmware-profile="props.device?.firmwareProfile"
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

      <div class="log-panel">
        <LogViewer
          :logs="logs"
          :title="t('ui.log.title')"
          @clear-logs="clearLog"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import LogViewer from '@/components/LogViewer.vue';
import FileNameSelectorModal from '@/components/modal/FileNameSelectorModal.vue';
import MultiCartResultModal from '@/components/modal/MultiCartResultModal.vue';
import ProgressDisplayModal from '@/components/modal/ProgressDisplayModal.vue';
import { ChipOperations, RamOperations, RomOperations } from '@/components/operaiton';
import type { GbaPreviewSavePayload } from '@/components/operaiton/contracts';
import { RetroButton, RetroCard, RetroSegmented } from '@/components/retro';
import { runWithCommandBufferReset, useCartBurnerFileState, useCartBurnerSessionState } from '@/composables/cartburner';
import { useToast } from '@/composables/useToast';
import type { ConnectionLogEntry } from '@/device-runtime/connection-report';
import { getDeviceRuntime } from '@/device-runtime/runtime-instance';
import { createCartridgeProtocolSession } from '@/features/burner/adapters';
import { type BurnerProtocolSession, createBurnerUseCase, type GameDetectionResult } from '@/features/burner/application';
import { isTauriRuntime } from '@/platform/runtime';
import type { CartridgeAdapter } from '@/services';
import { FlashcartProfileService } from '@/services/flashcart-profile-service';
import { AdvancedSettings } from '@/settings/advanced-settings';
import { useRecentFileNamesStore } from '@/stores/recent-file-names-store';
import { CommandOptions, DeviceInfo } from '@/types';
import type { BurnerLogEntry } from '@/types/burner-log';
import type { MbcType } from '@/types/command-options';
import type { FlashcartProfileSummary } from '@/types/flashcart-profile';
import { formatBytes, formatHex } from '@/utils/formatter-utils';
import { CFIInfo } from '@/utils/parsers/cfi-parser';
import { detectMbcTypeFromRom, parseRom } from '@/utils/parsers/rom-parser.ts';
import { prepareRomImage } from '@/utils/transfer-plan';

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
const flashcartProfiles = ref<FlashcartProfileSummary[]>([]);
const selectedFlashcartProfileId = ref<string>('');
const ambiguousFlashcartProfiles = ref<FlashcartProfileSummary[]>([]);

watch(
  [mode, () => props.device?.firmwareProfile?.capabilities.nativeFlashgbxProtocol],
  async ([currentMode, isFlashgbx]) => {
    selectedFlashcartProfileId.value = '';
    ambiguousFlashcartProfiles.value = [];
    if (!isFlashgbx) {
      flashcartProfiles.value = [];
      return;
    }
    const list = await FlashcartProfileService.loadByMode(currentMode);
    flashcartProfiles.value = list.map(profile => FlashcartProfileService.toSummary(profile));
  },
  { immediate: true },
);

function onFlashcartProfileChange(profileId: string) {
  selectedFlashcartProfileId.value = profileId;
  ambiguousFlashcartProfiles.value = [];
}
const burnerUseCase = createBurnerUseCase({ translate: key => t(key), formatHex: value => formatHex(value, 4) });
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
} = useCartBurnerSessionState(t, () => props.device?.connectionGeneration);
const {
  romFileData,
  romFileName,
  romRevision,
  selectedRomSize,
  selectedBaseAddress,
  ramFileData,
  ramFileName,
  ramRevision,
  selectedRamSize,
  selectedRamType,
  selectedRamBaseAddress,
  showFileNameSelector,
  pendingRamData,
  pendingPreviewResult,
  activePreviewSessionId,
  onRomFileSelected,
  onRomFileCleared,
  onRamFileSelected,
  onRamFileCleared,
  onRomSizeChange,
  onRomBaseAddressChange,
  onRamBaseAddressChange,
  onRamSizeChange,
  onRamTypeChange,
  applyPreviewSaveResult,
  discardPendingPreviewResult,
  activatePreviewSession,
  endPreviewSession,
  resetSelectedFiles,
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
const latestPreviewCheckpoint = ref<GbaPreviewSavePayload | null>(null);

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
/** Mode sync strategy of the binding that owns the current session. */
let modeSyncStrategy: ((adapter: CartridgeAdapter, mode: 'gba' | 'mbc5') => Promise<void>) | undefined;

function createSession(adapter: CartridgeAdapter, modeName: string): BurnerProtocolSession {
  return createCartridgeProtocolSession(adapter, modeName.toLowerCase(), {
    isActive: () => props.deviceReady && props.device !== null,
  });
}

watch(mode, (newMode) => {
  if (newMode !== 'MBC5') {
    mbcPower5V.value = false;
  }
  const adapter = gbaAdapter.value;
  if (!modeSyncStrategy || !props.deviceReady || busy.value || !adapter) {
    return;
  }
  const target = newMode === 'MBC5' ? 'mbc5' : 'gba';
  void modeSyncStrategy(adapter as unknown as CartridgeAdapter, target).catch((error: unknown) => {
    const msg = error instanceof Error ? error.message : String(error);
    log(`Failed to sync FlashGBX hardware mode (${newMode}): ${msg}`, 'warn');
  });
});

// 热重载状态恢复 - 保持适配器状态和日志
if (import.meta.hot) {
  const hot = import.meta.hot;
  const data = (hot.data ?? {}) as {
    cartBurnerState?: {
      logs: BurnerLogEntry[];
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
      burnerSession.addLog(entry.time, {
        message: entry.message,
        error: entry.error,
        details: entry.details,
      }, entry.level);
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

    // 适配器由已提交的会话装配：协议身份、分块上限与模式同步都来自同一个 profile
    const profile = props.device.session;
    if (!profile) {
      console.warn('[CartBurner] 会话缺失，无法装配适配器');
      return;
    }
    const runtime = getDeviceRuntime();
    const variant = runtime.registry.findVariant(profile.variantId);
    if (!variant) {
      console.error('[CartBurner] 未知会话 variant', profile.variantId);
      return;
    }
    const runtimeBinding = runtime.composition.resolve(variant.runtimeBindingId);
    modeSyncStrategy = runtimeBinding.modeSyncStrategy;
    const context = {
      device: props.device,
      profile,
      log: (msg: Parameters<typeof log>[0], level: Parameters<typeof log>[1]) => { log(msg, level); },
      updateProgress,
      t,
    };
    const isFlashgbx = profile.firmware.protocol === 'flashgbx';
    gbaAdapter.value = createSession(
      runtimeBinding.adapterFactory.create('gba', context),
      isFlashgbx ? 'flashgbx-gba' : 'gba',
    );
    mbc5Adapter.value = createSession(
      runtimeBinding.adapterFactory.create('mbc5', context),
      isFlashgbx ? 'flashgbx-mbc' : 'mbc5',
    );
  } else {
    // 设备未连接时清空适配器
    if (gbaAdapter.value || mbc5Adapter.value) {
      gbaAdapter.value = null;
      mbc5Adapter.value = null;
      modeSyncStrategy = undefined;
      console.log('[CartBurner] 清空适配器');
    }
  }
}

watch(() => props.deviceReady, () => {
  initializeAdapters();
});

// 会话替换（重连）时旧适配器必须失效，避免新连接复用旧会话的适配器
watch(() => props.device?.connectionId, () => {
  if (gbaAdapter.value || mbc5Adapter.value) {
    gbaAdapter.value = null;
    mbc5Adapter.value = null;
    modeSyncStrategy = undefined;
  }
  initializeAdapters();
});

onUnmounted(() => {
  gbaAdapter.value = null;
  mbc5Adapter.value = null;
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

async function withCommandBufferReset<T>(adapter: BurnerProtocolSession, operation: () => Promise<T>): Promise<T> {
  return runWithCommandBufferReset(
    adapter,
    operation,
    currentAdapter => burnerUseCase.resetCommandBuffer(currentAdapter),
    (error) => {
      const message = error instanceof Error ? error.message : String(error);
      showToast(t('messages.operation.resetCommandBufferFailed'), 'error');
      log(`${t('messages.operation.resetCommandBufferFailed')}: ${message}`, 'error');
    },
  );
}

async function readCart() {
  clearChipInfo();
  ambiguousFlashcartProfiles.value = [];
  await executeOperation({
    operation: async () => {
      const adapter = getAdapter();
      if (!adapter) {
        return;
      }

      await withCommandBufferReset(adapter, async () => {
        const result = await burnerUseCase.readCart(adapter, mbcPower5V.value, {
          flashcartProfileId: selectedFlashcartProfileId.value || undefined,
        });
        if (result.success && result.cfiInfo) {
          cfiInfo.value = result.cfiInfo;
          chipId.value = result.chipId;
          if (result.romSizeHex) {
            onRomSizeChange(result.romSizeHex);
          }
          showToast(result.message, 'success');
          log(result.message, 'success');
        } else {
          if (result.errorCode === 'profile_ambiguous') {
            const details = result.details as { candidates?: FlashcartProfileSummary[] } | undefined;
            ambiguousFlashcartProfiles.value = details?.candidates ?? [];
            showToast(t('messages.operation.profileAmbiguous'), 'error');
            log(t('messages.operation.profileAmbiguous'), 'warn');
          } else if (result.errorCode === 'profile_not_found') {
            showToast(t('messages.operation.profileNotFound'), 'error');
            log(result.message, 'error');
          } else {
            showToast(result.message, 'error');
            log(result.message, 'error');
          }
          cfiInfo.value = null;
        }
      });
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
      const currentCfiInfo = cfiInfo.value;

      await withCommandBufferReset(adapter, async () => {
        const response = await burnerUseCase.eraseChip({
          session: adapter,
          cfiInfo: currentCfiInfo,
          signal,
          options: {
            cfiInfo: currentCfiInfo,
            mbcType: selectedMbcType.value,
            enable5V: mbcPower5V.value,
            flashcartProfileId: selectedFlashcartProfileId.value || undefined,
          },
        });
        if (signal?.aborted) {
          return;
        }
        showToast(response.message, response.success ? 'success' : 'error');
      });
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
      const currentCfiInfo = cfiInfo.value;
      const currentRomData = romFileData.value;
      const romSize = parseInt(selectedRomSize.value, 16);
      const alignedRomData = prepareRomImage(currentRomData, romSize);

      const option: CommandOptions = {
        baseAddress: parseInt(selectedBaseAddress.value, 16),
        cfiInfo: currentCfiInfo,
        size: romSize,
        mbcType: selectedMbcType.value,
        enable5V: mbcPower5V.value,
        flashcartProfileId: selectedFlashcartProfileId.value || undefined,
      };

      await withCommandBufferReset(adapter, async () => {
        const response = await burnerUseCase.writeRom({
          session: adapter,
          cfiInfo: option.cfiInfo,
          options: option,
          data: alignedRomData,
          signal,
        });
        if (signal?.aborted) {
          return;
        }
        showToast(response.message, response.success ? 'success' : 'error');
      });
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
    resetProgressOnFinish: false,
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
      const currentCfiInfo = cfiInfo.value;

      const option: CommandOptions = {
        baseAddress: parseInt(selectedBaseAddress.value, 16),
        cfiInfo: currentCfiInfo,
        mbcType: selectedMbcType.value,
        enable5V: mbcPower5V.value,
      };

      const romSize = parseInt(selectedRomSize.value, 16);
      await withCommandBufferReset(adapter, async () => {
        const response = await burnerUseCase.readRom({
          session: adapter,
          cfiInfo: option.cfiInfo,
          options: option,
          size: romSize,
          signal,
        });
        if (signal?.aborted) {
          return;
        }
        if (response.success) {
          showToast(response.message, 'success');
          if (response.data) {
            const romInfo = parseRom(response.data);

            if (romInfo.isValid) {
              recentFileNamesStore.addFileName(romInfo.fileName);
            }

            const now = DateTime.now().toLocal().toFormat('yyyyMMdd-HHmmss');
            const fallbackExtension = romInfo.type === 'GBA'
              ? 'gba'
              : romInfo.type === 'GBC'
                ? 'gbc'
                : romInfo.type === 'GB'
                  ? 'gb'
                  : 'rom';
            let fileName = `exported_${now}.${fallbackExtension}`;
            if (romInfo.isValid) {
              fileName = romInfo.fileName;
            }
            const saveResult = await saveAsFile(response.data, fileName);
            if (saveResult.saved) {
              log(t('messages.rom.exportSuccess', { name: fileName }), 'success');
            } else {
              showToast(t('messages.operation.cancelled'), 'info');
              log(t('messages.operation.cancelled'), 'warn');
            }
          }
        } else {
          showToast(response.message, 'error');
        }
      });
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

      const currentCfiInfo = cfiInfo.value;
      const currentRomData = romFileData.value;
      const size = parseInt(selectedRomSize.value, 16);
      await withCommandBufferReset(adapter, async () => {
        const options = {
          baseAddress: parseInt(selectedBaseAddress.value, 16),
          cfiInfo: currentCfiInfo,
          size,
          mbcType: selectedMbcType.value,
          enable5V: mbcPower5V.value,
        };
        const response = await burnerUseCase.verifyRom({
          session: adapter,
          cfiInfo: currentCfiInfo,
          options,
          data: currentRomData,
          signal,
        });
        if (signal?.aborted) {
          return;
        }
        showToast(response.message, response.success ? 'success' : 'error');
      });
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

      const currentCfiInfo = cfiInfo.value;
      const size = parseInt(selectedRomSize.value, 16);
      const blankData = new Uint8Array(size).fill(fillByte);
      const fillLabel = fillByte === 0xFF ? '0xFF' : '0x00';
      log(t('messages.rom.verifyBlankStart', { size: formatBytes(size), fill: fillLabel }), 'info');

      await withCommandBufferReset(adapter, async () => {
        const options = {
          baseAddress: parseInt(selectedBaseAddress.value, 16),
          cfiInfo: currentCfiInfo,
          size,
          mbcType: selectedMbcType.value,
          enable5V: mbcPower5V.value,
        };
        const response = await burnerUseCase.verifyRom({
          session: adapter,
          cfiInfo: currentCfiInfo,
          options,
          data: blankData,
          signal,
        });
        if (signal?.aborted) {
          return;
        }
        showToast(response.message, response.success ? 'success' : 'error');
      });
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
      const currentCfiInfo = cfiInfo.value;
      const currentRamData = ramFileData.value;

      await withCommandBufferReset(adapter, async () => {
        const options = {
          ramType: selectedRamType.value as RamType,
          baseAddress: parseInt(selectedRamBaseAddress.value, 16),
          cfiInfo: currentCfiInfo,
          mbcType: selectedMbcType.value,
          enable5V: mbcPower5V.value,
        };
        const response = await burnerUseCase.writeRam({
          session: adapter,
          cfiInfo: currentCfiInfo,
          options,
          data: currentRamData,
        });
        showToast(response.message, response.success ? 'success' : 'error');
        if (response.success) {
          log(t('messages.ram.writeSuccess'), 'success');
        } else {
          log(t('messages.ram.writeFailed'), 'error');
        }
      });
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
      const currentCfiInfo = cfiInfo.value;

      const defaultSize = ramFileData.value ? ramFileData.value.length : parseInt(selectedRamSize.value, 16);
      await withCommandBufferReset(adapter, async () => {
        const options = {
          ramType: selectedRamType.value as RamType,
          baseAddress: parseInt(selectedRamBaseAddress.value, 16),
          cfiInfo: currentCfiInfo,
          mbcType: selectedMbcType.value,
          enable5V: mbcPower5V.value,
        };
        const response = await burnerUseCase.readRam({
          session: adapter,
          cfiInfo: currentCfiInfo,
          options,
          size: defaultSize,
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
              const saveResult = await saveAsFile(response.data, defaultFileName);
              if (saveResult.saved) {
                log(t('messages.ram.exportSuccess', { name: defaultFileName }), 'success');
              } else {
                showToast(t('messages.operation.cancelled'), 'info');
                log(t('messages.operation.cancelled'), 'warn');
              }
            }
          }
        } else {
          showToast(response.message, 'error');
        }
      });
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
      const currentCfiInfo = cfiInfo.value;
      const currentRamData = ramFileData.value;

      const size = parseInt(selectedRamSize.value, 16);
      await withCommandBufferReset(adapter, async () => {
        const options = {
          ramType: selectedRamType.value as RamType,
          baseAddress: parseInt(selectedRamBaseAddress.value, 16),
          cfiInfo: currentCfiInfo,
          size,
          mbcType: selectedMbcType.value,
          enable5V: mbcPower5V.value,
        };
        const response = await burnerUseCase.verifyRam({
          session: adapter,
          cfiInfo: currentCfiInfo,
          options,
          data: currentRamData,
        });
        showToast(response.message, response.success ? 'success' : 'error');
      });
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
      const currentCfiInfo = cfiInfo.value;

      const size = parseInt(selectedRamSize.value, 16);
      const blankData = new Uint8Array(size).fill(fillByte);
      const fillLabel = fillByte === 0xFF ? '0xFF' : '0x00';
      log(t('messages.ram.verifyBlankStart', { size: formatBytes(size), fill: fillLabel }), 'info');

      await withCommandBufferReset(adapter, async () => {
        const options = {
          ramType: selectedRamType.value as RamType,
          baseAddress: parseInt(selectedRamBaseAddress.value, 16),
          cfiInfo: currentCfiInfo,
          size,
          mbcType: selectedMbcType.value,
          enable5V: mbcPower5V.value,
        };
        const response = await burnerUseCase.verifyRam({
          session: adapter,
          cfiInfo: currentCfiInfo,
          options,
          data: blankData,
        });
        showToast(response.message, response.success ? 'success' : 'error');
      });
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
  resetSelectedFiles();

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

function onPreviewSaveCheckpoint(payload: GbaPreviewSavePayload) {
  if (activePreviewSessionId.value !== payload.launch.sessionId) return;
  latestPreviewCheckpoint.value = { ...payload, data: new Uint8Array(payload.data) };
}

function onPreviewSaveResult(payload: GbaPreviewSavePayload) {
  const result = applyPreviewSaveResult(payload, busy.value);
  endPreviewSession(payload.launch.sessionId);
  if (latestPreviewCheckpoint.value?.launch.sessionId === payload.launch.sessionId) {
    latestPreviewCheckpoint.value = null;
  }
  if (result === 'retained') {
    showToast(t('messages.emulator.pendingSaveRecovery', { rom: payload.launch.romName, save: payload.launch.saveName ?? defaultSaveName(payload.launch.romName) }), 'info');
  }
}

function defaultSaveName(romName: string) {
  return `${romName.replace(/\.[^.]*$/, '')}.sav`;
}

function onPreviewSessionStarted(launch: { sessionId: string }) {
  latestPreviewCheckpoint.value = null;
  activatePreviewSession(launch.sessionId);
}

function onPreviewSessionEnded(sessionId: string) {
  endPreviewSession(sessionId);
  if (latestPreviewCheckpoint.value?.launch.sessionId === sessionId) {
    latestPreviewCheckpoint.value = null;
  }
}

async function exportPendingPreviewResult() {
  const result = pendingPreviewResult.value;
  if (!result) return;
  const name = result.launch.saveName ?? defaultSaveName(result.launch.romName);
  try {
    const outcome = await saveAsFile(new Uint8Array(result.data), name);
    if (outcome.saved) {
      showToast(isTauriRuntime()
        ? t('ui.ram.exportSaved', { name: outcome.path ?? name })
        : t('ui.ram.exportStarted', { name }), 'success');
      if (pendingPreviewResult.value === result) discardPendingPreviewResult();
    } else {
      showToast(t('messages.operation.cancelled'), 'info');
    }
  } catch (error) {
    showToast(`${t('messages.ram.exportFailed')}: ${error instanceof Error ? error.message : String(error)}`, 'error');
  }
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
      const currentCfiInfo = cfiInfo.value;

      log(t('ui.operation.startReadingMultiCart'));

      await withCommandBufferReset(adapter, async () => {
        const gameResults = await burnerUseCase.scanMultiCart(
          adapter,
          mode.value,
          currentCfiInfo,
          selectedMbcType.value,
          mbcPower5V.value,
        );

        printGameDetectionResults(gameResults);

        showToast(t('ui.operation.readMultiCartSuccess'), 'success');
        log(t('ui.operation.readMultiCartSuccess'), 'success');

        // 显示多合一结果弹窗
        multiCartResults.value = gameResults;
        showMultiCartResultModal.value = true;
      });
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

/**
 * 把连接报告写入右侧日志区。
 *
 * 设备/固件、端口匹配结果与失败阶段提示都在 {@link buildConnectionLogReport} 里成形，
 * 本组件只负责把它们逐条渲染进日志面板，避免 UI 再解析一遍协议细节。
 */
function logConnectionEntries(entries: readonly ConnectionLogEntry[]) {
  for (const entry of entries) {
    const payload: { message: string; details?: string; error?: string } = { message: entry.message };
    if (entry.details) {
      payload.details = entry.details;
    }
    if (entry.error) {
      payload.error = entry.error;
    }
    log(payload, entry.level);
  }
}

// 暴露方法供父组件调用
defineExpose({
  logConnectionEntries,
  resetState,
});
</script>

<style scoped>
.flashburner-container {
  --burner-max-width: 100%;
  --burner-column-gap: var(--space-4);
  width: 100%;
  max-width: var(--burner-max-width);
  margin: 0;
  padding: 0;
  background: transparent;
  color: var(--retro-ink);
  box-sizing: border-box;
  container-type: inline-size;
  container-name: burner;
}

.mode-tabs-bar {
  display: flex;
  align-items: center;
  margin-bottom: var(--space-3);
}

.preview-save-recovery {
  margin-bottom: var(--space-4);
}

.preview-save-recovery p {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--font-size-xs);
}

.preview-recovery-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

/* 主布局默认单列，避免可用宽度不足时压坏左侧操作区 */
.main-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--burner-column-gap);
  height: auto;
  align-items: stretch;
  width: 100%;
  min-width: 0;
}

/* 内容区域 */
.content-area {
  width: 100%;
  min-width: 0;
  max-width: none;
  display: flex;
  flex-direction: column;
  overflow: visible;
  box-sizing: border-box;
}

/* 操作容器 */
.operations-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  position: relative;
  min-width: 0;
  padding: 0 0 6px 4px;
}

.log-panel {
  min-width: 0;
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

/* 可用内容宽度足够时，先切换到左侧 520px 保底的双列布局 */
@container burner (min-width: 860px) {
  .main-layout {
    grid-template-columns: 520px minmax(0, 1fr);
    gap: var(--burner-column-gap);
    align-items: stretch;
  }

  .log-panel {
    position: relative;
    min-height: 520px;
  }

  .log-panel :deep(.log-section) {
    position: absolute;
    inset: 0;
    height: 100%;
  }
}

/* 当两列都能保持至少 520px 时，再切换到严格等宽 */
@container burner (min-width: 1064px) {
  .main-layout {
    grid-template-columns: minmax(520px, 1fr) minmax(520px, 1fr);
    gap: var(--burner-column-gap);
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
  font-size: var(--font-size-base);
}
</style>
