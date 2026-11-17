<template>
  <EmulatorLaunchTransition
    :is-visible="isVisible"
    theme-color="#b9a4dc"
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
          :icon="isPaused ? 'pixelarticons:play' : 'pixelarticons:pause'"
          icon-only
          :title="$t('ui.emulator.pause')"
          @click="togglePause"
        />
        <RetroButton
          variant="warning"
          size="sm"
          icon="pixelarticons:reload"
          icon-only
          :title="$t('ui.emulator.reset')"
          @click="resetGame"
        />
        <RetroButton
          variant="danger"
          size="sm"
          icon="pixelarticons:close"
          icon-only
          :title="$t('ui.emulator.close')"
          @click="closeEmulator"
        />
      </div>
    </div>

    <div class="emulator-content">
      <EmulatorScreenViewport
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
import { RetroButton, RetroIcon } from '@/components/retro';
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
const isCovered = ref(false);
const isRunnerReady = ref(false);
const isScreenReady = computed(() => isCovered.value && isRunnerReady.value);

function onTransitionCovered(covered: boolean) {
  isCovered.value = covered;
}

let runnerInstance: BinjgbRunner | null = null;

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
  cleanup();
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

// 监听 ROM 数据变化
watch(() => props.romData, async (newData) => {
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
    // 清理之前的实例
    cleanup();

    // 加载并初始化 binjgb 运行器
    try {
      runnerInstance = await BinjgbRunner.create({
        canvas: gameCanvas.value,
        romData: props.romData,
      });
    } catch (romError: unknown) {
      console.error('ROM loading failed:', romError);

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
      runnerInstance.play();
      isRunnerReady.value = true;
    } catch (playError: unknown) {
      console.error('Failed to start game:', playError);
      showToast(t('ui.emulator.startGameFailed'), 'error');
      return;
    }

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
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
}

function handleKeyDown(event: KeyboardEvent) {
  const key = keyBindings[event.code];
  if (!key) return;

  event.preventDefault();
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

function togglePause() {
  if (!runnerInstance) return;

  try {
    if (isPaused.value) {
      runnerInstance.play();
      isPaused.value = false;
      showToast(t('ui.emulator.running'), 'success');
    } else {
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
  if (!runnerInstance) return;

  try {
    runnerInstance.reset();
    isPaused.value = false;
    showToast(t('ui.emulator.reset') + ' - ' + t('ui.emulator.running'), 'success');
  } catch (error: unknown) {
    console.error('Failed to reset game:', error);
    showToast(t('ui.emulator.resetFailed'), 'error');
  }
}

function closeEmulator() {
  cleanup();
  emit('close');
}

function cleanup() {
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('keyup', handleKeyUp);
  Object.keys(joypadState).forEach((key) => {
    joypadState[key as keyof JoypadState] = false;
  });

  if (runnerInstance) {
    try {
      runnerInstance.destroy();
    } catch (error: unknown) {
      console.error('Error during cleanup:', error);
    }
    runnerInstance = null;
  }
  isPaused.value = false;
  isRunnerReady.value = false;
  isCovered.value = false;
}
</script>

<style lang="scss" scoped>
@use '@/styles/variables/colors' as color-vars;
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
  gap: spacing-vars.$space-2;
  justify-content: center;
  align-items: center;
}

.key-mapping {
  background: var(--retro-bg-surface);
  padding: 2px 7px;
  border-radius: 4px;
  font-family: var(--retro-font-mono);
  font-size: 11px;
  color: var(--retro-ink);
  border: 1px solid var(--retro-border-subtle);
  white-space: nowrap;
}
</style>
