<template>
  <EmulatorLaunchTransition
    :is-visible="isVisible"
    @close="closeEmulator"
    @covered="onTransitionCovered"
  >
    <div class="emulator-header">
      <h3 class="emulator-title">
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
        aspect-ratio="240 / 160"
      >
        <canvas
          ref="gameCanvas"
          class="game-canvas"
          :class="{ 'is-ready': isScreenReady }"
          width="240"
          height="160"
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
          <span class="key-mapping">{{ $t('ui.emulator.l') }}: Shift左</span>
          <span class="key-mapping">{{ $t('ui.emulator.r') }}: L</span>
        </div>
      </div>
    </div>
  </EmulatorLaunchTransition>
</template>

<script setup lang="ts">
import { Wrapper } from 'gbats';
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import EmulatorLaunchTransition from '@/components/emulator/EmulatorLaunchTransition.vue';
import EmulatorScreenViewport from '@/components/emulator/EmulatorScreenViewport.vue';
import { attachSettledSaveListener, captureGbaSave, copyBytes, type GbaSaveCore, importGbaSave, inspectGbaSave, isGbaSaveSettled, type SaveCheckpoint } from '@/components/emulator/gba-save-bridge';
import { applyGbatsArmCompatibility } from '@/components/emulator/gbats-arm-compat';
import type { GbaPreviewLaunch } from '@/components/operaiton/contracts';
import { RetroButton, RetroIcon } from '@/components/retro';
import { useToast } from '@/composables/useToast';
import type { GbaPreviewSavePayload } from '@/features/gba-save/types';
import { saveBinaryFile } from '@/platform/native';
import { isTauriRuntime } from '@/platform/runtime';

const { t } = useI18n();
const { showToast } = useToast();

const props = defineProps<{
  isVisible: boolean;
  romData: Uint8Array | null;
  romName: string;
  launch?: GbaPreviewLaunch | null;
}>();

const emit = defineEmits<{
  close: [sessionId?: string];
  'save-checkpoint': [payload: GbaPreviewSavePayload];
  'save-result': [payload: GbaPreviewSavePayload];
  'save-use-changed': [sessionId: string];
}>();

const gameCanvas = useTemplateRef<HTMLCanvasElement>('gameCanvas');
const gba = shallowRef<Wrapper | null>(null);
const heldInputs = new Map<string, number>();
const isPaused = ref(false);
const hasError = ref(false);
const errorMessage = ref('');
const crashCount = ref(0);
const isInitializing = ref(false);
const latestCheckpoint = ref<SaveCheckpoint | null>(null);
const skipSelectedSave = ref(false);
const isCovered = ref(false);
const isScreenReady = computed(
  () => isCovered.value && Boolean(gba.value) && !isInitializing.value && !hasError.value,
);

function onTransitionCovered(covered: boolean) {
  isCovered.value = covered;
}

let bridgeDisposer: (() => void) | null = null;
let coreGeneration = 0;
let importedCapacity: number | undefined;
let initialBytes: Uint8Array | null = null;
let closing = false;
let sessionOverride: Uint8Array | null = null;
let resultDelivered = false;
let activeSaveLaunch: GbaPreviewSavePayload['launch'] | null = null;
const exportInProgress = ref(false);
let unmounted = false;

interface GbaAudio {
  context: AudioContext | null;
  jsAudio?: GbaAudioProcessor;
  buffers?: [Float32Array, Float32Array];
  sampleRate: number;
  resampleRatio: number;
  bufferSize: number;
  maxSamples: number;
  sampleMask: number;
  enabled?: boolean;
  pause: (paused: boolean) => void;
  audioProcess: (event: GbaAudioEvent) => void;
}

interface GbaAudioEvent {
  outputBuffer: {
    getChannelData: (channel: number) => Float32Array;
  };
}

interface GbaAudioProcessor {
  connect: (destination: AudioNode) => void;
  disconnect: () => void;
  port?: MessagePort;
}

