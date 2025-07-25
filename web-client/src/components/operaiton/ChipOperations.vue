<template>
  <section class="section">
    <div class="op-title-row">
      <span :class="['op-title', { busy }]">{{ $t('ui.operation.title') }}</span>
    </div>
    <div class="button-row">
      <button
        :disabled="!deviceReady || busy"
        @click="$emit('read-id')"
      >
        {{ $t('ui.operation.readId') }}
      </button>
      <button
        :disabled="!deviceReady || busy || !chipInfoValid"
        @click="$emit('read-rom-info')"
      >
        {{ $t('ui.operation.readRom') }}
      </button>
      <button
        :disabled="!deviceReady || busy || !chipInfoValid"
        @click="$emit('erase-chip')"
      >
        {{ $t('ui.operation.eraseChip') }}
      </button>
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

import { formatBytes } from '@/utils/formatter-utils';

const props = withDefaults(defineProps<{
  deviceReady: boolean;
  busy: boolean;
  idStr?: string;
  deviceSize?: number;
  sectorCounts?: number[];
  sectorSizes?: number[];
  bufferWriteBytes?: number;
}>(), {
  idStr: '',
  deviceSize: undefined,
  sectorCounts: undefined,
  sectorSizes: undefined,
  bufferWriteBytes: undefined,
});

const idStr = computed(() => {
  return props.idStr ?? '--';
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
  margin-bottom: 28px;
}

.op-title-row {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-bottom: 10px;
  min-width: 0;
}

.op-title {
  font-size: 1.15rem;
  color: #2c3e50;
  font-weight: 600;
  transition: color 0.2s, font-weight 0.2s;
  white-space: nowrap;
}
.op-title.busy {
  color: #e67e22;
  font-weight: bold;
}

.button-row {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.chip-info-display {
  margin-top: 10px;
  background: #f4f8fd;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 0.98rem;
  color: #2c3e50;
  box-shadow: 0 1px 4px #1976d210;
}

.chip-info-row {
  display: flex;
  align-items: center;
  width: 100%;
  margin-bottom: 2px;
}

.chip-info-row.id-row {
  margin-bottom: 6px;
}

.chip-info-label {
  min-width: 60px;
  max-width: 80px;
  width: 60px;
  color: #1976d2;
  font-weight: 600;
  font-size: 0.8em;
  white-space: nowrap;
  flex: none;
  margin-right: 8px;
}

.chip-info-value {
  flex: 1 1 0;
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', 'Menlo', 'Consolas', monospace;
  color: #333;
  font-size: 0.8em;
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

.chip-info-row:last-child {
  margin-bottom: 0;
}

button {
  padding: 6px 16px;
  border-radius: 5px;
  border: 1px solid #bbb;
  background: #f5f7fa;
  cursor: pointer;
  font-size: 0.95rem;
  transition: background 0.2s, color 0.2s;
  outline: none;
  white-space: nowrap;
  min-width: fit-content;
  flex: 1 1 auto;
}

button:focus {
  outline: none;
}

button:disabled {
  background: #eee;
  color: #aaa;
  cursor: not-allowed;
}

button:not(:disabled):hover {
  background: #e3f2fd;
  color: #1976d2;
}
</style>
