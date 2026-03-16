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

      <SectorVisualization
        :type="type"
        :sector-progress="sectorProgress"
      />

      <!-- Operation Detail -->
      <div
        v-if="detail"
        class="operation-detail"
      >
        {{ detail }}
      </div>

      <!-- Latest Log Entry -->
      <div
        v-if="latestLog"
        class="latest-log-entry"
        :class="`log-level-${latestLog.level}`"
      >
        {{ latestLog.message }}
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
import SectorVisualization from '@/components/progress/SectorVisualization.vue';
import { ProgressInfo } from '@/types/progress-info';
import { formatBytes, formatSpeed, formatTimeClock } from '@/utils/formatter-utils';

const props = defineProps<ProgressInfo & {
  modelValue: boolean;
  timeout?: number; // 超时时间（毫秒）
  latestLog?: { time: string; message: string; level: 'info' | 'success' | 'warn' | 'error' };
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
const TIME_REFRESH_INTERVAL_MS = 100;

const isCompleted = computed(() => {
  return props.progress === 100 || props.state === 'completed' || props.state === 'error';
});

const isTerminalState = computed(() => {
  return isCompleted.value || props.state === 'paused';
});

watch(
  () => visible.value && !isTerminalState.value,
  (active) => {
    if (active) {
      timer = window.setInterval(() => {
        now.value = Date.now();
      }, TIME_REFRESH_INTERVAL_MS);
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
    if (isTerminalState.value || props.progress === 100) {
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

<style lang="scss" scoped>
@use '@/styles/variables/colors' as color-vars;
@use '@/styles/variables/spacing' as spacing-vars;
@use '@/styles/variables/typography' as typography-vars;
@use '@/styles/variables/radius' as radius-vars;
@use '@/styles/mixins' as mixins;

.progress-section {
  margin-bottom: spacing-vars.$space-6;
}

.progress-bar-container {
  background: color-vars.$color-bg-tertiary;
  border-radius: radius-vars.$radius-md;
  height: 12px;
  overflow: hidden;
  margin-bottom: spacing-vars.$space-2;
}

.progress-bar-fill {
  background: linear-gradient(90deg, color-vars.$color-primary, #1d4ed8);
  height: 100%;
  border-radius: radius-vars.$radius-md;
  transition: width 0.3s ease;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
    animation: progressShimmer 2s infinite;
  }
}

@keyframes progressShimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.progress-percentage {
  text-align: center;
  font-weight: typography-vars.$font-weight-semibold;
  font-size: typography-vars.$font-size-lg;
  color: color-vars.$color-text;
  font-family: monospace;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: spacing-vars.$space-4;
  margin-bottom: spacing-vars.$space-5;
}

.stat-item {
  @include mixins.flex-between;
  padding: spacing-vars.$space-3;
  background: color-vars.$color-bg-secondary;
  border-radius: radius-vars.$radius-lg;
  border: 1px solid color-vars.$color-border-light;
}

.stat-label {
  font-size: typography-vars.$font-size-sm;
  color: color-vars.$color-text-secondary;
  font-weight: typography-vars.$font-weight-medium;
}

.stat-value {
  font-size: typography-vars.$font-size-sm;
  color: color-vars.$color-text;
  font-weight: typography-vars.$font-weight-semibold;
  font-variant-numeric: tabular-nums;
  font-family: monospace;
}

.operation-detail {
  background: color-vars.$color-bg-tertiary;
  border-radius: radius-vars.$radius-lg;
  padding: spacing-vars.$space-3;
  font-size: typography-vars.$font-size-sm;
  color: color-vars.$color-text-secondary;
  border-left: 4px solid color-vars.$color-primary;
  word-break: break-word;
  font-family: monospace;
}

.latest-log-entry {
  background: color-vars.$color-bg-secondary;
  border-radius: radius-vars.$radius-lg;
  padding: spacing-vars.$space-2 spacing-vars.$space-3;
  margin-top: spacing-vars.$space-3;
  font-size: typography-vars.$font-size-sm;
  font-family: monospace;
  color: color-vars.$color-text-secondary;
  border-left: 3px solid color-vars.$color-border;
  word-break: break-word;
  white-space: pre-wrap;

  &.log-level-success { border-left-color: color-vars.$color-success; }
  &.log-level-warn    { border-left-color: color-vars.$color-warning; }
  &.log-level-error   { border-left-color: color-vars.$color-error; }
}

@mixin button-base {
  border: none;
  padding: spacing-vars.$space-3 spacing-vars.$space-5;
  border-radius: radius-vars.$radius-md;
  font-weight: typography-vars.$font-weight-medium;
  cursor: pointer;
  transition: all 0.2s;
  font-size: typography-vars.$font-size-sm;

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    background: color-vars.$color-border;
    color: color-vars.$color-text-secondary;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
}

.stop-button {
  @include button-base;
  background: color-vars.$color-error;
  color: white;

  &:hover:not(:disabled) {
    background: color-vars.$color-error-hover;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
  }
}

.close-button {
  @include button-base;
  background: color-vars.$color-secondary;
  color: white;

  &:hover:not(:disabled) {
    background: #4b5563;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(107, 114, 128, 0.3);
  }
}

.completion-badge {
  color: color-vars.$color-success;
  margin-left: spacing-vars.$space-2;
  font-size: typography-vars.$font-size-lg;
}

/* 超时状态颜色样式 */
.time-warning {
  color: color-vars.$color-warning !important;
}

.time-danger {
  color: color-vars.$color-error !important;
}

.time-timeout {
  color: #dc2626 !important;
  font-weight: bold !important;
}
</style>