const GBA_AUDIO_WORKLET = `
class GbaAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.offset = 0;
    this.port.onmessage = ({ data }) => {
      if (data?.left && data?.right) {
        this.queue.push(data);
      }
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    const left = output[0];
    const right = output[1] || left;

    for (let index = 0; index < left.length; index += 1) {
      const packet = this.queue[0];
      if (!packet || this.offset >= packet.left.length) {
        left[index] = 0;
        right[index] = 0;
        continue;
      }

      left[index] = packet.left[this.offset];
      right[index] = packet.right[this.offset];
      this.offset += 1;

      if (this.offset >= packet.left.length) {
        this.queue.shift();
        this.offset = 0;
      }
    }

    return true;
  }
}

registerProcessor('gba-audio-processor', GbaAudioProcessor);
`;

let audioPumpTimer: ReturnType<typeof setInterval> | null = null;
let audioSetupToken = 0;
let exportToken = 0;

const keyBindings: Record<string, number> = {
  'KeyW': 6, // UP
  'KeyS': 7, // DOWN
  'KeyA': 5, // LEFT
  'KeyD': 4, // RIGHT
  'KeyJ': 0, // A
  'KeyK': 1, // B
  'KeyC': 3, // START
  'KeyV': 2, // SELECT
  'ShiftLeft': 9, // L
  'KeyL': 8, // R
};

onMounted(() => {
  if (props.isVisible && props.romData) {
    initializeEmulator();
  }
});

onUnmounted(() => {
  cleanup(true);
});

watch(() => props.isVisible, async (newVisible) => {
  if (newVisible && props.romData) {
    let attempts = 0;
    while (!gameCanvas.value && attempts < 5) {
      await nextTick();
      attempts++;
    }
    initializeEmulator();
  } else if (!newVisible) {
    cleanup();
  }
});

watch(() => [props.romData, props.launch?.sessionId] as const, async ([newRomData], [oldRomData, oldSessionId]) => {
  if (newRomData !== oldRomData || props.launch?.sessionId !== oldSessionId) {
    finishSessionBeforeReplacement();
  }
  if (newRomData && props.isVisible) {
    await nextTick();
    if (!gameCanvas.value) {
      await nextTick();
    }
    initializeEmulator();
  }
});

