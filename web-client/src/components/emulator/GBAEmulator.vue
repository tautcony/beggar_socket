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
          <button
            class="control-btn"
            :title="$t('ui.emulator.pause')"
            @click="togglePause"
          >
            <IonIcon :name="isPaused ? 'play' : 'pause'" />
          </button>
          <button
            class="control-btn"
            :title="$t('ui.emulator.reset')"
            @click="resetGame"
          >
            <IonIcon name="refresh" />
          </button>
          <button
            class="control-btn close-btn"
            :title="$t('ui.emulator.close')"
            @click="closeEmulator"
          >
            <IonIcon name="close" />
          </button>
        </div>
      </div>

      <div class="emulator-content">
        <canvas
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
            <span class="key-mapping">{{ $t('ui.emulator.aButton') }}: Z</span>
            <span class="key-mapping">{{ $t('ui.emulator.bButton') }}: X</span>
            <span class="key-mapping">{{ $t('ui.emulator.start') }}: Enter</span>
            <span class="key-mapping">{{ $t('ui.emulator.select') }}: Shift</span>
            <span class="key-mapping">{{ $t('ui.emulator.l') }}: Q</span>
            <span class="key-mapping">{{ $t('ui.emulator.r') }}: E</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { IonIcon } from '@ionic/vue';
import { useI18n } from 'vue-i18n';
import { useToast } from '@/composables/useToast';
import { Wrapper } from 'gbats';

const { t } = useI18n();
const { showToast } = useToast();

const props = defineProps<{
  isVisible: boolean;
  romData: Uint8Array | null;
  romName: string;
}>();

const emit = defineEmits(['close']);

const gameCanvas = ref<HTMLCanvasElement | null>(null);
const gba = ref<Wrapper | null>(null);
const isPaused = ref(false);

const keyBindings: { [key: string]: number } = {
  'KeyW': 6, // UP
  'KeyS': 7, // DOWN
  'KeyA': 5, // LEFT
  'KeyD': 4, // RIGHT
  'KeyZ': 0, // A
  'KeyX': 1, // B
  'Enter': 3, // START
  'ShiftLeft': 2, // SELECT
  'ShiftRight': 2, // SELECT
  'KeyQ': 9, // L
  'KeyE': 8, // R
};

onMounted(async () => {
  if (props.isVisible && props.romData) {
    await initializeEmulator();
  }
});

onUnmounted(() => {
  cleanup();
});

watch(() => props.isVisible, async (newVisible) => {
  if (newVisible && props.romData) {
    await nextTick();
    await initializeEmulator();
  } else if (!newVisible) {
    cleanup();
  }
});

watch(() => props.romData, async (newRomData) => {
  if (newRomData && props.isVisible) {
    await nextTick();
    await initializeEmulator();
  }
});

async function initializeEmulator() {
  try {
    if (!gameCanvas.value || !props.romData) {
      console.error('Canvas or ROM data not available');
      return;
    }

    cleanup();

    // 根据官方例子初始化 gbats Wrapper
    gba.value = new Wrapper({
      rom: props.romData.buffer,
      canvas: gameCanvas.value,
    });

    // 设置图片格式
    gba.value.screenImageFormat = 'webp';

    // 绑定键盘事件
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    showToast(t('ui.emulator.loaded'), 'success');
  } catch (error) {
    console.error('Failed to initialize GBA emulator:', error);
    showToast(t('ui.emulator.loadFailed'), 'error');
  }
}

function handleKeyDown(event: KeyboardEvent) {
  if (!gba.value) return;

  const gamepadKey = keyBindings[event.code];
  if (gamepadKey !== undefined) {
    event.preventDefault();
    gba.value.press(gamepadKey);
  }
}

function handleKeyUp(event: KeyboardEvent) {
  if (!gba.value) return;

  const gamepadKey = keyBindings[event.code];
  if (gamepadKey !== undefined) {
    event.preventDefault();
    // gbats 的 Wrapper 会自动处理按键释放
    // 不需要手动调用释放函数
  }
}

function togglePause() {
  if (!gba.value) return;

  if (isPaused.value) {
    // 恢复运行
    gba.value.run(false);
    isPaused.value = false;
    showToast(t('ui.emulator.resumed'), 'success');
  } else {
    // 暂停
    gba.value.pause();
    isPaused.value = true;
    showToast(t('ui.emulator.paused'), 'success');
  }
}

function resetGame() {
  if (!gba.value) return;

  try {
    // 使用 Wrapper 的 resetEmulator 方法
    gba.value.resetEmulator();
    isPaused.value = false;
    showToast(t('ui.emulator.reset'), 'success');
  } catch (error) {
    console.error('Failed to reset game:', error);
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
      // gbats Wrapper 会自动清理资源
      gba.value = null;
    } catch (error) {
      console.warn('Error stopping GBA emulator:', error);
    }
  }

  isPaused.value = false;
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
  overflow: hidden;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.emulator-header {
  background: linear-gradient(135deg, #5bcffa 0%, #f5abb9 100%);
  color: white;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.emulator-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.emulator-icon {
  font-size: 1.3rem;
  color: #68d391;
}

.emulator-controls {
  display: flex;
  gap: 8px;
}

.control-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  border-radius: 6px;
  padding: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  font-size: 1rem;
  width: 36px;
  height: 36px;
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.close-btn:hover {
  background: rgba(239, 68, 68, 0.3);
}

.emulator-content {
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  min-height: 200px;
}

.game-canvas {
  border: 2px solid #333;
  border-radius: 4px;
  background: #000;
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
  background: #f9fafb;
  color: #374151;
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
    max-height: calc(100vh - 20px);
  }

  .game-canvas {
    min-width: 320px;
    min-height: 213px;
  }

  .key-mappings {
    gap: 8px;
  }

  .key-mapping {
    font-size: 0.7rem;
    padding: 3px 6px;
  }
}

@media (max-width: 480px) {
  .emulator-header {
    padding: 8px 12px;
  }

  .emulator-title {
    font-size: 0.9rem;
  }

  .control-btn {
    width: 32px;
    height: 32px;
    font-size: 0.9rem;
  }

  .emulator-content {
    padding: 12px;
  }

  .game-canvas {
    min-width: 240px;
    min-height: 160px;
  }

  .emulator-footer {
    padding: 12px;
  }
}
</style>
