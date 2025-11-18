<template>
  <section class="section">
    <div class="section-header">
      <div class="op-title-row">
        <span :class="['op-title', { busy }]">{{ $t('ui.operation.title') }}</span>
      </div>
      <div
        v-if="props.mode === 'MBC5'"
        class="selector-container"
      >
        <div class="mbc-type-selector">
          <label class="mbc-type-label">{{ $t('ui.mbc.typeLabel') }}</label>
          <select
            :value="props.selectedMbcType"
            class="mbc-type-dropdown"
            :disabled="!deviceReady || busy"
            @change="$emit('mbc-type-change', ($event.target as HTMLSelectElement).value)"
          >
            <option
              v-for="option in mbcTypeOptions"
              :key="option"
              :value="option"
            >
              {{ option }}
            </option>
          </select>
        </div>
        <div class="mbc-power-selector">
          <ToggleSwitch
            :model-value="props.mbcPower5V"
            :disabled="!deviceReady || busy"
            :label="$t('ui.mbc.power5vLabel')"
            :tooltip="$t('ui.mbc.power5vTooltip')"
            @update:model-value="$emit('mbc-power-change', $event)"
          />
        </div>
      </div>
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
import ToggleSwitch from '@/components/common/ToggleSwitch.vue';
import type { MbcType } from '@/types/command-options';
import { formatBytes } from '@/utils/formatter-utils';

const props = withDefaults(defineProps<{
  deviceReady: boolean;
  busy: boolean;
  chipId?: number[];
  deviceSize?: number;
  sectorCounts?: number[];
  sectorSizes?: number[];
  bufferWriteBytes?: number;
  mode?: 'GBA' | 'MBC5';
  selectedMbcType?: MbcType;
  mbcPower5V?: boolean;
}>(), {
  chipId: undefined,
  deviceSize: undefined,
  sectorCounts: undefined,
  sectorSizes: undefined,
  bufferWriteBytes: undefined,
  mode: 'GBA',
  selectedMbcType: 'MBC5',
  mbcPower5V: false,
});

const mbcTypeOptions: MbcType[] = ['MBC1', 'MBC2', 'MBC3', 'MBC5'];

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

defineEmits<{
  'read-id': [];
  'erase-chip': [];
  'read-rom-info': [];
  'mbc-type-change': [value: string];
  'mbc-power-change': [value: boolean];
}>();
</script>

<style scoped>
.section {
  margin-bottom: var(--space-7);
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-3);
  gap: var(--space-4);
  min-width: 0;
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

/* MBC 设置样式 - 与 RamOperations 保持一致 */
.selector-container {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
  min-width: 0;
  margin-bottom: var(--space-3);
}

.mbc-type-selector,
.mbc-power-selector {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: fit-content;
  flex-shrink: 0;
}

.mbc-type-selector > *,
.mbc-power-selector > * {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.mbc-type-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
  white-space: nowrap;
}

.mbc-type-dropdown {
  padding: var(--space-1) var(--space-2);
  border: none;
  border-radius: var(--radius-base);
  box-shadow: var(--shadow-sm);
  background: var(--color-bg);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
  min-width: 80px;
  max-width: 180px;
  white-space: nowrap;
}

.mbc-type-dropdown:hover:not(:disabled) {
  box-shadow: var(--shadow-md);
}

.mbc-type-dropdown:disabled {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  cursor: not-allowed;
}
</style>