function initializeEmulator() {
  if (isInitializing.value) {
    console.warn('Emulator is already initializing');
    return;
  }

  try {
    if (!gba.value) resultDelivered = false;
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
    isInitializing.value = true;
    hasError.value = false;
    errorMessage.value = '';

    if (!gameCanvas.value) {
      throw new Error(t('ui.emulator.errors.canvasNotAvailable'));
    }

    if (!props.romData) {
      throw new Error(t('ui.emulator.errors.romDataNotProvided'));
    }

    const inputRom = props.launch?.romData ?? props.romData;
    if (!inputRom || inputRom.length < 1024) {
      throw new Error(t('ui.emulator.errors.romTooSmall'));
    }

    disposeCore();

    // 检查浏览器兼容性
    if (!window.WebAssembly) {
      throw new Error(t('ui.emulator.errors.webAssemblyNotSupported'));
    }

    const ownedRom = copyBytes(inputRom);
    gba.value = new Wrapper({
      rom: ownedRom.buffer as ArrayBuffer,
      canvas: gameCanvas.value,
    });

    if (!gba.value) {
      throw new Error(t('ui.emulator.errors.createInstanceFailed'));
    }

    // Wrapper starts scheduling from its constructor; pause it synchronously
    // before applying core compatibility or preparing any save data.
    gba.value.emulator.pause();
    applyGbatsArmCompatibility(gba.value.emulator);
    const core = gba.value.emulator as unknown as GbaSaveCore;
    const descriptor = inspectGbaSave(core);
    const selectedSave = sessionOverride ?? (skipSelectedSave.value ? null : props.launch?.saveData ?? null);
    if (selectedSave) {
      if (!descriptor) throw new Error(t('ui.emulator.errors.unknownSaveType'));
      const imported = importGbaSave(core, selectedSave);
      importedCapacity = imported.descriptor.capacity;
      initialBytes ??= copyBytes(imported.baseline ?? imported.data);
      rememberSaveCheckpoint(imported);
    } else if (descriptor && !initialBytes) {
      try {
        const initial = captureGbaSave(core);
        initialBytes = copyBytes(initial.baseline ?? initial.data);
        rememberSaveCheckpoint(initial);
      } catch {
        // EEPROM capacity is unknown until the game's first DMA access.
      }
    }

    const generation = ++coreGeneration;
    bridgeDisposer = descriptor ? attachSettledSaveListener(
      core,
      () => generation === coreGeneration,
      () => importedCapacity,
      checkpoint => {
        rememberSaveCheckpoint(checkpoint);
        const baseline = initialBytes;
        const changed = baseline ? !bytesEqual(checkpoint.data, baseline) : checkpoint.data.some(byte => byte !== 0);
        emitSavePayload('save-checkpoint', checkpoint.data, checkpoint.descriptor.capacity, changed);
      },
      error => {
        releaseHeldInputs();
        gba.value?.emulator.pause();
        isPaused.value = true;
        hasError.value = true;
        errorMessage.value = `${t('ui.emulator.errors.saveConflict')}: ${error.message}`;
        if (latestCheckpoint.value) {
          emitSavePayload('save-checkpoint', latestCheckpoint.value.data, latestCheckpoint.value.descriptor.capacity, initialBytes ? !bytesEqual(latestCheckpoint.value.data, initialBytes) : true);
        }
      },
    ) : null;

    // 设置错误处理器
    setupErrorHandling();

    // gbats 1.0.9 leaves its browser audio initialization disabled. Create
    // an AudioWorklet output so generated samples reach speakers.
    void setupAudio();

    // 设置图片格式
    gba.value.screenImageFormat = 'webp';

    // 绑定键盘事件
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleInputFocusLoss);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 重置错误计数
    crashCount.value = 0;

    if (!isPaused.value && !hasError.value) {
      gba.value.emulator.runStable();
    }

    showToast(t('ui.emulator.loaded'), 'success');
  } catch (error) {
    console.error('Failed to initialize GBA emulator:', error);

    crashCount.value++;
    hasError.value = true;
    disposeCore();

    if (error instanceof Error) {
      errorMessage.value = error.message;
    } else {
      errorMessage.value = t('ui.emulator.errors.unknownError');
    }

    // 如果多次崩溃，显示特殊错误信息
    if (crashCount.value > 1) {
      errorMessage.value = t('ui.emulator.errors.multipleInitFailures', { count: crashCount.value });
    }

    showToast(t('ui.emulator.loadFailed'), 'error');
  } finally {
    isInitializing.value = false;
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

function rememberSaveCheckpoint(checkpoint: SaveCheckpoint) {
  if (checkpoint.baseline) {
    if (!initialBytes) {
      initialBytes = copyBytes(checkpoint.baseline);
    } else if (checkpoint.baseline.byteLength > initialBytes.byteLength) {
      const expandedBaseline = new Uint8Array(checkpoint.baseline.byteLength);
      expandedBaseline.set(initialBytes);
      expandedBaseline.set(checkpoint.baseline.subarray(initialBytes.byteLength), initialBytes.byteLength);
      initialBytes = expandedBaseline;
    }
  }
  latestCheckpoint.value = { descriptor: checkpoint.descriptor, data: copyBytes(checkpoint.data) };
}

function setupErrorHandling() {
  const wrapper = gba.value;
  if (!wrapper) return;
  const core = wrapper.emulator;

  try {
    core.setLogger((level: number, error: string) => {
      if (gba.value !== wrapper || wrapper.emulator !== core) return;

      if (level > 0 && (level & core.LOG_ERROR) !== 0) {
        handleEmulatorError(level, error);
      } else if (level > 0 && (level & core.LOG_WARN) !== 0) {
        console.warn('GBA emulator warning:', error);
      } else {
        console.debug('GBA emulator log:', error);
      }
    });
  } catch (error) {
    console.warn('Could not set up error handling:', error);
  }
}

async function setupAudio() {
  if (!gba.value) return;

  const emulator = gba.value;
  const audio = emulator.emulator.audio as unknown as GbaAudio;
  const setupToken = ++audioSetupToken;
  const audioWindow = window as Window & {
    webkitAudioContext?: new () => unknown;
  };
  const AudioContextConstructor = globalThis.AudioContext ?? audioWindow.webkitAudioContext;

  if (!AudioContextConstructor) {
    console.warn('Web Audio API is not available; GBA audio is disabled');
    return;
  }

  let context: AudioContext | null = null;

  try {
    stopAudioPump();
    context = new AudioContextConstructor();
    if (!context.audioWorklet) {
      console.warn('AudioWorklet is not available; GBA audio is disabled');
      await context.close();
      return;
    }

    const moduleUrl = URL.createObjectURL(new Blob([GBA_AUDIO_WORKLET], {
      type: 'application/javascript',
    }));
    try {
      await context.audioWorklet.addModule(moduleUrl);
    } finally {
      URL.revokeObjectURL(moduleUrl);
    }

    if (setupToken !== audioSetupToken || gba.value !== emulator) {
      await context.close();
      return;
    }

    const bufferSize = 4096;
    const maxSamples = bufferSize << 2;
    const processor = new AudioWorkletNode(context, 'gba-audio-processor', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });

    audio.context = context;
    audio.bufferSize = bufferSize;
    audio.maxSamples = maxSamples;
    audio.sampleMask = maxSamples - 1;
    audio.buffers = [
      new Float32Array(maxSamples),
      new Float32Array(maxSamples),
    ];
    audio.resampleRatio = audio.sampleRate / context.sampleRate;
    audio.jsAudio = processor;

    // The emulator may already have enabled sound before the audio node was
    // installed. Reconnect it without changing the emulated state.
    audio.pause(false);
    startAudioPump(audio, processor, bufferSize, context.sampleRate);
    void context.resume().catch((error: unknown) => {
      console.warn('Could not resume GBA audio context:', error);
    });
  } catch (error: unknown) {
    console.warn('Could not initialize GBA audio:', error);
    if (context) {
      void context.close().catch(() => { /* ignore close errors */ });
    }
  }
}

