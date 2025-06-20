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
          <button
            class="control-btn"
            :title="$t('ui.emulator.pause')"
            @click="togglePause"
          >
            <IonIcon :icon="isPaused ? play : pause" />
          </button>
          <button
            class="control-btn"
            :title="$t('ui.emulator.reset')"
            @click="resetGame"
          >
            <IonIcon :icon="refresh" />
          </button>
          <button
            class="control-btn close-btn"
            :title="$t('ui.emulator.close')"
            @click="closeEmulator"
          >
            <IonIcon :icon="close" />
          </button>
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
            <span class="key-mapping">{{ $t('ui.emulator.dpad') }}: Arrow Keys</span>
            <span class="key-mapping">{{ $t('ui.emulator.aButton') }}: Z</span>
            <span class="key-mapping">{{ $t('ui.emulator.bButton') }}: X</span>
            <span class="key-mapping">{{ $t('ui.emulator.start') }}: Enter</span>
            <span class="key-mapping">{{ $t('ui.emulator.select') }}: Shift</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { close, gameControllerOutline, pause, play, refresh } from 'ionicons/icons';
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { WasmBoy, type WasmBoyStatic } from 'wasmboy';

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

const gameCanvas = ref<HTMLCanvasElement>();
const isPaused = ref(false);
let wasmBoyInstance: WasmBoyStatic | null = null;

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
      play: () => isPlaying.set(true),
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
      let errorMessage = t('ui.emulator.romLoadFailed');
      if (romError instanceof RangeError) {
        errorMessage = t('ui.emulator.invalidRom');
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
      showToast(`${t('ui.emulator.startGameFailed')}`, 'error');
      return;
    }

    wasmBoyInstance = WasmBoy;
    isPaused.value = false;

    // 设置键盘事件监听
    setupKeyboardControls();

    showToast(t('ui.emulator.initSuccess'), 'success');

  } catch (error: unknown) {
    console.error('Failed to initialize emulator:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    showToast(`${t('ui.emulator.initError')}: ${errorMessage}`, 'error');
  }
}

function setupKeyboardControls() {
  // WasmBoy 通常会自动处理键盘输入
  // 默认键盘映射：
  // Arrow Keys = D-Pad
  // Z = A Button
  // X = B Button
  // Enter = Start
  // Shift = Select

  // 启用默认的手柄控制
  if (wasmBoyInstance) {
    wasmBoyInstance.enableDefaultJoypad();
  }
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
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-width: 90vw;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.emulator-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: linear-gradient(135deg, #5bcffa 0%, #f5abb9 100%);
  color: white;
}

.emulator-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.emulator-icon {
  font-size: 1.2em;
}

.emulator-controls {
  display: flex;
  gap: 8px;
}

.control-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  padding: 8px;
  transition: all 0.2s ease;
  width: 36px;
  height: 36px;
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.control-btn.close-btn:hover {
  background: rgba(239, 68, 68, 0.8);
}

.emulator-content {
  display: flex;
  justify-content: center;
  padding: 20px;
  align-items: center;
}

.game-canvas {
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  background: #000;
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
  /* 放大显示，保持像素完美 */
  width: 480px;
  height: 432px;
}

.emulator-footer {
  background: #f9fafb;
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
}

.controls-help {
  text-align: center;
}

.controls-help p {
  margin: 0 0 12px 0;
  font-size: 0.9rem;
  color: #6b7280;
}

.key-mappings {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  align-items: center;
}

.key-mapping {
  background: #f3f4f6;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  color: #374151;
  border: 1px solid #d1d5db;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .emulator-container {
    margin: 10px;
    max-width: calc(100vw - 20px);
    max-height: 95vh;
  }

  .emulator-content {
    padding: 16px;
  }

  .game-canvas {
    width: 320px;
    height: 288px;
    align-self: center;
  }

  .emulator-header {
    padding: 12px 16px;
  }

  .emulator-title {
    font-size: 1rem;
  }

  .key-mappings {
    gap: 8px;
  }

  .key-mapping {
    font-size: 0.75rem;
  }
}

@media (max-width: 480px) {
  .game-canvas {
    width: 240px;
    height: 216px;
  }

  .emulator-footer {
    padding: 12px 16px;
  }

  .emulator-header {
    padding: 10px 12px;
  }

  .emulator-title {
    font-size: 0.9rem;
  }
}
</style>
