<template>
  <EmulatorLaunchTransition
    :is-visible="isVisible"
    @close="closeEmulator"
    @covered="onTransitionCovered"
  >
    <div class="emulator-header">
      <h3 class="emulator-title">
        <RetroIcon
          icon="pixelarticons:gamepad"
          class="emulator-icon"
        />
        {{ $t('ui.emulator.title') }} - {{ romName }}
      </h3>
      <div class="emulator-controls">
        <RetroButton
          variant="secondary"
          size="sm"
          :disabled="exportInProgress"
          :icon="isPaused ? 'pixelarticons:play' : 'pixelarticons:pause'"
          icon-only
          :title="$t('ui.emulator.pause')"
          @click="togglePause"
        />
        <RetroButton
          variant="warning"
          size="sm"
          :disabled="exportInProgress"
          icon="pixelarticons:reload"
          icon-only
          :title="$t('ui.emulator.reset')"
          @click="resetGame"
        />
        <RetroButton
          variant="secondary"
          size="sm"
          :text="$t('ui.emulator.exportSave')"
          :disabled="!latestCheckpoint || exportInProgress"
          @click="exportSave"
        />
        <RetroButton
          variant="danger"
          size="sm"
          :disabled="exportInProgress"
          icon="pixelarticons:close"
          icon-only
          :title="$t('ui.emulator.close')"
          @click="closeEmulator"
        />
      </div>
    </div>

    <div class="emulator-content">
      <div
        v-if="hasError"
        class="error-display"
      >
        <div class="error-icon">
          <RetroIcon
            icon="pixelarticons:alert"
            class="error-icon"
          />
        </div>
        <h4>{{ $t('ui.emulator.errors.error') }}</h4>
        <p>{{ errorMessage }}</p>
        <RetroButton
          variant="primary"
          :text="$t('ui.emulator.retry')"
          @click="retryInitialization"
        />
        <RetroButton
          v-if="launch?.saveData && !skipSelectedSave"
          variant="secondary"
          :text="$t('ui.emulator.startWithoutSave')"
          @click="startWithoutSelectedSave"
        />
      </div>
      <EmulatorScreenViewport
        v-else
        :is-ready="isScreenReady"
        aspect-ratio="160 / 144"
      >
        <canvas
          ref="gameCanvas"
          class="game-canvas"
          :class="{ 'is-ready': isScreenReady }"
          width="160"
          height="144"
        />
      </EmulatorScreenViewport>
    </div>

    <div class="emulator-footer">
      <div class="controls-help">
        <p>{{ $t('ui.emulator.controlsHelp') }}</p>
        <div class="key-mappings">
          <span class="key-mapping">{{ $t('ui.emulator.dpad') }}: WASD</span>
          <span class="key-mapping">{{ $t('ui.emulator.aButton') }}: J</span>
          <span class="key-mapping">{{ $t('ui.emulator.bButton') }}: K</span>
          <span class="key-mapping">{{ $t('ui.emulator.start') }}: C</span>
          <span class="key-mapping">{{ $t('ui.emulator.select') }}: V</span>
        </div>
      </div>
    </div>
  </EmulatorLaunchTransition>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { BinjgbRunner, type JoypadButton, type JoypadState } from '@/components/emulator/binjgb/binjgb-runner';
import EmulatorLaunchTransition from '@/components/emulator/EmulatorLaunchTransition.vue';
import EmulatorScreenViewport from '@/components/emulator/EmulatorScreenViewport.vue';
import { captureGbSave, type GbSaveCheckpoint, importGbSave, inspectGbSave } from '@/components/emulator/gb-save-bridge';
import { copyBytes } from '@/components/emulator/gba-save-bridge';
import type { GbaPreviewLaunch } from '@/components/operaiton/contracts';
import { RetroButton, RetroIcon } from '@/components/retro';
import { useToast } from '@/composables/useToast';
import type { GbaPreviewSavePayload } from '@/features/gba-save/types';
import { saveBinaryFile } from '@/platform/native';
import { isTauriRuntime } from '@/platform/runtime';