function startAudioPump(
  audio: GbaAudio,
  processor: GbaAudioProcessor,
  bufferSize: number,
  sampleRate: number,
) {
  if (!processor.port) return;

  const pump = () => {
    if (!processor.port || !audio.buffers) return;

    const left = new Float32Array(bufferSize);
    const right = new Float32Array(bufferSize);
    audio.audioProcess({
      outputBuffer: {
        getChannelData: (channel: number) => channel === 0 ? left : right,
      },
    });
    processor.port.postMessage({ left, right }, [left.buffer, right.buffer]);
  };

  pump();
  audioPumpTimer = setInterval(pump, (bufferSize / sampleRate) * 1000);
}

function stopAudioPump() {
  if (audioPumpTimer) {
    clearInterval(audioPumpTimer);
    audioPumpTimer = null;
  }
}

function teardownAudio() {
  audioSetupToken += 1;
  stopAudioPump();

  const audio = gba.value?.emulator.audio as unknown as GbaAudio | undefined;
  const audioContext = audio?.context;
  audio?.jsAudio?.disconnect();
  if (audio) {
    audio.context = null;
    audio.jsAudio = undefined;
  }
  void audioContext?.close().catch(() => { /* ignore close errors */ });
}

function resumeAudio() {
  const audio = gba.value?.emulator.audio as unknown as GbaAudio | undefined;
  if (audio?.context?.state === 'suspended') {
    void audio.context.resume().catch((error: unknown) => {
      console.warn('Could not resume GBA audio context:', error);
    });
  }
}

function handleEmulatorError(level: number, error: string) {
  console.error('Emulator error:', error);
  releaseHeldInputs();

  if (gba.value) {
    gba.value?.emulator.pause();
  }

  crashCount.value++;
  hasError.value = true;
  errorMessage.value = t('ui.emulator.errors.emulatorCrashed', { error });

  if (crashCount.value > 2) {
    errorMessage.value = t('ui.emulator.errors.multipleCrashes');
    gba.value?.emulator.pause();
  }

  showToast(t('ui.emulator.errors.crashed'), 'error');
}

