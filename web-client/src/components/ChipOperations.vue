<template>
  <section class="section">
    <h2>{{ $t('ui.operation.title') }}</h2>
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
    <div
      v-if="idStr"
      class="id-display"
    >
      ID: {{ idStr }}
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps({
  deviceReady: {
    type: Boolean,
    required: true
  },
  busy: {
    type: Boolean,
    required: true
  },
  idStr: {
    type: String,
    default: ''
  }
})

defineEmits(['read-id', 'erase-chip'])
</script>

<style scoped>
.section {
  margin-bottom: 28px;
}

.section h2 {
  font-size: 1.15rem;
  margin-bottom: 10px;
  color: #2c3e50;
  font-weight: 600;
}

.button-row {
  display: flex;
  gap: 16px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.id-display {
  margin-top: 6px;
  color: #1976d2;
  font-weight: bold;
  letter-spacing: 2px;
}

button {
  padding: 6px 18px;
  border-radius: 5px;
  border: 1px solid #bbb;
  background: #f5f7fa;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s, color 0.2s;
  outline: none;
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