const { t } = useI18n();
const { showToast } = useToast();

const props = defineProps<{
  romData: Uint8Array | null;
  romName: string;
  isVisible: boolean;
  launch?: GbaPreviewLaunch | null;
}>();

const emit = defineEmits<{
  close: [sessionId?: string];
  'save-checkpoint': [payload: GbaPreviewSavePayload];
  'save-result': [payload: GbaPreviewSavePayload];
  'save-use-changed': [sessionId: string];
}>();

const gameCanvas = useTemplateRef<HTMLCanvasElement>('gameCanvas');
const isPaused = ref(false);
const hasError = ref(false);
const errorMessage = ref('');
const isCovered = ref(false);
const isRunnerReady = ref(false);
const latestCheckpoint = ref<GbSaveCheckpoint | null>(null);
const skipSelectedSave = ref(false);
const exportInProgress = ref(false);
const isScreenReady = computed(() => isCovered.value && isRunnerReady.value && !hasError.value);

function onTransitionCovered(covered: boolean) {
  isCovered.value = covered;
}

let runnerInstance: BinjgbRunner | null = null;
let coreGeneration = 0;
let initialBytes: Uint8Array | null = null;
let sessionOverride: Uint8Array | null = null;
let resultDelivered = false;
let activeSaveLaunch: GbaPreviewSavePayload['launch'] | null = null;
let closing = false;
let unmounted = false;
let exportToken = 0;

const keyBindings: Record<string, JoypadButton> = {
  'KeyW': 'up',
  'KeyD': 'right',
  'KeyS': 'down',
  'KeyA': 'left',
  'KeyJ': 'a',
  'KeyK': 'b',
  'KeyV': 'select',
  'KeyC': 'start',
};

const joypadState: JoypadState = {
  up: false,
  right: false,
  down: false,
  left: false,
  a: false,
  b: false,
  select: false,
  start: false,
};

onMounted(async () => {
  if (props.isVisible && props.romData) {
    await initEmulator();
  }
});

onUnmounted(() => {
  cleanup(true);
});

// 监听可见性变化
watch(() => props.isVisible, async (newVal) => {
  if (newVal && props.romData) {
    let attempts = 0;
    while (!gameCanvas.value && attempts < 5) {
      await nextTick();
      attempts++;
    }
    await initEmulator();
  } else {
    cleanup();
  }
});

// 监听 ROM 数据 / 会话变化
watch(() => [props.romData, props.launch?.sessionId] as const, async ([newData], [oldData, oldSessionId]) => {
  if ((newData !== oldData || props.launch?.sessionId !== oldSessionId) && runnerInstance) {
    finishSessionBeforeReplacement();
  }
  if (props.isVisible && newData) {
    await nextTick();
    if (!gameCanvas.value) {
      await nextTick();
    }
    await initEmulator();
  }
});