async function retryInitialization() {
  if (crashCount.value > 3) {
    showToast(t('ui.emulator.errors.tooManyRetries'), 'error');
    return;
  }

  sessionOverride = latestCheckpoint.value ? copyBytes(latestCheckpoint.value.data) : null;
  hasError.value = false;
  await nextTick();
  initializeEmulator();
}

async function startWithoutSelectedSave() {
  skipSelectedSave.value = true;
  sessionOverride = null;
  importedCapacity = undefined;
  initialBytes = null;
  latestCheckpoint.value = null;
  if (activeSaveLaunch) {
    activeSaveLaunch = { ...activeSaveLaunch, saveName: undefined, usesSelectedSave: false };
    emit('save-use-changed', activeSaveLaunch.sessionId);
  }
  hasError.value = false;
  await nextTick();
  initializeEmulator();
}

function handleKeyDown(event: KeyboardEvent) {
  const gamepadKey = keyBindings[event.code];
  if (gamepadKey === undefined) return;
  event.preventDefault();
  if (event.repeat || heldInputs.has(event.code) || !canAcceptGameInput()) return;

  try {
    const wrapper = gba.value;
    if (!wrapper) return;
    wrapper.emulator.keypad.currentDown &= ~(1 << gamepadKey);
    heldInputs.set(event.code, gamepadKey);
    resumeAudio();
  } catch (error) {
    console.error('Error pressing key:', error);
    handleEmulatorError(1, t('ui.emulator.errors.keyPressError', { error: error instanceof Error ? error.message : String(error) }));
  }
}

function handleKeyUp(event: KeyboardEvent) {
  const gamepadKey = keyBindings[event.code];
  if (gamepadKey === undefined) return;
  event.preventDefault();
  releaseHeldInput(event.code);
}

function canAcceptGameInput(): boolean {
  return props.isVisible && Boolean(gba.value) && !isInitializing.value && !isPaused.value
    && !gba.value?.emulator.paused && !hasError.value && !exportInProgress.value && !closing;
}

function releaseHeldInput(code: string) {
  const gamepadKey = heldInputs.get(code);
  if (gamepadKey === undefined) return;
  heldInputs.delete(code);

  if (![...heldInputs.values()].includes(gamepadKey)) {
    const keypad = gba.value?.emulator.keypad;
    if (keypad) keypad.currentDown |= 1 << gamepadKey;
  }
}

function releaseHeldInputs() {
  for (const gamepadKey of new Set(heldInputs.values())) {
    const keypad = gba.value?.emulator.keypad;
    if (keypad) keypad.currentDown |= 1 << gamepadKey;
  }
  heldInputs.clear();
}

function handleInputFocusLoss() {
  releaseHeldInputs();
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') releaseHeldInputs();
}

function togglePause() {
  if (exportInProgress.value) return;
  if (!gba.value || hasError.value) return;

  try {
    if (isPaused.value) {
      // 恢复运行
      resumeAudio();
      gba.value.emulator.runStable();
      isPaused.value = false;
      showToast(t('ui.emulator.resumed'), 'success');
    } else {
      // 暂停
      releaseHeldInputs();
      gba.value.emulator.pause();
      isPaused.value = true;
      showToast(t('ui.emulator.paused'), 'success');
    }
  } catch (e) {
    console.error('Error toggling pause:', e);
    handleEmulatorError(1, t('ui.emulator.errors.pauseResumeError', { error: e instanceof Error ? e.message : String(e) }));
  }
}

