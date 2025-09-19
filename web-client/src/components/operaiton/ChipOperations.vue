<template>
  <section class="section">
    <div class="op-title-row">
      <span :class="['op-title', { busy }]">{{ $t('ui.operation.title') }}</span>
    </div>
    <div class="button-row">
      <BaseButton
        :disabled="!deviceReady || busy"
        variant="primary"
        :text="$t('ui.operation.readId')"
        @click="$emit('read-id')"
      />
      <BaseButton
        :disabled="!deviceReady || busy || !chipInfoValid"
        variant="primary"
        :text="$t('ui.operation.readRom')"
        @click="$emit('read-rom-info')"
      />
      <BaseButton
        :disabled="!deviceReady || busy || !chipInfoValid"
        variant="error"
        :text="$t('ui.operation.eraseChip')"
        @click="$emit('erase-chip')"
      />
    </div>
    <div class="chip-info-display">
      <div class="chip-info-row id-row">
        <span class="chip-info-label">ID:</span>
        <span
          class="chip-info-value"
          :title="idStr || '--'"
        >{{ idStr || '--' }}</span>
      </div>
      <div class="chip-info-row">
        <span class="chip-info-label">{{ $t('ui.chip.deviceSize') }}:</span>
        <span
          class="chip-info-value"
          :title="deviceSizeStr"
        >{{ deviceSizeStr }}</span>
        <span class="chip-info-label">{{ $t('ui.chip.sectorCount') }}:</span>
        <span
          class="chip-info-value"
          :title="sectorCountStr"
        >{{ sectorCountStr }}</span>
      </div>
      <div class="chip-info-row">
        <span class="chip-info-label">{{ $t('ui.chip.bufferWrite') }}:</span>
        <span
          class="chip-info-value"
          :title="bufferWriteBytesStr"
        >{{ bufferWriteBytesStr }}</span>

        <span class="chip-info-label">{{ $t('ui.chip.sectorSize') }}:</span>
        <span
          class="chip-info-value"
          :title="sectorSizeStr"
        >{{ sectorSizeStr }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import BaseButton from '@/components/common/BaseButton.vue';
import { formatBytes } from '@/utils/formatter-utils';

const props = withDefaults(defineProps<{
  deviceReady: boolean;
  busy: boolean;
  chipId?: number[];
  deviceSize?: number;
  sectorCounts?: number[];
  sectorSizes?: number[];
  bufferWriteBytes?: number;
}>(), {
  chipId: undefined,
  deviceSize: undefined,
  sectorCounts: undefined,
  sectorSizes: undefined,
  bufferWriteBytes: undefined,
});

const idStr = computed(() => {
  return props.chipId?.map(x => x.toString(16).padStart(2, '0')).join(' ') ?? '--';
});

const deviceSizeStr = computed(() => {
  return props.deviceSize ? formatBytes(props.deviceSize) : '--';
});

const sectorCountStr = computed(() => {
  return props.sectorCounts ? props.sectorCounts.join(', ') : '--';
});

const sectorSizeStr = computed(() => {
  return props.sectorSizes ? props.sectorSizes.map(size => formatBytes(size)).join(', ') : '--';
});

const bufferWriteBytesStr = computed(() => {
  return props.bufferWriteBytes ? formatBytes(props.bufferWriteBytes) : '--';
});

// 检查芯片信息是否有效
const chipInfoValid = computed(() => {
  // 检查是否所有必要的参数都有值
  if (!props.deviceSize || !props.sectorCounts || !props.sectorSizes) {
    return false;
  }

  // 检查是否为有效数字（不为 NaN 或 Infinity）
  const isValidNumber = (num: number) =>
    !isNaN(num) && isFinite(num) && num > 0;

  return (
    isValidNumber(props.deviceSize) &&
    props.sectorCounts.length > 0 &&
    props.sectorSizes.length > 0 &&
    props.sectorCounts.every(isValidNumber) &&
    props.sectorSizes.every(isValidNumber)
  );
});

const emits = defineEmits<{
  'read-id': [];
  'erase-chip': [];
  'read-rom-info': [];
}>();
</script>

<style scoped>
.section {
  margin-bottom: var(--space-7);
}

.op-title-row {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-bottom: var(--space-3);
  min-width: 0;
}

.op-title {
  font-size: var(--font-size-lg);
  color: var(--color-text);
  font-weight: var(--font-weight-semibold);
  transition: color 0.2s, font-weight 0.2s;
  white-space: nowrap;
}

.op-title.busy {
  color: var(--color-warning);
  font-weight: bold;
}

.button-row {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
  flex-wrap: wrap;
  min-width: 0;
}

.button-row > * {
  flex: 1 1 auto;
}

.chip-info-display {
  margin-top: var(--space-3);
  background: var(--color-primary-light);
  border-radius: var(--radius-base);
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.chip-info-row {
  display: flex;
  align-items: center;
  width: 100%;
  margin-bottom: var(--space-1);
}

.chip-info-row.id-row {
  margin-bottom: var(--space-2);
}

.chip-info-label {
  min-width: 60px;
  max-width: 80px;
  width: 60px;
  color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-xs);
  white-space: nowrap;
  flex: none;
  margin-right: var(--space-2);
}

.chip-info-value {
  flex: 1 1 0;
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', 'Menlo', 'Consolas', monospace;
  color: var(--color-text);
  font-size: var(--font-size-xs);
  margin-right: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip-info-row:not(.id-row) {
  justify-content: flex-start;
}

.chip-info-row:not(.id-row) > .chip-info-label:last-of-type,
.chip-info-row:not(.id-row) > .chip-info-value:last-of-type {
  margin-left: 0;
  justify-content: flex-start;
  text-align: left;
}
</style>
