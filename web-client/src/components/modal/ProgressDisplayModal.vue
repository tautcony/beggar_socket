<template>
  <BaseModal
    v-model="localVisible"
    :title="$t('ui.progress.title')"
    :close-disabled="true"
    :width="500"
    @close="handleClose"
  >
    <template #header>
      <h3 class="modal-title">
        {{ $t('ui.progress.title') }}
        <span
          v-if="isCompleted"
          class="completion-badge"
        >
          <IonIcon :icon="checkmarkOutline" />
        </span>
      </h3>
    </template>
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
          <span class="stat-label">{{ $t('ui.progress.elapsed') }}</span>
          <span
            class="stat-value"
            :class="timeColorClass"
          >{{ formatTimeClock(elapsedTime, 'ms', true) }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">{{ $t('ui.progress.remaining_time') }}</span>
          <span
            class="stat-value"
            :class="timeColorClass"
          >{{ formatTimeClock(remainingTime, 'ms', true) }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">{{ $t('ui.progress.speed') }}</span>
          <span class="stat-value">{{ formatSpeed(currentSpeed) }}</span>
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
    <template #footer>
      <button
        class="stop-button"
        :disabled="(!allowCancel) || state === 'completed' || state === 'error'"
        @click="handleStop"
      >
        {{ $t('ui.progress.stop') }}
      </button>
      <button
        class="close-button"
        :disabled="state === 'running'"
        @click="handleClose"
      >
        {{ $t('ui.progress.close') }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { checkmarkOutline } from 'ionicons/icons';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import BaseModal from '@/components/common/BaseModal.vue';
import { ProgressInfo } from '@/types/progress-info';
import { formatBytes, formatSpeed, formatTimeClock } from '@/utils/formatter-utils';

const props = defineProps<ProgressInfo & {
  modelValue: boolean;
  timeout?: number; // 超时时间（毫秒）
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  stop: []
  close: []
}>();

// 创建一个计算属性来处理 v-model
const localVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => {
    emit('update:modelValue', value);
  },
});

const visible = ref(false);
const isCancelled = ref(false);
const now = ref(Date.now());
const lastUpdateTime = ref(Date.now());
let timer: number | undefined;

const isCompleted = computed(() => {
  return props.progress === 100 || props.state === 'completed' || props.state === 'error';
});

watch(
  () => visible.value && !isCompleted.value,
  (active) => {
    if (active) {
      timer = window.setInterval(() => {
        now.value = Date.now();
      }, 100);
    } else if (timer) {
      clearInterval(timer);
    }
  },
  { immediate: true },
);

watch(() => props.progress, (newProgress) => {
  if (newProgress !== null && newProgress !== undefined) {
    visible.value = true;
    lastUpdateTime.value = Date.now(); // 更新最后更新时间
  }
}, { immediate: true });

// 监听其他可能表示数据更新的属性
watch([
  () => props.transferredBytes,
  () => props.currentSpeed,
  () => props.detail,
], () => {
  lastUpdateTime.value = Date.now();
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

// Computed statistics
const totalBytes = computed(() => props.totalBytes ?? 0);

const transferredBytes = computed(() => {
  if (totalBytes.value && props.progress) {
    return Math.floor((totalBytes.value * props.progress) / 100);
  }
  return props.transferredBytes ?? 0;
});

const remainingBytes = computed(() => {
  const total = totalBytes.value;
  const transferred = transferredBytes.value;
  return Math.max(0, total - transferred);
});

const elapsedTime = computed(() => {
  if (!props.startTime) return 0;
  return now.value - props.startTime;
});

const currentSpeed = computed(() => props.currentSpeed ?? 0);

const remainingTime = computed(() => {
  if (!currentSpeed.value || currentSpeed.value <= 0) return 0;
  return remainingBytes.value / currentSpeed.value * 1000;
});

// 监控数据更新超时状态
const timeSinceLastUpdate = computed(() => {
  return now.value - lastUpdateTime.value;
});

const timeoutDuration = computed(() => props.timeout ?? 10000); // 默认10秒超时

const updateTimeoutStatus = computed(() => {
  const elapsed = timeSinceLastUpdate.value;
  const timeout = timeoutDuration.value;

  if (elapsed >= timeout) {
    return 'timeout'; // 超时
  } else if (elapsed >= timeout * 2 / 3) {
    return 'danger'; // 剩余1/3时间，黄色
  } else if (elapsed >= timeout * 1 / 3) {
    return 'warning'; // 剩余2/3时间，轻微警告
  }
  return 'normal';
});

// 时间显示颜色类
const timeColorClass = computed(() => {
  const status = updateTimeoutStatus.value;
  return {
    'time-warning': status === 'warning',
    'time-danger': status === 'danger',
    'time-timeout': status === 'timeout',
  };
});

function handleStop() {
  if (props.allowCancel) {
    emit('stop');
    isCancelled.value = true;
  }
}

function handleClose() {
  visible.value = false;
  emit('close');
}

// Keyboard handling
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && visible.value) {
    if (isCompleted.value || props.progress === 100) {
      // 操作完成时允许ESC关闭
      visible.value = false;
      emit('close');
    } else if (props.allowCancel) {
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
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', 'Menlo', 'Consolas', monospace;
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
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', 'Menlo', 'Consolas', monospace;
}
.operation-detail {
  background: #f3f4f6;
  border-radius: 8px;
  padding: 12px;
  font-size: 0.875rem;
  color: #4b5563;
  border-left: 4px solid #3b82f6;
  word-break: break-word;
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', 'Menlo', 'Consolas', monospace;
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
.close-button {
  background: #6b7280;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}
.close-button:hover:not(:disabled) {
  background: #4b5563;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(107, 114, 128, 0.3);
}
.close-button:active:not(:disabled) {
  transform: translateY(0);
}
.close-button:disabled {
  background: #d1d5db;
  color: #9ca3af;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
.completion-badge {
  color: #16a34a;
  margin-left: 8px;
  font-size: 1.1em;
}

/* 超时状态颜色样式 */
.time-warning {
  color: #f59e0b !important; /* 黄色 - 剩余2/3时间 */
}

.time-danger {
  color: #ef4444 !important; /* 红色 - 剩余1/3时间 */
}

.time-timeout {
  color: #dc2626 !important; /* 深红色 - 超时 */
  font-weight: bold !important;
}
</style>
