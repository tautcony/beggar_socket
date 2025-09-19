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
            :title="$t('ui.emulator.pause')"
            @click="togglePause"
          />
          <BaseButton
            variant="warning"
            size="sm"
            :icon="refresh"
            :title="$t('ui.emulator.reset')"
            @click="resetGame"
          />
          <BaseButton
            variant="error"
            size="sm"
            :icon="close"
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
    gba.value.resetEmulator();

    // 重置后重新设置错误处理器，因为resetEmulator可能会清除logger
    setupErrorHandling();

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

<style scoped>
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
  background: var(--color-bg);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.emulator-header {
  background: linear-gradient(135deg, #5bcffa 0%, #f5abb9 100%);
  color: #ffffff;
  padding: var(--space-4) var(--space-5);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.emulator-title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.emulator-controls {
  display: flex;
  gap: var(--space-2);
}

.emulator-content {
  background: var(--color-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-5);
  min-height: 200px;
}

.error-display {
  text-align: center;
  padding: var(--space-10) var(--space-5);
  color: var(--color-error);
}

.error-icon {
  font-size: var(--font-size-5xl);
  margin-bottom: var(--space-4);
}

.error-display h4 {
  margin: 0 0 var(--space-3) 0;
  font-size: var(--font-size-xl);
  color: var(--color-error);
}

.error-display p {
  margin: 0 0 var(--space-5) 0;
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
  max-width: 400px;
}

.game-canvas {
  border: 2px solid var(--color-text);
  border-radius: var(--radius-base);
  background: #000000;
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  /* GBA屏幕比例 240x160，放大到合适尺寸 */
  min-width: 480px;
  min-height: 320px;
}

.emulator-footer {
  background: var(--color-bg-secondary);
  color: var(--color-text);
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--color-border-light);
}

.controls-help {
  text-align: center;
}

.controls-help p {
  margin: 0 0 var(--space-3) 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.key-mappings {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  justify-content: center;
  align-items: center;
}

.key-mapping {
  background: var(--color-bg-tertiary);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-base);
  font-size: var(--font-size-xs);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}
</style>
