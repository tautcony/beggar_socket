<template>
  <RetroModal
    v-model="localVisible"
    :title="modalTitle"
    :close-disabled="true"
    :width="500"
    @close="handleClose"
  >
    <template #header>
      <h3 class="modal-title">
        {{ modalTitle }}
        <span
          class="status-badge"
          :class="statusBadgeClass"
        >
          <RetroIcon :icon="statusBadgeIcon" />
          <span>{{ statusBadgeText }}</span>
        </span>
      </h3>
    </template>
    <div class="modal-body">
      <!-- Progress Bar -->
      <div class="progress-section">
        <div class="progress-bar-container">
          <div
            class="progress-bar-fill"
            :class="{ 'progress-bar-fill--instant': useInstantProgressFill }"
            :style="progressBarFillStyle"
          />
        </div>
        <div class="progress-percentage">
          {{ normalizedProgress.toFixed(1) }}%
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

      <div class="detail-section">
        <template v-if="supplementaryEntry">
          <details
            v-if="supplementaryEntry.error || supplementaryEntry.details"
            class="supplementary-disclosure"
          >
            <summary
              class="latest-log-entry"
              :class="[
                `log-level-${supplementaryEntry.level}`,
                { 'latest-log-entry--error': supplementaryEntry.level === 'error' },
              ]"
            >
              <span class="latest-log-message">{{ supplementaryEntry.message }}</span>
              <span class="latest-log-expand-button">{{ $t('ui.common.details') }}</span>
            </summary>
            <div class="supplementary-subitems">
              <div
                v-if="supplementaryEntry.error"
                class="supplementary-subitem"
              >
                <span class="supplementary-subitem-label">{{ $t('ui.common.error') }}</span>
                <pre class="supplementary-subitem-content supplementary-subitem-content--error">{{ supplementaryEntry.error }}</pre>
              </div>
              <div
                v-if="supplementaryEntry.details"
                class="supplementary-subitem"
              >
                <span class="supplementary-subitem-label">{{ $t('ui.common.detail') }}</span>
                <pre class="supplementary-subitem-content">{{ supplementaryEntry.details }}</pre>
              </div>
            </div>
          </details>
          <div
            v-else
            class="latest-log-entry"
            :class="[
              `log-level-${supplementaryEntry.level}`,
              { 'latest-log-entry--error': supplementaryEntry.level === 'error' },
            ]"
          >
            {{ supplementaryEntry.message }}
          </div>
        </template>
      </div>
    </div>
    <template #footer>
      <RetroButton
        variant="danger"
        size="sm"
        :disabled="(!allowCancel) || state === 'completed' || state === 'error'"
        @click="handleStop"
      >
        {{ $t('ui.progress.stop') }}
      </RetroButton>
      <RetroButton
        variant="secondary"
        size="sm"
        :disabled="state === 'running'"
        @click="handleClose"
      >
        {{ $t('ui.progress.close') }}
      </RetroButton>
    </template>
  </RetroModal>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import SectorVisualization from '@/components/progress/SectorVisualization.vue';
import { RetroButton, RetroIcon, RetroModal } from '@/components/retro';
import type { BurnerLogEntry } from '@/types/burner-log';
import { ProgressInfo } from '@/types/progress-info';
import { formatBurnerLogMessage } from '@/utils/burner-log';
import { formatBytes, formatSpeed, formatTimeClock } from '@/utils/formatter-utils';

type SupplementaryEntry = Pick<BurnerLogEntry, 'message' | 'error' | 'details' | 'level'>;

const props = defineProps<ProgressInfo & {
  modelValue: boolean;
  timeout?: number; // 超时时间（毫秒）
  latestLog?: BurnerLogEntry;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  stop: []
  close: []
}>();

const { t } = useI18n();

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
const instantProgressFill = ref(false);
let timer: number | undefined;
let instantProgressFrame: number | undefined;
let releaseProgressFrame: number | undefined;
const TIME_REFRESH_INTERVAL_MS = 100;

const normalizedProgress = computed(() => {
  const value = typeof props.progress === 'number' ? props.progress : 0;
  return Math.max(0, Math.min(100, value));
});

const useInstantProgressFill = computed(() => instantProgressFill.value);

const progressBarFillStyle = computed(() => ({
  width: `${normalizedProgress.value}%`,
}));

function clearProgressFillFrames() {
  if (instantProgressFrame !== undefined) {
    cancelAnimationFrame(instantProgressFrame);
    instantProgressFrame = undefined;
  }
  if (releaseProgressFrame !== undefined) {
    cancelAnimationFrame(releaseProgressFrame);
    releaseProgressFrame = undefined;
  }
}

