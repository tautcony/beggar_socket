<template>
  <div
    v-if="isVisible"
    class="emulator-overlay"
    @click.self="closeEmulator"
  >
    <div class="emulator-container">
      <div class="emulator-header">
        <h3 class="emulator-title">
          {{ $t('ui.emulator.title') }} - {{ romName }}
        </h3>
        <div class="emulator-controls">
          <BaseButton
            variant="secondary"
            size="sm"
            :icon="isPaused ? play : pause"
            icon-only
            :title="$t('ui.emulator.pause')"
            @click="togglePause"
          />
          <BaseButton
            variant="warning"
            size="sm"
            :icon="refresh"
            icon-only
            :title="$t('ui.emulator.reset')"
            @click="resetGame"
          />
          <BaseButton
            variant="error"
            size="sm"
            :icon="close"
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
            <IonIcon
              :icon="warning"
              class="error-icon"
            />
          </div>
          <h4>{{ $t('ui.emulator.errors.error') }}</h4>
          <p>{{ errorMessage }}</p>
          <BaseButton
            variant="primary"
            :text="$t('ui.emulator.retry')"
            @click="retryInitialization"
          />
        </div>
        <canvas
          v-else
          ref="gameCanvas"
          class="game-canvas"
          width="240"
          height="160"
        />
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { Wrapper } from 'gbats';
import { close, pause, play, refresh, warning } from 'ionicons/icons';
import { nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseButton from '@/components/common/BaseButton.vue';
import { useToast } from '@/composables/useToast';

const { t } = useI18n();
const { showToast } = useToast();

const props = defineProps<{
  isVisible: boolean;
  romData: Uint8Array | null;
  romName: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const gameCanvas = useTemplateRef<HTMLCanvasElement>('gameCanvas');
const gba = ref<Wrapper | null>(null);
const isPaused = ref(false);
const hasError = ref(false);
const errorMessage = ref('');
const crashCount = ref(0);
const isInitializing = ref(false);

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
  cleanup();
});

watch(() => props.isVisible, async (newVisible) => {
  if (newVisible && props.romData) {
    await nextTick();
    initializeEmulator();
  } else if (!newVisible) {
    cleanup();
  }
});

watch(() => props.romData, async (newRomData) => {
  if (newRomData && props.isVisible) {
    await nextTick();
    initializeEmulator();
  }
});

