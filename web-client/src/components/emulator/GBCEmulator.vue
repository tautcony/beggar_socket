<template>
  <div
    v-if="isVisible"
    class="emulator-overlay"
    @click.self="closeEmulator"
  >
    <div class="emulator-container">
      <div class="emulator-header">
        <h3 class="emulator-title">
          <IonIcon
            :icon="gameControllerOutline"
            class="emulator-icon"
          />
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
        <canvas
          ref="gameCanvas"
          class="game-canvas"
          width="160"
          height="144"
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
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { close, gameControllerOutline, pause, play, refresh } from 'ionicons/icons';
import { nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { WasmBoy, type WasmBoyStatic } from 'wasmboy';

import BaseButton from '@/components/common/BaseButton.vue';
import { useToast } from '@/composables/useToast';

const { t } = useI18n();
const { showToast } = useToast();

const props = defineProps<{
  romData: Uint8Array | null;
  romName: string;
  isVisible: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const gameCanvas = useTemplateRef<HTMLCanvasElement>('gameCanvas');
const isPaused = ref(false);
let wasmBoyInstance: WasmBoyStatic | null = null;

const keyBindings: Record<string, keyof JoypadState> = {
  'KeyW': 'up',
  'KeyD': 'right',
  'KeyS': 'down',
  'KeyA': 'left',
  'KeyJ': 'a',
  'KeyK': 'b',
  'KeyV': 'select',
  'KeyC': 'start',
};

interface JoypadState {
  up: boolean;
  right: boolean;
  down: boolean;
  left: boolean;
  a: boolean;
  b: boolean;
  select: boolean;
  start: boolean;
}

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

onUnmounted(async () => {
  await cleanup();
});

// 监听可见性变化
watch(() => props.isVisible, async (newVal) => {
  if (newVal && props.romData) {
    await nextTick(async () => {
      await initEmulator();
    });
  } else {
    await cleanup();
  }
});

// 监听 ROM 数据变化
watch(() => props.romData, async (newData) => {
  if (props.isVisible && newData) {
    await nextTick(async () => {
      await initEmulator();
    });
  }
});

async function initEmulator() {
  if (!gameCanvas.value || !props.romData) return;

  try {
    // 清理之前的实例
    await cleanup();

    // 声明局部变量
    const wasmBoyCanvasRef = gameCanvas.value;
    const isPlaying = {
      set: (value: boolean) => {
        // 这里可以添加状态管理逻辑
        // console.log('Playing state:', value);
      },
      get: () => !isPaused.value,
    };
    const setStatus = (status: string, code: number) => {
      // console.log('Status:', status, 'Code:', code);
    };

    const EmbedPlugin = {
      name: 'EmbedPlugin',
      saveState: (saveStateObject: Record<string, unknown>) => {
        if (wasmBoyCanvasRef) {
          saveStateObject.screenshotCanvasDataURL = wasmBoyCanvasRef.toDataURL();
        }
      },
      play: () => { isPlaying.set(true); },
      pause: () => {
        isPlaying.set(false);
        setStatus('Paused', -1);
      },
    };

    // 设置 Canvas
    WasmBoy.setCanvas(gameCanvas.value);
    WasmBoy.addPlugin(EmbedPlugin);

    // 初始化 WasmBoy
    const config = {
      headless: false,
      useGbcWhenOptional: true,
      audioAccumulateSamples: true,
      graphicsBatchProcessing: false,
      graphicsDisableScanlineRendering: false,
      audioBufferSize: 1024,
      frameSkip: 0,
      audioBatchProcessing: false,
    };

    await WasmBoy.config(config);

    // 加载 ROM
    try {
      // WasmBoy 0.7.1 recognizes ROM bytes as Uint8Array. Passing the
      // underlying ArrayBuffer makes it treat the buffer as a URL and call
      // toLowerCase() on it.
      await WasmBoy.loadROM(props.romData);
    } catch (romError: unknown) {
      console.error('ROM loading failed:', romError);
      // 尝试清理 WasmBoy 状态
      try {
        await WasmBoy.reset();
      } catch (resetError) {
        console.error('Reset after ROM load failure also failed:', resetError);
      }

      // 根据错误类型提供更具体的错误信息
      let errorMessage = t('ui.emulator.errors.romLoadFailed');
      if (romError instanceof RangeError) {
        errorMessage = t('ui.emulator.errors.invalidRom');
      } else if (romError instanceof Error && romError.message) {
        errorMessage += `: ${romError.message}`;
      }

      showToast(errorMessage, 'error');
      return;
    }

    // 设置 Canvas 为可聚焦
    if (gameCanvas.value) {
      gameCanvas.value.tabIndex = 0;
      gameCanvas.value.focus();
    }

    // 开始游戏
    try {
      await WasmBoy.play();
    } catch (playError: unknown) {
      console.error('Failed to start game:', playError);
      showToast(t('ui.emulator.startGameFailed'), 'error');
      return;
    }

    wasmBoyInstance = WasmBoy;
    isPaused.value = false;

    // 设置键盘事件监听
    setupKeyboardControls();

    showToast(t('ui.emulator.initSuccess'), 'success');

  } catch (error: unknown) {
    console.error('Failed to initialize emulator:', error);
    const errorMessage = error instanceof Error ? error.message : t('ui.emulator.errors.unknownError');
    showToast(`${t('ui.emulator.errors.error')}: ${errorMessage}`, 'error');
  }
}

function setupKeyboardControls() {
  wasmBoyInstance?.disableDefaultJoypad();
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
}

function updateJoypadState() {
  if (!wasmBoyInstance) return;

  wasmBoyInstance.setJoypadState(
    joypadState.up ? 1 : 0,
    joypadState.right ? 1 : 0,
    joypadState.down ? 1 : 0,
    joypadState.left ? 1 : 0,
    joypadState.a ? 1 : 0,
    joypadState.b ? 1 : 0,
    joypadState.select ? 1 : 0,
    joypadState.start ? 1 : 0,
  );
}

function handleKeyDown(event: KeyboardEvent) {
  const key = keyBindings[event.code];
  if (!key) return;

  event.preventDefault();
  joypadState[key] = true;
  updateJoypadState();
}

function handleKeyUp(event: KeyboardEvent) {
  const key = keyBindings[event.code];
  if (!key) return;

  event.preventDefault();
  joypadState[key] = false;
  updateJoypadState();
}

async function togglePause() {
  if (!wasmBoyInstance) return;

  try {
    if (isPaused.value) {
      await wasmBoyInstance.play();
      isPaused.value = false;
      showToast(t('ui.emulator.running'), 'success');
    } else {
      await wasmBoyInstance.pause();
      isPaused.value = true;
      showToast(t('ui.emulator.paused'), 'success');
    }
  } catch (error: unknown) {
    console.error('Failed to toggle pause:', error);
    showToast(t('ui.emulator.operationFailed'), 'error');
  }
}

async function resetGame() {
  if (!wasmBoyInstance) return;

  try {
    await wasmBoyInstance.reset();
    await wasmBoyInstance.play();
    isPaused.value = false;
    showToast(t('ui.emulator.reset') + ' - ' + t('ui.emulator.running'), 'success');
  } catch (error: unknown) {
    console.error('Failed to reset game:', error);
    showToast(t('ui.emulator.resetFailed'), 'error');
  }
}

async function closeEmulator() {
  await cleanup();
  emit('close');
}

async function cleanup() {
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('keyup', handleKeyUp);
  Object.keys(joypadState).forEach((key) => {
    joypadState[key as keyof JoypadState] = false;
  });

  if (wasmBoyInstance) {
    try {
      await wasmBoyInstance.pause();
      wasmBoyInstance.disableDefaultJoypad();
    } catch (error: unknown) {
      console.error('Error during cleanup:', error);
    }
    wasmBoyInstance = null;
  }
  isPaused.value = false;
}

// Handle overlay click to close emulator
async function handleOverlayClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    await closeEmulator();
  }
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
  width: min(540px, calc(100vw - 2rem));
  max-width: 90vw;
  max-height: calc(100vh - 2rem);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.emulator-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: spacing-vars.$space-4 spacing-vars.$space-5;
  background: linear-gradient(135deg, #5bcffa 0%, #f5abb9 100%);
  color: color-vars.$color-text-inverse;
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

.game-canvas {
  border: 2px solid color-vars.$color-border-light;
  border-radius: radius-vars.$radius-lg;
  background: color-vars.$color-bg-inverse;
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
  /* 放大显示，保持像素完美 */
  width: min(480px, 100%);
  height: auto;
  aspect-ratio: 160 / 144;
}

.emulator-footer {
  background: color-vars.$color-bg-secondary;
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
