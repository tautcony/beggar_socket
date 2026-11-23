<template>
  <RetroCard>
    <template #header-left>
      <span :class="['op-title', { busy }]">{{ $t('ui.operation.title') }}</span>
    </template>
    <template
      v-if="props.mode === 'MBC5'"
      #header-right
    >
      <div class="selector-container">
        <div class="mbc-type-selector">
          <label class="mbc-type-label">{{ $t('ui.mbc.typeLabel') }}</label>
          <RetroSelect
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
          </RetroSelect>
        </div>
        <div class="mbc-power-selector">
          <RetroSwitch
            :model-value="props.mbcPower5V"
            :disabled="!deviceReady || busy || !supportsCartPowerControl"
            :label="$t('ui.mbc.power5vLabel')"
            :tooltip="$t('ui.mbc.power5vTooltip')"
            @update:model-value="$emit('mbc-power-change', $event)"
          />
        </div>
      </div>
    </template>
    <div class="button-row">
      <RetroButton
        :disabled="!deviceReady || busy"
        variant="primary"
        :text="$t('ui.operation.readId')"
        @click="$emit('read-id')"
      />
      <RetroButton
        :disabled="!deviceReady || busy || !chipInfoValid"
        variant="secondary"
        :text="$t('ui.operation.readRom')"
        @click="$emit('read-rom-info')"
      />
      <RetroButton
        :disabled="!deviceReady || busy || !chipInfoValid"
        variant="danger"
        :text="$t('ui.operation.eraseChip')"
        @click="$emit('erase-chip')"
      />
    </div>
    <div
      v-if="showFlashcartProfileSelector"
      class="flashcart-profile-row"
    >
      <label class="flashcart-profile-label">{{ $t('ui.chip.flashcartProfile') }}</label>
      <RetroSelect
        :value="props.selectedFlashcartProfileId"
        class="flashcart-profile-dropdown"
        :disabled="!deviceReady || busy"
        @change="onFlashcartProfileChange(($event.target as HTMLSelectElement).value)"
      >
        <option value="">
          {{ $t('ui.chip.flashcartProfileAuto') }}
        </option>
        <option
          v-for="profile in filteredFlashcartProfiles"
          :key="profile.id"
          :value="profile.id"
        >
          {{ formatProfileLabel(profile) }}
        </option>
      </RetroSelect>
    </div>
    <div
      v-if="showFlashcartProfileSelector && filteredAmbiguousProfiles.length > 0"
      class="flashcart-ambiguous-box"
    >
      <div class="flashcart-ambiguous-title">
        {{ $t('ui.chip.flashcartProfileAmbiguous') }}
      </div>
      <div class="flashcart-ambiguous-list">
        <button
          v-for="candidate in filteredAmbiguousProfiles"
          :key="candidate.id"
          type="button"
          class="flashcart-ambiguous-item"
          :disabled="!deviceReady || busy"
          @click="onFlashcartProfileChange(candidate.id)"
        >
          {{ formatProfileLabel(candidate) }}
        </button>
      </div>
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
  </RetroCard>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';

import { CHIP_OPERATION_EVENTS, type ChipOperationsProps } from '@/components/operaiton/contracts';
import { RetroButton, RetroCard, RetroSelect, RetroSwitch } from '@/components/retro';
import type { MbcType } from '@/types/command-options';
import type { FlashcartProfileSummary } from '@/types/flashcart-profile';
import { formatBytes } from '@/utils/formatter-utils';

const props = withDefaults(defineProps<ChipOperationsProps>(), {
  chipId: undefined,
  deviceSize: undefined,
  sectorCounts: undefined,
  sectorSizes: undefined,
  bufferWriteBytes: undefined,
  mode: 'GBA',
  selectedMbcType: 'MBC5',
  mbcPower5V: false,
  flashcartProfiles: () => [],
  selectedFlashcartProfileId: '',
  ambiguousFlashcartProfiles: () => [],
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

const supportsCartPowerControl = computed(() => {
  return props.capabilities?.has('cart.powerControl') ?? false;
});

const showFlashcartProfileSelector = computed(() => {
  return props.capabilities?.has('profile.flashcartDb') ?? false;
});

const expectedProfileType = computed(() => (props.mode === 'GBA' ? 'AGB' : 'DMG'));

const filteredFlashcartProfiles = computed(() => {
  return (props.flashcartProfiles ?? []).filter(profile => profile.type === expectedProfileType.value);
});

const filteredAmbiguousProfiles = computed(() => {
  return (props.ambiguousFlashcartProfiles ?? []).filter(profile => profile.type === expectedProfileType.value);
});

function formatProfileLabel(profile: FlashcartProfileSummary): string {
  const name = profile.names[0] || profile.id;
  const sizePart = profile.flash_size ? `, ${formatBytes(profile.flash_size)}` : '';
  return `${name} (${profile.voltage}V${sizePart})`;
}

const emit = defineEmits([...CHIP_OPERATION_EVENTS]);

function onFlashcartProfileChange(profileId: string): void {
  emit('flashcart-profile-change', profileId);
}

watch(
  () => props.mode,
  () => {
    if (props.selectedFlashcartProfileId) {
      const stillValid = filteredFlashcartProfiles.value.some(
        profile => profile.id === props.selectedFlashcartProfileId,
      );
      if (!stillValid) {
        emit('flashcart-profile-change', '');
      }
    }
  },
);

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
</script>

<style scoped>
.op-title {
  font-size: var(--font-size-lg);
  color: var(--retro-ink);
  font-weight: var(--font-weight-semibold);
  transition: color 0.2s, font-weight 0.2s;
  white-space: nowrap;
}

.op-title.busy {
  color: var(--color-warning);
  font-weight: var(--font-weight-bold);
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
  margin-top: var(--space-2);
  background: var(--retro-bg-elevated);
  border: 1px solid var(--retro-border-subtle);
  border-radius: 4px;
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-xs);
  color: var(--retro-ink);
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
  color: var(--retro-ink-muted);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-xs);
  white-space: nowrap;
  flex: none;
  margin-right: var(--space-2);
}

.chip-info-value {
  flex: 1 1 0;
  font-family: var(--retro-font-mono);
  color: var(--retro-ink);
  font-size: var(--font-size-xs);
  margin-right: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip-info-row:not(.id-row) {
  justify-content: flex-start;
}

/* MBC 设置样式 - 与 RomOperations / RamOperations 保持一致 */
.selector-container {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  min-width: 0;
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
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--retro-ink-muted);
  margin: 0;
  white-space: nowrap;
}

.mbc-type-dropdown {
  min-width: 80px;
  max-width: 180px;
}

.flashcart-profile-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  margin-bottom: var(--space-2);
}

.flashcart-profile-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--retro-ink-muted);
  white-space: nowrap;
}

.flashcart-profile-dropdown {
  flex: 1 1 auto;
  min-width: 0;
}

.flashcart-ambiguous-box {
  margin-bottom: var(--space-2);
  padding: var(--space-2);
  border: 1px solid var(--color-warning);
  border-radius: 4px;
  background: var(--retro-bg-elevated);
}

.flashcart-ambiguous-title {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-warning);
  margin-bottom: var(--space-1);
}

.flashcart-ambiguous-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.flashcart-ambiguous-item {
  font-size: var(--font-size-xs);
  padding: 2px 8px;
  border: 1px solid var(--retro-border-subtle);
  border-radius: 3px;
  background: transparent;
  color: var(--retro-ink);
  cursor: pointer;
}
</style>
