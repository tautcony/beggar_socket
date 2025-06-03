<template>
  <!-- Modal Dialog -->
  <Teleport to="body">
    <div
      v-if="visible"
      class="modal-overlay"
      @click.self="onOverlayClick"
    >
      <div class="progress-modal">
        <div class="modal-header">
          <h3 class="modal-title">
            {{ $t('ui.progress.title') }}
            <span
              v-if="isCompleted"
              class="completion-badge"
            >
              ✓
            </span>
          </h3>
          <button
            class="close-button"
            :disabled="!allowCancel && !isCompleted"
            @click="handleClose"
          >
            ✕
          </button>
        </div>

        <div class="modal-body">
          <!-- Progress Bar -->
          <div class="progress-section">
            <div class="progress-bar-container">
              <div
                class="progress-bar-fill"
                :style="{ width: `${progress || 0}%` }"
              />
            </div>
            <div class="progress-percentage">
              {{ (progress || 0).toFixed(1) }}%
            </div>
          </div>

          <!-- Transfer Statistics -->
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-label">{{ $t('ui.progress.transferred') }}</span>
              <span class="stat-value">{{ formatBytes(transferredBytes) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">{{ $t('ui.progress.remaining') }}</span>
              <span class="stat-value">{{ formatBytes(remainingBytes) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">{{ $t('ui.progress.speed') }}</span>
              <span class="stat-value">{{ formatSpeed(currentSpeed) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">{{ $t('ui.progress.elapsed') }}</span>
              <span class="stat-value">{{ formatTime(elapsedTime) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">{{ $t('ui.progress.remaining_time') }}</span>
              <span class="stat-value">{{ formatTime(remainingTime) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">{{ $t('ui.progress.total_size') }}</span>
              <span class="stat-value">{{ formatBytes(totalBytes) }}</span>
            </div>
          </div>

          <!-- Operation Detail -->
          <div
            v-if="detail"
            class="operation-detail"
          >
            {{ detail }}
          </div>
        </div>

        <div class="modal-footer">
          <button
            class="stop-button"
            :disabled="!allowCancel"
            @click="handleStop"
          >
            {{ $t('ui.progress.stop') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatBytes, formatSpeed, formatTime } from '@/utils/Formatter';

const { t } = useI18n();

interface ProgressData {
  progress: number | null
  detail?: string
  totalBytes?: number
  transferredBytes?: number
  startTime?: number
  currentSpeed?: number // KB/s
  allowCancel?: boolean
}

const props = defineProps<ProgressData>();

const emit = defineEmits<{
  stop: []
  close: []
}>();

const visible = ref(false);
const isCompleted = ref(false);
const now = ref(Date.now());
let timer: number | undefined;

watch(
  () => visible.value && !isCompleted.value,
  (active) => {
    if (active) {
      timer = window.setInterval(() => {
        now.value = Date.now();
      }, 500);
    } else if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

// 监听进度变化来控制弹窗显示
watch(() => props.progress, (newProgress) => {
  if (newProgress !== null && newProgress !== undefined) {
    visible.value = true;
    isCompleted.value = false;
  }

  // 当进度达到100%时标记为完成，但不自动关闭
  if (newProgress === 100) {
    isCompleted.value = true;
  }
}, { immediate: true });

// Computed statistics
const transferredBytes = computed(() => {
  if (props.totalBytes && props.progress) {
    return Math.floor((props.totalBytes * props.progress) / 100);
  }
  return props.transferredBytes || 0;
});

const remainingBytes = computed(() => {
  const total = props.totalBytes || 0;
  const transferred = transferredBytes.value;
  return Math.max(0, total - transferred);
});

const elapsedTime = computed(() => {
  if (!props.startTime) return 0;
  return Math.floor((now.value - props.startTime) / 1000);
});

const currentSpeed = computed(() => props.currentSpeed || 0);

const remainingTime = computed(() => {
  if (!currentSpeed.value || currentSpeed.value <= 0) return 0;
  const remainingKB = remainingBytes.value / 1024;
  return Math.floor(remainingKB / currentSpeed.value);
});

const totalBytes = computed(() => props.totalBytes || 0);

function handleStop() {
  if (props.allowCancel !== false) {
    emit('stop');
  }
}

function handleClose() {
  visible.value = false;
  emit('close');
}

function onOverlayClick() {
  // 只有在操作完成时才允许点击弹窗外关闭
  if (isCompleted.value || props.progress === 100) {
    visible.value = false;
    emit('close');
  }
}

// Keyboard handling
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && visible.value) {
    if (isCompleted.value || props.progress === 100) {
      // 操作完成时允许ESC关闭
      visible.value = false;
      emit('close');
    } else if (props.allowCancel !== false) {
      // 操作进行中时ESC触发停止
      handleStop();
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.progress-modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  width: 500px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: hidden;
  animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: #6b7280;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover:not(:disabled) {
  background: #f3f4f6;
  color: #374151;
}

.close-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-body {
  padding: 24px;
}

.progress-section {
  margin-bottom: 24px;
}

.progress-bar-container {
  background: #e5e7eb;
  border-radius: 6px;
  height: 12px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-bar-fill {
  background: linear-gradient(90deg, #3b82f6, #1d4ed8);
  height: 100%;
  border-radius: 6px;
  transition: width 0.3s ease;
  position: relative;
}

.progress-bar-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  animation: progressShimmer 2s infinite;
}

@keyframes progressShimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.progress-percentage {
  text-align: center;
  font-weight: 600;
  font-size: 1.1rem;
  color: #374151;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.stat-label {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.stat-value {
  font-size: 0.875rem;
  color: #111827;
  font-weight: 600;
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace;
}

.operation-detail {
  background: #f3f4f6;
  border-radius: 8px;
  padding: 12px;
  font-size: 0.875rem;
  color: #4b5563;
  border-left: 4px solid #3b82f6;
  word-break: break-word;
}

.modal-footer {
  padding: 16px 24px 20px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
}

.stop-button {
  background: #ef4444;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.stop-button:hover:not(:disabled) {
  background: #dc2626;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.stop-button:active:not(:disabled) {
  transform: translateY(0);
}

.stop-button:disabled {
  background: #d1d5db;
  color: #9ca3af;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.completion-tip {
  display: block;
  margin-top: 8px;
  color: #16a34a;
  font-size: 0.95rem;
  font-weight: 500;
  text-align: right;
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .progress-modal {
    background: #1f2937;
    color: #f9fafb;
  }

  .modal-header {
    border-bottom-color: #374151;
  }

  .modal-title {
    color: #f9fafb;
  }

  .close-button {
    color: #9ca3af;
  }

  .close-button:hover:not(:disabled) {
    background: #374151;
    color: #d1d5db;
  }

  .progress-bar-container {
    background: #374151;
  }

  .progress-percentage {
    color: #e5e7eb;
  }

  .stat-item {
    background: #374151;
    border-color: #4b5563;
  }

  .stat-label {
    color: #9ca3af;
  }

  .stat-value {
    color: #f3f4f6;
  }

  .operation-detail {
    background: #374151;
    color: #d1d5db;
    border-left-color: #3b82f6;
  }

  .modal-footer {
    border-top-color: #374151;
  }
}
</style>
