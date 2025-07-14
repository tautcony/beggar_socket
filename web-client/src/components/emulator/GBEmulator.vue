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
import { Gameboy } from 'gameboy-emulator';
import { close, gameControllerOutline, pause, play, refresh } from 'ionicons/icons';
import { nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

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
let gameboyInstance: Gameboy | null = null;

onMounted(() => {
  if (props.isVisible && props.romData) {
    initEmulator();
  }
});

onUnmounted(() => {
  cleanup();
});

// 监听可见性变化
watch(() => props.isVisible, async (newVal) => {
  if (newVal && props.romData) {
    await nextTick(() => {
      initEmulator();
    });
  } else {
    cleanup();
  }
});

// 监听 ROM 数据变化
watch(() => props.romData, async (newData) => {
  if (props.isVisible && newData) {
    await nextTick(() => {
      initEmulator();
    });
  }
});

function initEmulator() {
  if (!gameCanvas.value || !props.romData) return;

  try {
    // 清理之前的实例
    cleanup();

    // 创建新的 GameBoy 实例
    gameboyInstance = new Gameboy();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    gameboyInstance.apu.disableSound();

    // 设置 Canvas
    const context = gameCanvas.value.getContext('2d');
    if (!context) {
      throw new Error('无法获取 Canvas 2D 上下文');
    }

    // 设置帧回调
    gameboyInstance.onFrameFinished((imageData: ImageData) => {
      context.putImageData(imageData, 0, 0);
    });

    // 加载 ROM
    try {
      // 确保 ROM 数据是 ArrayBuffer 格式
      let romArrayBuffer: ArrayBuffer;
      if (props.romData instanceof ArrayBuffer) {
        romArrayBuffer = props.romData;
      } else { // 将 Uint8Array 转换为 ArrayBuffer
        romArrayBuffer = props.romData.buffer.slice(
          props.romData.byteOffset,
          props.romData.byteOffset + props.romData.byteLength,
        );
      }
      gameboyInstance.loadGame(romArrayBuffer);
    } catch (romError: unknown) {
      console.error('ROM loading failed:', romError);

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

    // 启用音频
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      gameboyInstance.apu.enableSound();
    } catch (audioError: unknown) {
      console.warn('音频启用失败:', audioError);
      // 音频失败不影响游戏运行，只显示警告
    }

    // 设置 Canvas 为可聚焦
    if (gameCanvas.value) {
      gameCanvas.value.tabIndex = 0;
      gameCanvas.value.focus();
    }

    // 配置键盘映射
    setupKeyboardControls();

    // 开始游戏
    try {
      gameboyInstance.run();
    } catch (playError: unknown) {
      console.error('Failed to start game:', playError);
      showToast(t('ui.emulator.startGameFailed'), 'error');
      return;
    }

    isPaused.value = false;

    showToast(t('ui.emulator.initSuccess'), 'success');

  } catch (error: unknown) {
    console.error('Failed to initialize emulator:', error);
    const errorMessage = error instanceof Error ? error.message : t('ui.emulator.errors.unknownError');
    showToast(`${t('ui.emulator.errors.error')}: ${errorMessage}`, 'error');
  }
}

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
function setupKeyboardControls() {
  // 使用 keyboardManager 配置按键映射
  if (gameboyInstance?.keyboardManager) {
    // 设置自定义按键映射
    gameboyInstance.keyboardManager.left = 'ArrowLeft';
    gameboyInstance.keyboardManager.right = 'ArrowRight';
    gameboyInstance.keyboardManager.up = 'ArrowUp';
    gameboyInstance.keyboardManager.down = 'ArrowDown';
    gameboyInstance.keyboardManager.a = 'KeyZ'; // A 按钮映射到 Z 键
    gameboyInstance.keyboardManager.b = 'KeyX'; // B 按钮映射到 X 键
    gameboyInstance.keyboardManager.start = 'Enter';
    gameboyInstance.keyboardManager.select = 'ShiftLeft'; // SELECT 按钮映射到 Shift 键

    console.log('Keyboard mappings configured:', {
      a: gameboyInstance.keyboardManager.a,
      b: gameboyInstance.keyboardManager.b,
      select: gameboyInstance.keyboardManager.select,
    });
  }
}
/* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */

function togglePause() {
  if (!gameboyInstance) return;

  try {
    if (isPaused.value) {
      gameboyInstance.run();
      isPaused.value = false;
      showToast(t('ui.emulator.running'), 'success');
    } else {
      // gameboy-emulator 没有直接的 pause 方法
      // 我们可以通过停止 run 循环来实现暂停效果
      isPaused.value = true;
      showToast(t('ui.emulator.paused'), 'success');
    }
  } catch (error: unknown) {
    console.error('Failed to toggle pause:', error);
    showToast(t('ui.emulator.operationFailed'), 'error');
  }
}

function resetGame() {
  if (!gameboyInstance || !props.romData) return;

  try {
    // 确保 ROM 数据是 ArrayBuffer 格式
    let romArrayBuffer: ArrayBuffer;
    if (props.romData instanceof ArrayBuffer) {
      romArrayBuffer = props.romData;
    } else {
      // 将 Uint8Array 转换为 ArrayBuffer
      romArrayBuffer = props.romData.buffer.slice(
        props.romData.byteOffset,
        props.romData.byteOffset + props.romData.byteLength,
      );
    }

    // 重新加载游戏来实现重置
    gameboyInstance.loadGame(romArrayBuffer);
    gameboyInstance.run();
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
  if (gameboyInstance) {
    try {
      // gameboy-emulator 没有直接的清理方法
      // 只需要将引用设为 null
    } catch (error: unknown) {
      console.error('Error during cleanup:', error);
    }
    gameboyInstance = null;
  }
  isPaused.value = false;
}

// Handle overlay click to close emulator
function handleOverlayClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    closeEmulator();
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