async function initEmulator() {
  if (!gameCanvas.value || !props.romData) return;

  try {
    if (!runnerInstance) resultDelivered = false;
    if (props.launch && activeSaveLaunch?.sessionId !== props.launch.sessionId) {
      activeSaveLaunch = {
        sessionId: props.launch.sessionId,
        romName: props.launch.romName,
        romRevision: props.launch.romRevision,
        ramRevision: props.launch.ramRevision,
        saveName: props.launch.saveName,
        usesSelectedSave: props.launch.usesSelectedSave,
        ramWasEmptyAtLaunch: props.launch.ramWasEmptyAtLaunch,
      };
    }

    hasError.value = false;
    errorMessage.value = '';

    // 清理之前的实例
    disposeCore();

    const generation = ++coreGeneration;
    const inputRom = props.launch?.romData ?? props.romData;

    // 加载并初始化 binjgb 运行器
    try {
      runnerInstance = await BinjgbRunner.create({
        canvas: gameCanvas.value,
        romData: copyBytes(inputRom),
        onExtRamSettled: () => {
          if (generation !== coreGeneration || !runnerInstance) return;
          try {
            const checkpoint = captureGbSave(runnerInstance);
            rememberSaveCheckpoint(checkpoint);
            const baseline = initialBytes;
            const changed = baseline
              ? !bytesEqual(checkpoint.data, baseline)
              : checkpoint.data.some(byte => byte !== 0);
            emitSavePayload('save-checkpoint', checkpoint.data, checkpoint.descriptor.capacity, changed);
          } catch (error) {
            console.warn('Failed to capture GB save checkpoint:', error);
          }
        },
      });
    } catch (romError: unknown) {
      console.error('ROM loading failed:', romError);

      let msg = t('ui.emulator.errors.romLoadFailed');
      if (romError instanceof RangeError) {
        msg = t('ui.emulator.errors.invalidRom');
      } else if (romError instanceof Error && romError.message) {
        msg += `: ${romError.message}`;
      }

      hasError.value = true;
      errorMessage.value = msg;
      showToast(msg, 'error');
      return;
    }

    if (generation !== coreGeneration || unmounted) {
      runnerInstance.destroy();
      runnerInstance = null;
      return;
    }

    // 准备外部 RAM / 存档
    const descriptor = inspectGbSave(runnerInstance);
    const selectedSave = sessionOverride ?? (skipSelectedSave.value ? null : props.launch?.saveData ?? null);
    if (selectedSave) {
      if (!descriptor) {
        throw new Error(t('ui.emulator.errors.unknownSaveType'));
      }
      const imported = importGbSave(runnerInstance, selectedSave);
      initialBytes ??= copyBytes(imported.baseline ?? imported.data);
      rememberSaveCheckpoint(imported);
    } else if (descriptor && !initialBytes) {
      const initial = captureGbSave(runnerInstance);
      initialBytes = copyBytes(initial.baseline ?? initial.data);
      rememberSaveCheckpoint(initial);
    }

    // 设置 Canvas 为可聚焦
    if (gameCanvas.value) {
      gameCanvas.value.tabIndex = 0;
      gameCanvas.value.focus();
    }

    // 开始游戏
    try {
      if (!isPaused.value) {
        runnerInstance.play();
      }
      isRunnerReady.value = true;
    } catch (playError: unknown) {
      console.error('Failed to start game:', playError);
      hasError.value = true;
      errorMessage.value = t('ui.emulator.startGameFailed');
      showToast(t('ui.emulator.startGameFailed'), 'error');
      return;
    }

    // 设置键盘事件监听
    setupKeyboardControls();

    showToast(t('ui.emulator.initSuccess'), 'success');
  } catch (error: unknown) {
    console.error('Failed to initialize emulator:', error);
    disposeCore();
    const msg = error instanceof Error ? error.message : t('ui.emulator.errors.unknownError');
    hasError.value = true;
    errorMessage.value = msg;
    showToast(`${t('ui.emulator.errors.error')}: ${msg}`, 'error');
  }
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function emitSavePayload(
  event: 'save-checkpoint' | 'save-result',
  data: Uint8Array,
  capacity: number,
  changed: boolean,
  reason?: string,
) {
  if (!activeSaveLaunch) return;
  const payload: GbaPreviewSavePayload = {
    launch: { ...activeSaveLaunch },
    data: copyBytes(data),
    capacity,
    changed,
    ...(reason ? { reason } : {}),
  };
  if (event === 'save-checkpoint') emit('save-checkpoint', payload);
  else emit('save-result', payload);
}

function rememberSaveCheckpoint(checkpoint: GbSaveCheckpoint) {
  if (checkpoint.baseline && !initialBytes) {
    initialBytes = copyBytes(checkpoint.baseline);
  }
  latestCheckpoint.value = { descriptor: checkpoint.descriptor, data: copyBytes(checkpoint.data) };
}

async function retryInitialization() {
  sessionOverride = latestCheckpoint.value ? copyBytes(latestCheckpoint.value.data) : null;
  hasError.value = false;
  await nextTick();
  await initEmulator();
}

async function startWithoutSelectedSave() {
  skipSelectedSave.value = true;
  sessionOverride = null;
  initialBytes = null;
  latestCheckpoint.value = null;
  if (activeSaveLaunch) {
    activeSaveLaunch = { ...activeSaveLaunch, saveName: undefined, usesSelectedSave: false };
    emit('save-use-changed', activeSaveLaunch.sessionId);
  }
  hasError.value = false;
  await nextTick();
  await initEmulator();
}

function setupKeyboardControls() {
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
  window.addEventListener('blur', handleInputFocusLoss);
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

function canAcceptGameInput(): boolean {
  return props.isVisible && Boolean(runnerInstance) && !isPaused.value
    && !hasError.value && !exportInProgress.value && !closing;
}

function handleKeyDown(event: KeyboardEvent) {
  const key = keyBindings[event.code];
  if (!key) return;

  event.preventDefault();
  if (!canAcceptGameInput()) return;
  joypadState[key] = true;
  runnerInstance?.setJoypadButton(key, true);
}

function handleKeyUp(event: KeyboardEvent) {
  const key = keyBindings[event.code];
  if (!key) return;

  event.preventDefault();
  joypadState[key] = false;
  runnerInstance?.setJoypadButton(key, false);
}

function releaseHeldInputs() {
  (Object.keys(joypadState) as JoypadButton[]).forEach((key) => {
    joypadState[key] = false;
    runnerInstance?.setJoypadButton(key, false);
  });
}

function handleInputFocusLoss() {
  releaseHeldInputs();
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') releaseHeldInputs();
}

function togglePause() {
  if (!runnerInstance || exportInProgress.value || hasError.value) return;

  try {
    if (isPaused.value) {
      runnerInstance.play();
      isPaused.value = false;
      showToast(t('ui.emulator.running'), 'success');
    } else {
      releaseHeldInputs();
      runnerInstance.pause();
      isPaused.value = true;
      showToast(t('ui.emulator.paused'), 'success');
    }
  } catch (error: unknown) {
    console.error('Failed to toggle pause:', error);
    showToast(t('ui.emulator.operationFailed'), 'error');
  }
}

function resetGame() {
  if (!runnerInstance || exportInProgress.value) return;

  try {
    const restorePaused = isPaused.value;
    releaseHeldInputs();
    runnerInstance.pause();

    if (inspectGbSave(runnerInstance)) {
      try {
        const checkpoint = captureGbSave(runnerInstance);
        rememberSaveCheckpoint(checkpoint);
      } catch {
        // Keep the last valid checkpoint.
      }
    }

    runnerInstance.reset();

    if (latestCheckpoint.value && inspectGbSave(runnerInstance)) {
      const reimported = importGbSave(runnerInstance, latestCheckpoint.value.data);
      rememberSaveCheckpoint(reimported);
    }

    if (restorePaused) {
      runnerInstance.pause();
      isPaused.value = true;
      showToast(t('ui.emulator.reset') + ' - ' + t('ui.emulator.paused'), 'success');
    } else {
      runnerInstance.play();
      isPaused.value = false;
      showToast(t('ui.emulator.reset') + ' - ' + t('ui.emulator.running'), 'success');
    }
  } catch (error: unknown) {
    console.error('Failed to reset game:', error);
    showToast(t('ui.emulator.resetFailed'), 'error');
  }
}

async function exportSave() {
  if (!latestCheckpoint.value || exportInProgress.value) return;
  exportInProgress.value = true;
  releaseHeldInputs();
  const exportingRunner = runnerInstance;
  const exportingGeneration = coreGeneration;
  const currentExportToken = ++exportToken;
  const wasPaused = isPaused.value;
  exportingRunner?.pause();
  try {
    if (exportingRunner && inspectGbSave(exportingRunner)) {
      try {
        const stable = captureGbSave(exportingRunner);
        rememberSaveCheckpoint(stable);
      } catch {
        // Keep the last valid checkpoint.
      }
    }
    const filename = props.launch?.usesSelectedSave && props.launch.saveName
      ? props.launch.saveName
      : `${props.romName.replace(/\.[^.]*$/, '')}.sav`;
    const result = await saveBinaryFile(copyBytes(latestCheckpoint.value.data), filename);
    if (result.saved) {
      showToast(isTauriRuntime()
        ? t('ui.emulator.exportSaved', { name: result.path ?? filename })
        : t('ui.emulator.exportStarted', { name: filename }), 'success');
    } else {
      showToast(t('messages.operation.cancelled'), 'info');
    }
  } catch (error) {
    showToast(`${t('ui.emulator.errors.exportFailed')}: ${error instanceof Error ? error.message : String(error)}`, 'error');
  } finally {
    if (currentExportToken === exportToken) exportInProgress.value = false;
    if (runnerInstance === exportingRunner && coreGeneration === exportingGeneration
      && !wasPaused && !hasError.value) {
      exportingRunner?.play();
    }
  }
}

function closeEmulator() {
  if (closing || exportInProgress.value) return;
  closing = true;
  releaseHeldInputs();

  let checkpoint = latestCheckpoint.value;
  let reason: string | undefined;
  if (runnerInstance && !hasError.value && inspectGbSave(runnerInstance)) {
    runnerInstance.pause();
    try {
      const captured = captureGbSave(runnerInstance);
      rememberSaveCheckpoint(captured);
      checkpoint = latestCheckpoint.value;
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
    }
  } else if (hasError.value) {
    reason = t('ui.emulator.errors.lastCheckpointOnly');
  }

  if (checkpoint && !resultDelivered) {
    const changed = initialBytes
      ? !bytesEqual(checkpoint.data, initialBytes)
      : checkpoint.data.some(byte => byte !== 0);
    emitSavePayload('save-result', checkpoint.data, checkpoint.descriptor.capacity, changed, reason);
    resultDelivered = true;
  }

  disposeCore();
  isPaused.value = false;
  isCovered.value = false;
  emit('close', activeSaveLaunch?.sessionId);
  closing = false;
}

function disposeCore() {
  coreGeneration += 1;
  releaseHeldInputs();
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('keyup', handleKeyUp);
  window.removeEventListener('blur', handleInputFocusLoss);
  document.removeEventListener('visibilitychange', handleVisibilityChange);

  if (runnerInstance) {
    try {
      runnerInstance.destroy();
    } catch (error: unknown) {
      console.error('Error during cleanup:', error);
    }
    runnerInstance = null;
  }
  isRunnerReady.value = false;
}

function finishSessionBeforeReplacement() {
  if (runnerInstance && inspectGbSave(runnerInstance)) {
    runnerInstance.pause();
    try {
      const stable = captureGbSave(runnerInstance);
      rememberSaveCheckpoint(stable);
    } catch {
      // Keep the last valid checkpoint.
    }
  }
  if (latestCheckpoint.value && !resultDelivered) {
    const changed = initialBytes
      ? !bytesEqual(latestCheckpoint.value.data, initialBytes)
      : latestCheckpoint.value.data.some(byte => byte !== 0);
    emitSavePayload(
      'save-result',
      latestCheckpoint.value.data,
      latestCheckpoint.value.descriptor.capacity,
      changed,
      t('ui.emulator.errors.lastCheckpointOnly'),
    );
    resultDelivered = true;
  }
  disposeCore();
  initialBytes = null;
  latestCheckpoint.value = null;
  sessionOverride = null;
  skipSelectedSave.value = false;
  resultDelivered = false;
  hasError.value = false;
  isPaused.value = false;
}

function cleanup(isFinalUnmount = false) {
  if (isFinalUnmount) unmounted = true;
  if (runnerInstance && inspectGbSave(runnerInstance)) {
    runnerInstance.pause();
    try {
      const stable = captureGbSave(runnerInstance);
      rememberSaveCheckpoint(stable);
    } catch {
      // Keep the last valid checkpoint.
    }
  }
  if (runnerInstance && !resultDelivered && latestCheckpoint.value) {
    const changed = initialBytes
      ? !bytesEqual(latestCheckpoint.value.data, initialBytes)
      : latestCheckpoint.value.data.some(byte => byte !== 0);
    emitSavePayload(
      'save-result',
      latestCheckpoint.value.data,
      latestCheckpoint.value.descriptor.capacity,
      changed,
      t('ui.emulator.errors.lastCheckpointOnly'),
    );
    resultDelivered = true;
  }
  disposeCore();
  isPaused.value = false;
  isCovered.value = false;
}
</script>

<style lang="scss" scoped>
@use '@/styles/variables/spacing' as spacing-vars;
@use '@/styles/variables/typography' as typography-vars;
@use '@/styles/variables/radius' as radius-vars;
@use '@/styles/mixins' as mixins;

.emulator-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: spacing-vars.$space-3;
  padding: 10px spacing-vars.$space-4;
  background: var(--retro-bg-elevated);
  border-bottom: 1.5px solid var(--retro-border);
  color: var(--retro-ink);
}

.emulator-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-2;
  margin: 0;
  font-size: typography-vars.$font-size-lg;
  font-weight: typography-vars.$font-weight-semibold;
}

