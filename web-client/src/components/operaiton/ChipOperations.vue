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
          :title="String(deviceSize ?? '--')"
        >{{ deviceSize ?? '--' }}</span>
        <span class="chip-info-label">{{ $t('ui.chip.sectorCount') }}:</span>
        <span
          class="chip-info-value"
          :title="sectorCount ?? '--'"
        >{{ sectorCount ?? '--' }}</span>
      </div>
      <div class="chip-info-row">
        <span class="chip-info-label">{{ $t('ui.chip.sectorSize') }}:</span>
        <span
          class="chip-info-value"
          :title="sectorSize ?? '--'"
        >{{ sectorSize ?? '--' }}</span>
        <span class="chip-info-label">{{ $t('ui.chip.bufferWrite') }}:</span>
        <span
          class="chip-info-value"
          :title="String(bufferWriteBytes ?? '--')"
        >{{ bufferWriteBytes ?? '--' }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  deviceReady: boolean;
  busy: boolean;
  idStr?: string;
  deviceSize?: number | string;
  sectorCount?: string;
  sectorSize?: string;
  bufferWriteBytes?: number | string;
}>(), {
  idStr: '',
  deviceSize: undefined,
  sectorCount: undefined,
  sectorSize: undefined,
  bufferWriteBytes: undefined,
});

// 检查芯片信息是否有效
const chipInfoValid = computed(() => {
  // 检查是否所有必要的参数都有值
  if (!props.deviceSize || !props.sectorCount || !props.sectorSize) {
    return false;
  }

  // 支持逗号或其他分隔符分隔的一组数据，解析每一个数字
  const parseAllNumbers = (val: string | number | undefined): number[] => {
    if (typeof val === 'number') return [val];
    if (typeof val === 'string') {
      // 匹配所有数字（支持负号和小数点），以逗号、空格等分隔
      return (val.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    }
    return [];
  };

  // 检查是否为有效数字（不为 NaN 或 Infinity）
  const isValidNumber = (num: number) =>
    !isNaN(num) && isFinite(num) && num > 0;

  const deviceSizeNum = Number(props.deviceSize);
  const sectorCountNums = parseAllNumbers(props.sectorCount);
  const sectorSizeNums = parseAllNumbers(props.sectorSize);

  return (
    isValidNumber(deviceSizeNum) &&
    sectorCountNums.length > 0 &&
    sectorSizeNums.length > 0 &&
    sectorCountNums.every(isValidNumber) &&
    sectorSizeNums.every(isValidNumber)
  );
});

defineEmits(['read-id', 'erase-chip', 'read-rom-info']);
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
  gap: 4px;
  margin-bottom: 2px;
  align-items: center;
  width: 100%;
}

.chip-info-row.id-row {
  margin-bottom: 6px;
}

.chip-info-row:not(.id-row) {
  justify-content: flex-start;
}

.chip-info-label {
  min-width: 70px;
  color: #1976d2;
  font-weight: 600;
  font-size: 0.8em;
  white-space: nowrap;
}

.chip-info-value {
  font-family: monospace;
  color: #333;
  font-size: 0.8em;
  margin-right: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip-info-row:not(.id-row) > .chip-info-label,
.chip-info-row:not(.id-row) > .chip-info-value {
  flex: 1 1 0;
  min-width: 0;
}

.chip-info-row:not(.id-row) > .chip-info-label:last-of-type,
.chip-info-row:not(.id-row) > .chip-info-value:last-of-type {
  margin-left: 8%;
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