function initializeEmulator() {
  if (isInitializing.value) {
    console.warn('Emulator is already initializing');
    return;
  }

  try {
    isInitializing.value = true;
    hasError.value = false;
    errorMessage.value = '';

    if (!gameCanvas.value) {
      throw new Error(t('ui.emulator.errors.canvasNotAvailable'));
    }

    if (!props.romData) {
      throw new Error(t('ui.emulator.errors.romDataNotProvided'));
    }

    // 检查ROM数据有效性
    if (props.romData.length < 1024) {
      throw new Error(t('ui.emulator.errors.romTooSmall'));
    }

    cleanup();

    // 检查浏览器兼容性
    if (!window.WebAssembly) {
      throw new Error(t('ui.emulator.errors.webAssemblyNotSupported'));
    }

    // 根据官方例子初始化 gbats Wrapper
    gba.value = new Wrapper({
      rom: props.romData.buffer as ArrayBuffer,
      canvas: gameCanvas.value,
    });

    if (!gba.value) {
      throw new Error(t('ui.emulator.errors.createInstanceFailed'));
    }

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

    // 重置错误计数
    crashCount.value = 0;

    showToast(t('ui.emulator.loaded'), 'success');
  } catch (error) {
    console.error('Failed to initialize GBA emulator:', error);

    crashCount.value++;
    hasError.value = true;

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

function setupErrorHandling() {
  if (!gba.value) return;

  try {
    gba.value.emulator.setLogger((level: number, error: string) => {
      handleEmulatorError(level, error);
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

function retryInitialization() {
  if (crashCount.value > 3) {
    showToast(t('ui.emulator.errors.tooManyRetries'), 'error');
    return;
  }

  initializeEmulator();
}

function handleKeyDown(event: KeyboardEvent) {
  if (!gba.value || hasError.value) return;

  resumeAudio();

  const gamepadKey = keyBindings[event.code];
  if (gamepadKey !== undefined) {
    event.preventDefault();
    try {
      gba.value.press(gamepadKey);
    } catch (e) {
      console.error('Error pressing key:', e);
      handleEmulatorError(1, t('ui.emulator.errors.keyPressError', { error: e instanceof Error ? e.message : String(e) }));
    }
  }
}

function handleKeyUp(event: KeyboardEvent) {
  if (!gba.value || hasError.value) return;

  const gamepadKey = keyBindings[event.code];
  if (gamepadKey !== undefined) {
    event.preventDefault();
    try {
      // gbats 的 Wrapper 会自动处理按键释放
      // 不需要手动调用释放函数
    } catch (error) {
      console.error('Error releasing key:', error);
    }
  }
}

function togglePause() {
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

  try {
    // 使用 Wrapper 的 resetEmulator 方法
    gba.value.pause();
    teardownAudio();
    gba.value.resetEmulator();

    // 重置后重新设置错误处理器，因为resetEmulator可能会清除logger
    setupErrorHandling();
    void setupAudio();

    isPaused.value = false;
    hasError.value = false;
    errorMessage.value = '';
    showToast(t('ui.emulator.reset'), 'success');
  } catch (e) {
    console.error('Failed to reset game:', e);
    handleEmulatorError(1, t('ui.emulator.errors.resetError', { error: e instanceof Error ? e.message : String(e) }));
    showToast(t('ui.emulator.resetFailed'), 'error');
  }
}

function closeEmulator() {
  cleanup();
  emit('close');
}

function cleanup() {
  // 移除键盘事件监听器
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('keyup', handleKeyUp);

  // 停止模拟器
  if (gba.value) {
    try {
      // 先暂停，然后清理
      if (!isPaused.value) {
        gba.value.pause();
      }

      teardownAudio();

      // gbats Wrapper 会自动清理资源
      gba.value = null;
    } catch (error) {
      console.warn('Error stopping GBA emulator:', error);
    }
  }

  // 重置状态
  isPaused.value = false;
  hasError.value = false;
  errorMessage.value = '';
  isInitializing.value = false;
}
</script>

<style lang="scss" scoped>
@use '@/styles/variables/colors' as color-vars;
@use '@/styles/variables/spacing' as spacing-vars;
@use '@/styles/variables/typography' as typography-vars;
@use '@/styles/variables/radius' as radius-vars;
@use '@/styles/mixins' as mixins;

.emulator-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.emulator-container {
  background: color-vars.$color-bg;
  border-radius: radius-vars.$radius-xl;
  box-shadow: color-vars.$shadow-lg;
  overflow: hidden;
  width: min(540px, calc(100vw - 2rem));
  max-width: 90vw;
  max-height: calc(100vh - 2rem);
  display: flex;
  flex-direction: column;
}

.emulator-header {
  background: linear-gradient(135deg, #5bcffa 0%, #f5abb9 100%);
  color: #ffffff;
  padding: spacing-vars.$space-4 spacing-vars.$space-5;
  display: flex;
  justify-content: space-between;
  align-items: center;
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
  background: color-vars.$color-bg;
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
  color: color-vars.$color-error;

  h4 {
    margin: 0 0 spacing-vars.$space-3 0;
    font-size: typography-vars.$font-size-xl;
    color: color-vars.$color-error;
  }

  p {
    margin: 0 0 spacing-vars.$space-5 0;
    color: color-vars.$color-text-secondary;
    line-height: typography-vars.$line-height-normal;
    max-width: 400px;
  }
}

.error-icon {
  font-size: typography-vars.$font-size-5xl;
  margin-bottom: spacing-vars.$space-4;
}

.game-canvas {
  border: 2px solid color-vars.$color-text;
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
}

.emulator-footer {
  background: color-vars.$color-bg-secondary;
  color: color-vars.$color-text;
  padding: spacing-vars.$space-4 spacing-vars.$space-5;
  border-top: 1px solid color-vars.$color-border-light;
}

.controls-help {
  text-align: center;

  p {
    margin: 0 0 spacing-vars.$space-3 0;
    font-size: typography-vars.$font-size-sm;
    color: color-vars.$color-text-secondary;
  }
}

.key-mappings {
  display: flex;
  flex-wrap: wrap;
  gap: spacing-vars.$space-3;
  justify-content: center;
  align-items: center;
}

.key-mapping {
  background: color-vars.$color-bg-tertiary;
  padding: spacing-vars.$space-1 spacing-vars.$space-2;
  border-radius: radius-vars.$radius-base;
  font-size: typography-vars.$font-size-xs;
  color: color-vars.$color-text;
  border: 1px solid color-vars.$color-border;
}
</style>