.emulator-icon {
  font-size: typography-vars.$font-size-xl;
}

.emulator-controls {
  display: flex;
  gap: spacing-vars.$space-2;
  flex-shrink: 0;
}

.emulator-content {
  min-width: 0;
  overflow: auto;
  display: flex;
  justify-content: center;
  padding: spacing-vars.$space-5;
  align-items: center;
}

.error-display {
  text-align: center;
  padding: spacing-vars.$space-10 spacing-vars.$space-5;
  color: var(--color-error);

  h4 {
    margin: 0 0 spacing-vars.$space-3 0;
    font-size: typography-vars.$font-size-xl;
    color: var(--color-error);
  }

  p {
    margin: 0 0 spacing-vars.$space-5 0;
    color: var(--color-text-secondary);
    line-height: typography-vars.$line-height-normal;
    max-width: 400px;
  }
}

.error-icon {
  font-size: typography-vars.$font-size-5xl;
  margin-bottom: spacing-vars.$space-4;
}

.game-canvas {
  border: 2px solid var(--color-border-light);
  border-radius: radius-vars.$radius-lg;
  background: var(--color-bg-inverse);
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
  /* 放大显示，保持像素完美 */
  width: min(480px, 100%);
  height: auto;
  aspect-ratio: 160 / 144;
  opacity: 0;
  transition: opacity 250ms cubic-bezier(0.33, 1, 0.68, 1);

  &.is-ready {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .game-canvas {
    transition: none !important;
    opacity: 1 !important;
  }
}

.emulator-footer {
  background: var(--retro-bg-elevated);
  color: var(--retro-ink);
  padding: spacing-vars.$space-3 spacing-vars.$space-4;
  border-top: 1px solid var(--retro-divider);
}

.controls-help {
  text-align: center;

  p {
    margin: 0 0 spacing-vars.$space-2 0;
    font-size: typography-vars.$font-size-xs;
    color: var(--retro-ink-muted);
  }
}

.key-mappings {
  display: flex;
  flex-wrap: wrap;
  gap: spacing-vars.$space-2;
  justify-content: center;
  align-items: center;
}

.key-mapping {
  background: var(--retro-bg-surface);
  padding: 2px 7px;
  border-radius: 4px;
  font-family: var(--retro-font-micro);
  font-size: 10px;
  color: var(--retro-ink);
  border: 1px solid var(--retro-border-subtle);
  white-space: nowrap;
}
</style>