function resetGame() {
  if (!gba.value) return;
  if (exportInProgress.value) return;

  try {
    const restorePaused = isPaused.value;
    releaseHeldInputs();
    gba.value.emulator.pause();
    try {
      const checkpoint = captureGbaSave(gba.value.emulator, importedCapacity);
      rememberSaveCheckpoint(checkpoint);
    } catch {
      // A pending protocol command cannot replace the last valid checkpoint.
    }
    sessionOverride = latestCheckpoint.value ? copyBytes(latestCheckpoint.value.data) : null;
    disposeCore();
    hasError.value = false;
    errorMessage.value = '';
    isPaused.value = restorePaused;
    initializeEmulator();
    showToast(t('ui.emulator.reset'), 'success');
  } catch (e) {
    console.error('Failed to reset game:', e);
    handleEmulatorError(1, t('ui.emulator.errors.resetError', { error: e instanceof Error ? e.message : String(e) }));
    showToast(t('ui.emulator.resetFailed'), 'error');
  }
}

async function closeEmulator() {
  if (closing) return;
  if (exportInProgress.value) return;
  closing = true;
  releaseHeldInputs();
  const closingCore = gba.value?.emulator as unknown as GbaSaveCore | undefined;
  const closingGeneration = coreGeneration;
  const wasRunning = Boolean(gba.value && !isPaused.value && !hasError.value);
  if (closingCore && wasRunning) {
    const deadline = Date.now() + 500;
    while (Date.now() < deadline && coreGeneration === closingGeneration
      && gba.value?.emulator === closingCore && !coreIsSettled()) {
      await new Promise(resolve => setTimeout(resolve, 16));
    }
  }

  if (unmounted || coreGeneration !== closingGeneration) {
    closing = false;
    return;
  }

  const core = gba.value?.emulator as unknown as GbaSaveCore | undefined;
  let checkpoint = latestCheckpoint.value;
  let reason: string | undefined;
  if (core && !hasError.value) {
    core.pause();
    try {
      const captured = captureGbaSave(core, importedCapacity);
      rememberSaveCheckpoint(captured);
      checkpoint = latestCheckpoint.value;
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
      if (!isGbaSaveSettled(core)) {
        if (wasRunning) core.runStable();
        closing = false;
        showToast(t('ui.emulator.errors.savePendingClose'), 'info');
        return;
      }
      checkpoint = null;
    }
  } else if (hasError.value) {
    reason = t('ui.emulator.errors.lastCheckpointOnly');
  }

  if (checkpoint) {
    const changed = initialBytes ? !bytesEqual(checkpoint.data, initialBytes) : checkpoint.data.some(byte => byte !== 0);
    emitSavePayload('save-result', checkpoint.data, checkpoint.descriptor.capacity, changed, reason);
    resultDelivered = true;
  }
  disposeCore();
  emit('close', activeSaveLaunch?.sessionId);
  closing = false;
}

function coreIsSettled(): boolean {
  const core = gba.value?.emulator as unknown as GbaSaveCore | undefined;
  return !core || isGbaSaveSettled(core);
}

