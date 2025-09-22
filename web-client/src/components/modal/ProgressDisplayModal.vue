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

      <!-- Sector Visualization (for erase, write, and verify operations) -->
      <div
        v-if="sectorProgress && (type === 'erase' || type === 'write' || type === 'verify')"
        class="sector-visualization"
      >
        <div class="sector-title">
          {{ $t('ui.progress.sectorMap') }}
          <span class="sector-counter">
            {{ sectorProgress.completedSectors }} / {{ sectorProgress.totalSectors }}
          </span>
        </div>
        <div class="sector-grid">
          <div
            v-for="sector in sortedSectors"
            :key="`sector-${sector.address}`"
            class="sector-block"
            :class="{
              'sector-pending': sector.state === 'pending',
              'sector-processing': sector.state === 'processing',
              'sector-completed': sector.state === 'completed',
              'sector-error': sector.state === 'error',
              'sector-current': sector.state === 'processing',
              [`sector-size-${getSectorSizeClass(sector.size)}`]: true
            }"
            :title="$t('ui.progress.sectorTooltip', {
              address: formatHex(sector.address, 4),
              size: formatBytes(sector.size),
              state: $t(`ui.progress.sectorState.${sector.state}`)
            })"
          >
            <div class="sector-inner">
              <div
                v-if="sector.state === 'processing'"
                class="sector-spinner"
              />
            </div>
          </div>
        </div>
        <div class="sector-legend">
          <!-- 第一排：扇区大小组 -->
          <div class="legend-row">
            <!-- Small 扇区组 -->
            <div
              v-if="existingSectorSizes.has('small')"
              class="legend-group"
            >
              <span class="legend-size-label">{{ formatBytes(sectorSizeLabels.small) }}:</span>
              <div class="legend-item">
                <div class="legend-color sector-pending sector-size-small" />
                <span>{{ $t('ui.progress.sectorState.pending') }}</span>
              </div>
              <div class="legend-item">
                <div class="legend-color sector-completed sector-size-small" />
                <span>{{ $t('ui.progress.sectorState.completed') }}</span>
              </div>
            </div>

            <!-- Medium 扇区组 -->
            <div
              v-if="existingSectorSizes.has('medium')"
              class="legend-group"
            >
              <span class="legend-size-label">{{ formatBytes(sectorSizeLabels.medium) }}:</span>
              <div class="legend-item">
                <div class="legend-color sector-pending sector-size-medium" />
                <span>{{ $t('ui.progress.sectorState.pending') }}</span>
              </div>
              <div class="legend-item">
                <div class="legend-color sector-completed sector-size-medium" />
                <span>{{ $t('ui.progress.sectorState.completed') }}</span>
              </div>
            </div>

            <!-- Large 扇区组 -->
            <div
              v-if="existingSectorSizes.has('large')"
              class="legend-group"
            >
              <span class="legend-size-label">{{ formatBytes(sectorSizeLabels.large) }}:</span>
              <div class="legend-item">
                <div class="legend-color sector-pending sector-size-large" />
                <span>{{ $t('ui.progress.sectorState.pending') }}</span>
              </div>
              <div class="legend-item">
                <div class="legend-color sector-completed sector-size-large" />
                <span>{{ $t('ui.progress.sectorState.completed') }}</span>
              </div>
            </div>
            <div class="legend-group">
              <div class="legend-item">
                <div class="legend-color sector-processing" />
                <span>{{ $t('ui.progress.sectorState.processing') }}</span>
              </div>
            </div>
          </div>
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
import { formatBytes, formatHex, formatSpeed, formatTimeClock } from '@/utils/formatter-utils';

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

// 根据扇区大小返回样式类名
function getSectorSizeClass(sectorSize: number): string {
  if (sectorSize <= 0x1000) { // 4KB or smaller
    return 'small';
  } else if (sectorSize <= 0x8000) { // 32KB or smaller
    return 'medium';
  } else {
    return 'large'; // 64KB or larger
  }
}

// 按地址排序的扇区列表
const sortedSectors = computed(() => {
  if (!props.sectorProgress?.sectors) return [];
  return [...props.sectorProgress.sectors].sort((a, b) => a.address - b.address);
});

// 获取实际存在的扇区大小类型
const existingSectorSizes = computed(() => {
  if (!props.sectorProgress?.sectors) return new Set();

  const sizes = new Set<string>();
  props.sectorProgress.sectors.forEach(sector => {
    sizes.add(getSectorSizeClass(sector.size));
  });
  return sizes;
});

