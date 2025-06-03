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
        :disabled="!deviceReady || busy"
        @click="$emit('erase-chip')"
      >
        {{ $t('ui.operation.eraseChip') }}
      </button>
    </div>
    <div class="chip-info-display">
      <div class="chip-info-row id-row">
        <span class="chip-info-label">ID:</span>
        <span class="chip-info-value">{{ idStr || '--' }}</span>
      </div>
      <div class="chip-info-row">
        <span class="chip-info-label">{{ $t('ui.chip.deviceSize') }}:</span>
        <span class="chip-info-value">{{ deviceSize ?? '--' }}</span>
        <span class="chip-info-label">{{ $t('ui.chip.sectorCount') }}:</span>
        <span class="chip-info-value">{{ sectorCount ?? '--' }}</span>
      </div>
      <div class="chip-info-row">
        <span class="chip-info-label">{{ $t('ui.chip.sectorSize') }}:</span>
        <span class="chip-info-value">{{ sectorSize ?? '--' }}</span>
        <span class="chip-info-label">{{ $t('ui.chip.bufferWrite') }}:</span>
        <span class="chip-info-value">{{ bufferWriteBytes ?? '--' }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const props = defineProps({
  deviceReady: {
    type: Boolean,
    required: true,
  },
  busy: {
    type: Boolean,
    required: true,
  },
  idStr: {
    type: String,
    default: '',
  },
  deviceSize: {
    type: [Number, String],
    default: undefined,
  },
  sectorCount: {
    type: [Number, String],
    default: undefined,
  },
  sectorSize: {
    type: [Number, String],
    default: undefined,
  },
  bufferWriteBytes: {
    type: [Number, String],
    default: undefined,
  },
});

defineEmits(['read-id', 'erase-chip']);
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