async function exportSave() {
  if (!latestCheckpoint.value || exportInProgress.value) return;
  exportInProgress.value = true;
  releaseHeldInputs();
  const exportingWrapper = gba.value;
  const exportingCore = exportingWrapper?.emulator;
  const exportingGeneration = coreGeneration;
  const currentExportToken = ++exportToken;
  const wasPaused = isPaused.value;
  exportingCore?.pause();
  try {
    const core = exportingCore as unknown as GbaSaveCore | undefined;
    if (core && isGbaSaveSettled(core)) {
      try {
        const stable = captureGbaSave(core, importedCapacity);
        rememberSaveCheckpoint(stable);
      } catch {
        // Unknown EEPROM capacity keeps the previous valid checkpoint usable.
      }
    } else if (core) {
      showToast(t('ui.emulator.errors.exportingLastCheckpoint'), 'info');
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
    if (gba.value === exportingWrapper && coreGeneration === exportingGeneration
      && exportingWrapper?.emulator === exportingCore) {
      if (!wasPaused && !hasError.value) exportingCore?.runStable();
    }
  }
}

function disposeCore() {
  coreGeneration += 1;
  releaseHeldInputs();
  bridgeDisposer?.();
  bridgeDisposer = null;
  // 移除键盘事件监听器
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('keyup', handleKeyUp);
  window.removeEventListener('blur', handleInputFocusLoss);
  document.removeEventListener('visibilitychange', handleVisibilityChange);

  // 停止模拟器
  if (gba.value) {
    try {
      // 先暂停，然后清理
      teardownAudio();
      gba.value.emulator.pause();

      // gbats Wrapper 会自动清理资源
      gba.value = null;
    } catch (error) {
      console.warn('Error stopping GBA emulator:', error);
    }
  }

  // 重置状态
}

function finishSessionBeforeReplacement() {
  const core = gba.value?.emulator as unknown as GbaSaveCore | undefined;
  if (core) {
    core.pause();
    if (isGbaSaveSettled(core)) {
      try {
        const stable = captureGbaSave(core, importedCapacity);
        rememberSaveCheckpoint(stable);
      } catch {
        // Keep the last valid checkpoint if metadata is unresolved.
      }
    }
  }
  if (latestCheckpoint.value && !resultDelivered) {
    const changed = initialBytes ? !bytesEqual(latestCheckpoint.value.data, initialBytes) : latestCheckpoint.value.data.some(byte => byte !== 0);
    emitSavePayload('save-result', latestCheckpoint.value.data, latestCheckpoint.value.descriptor.capacity, changed, t('ui.emulator.errors.lastCheckpointOnly'));
    resultDelivered = true;
  }
  disposeCore();
  initialBytes = null;
  latestCheckpoint.value = null;
  importedCapacity = undefined;
  sessionOverride = null;
  skipSelectedSave.value = false;
  resultDelivered = false;
  hasError.value = false;
  isPaused.value = false;
}

function cleanup(isFinalUnmount = false) {
  if (isFinalUnmount) unmounted = true;
  const core = gba.value?.emulator as unknown as GbaSaveCore | undefined;
  if (core) {
    core.pause();
    if (isGbaSaveSettled(core)) {
      try {
        const stable = captureGbaSave(core, importedCapacity);
        rememberSaveCheckpoint(stable);
      } catch {
        // Keep the last valid checkpoint if save metadata is unresolved.
      }
    }
  }
  if (gba.value && !resultDelivered && latestCheckpoint.value) {
    const changed = initialBytes ? !bytesEqual(latestCheckpoint.value.data, initialBytes) : latestCheckpoint.value.data.some(byte => byte !== 0);
    emitSavePayload('save-result', latestCheckpoint.value.data, latestCheckpoint.value.descriptor.capacity, changed, t('ui.emulator.errors.lastCheckpointOnly'));
    resultDelivered = true;
  }
  disposeCore();
  initialBytes = null;
  latestCheckpoint.value = null;
  importedCapacity = undefined;
  sessionOverride = null;
  skipSelectedSave.value = false;
  hasError.value = false;
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
  background: var(--retro-bg-elevated);
  color: var(--retro-ink);
  border-bottom: 1.5px solid var(--retro-border);
  padding: 10px spacing-vars.$space-4;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: spacing-vars.$space-3;
}

.emulator-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0;
  font-size: typography-vars.$font-size-lg;
  font-weight: typography-vars.$font-weight-semibold;
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-2;
}

.emulator-controls {
  display: flex;
  gap: spacing-vars.$space-2;
  flex-shrink: 0;
}

.emulator-content {
  background: var(--color-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: spacing-vars.$space-5;
  min-width: 0;
  overflow: auto;
  min-height: 200px;
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
  border: 2px solid var(--retro-border);
  border-radius: radius-vars.$radius-base;
  background: #000000;
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
  max-width: 100%;
  max-height: 100%;
  width: min(480px, 100%);
  height: auto;
  aspect-ratio: 240 / 160;
  /* GBA屏幕比例 240x160，放大到合适尺寸 */
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
  gap: 5px;
  justify-content: center;
  align-items: center;
}

.key-mapping {
  background: var(--retro-bg-surface);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--retro-font-micro);
  font-size: 10px;
  color: var(--retro-ink);
  border: 1px solid var(--retro-border-subtle);
  white-space: nowrap;
}
</style>