// 获取每种大小的扇区实际字节数
const sectorSizeLabels = computed(() => {
  if (!props.sectorProgress?.sectors) return {};

  const sizeMap: Record<string, number> = {};
  props.sectorProgress.sectors.forEach(sector => {
    const sizeClass = getSectorSizeClass(sector.size);
    if (!sizeMap[sizeClass] || sector.size < sizeMap[sizeClass]) {
      sizeMap[sizeClass] = sector.size;
    }
  });
  return sizeMap;
});

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

/* 扇区可视化样式 */
.sector-visualization {
  margin: spacing-vars.$space-5 0;
  padding: spacing-vars.$space-4;
  background: color-vars.$color-bg-secondary;
  border-radius: radius-vars.$radius-lg;
  border: 1px solid color-vars.$color-border-light;
}

.sector-title {
  @include mixins.flex-between;
  margin-bottom: spacing-vars.$space-3;
  font-size: typography-vars.$font-size-sm;
  font-weight: typography-vars.$font-weight-semibold;
  color: color-vars.$color-text;
}

.sector-counter {
  font-family: monospace;
  background: color-vars.$color-bg-tertiary;
  padding: spacing-vars.$space-1 spacing-vars.$space-2;
  border-radius: radius-vars.$radius-base;
  font-size: typography-vars.$font-size-xs;
  color: color-vars.$color-text-secondary;
}

.sector-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-bottom: spacing-vars.$space-3;
  max-height: 200px;
  overflow-y: auto;
  overflow-x: hidden;
  justify-content: flex-start;
  align-content: flex-start;
}

.sector-block {
  width: 16px;
  height: 16px;
  border-radius: radius-vars.$radius-sm;
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover {
    transform: scale(1.1);
    z-index: 10;
  }
}

.sector-inner {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  @include mixins.flex-center;
}

/* 扇区状态颜色 */
.sector-pending {
  border: 1px solid color-vars.$color-border;

  &.sector-size-small {
    background: #ddd6fe; /* 浅紫色 - 4KB */
  }

  &.sector-size-medium {
    background: #bfdbfe; /* 浅蓝色 - 32KB */
  }

  &.sector-size-large {
    background: color-vars.$color-bg-tertiary; /* 浅灰色 - 64KB+ */
  }
}

.sector-processing {
  background: color-vars.$color-warning;
  border: 1px solid #f59e0b;
  animation: sectorPulse 1s infinite;
}

.sector-completed {
  border: 1px solid #15803d;

  &.sector-size-small {
    background: #a855f7; /* 紫色 - 4KB 完成 */
  }

  &.sector-size-medium {
    background: color-vars.$color-primary; /* 蓝色 - 32KB 完成 */
  }

  &.sector-size-large {
    background: color-vars.$color-success; /* 绿色 - 64KB+ 完成 */
  }
}

.sector-error {
  background: color-vars.$color-error;
  border: 1px solid #dc2626;
}

.sector-current {
  box-shadow: 0 0 0 2px color-vars.$color-primary;
  z-index: 5;
}

/* 擦除动画 */
@keyframes sectorPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.sector-spinner {
  width: 8px;
  height: 8px;
  border: 1px solid #ffffff;
  border-top: 1px solid transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 图例 */
.sector-legend {
  @include mixins.flex-column;
  gap: spacing-vars.$space-2;
  font-size: typography-vars.$font-size-xs;
  color: color-vars.$color-text-secondary;
}

.legend-row {
  display: flex;
  flex-wrap: wrap;
  gap: spacing-vars.$space-3;
  align-items: center;
  justify-content: center;
}

.legend-group {
  display: flex;
  flex-wrap: wrap;
  gap: spacing-vars.$space-2;
  align-items: center;
  padding: spacing-vars.$space-1 spacing-vars.$space-2;
  background: rgba(0, 0, 0, 0.02);
  border-radius: radius-vars.$radius-base;
  border: 1px solid rgba(0, 0, 0, 0.05);
  min-width: 0;
  flex-shrink: 1;
}

.legend-size-label {
  font-weight: typography-vars.$font-weight-semibold;
  color: color-vars.$color-text;
  font-size: typography-vars.$font-size-xs;
  margin-right: spacing-vars.$space-1;
  white-space: nowrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-1;
  font-size: typography-vars.$font-size-xs;
  flex-shrink: 0;
  min-width: 0;

  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: radius-vars.$radius-sm;
  border: 1px solid;

  &.sector-pending {
    border-color: color-vars.$color-border;

    &.sector-size-small {
      background: #ddd6fe;
    }

    &.sector-size-medium {
      background: #bfdbfe;
    }

    &.sector-size-large {
      background: color-vars.$color-bg-tertiary;
    }
  }

  &.sector-processing {
    background: color-vars.$color-warning;
    border-color: #f59e0b;
  }

  &.sector-completed.sector-size-small {
    background: #a855f7;
    border-color: #15803d;
  }
}
</style>