function snapProgressFillToCurrentValue() {
  clearProgressFillFrames();
  instantProgressFill.value = true;
  instantProgressFrame = requestAnimationFrame(() => {
    instantProgressFrame = undefined;
    releaseProgressFrame = requestAnimationFrame(() => {
      releaseProgressFrame = undefined;
      instantProgressFill.value = false;
    });
  });
}

const isCompleted = computed(() => {
  return props.progress === 100 || props.state === 'completed';
});

const isTerminalState = computed(() => {
  return isCompleted.value || props.state === 'paused' || props.state === 'error';
});

const modalTitle = computed(() => {
  return t('ui.progress.title');
});

function normalizeComparableText(value: string | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

function messagesOverlap(first: string, second: string): boolean {
  return first === second || first.includes(second) || second.includes(first);
}

const currentDetail = computed(() => {
  return props.detail?.trim() ?? '';
});

const supplementaryEntry = computed<SupplementaryEntry | undefined>(() => {
  if (props.state !== 'running' && currentDetail.value) {
    if (props.latestLog) {
      const detailText = normalizeComparableText(currentDetail.value);
      const latestLogText = normalizeComparableText(formatBurnerLogMessage(props.latestLog));
      if (detailText && latestLogText && messagesOverlap(detailText, latestLogText)) {
        return props.latestLog;
      }
    }

    return {
      message: currentDetail.value,
      level: props.state === 'error' ? 'error' : 'info',
      error: undefined,
      details: undefined,
    };
  }

  if (!props.latestLog) {
    return undefined;
  }

  const detailText = normalizeComparableText(currentDetail.value);
  const latestLogText = normalizeComparableText(formatBurnerLogMessage(props.latestLog));
  if (detailText && latestLogText && messagesOverlap(detailText, latestLogText)) {
    return undefined;
  }

  return props.latestLog;
});

const statusBadgeText = computed(() => {
  if (props.state === 'error') return t('ui.progress.status.error');
  if (props.state === 'completed') return t('ui.progress.status.completed');
  if (props.state === 'paused') return t('ui.progress.status.paused');
  return t('ui.progress.status.running');
});

const statusBadgeIcon = computed(() => {
  if (props.state === 'error') return 'pixelarticons:alert';
  if (props.state === 'completed') return 'pixelarticons:check';
  if (props.state === 'paused') return 'pixelarticons:pause';
  return 'pixelarticons:sync';
});

const statusBadgeClass = computed(() => {
  if (props.state === 'error') return 'status-badge--error';
  if (props.state === 'completed') return 'status-badge--completed';
  if (props.state === 'paused') return 'status-badge--paused';
  return 'status-badge--running';
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

watch(
  [() => props.type, normalizedProgress],
  ([type, progress], [prevType, prevProgress]) => {
    if (prevType === undefined || prevProgress === undefined) {
      return;
    }

    if (type !== prevType || progress < prevProgress) {
      snapProgressFillToCurrentValue();
    }
  },
);

// 监听其他可能表示数据更新的属性
watch([
  () => props.transferredBytes,
  () => props.currentSpeed,
  () => props.detail,
], () => {
  lastUpdateTime.value = Date.now();
});

onUnmounted(() => {
  clearProgressFillFrames();
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
@use '@/styles/variables/spacing' as spacing-vars;
@use '@/styles/variables/typography' as typography-vars;
@use '@/styles/variables/radius' as radius-vars;
@use '@/styles/mixins' as mixins;

.progress-section {
  margin-bottom: spacing-vars.$space-6;
}

.progress-bar-container {
  background: var(--retro-bg-elevated);
  border: var(--retro-border-width) solid var(--retro-border);
  border-radius: 4px;
  height: 12px;
  overflow: hidden;
  margin-bottom: spacing-vars.$space-2;
}

.progress-bar-fill {
  background: var(--retro-primary-bg);
  height: 100%;
  width: 0;
  transition: width 0.08s linear;
  position: relative;
  will-change: width;
  backface-visibility: hidden;
}

.progress-bar-fill--instant {
  transition: none;
}

.progress-percentage {
  text-align: center;
  font-weight: typography-vars.$font-weight-semibold;
  font-size: typography-vars.$font-size-lg;
  color: var(--color-text);
  font-family: var(--retro-font-mono);
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: spacing-vars.$space-4;
  margin-bottom: spacing-vars.$space-5;
}

.detail-section {
  margin-top: spacing-vars.$space-3;
  min-height: 44px;
}

.modal-title {
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-3;
  margin: 0;
  font-size: typography-vars.$font-size-base;
  font-weight: typography-vars.$font-weight-bold;
  color: var(--retro-ink);
  line-height: var(--line-height-normal);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: spacing-vars.$space-1;
  margin-left: auto;
  padding: 3px 8px;
  border-radius: 4px;
  font-family: var(--retro-font-micro);
  font-size: var(--font-size-micro);
  font-weight: typography-vars.$font-weight-bold;
  line-height: 1;
  border: var(--retro-border-width) solid var(--retro-border);
  color: var(--retro-ink);
  background: var(--retro-bg-surface);

  :deep(svg) {
    font-size: typography-vars.$font-size-sm;
  }
}

.status-badge--running {
  background: var(--retro-bg-tint);
}

.status-badge--completed {
  background: var(--retro-success-bg);
}

.status-badge--paused {
  background: var(--retro-warning-bg);
}

.status-badge--error {
  color: var(--retro-danger-fg);
  background: var(--retro-danger-bg);
}

.stat-item {
  @include mixins.flex-between;
  padding: spacing-vars.$space-2 spacing-vars.$space-3;
  background: var(--retro-bg-elevated);
  border-radius: 4px;
  border: 1px solid var(--retro-border-subtle);
}

.stat-label {
  font-size: typography-vars.$font-size-xs;
  color: var(--retro-ink-muted);
  font-weight: typography-vars.$font-weight-semibold;
}

.stat-value {
  font-size: typography-vars.$font-size-xs;
  color: var(--retro-ink);
  font-weight: typography-vars.$font-weight-bold;
  font-variant-numeric: tabular-nums;
  font-family: var(--retro-font-mono);
}

.latest-log-entry {
  display: flex;
  align-items: flex-start;
  gap: spacing-vars.$space-2;
  background: var(--color-bg-secondary);
  border-radius: radius-vars.$radius-lg;
  padding: spacing-vars.$space-2 spacing-vars.$space-3;
  font-size: typography-vars.$font-size-sm;
  font-family: var(--retro-font-mono);
  color: var(--color-text-secondary);
  border-left: 3px solid var(--color-border);
  word-break: break-word;
  white-space: pre-wrap;

  &.log-level-success { border-left-color: var(--color-success); }
  &.log-level-warn    { border-left-color: var(--color-warning); }
  &.log-level-error   { border-left-color: var(--color-error); }
}

.latest-log-entry::-webkit-details-marker {
  display: none;
}

.supplementary-disclosure {
  display: block;
  width: 100%;
}

.supplementary-disclosure > summary {
  cursor: pointer;
  list-style: none;
}

.latest-log-entry--error {
  color: var(--color-error);
  background: rgba(239, 68, 68, 0.08);
}

.latest-log-message {
  min-width: 0;
}

.latest-log-expand-button {
  flex-shrink: 0;
  margin-left: auto;
  padding: 0 spacing-vars.$space-2;
  border: 1px solid var(--color-border);
  border-radius: radius-vars.$radius-sm;
  color: var(--color-text-secondary);
  font-size: typography-vars.$font-size-xs;
  line-height: 20px;
}

.supplementary-disclosure[open] .latest-log-expand-button {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.supplementary-subitems {
  margin-top: spacing-vars.$space-2;
  display: grid;
  gap: spacing-vars.$space-2;
}

.supplementary-subitem {
  display: grid;
  grid-template-columns: 52px 1fr;
  gap: spacing-vars.$space-2;
  align-items: start;
}

.supplementary-subitem-label {
  color: var(--color-text-tertiary);
  font-size: typography-vars.$font-size-xs;
  line-height: var(--line-height-relaxed);
}

.supplementary-subitem-content {
  margin: 0;
  padding: spacing-vars.$space-2 spacing-vars.$space-3;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-light);
  border-radius: radius-vars.$radius-md;
  color: var(--color-text-secondary);
  font-family: var(--retro-font-mono);
  font-size: typography-vars.$font-size-xs;
  white-space: pre-wrap;
  word-break: break-word;
}

.supplementary-subitem-content--error {
  color: var(--color-error);
  border-color: rgba(239, 68, 68, 0.24);
}

/* 超时状态颜色样式 */
.time-warning {
  color: var(--color-warning) !important;
}

.time-danger {
  color: var(--color-error) !important;
}

.time-timeout {
  color: #dc2626 !important;
  font-weight: var(--font-weight-bold);
}
</style>
