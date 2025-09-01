<template>
  <BaseModal
    v-model="localVisible"
    :title="title"
    width="600px"
    max-height="80vh"
    @close="closeModal"
  >
    <div
      v-if="type === 'GBA'"
      class="datetime-form"
    >
      <div class="form-row">
        <div class="form-group">
          <label>{{ $t('ui.tools.rtc.year') }}:</label>
          <input
            v-model.number="gbaDate.year"
            type="number"
            min="0"
            max="99"
            class="number-input"
          >
        </div>
        <div class="form-group">
          <label>{{ $t('ui.tools.rtc.month') }}:</label>
          <input
            v-model.number="gbaDate.month"
            type="number"
            min="1"
            max="12"
            class="number-input"
          >
        </div>
        <div class="form-group">
          <label>{{ $t('ui.tools.rtc.date') }}:</label>
          <input
            v-model.number="gbaDate.date"
            type="number"
            min="1"
            max="31"
            class="number-input"
          >
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>{{ $t('ui.tools.rtc.day') }}:</label>
          <select
            v-model="gbaDate.day"
            class="select-input"
          >
            <option
              v-for="(dayName, index) in weekDays"
              :key="index"
              :value="index"
            >
              {{ dayName }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>{{ $t('ui.tools.rtc.hour') }}:</label>
          <input
            v-model.number="gbaDate.hour"
            type="number"
            min="0"
            max="23"
            class="number-input"
          >
        </div>
        <div class="form-group">
          <label>{{ $t('ui.tools.rtc.minute') }}:</label>
          <input
            v-model.number="gbaDate.minute"
            type="number"
            min="0"
            max="59"
            class="number-input"
          >
        </div>
        <div class="form-group">
          <label>{{ $t('ui.tools.rtc.second') }}:</label>
          <input
            v-model.number="gbaDate.second"
            type="number"
            min="0"
            max="59"
            class="number-input"
          >
        </div>
      </div>
    </div>

    <div
      v-else-if="type === 'MBC3'"
      class="datetime-form"
    >
      <div class="form-row">
        <div class="form-group">
          <label>{{ $t('ui.tools.rtc.dayOfYear') }}:</label>
          <input
            v-model.number="mbc3Date.day"
            type="number"
            min="1"
            max="365"
            class="number-input"
          >
        </div>
        <div class="form-group">
          <label>{{ $t('ui.tools.rtc.hour') }}:</label>
          <input
            v-model.number="mbc3Date.hour"
            type="number"
            min="0"
            max="23"
            class="number-input"
          >
        </div>
        <div class="form-group">
          <label>{{ $t('ui.tools.rtc.minute') }}:</label>
          <input
            v-model.number="mbc3Date.minute"
            type="number"
            min="0"
            max="59"
            class="number-input"
          >
        </div>
        <div class="form-group">
          <label>{{ $t('ui.tools.rtc.second') }}:</label>
          <input
            v-model.number="mbc3Date.second"
            type="number"
            min="0"
            max="59"
            class="number-input"
          >
        </div>
      </div>
    </div>

    <template #footer>
      <button
        class="button secondary"
        @click="setCurrentTime"
      >
        {{ $t('ui.tools.rtc.setCurrentTime') }}
      </button>
      <div class="button-group">
        <button
          class="button secondary"
          @click="closeModal"
        >
          {{ $t('ui.common.cancel') }}
        </button>
        <button
          class="button primary"
          @click="confirm"
        >
          {{ $t('ui.common.confirm') }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseModal from '@/components/common/BaseModal.vue';

interface Props {
  isVisible: boolean;
  type: 'GBA' | 'MBC3';
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'close': [];
  'confirm': [data: GBARTCData | MBC3RTCData];
}>();

export interface GBARTCData {
  year: number;
  month: number;
  date: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface MBC3RTCData {
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const { t } = useI18n();

const localVisible = computed({
  get: () => props.isVisible,
  set: (value: boolean) => {
    if (!value) {
      emit('close');
    }
  },
});

const gbaDate = reactive<GBARTCData>({
  year: 0,
  month: 1,
  date: 1,
  day: 0,
  hour: 0,
  minute: 0,
  second: 0,
});

const mbc3Date = reactive<MBC3RTCData>({
  day: 1,
  hour: 0,
  minute: 0,
  second: 0,
});

const weekDays = computed(() => [
  t('ui.tools.rtc.sunday'),
  t('ui.tools.rtc.monday'),
  t('ui.tools.rtc.tuesday'),
  t('ui.tools.rtc.wednesday'),
  t('ui.tools.rtc.thursday'),
  t('ui.tools.rtc.friday'),
  t('ui.tools.rtc.saturday'),
]);

const title = computed(() => {
  return props.type === 'GBA'
    ? t('ui.tools.rtc.setGBA')
    : t('ui.tools.rtc.setMBC3');
});

function closeModal() {
  emit('close');
}

function setCurrentTime() {
  const now = new Date();

  if (props.type === 'GBA') {
    gbaDate.year = now.getFullYear() - 2000;
    gbaDate.month = now.getMonth() + 1;
    gbaDate.date = now.getDate();
    gbaDate.day = now.getDay();
    gbaDate.hour = now.getHours();
    gbaDate.minute = now.getMinutes();
    gbaDate.second = now.getSeconds();
  } else {
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    mbc3Date.day = dayOfYear;
    mbc3Date.hour = now.getHours();
    mbc3Date.minute = now.getMinutes();
    mbc3Date.second = now.getSeconds();
  }
}

function confirm() {
  if (props.type === 'GBA') {
    emit('confirm', { ...gbaDate });
  } else {
    emit('confirm', { ...mbc3Date });
  }
}

// Initialize with current time when modal opens
function initializeCurrentTime() {
  setCurrentTime();
}

// Call initialization when component is mounted or visible changes
watch(() => props.isVisible, (visible) => {
  if (visible) {
    initializeCurrentTime();
  }
});
</script>

<style scoped>
.datetime-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.number-input,
.select-input {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: white;
  color: #111827;
  font-size: 0.875rem;
}

.number-input:focus,
.select-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.button-group {
  display: flex;
  gap: 0.5rem;
}

.button {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: 1px solid;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.button.primary {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.button.primary:hover {
  background: #2563eb;
  border-color: #2563eb;
}

.button.secondary {
  background: white;
  border-color: #d1d5db;
  color: #374151;
}

.button.secondary:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}
</style>
