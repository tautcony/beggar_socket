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
      <div class="current-datetime-display">
        <div class="datetime-preview">
          <span class="label">{{ $t('ui.tools.rtc.currentSetting') }}:</span>
          <span
            class="datetime-value"
            :class="{ 'invalid': !isGBADateValid }"
          >
            {{ currentDateTime }}
          </span>
        </div>
      </div>

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
          <input
            :value="weekDays[gbaDate.day]"
            readonly
            class="readonly-input"
          >
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
      <div class="current-datetime-display">
        <div class="datetime-preview">
          <span class="label">{{ $t('ui.tools.rtc.currentSetting') }}:</span>
          <span
            class="datetime-value"
            :class="{ 'invalid': !isMBC3DateValid }"
          >
            {{ currentDateTime }}
          </span>
        </div>
      </div>

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
      <div class="current-time-toggle">
        <ToggleSwitch
          v-model="isRealTimeEnabled"
          :label="$t('ui.tools.rtc.setCurrentTime')"
        />
      </div>
      <div class="button-group">
        <button
          class="button secondary"
          @click="closeModal"
        >
          {{ $t('ui.common.cancel') }}
        </button>
        <button
          class="button primary"
          :disabled="!isDateValid"
          @click="confirm"
        >
          {{ $t('ui.common.confirm') }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseModal from '@/components/common/BaseModal.vue';
import ToggleSwitch from '@/components/common/ToggleSwitch.vue';

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

const isRealTimeEnabled = ref(false);
const updateInterval = ref<ReturnType<typeof setInterval> | null>(null);

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

// Computed property to show current date/time in a readable format
const currentDateTime = computed(() => {
  if (props.type === 'GBA') {
    const dt = DateTime.fromObject({
      year: gbaDate.year + 2000,
      month: gbaDate.month,
      day: gbaDate.date,
      hour: gbaDate.hour,
      minute: gbaDate.minute,
      second: gbaDate.second,
    });
    return dt.isValid ? dt.toFormat('yyyy-MM-dd HH:mm:ss') : t('ui.tools.rtc.invalidDate');
  } else {
    const dt = DateTime.now().startOf('year').plus({ days: mbc3Date.day - 1 })
      .set({ hour: mbc3Date.hour, minute: mbc3Date.minute, second: mbc3Date.second });
    return dt.isValid ? dt.toFormat('yyyy-MM-dd HH:mm:ss') : t('ui.tools.rtc.invalidDate');
  }
});

// Validation for GBA date
const isGBADateValid = computed(() => {
  if (props.type !== 'GBA') return true;

  const dt = DateTime.fromObject({
    year: gbaDate.year + 2000,
    month: gbaDate.month,
    day: gbaDate.date,
    hour: gbaDate.hour,
    minute: gbaDate.minute,
    second: gbaDate.second,
  });

  return dt.isValid;
});

// Validation for MBC3 date
const isMBC3DateValid = computed(() => {
  if (props.type !== 'MBC3') return true;

  const currentYear = DateTime.now().year;
  const isLeapYear = DateTime.local(currentYear).isInLeapYear;
  const maxDays = isLeapYear ? 366 : 365;

  return mbc3Date.day >= 1 && mbc3Date.day <= maxDays &&
         mbc3Date.hour >= 0 && mbc3Date.hour <= 23 &&
         mbc3Date.minute >= 0 && mbc3Date.minute <= 59 &&
         mbc3Date.second >= 0 && mbc3Date.second <= 59;
});

const isDateValid = computed(() => {
  return props.type === 'GBA' ? isGBADateValid.value : isMBC3DateValid.value;
});

function closeModal() {
  emit('close');
}

function setCurrentTime() {
  const now = DateTime.now();

  if (props.type === 'GBA') {
    gbaDate.year = now.year - 2000;
    gbaDate.month = now.month;
    gbaDate.date = now.day;
    gbaDate.day = now.weekday % 7; // luxon: 1-7 (Monday-Sunday), convert to 0-6 (Sunday-Saturday)
    gbaDate.hour = now.hour;
    gbaDate.minute = now.minute;
    gbaDate.second = now.second;
  } else {
    const dayOfYear = now.ordinal; // luxon provides ordinal day directly
    mbc3Date.day = dayOfYear;
    mbc3Date.hour = now.hour;
    mbc3Date.minute = now.minute;
    mbc3Date.second = now.second;
  }
}

function startRealTimeUpdate() {
  if (updateInterval.value) {
    clearInterval(updateInterval.value);
  }
  setCurrentTime(); // 立即更新一次
  updateInterval.value = setInterval(setCurrentTime, 1000); // 每秒更新
}

function stopRealTimeUpdate() {
  if (updateInterval.value) {
    clearInterval(updateInterval.value);
    updateInterval.value = null;
  }
}

function cleanupInterval() {
  stopRealTimeUpdate();
}

function confirm() {
  // Validate the date before confirming
  if (!isDateValid.value) {
    console.warn('Invalid date detected, cannot confirm');
    return;
  }

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

// Watch for real-time toggle changes
watch(isRealTimeEnabled, (enabled) => {
  if (enabled) {
    startRealTimeUpdate();
  } else {
    stopRealTimeUpdate();
  }
});

// Watch for date changes to auto-correct invalid values
watch([() => gbaDate.month, () => gbaDate.year], () => {
  if (props.type === 'GBA') {
    // Auto-correct date when month or year changes
    const maxDays = DateTime.fromObject({
      year: gbaDate.year + 2000,
      month: gbaDate.month,
    }).daysInMonth ?? 31;

    if (gbaDate.date > maxDays) {
      gbaDate.date = maxDays;
    }
  }
});

// Watch for date changes to auto-calculate day of week
watch([() => gbaDate.year, () => gbaDate.month, () => gbaDate.date], () => {
  if (props.type === 'GBA') {
    const dt = DateTime.fromObject({
      year: gbaDate.year + 2000,
      month: gbaDate.month,
      day: gbaDate.date,
    });

    if (dt.isValid) {
      // luxon weekday: 1 = Monday, 7 = Sunday
      // 转换为我们的格式: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      gbaDate.day = dt.weekday === 7 ? 0 : dt.weekday;
    }
  }
});

// Watch for input blur to auto-correct values
watch(() => props.isVisible, (visible) => {
  if (visible) {
    initializeCurrentTime();
  } else {
    // Clean up when modal closes
    isRealTimeEnabled.value = false;
    stopRealTimeUpdate();
  }
});

// Cleanup on component unmount
onBeforeUnmount(() => {
  cleanupInterval();
});
</script>

<style scoped>
.datetime-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.current-datetime-display {
  background-color: var(--color-bg-secondary);
  border: var(--border-width) var(--border-style) var(--color-border-light);
  border-radius: var(--radius-base);
  padding: var(--space-3);
  margin-bottom: var(--space-2);
}

.datetime-preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.datetime-preview .label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.datetime-value {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.datetime-value.invalid {
  color: var(--color-error);
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--space-4);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-group label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.number-input {
  padding: var(--space-2);
  border: var(--border-width) var(--border-style) var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.readonly-input {
  padding: var(--space-2);
  border: var(--border-width) var(--border-style) var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  cursor: not-allowed;
}

.number-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--shadow-focus);
}

.current-time-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.button-group {
  display: flex;
  gap: var(--space-2);
}

.button {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-base);
  border: var(--border-width) var(--border-style);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: all 0.2s ease;
}

.button.primary {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-text-inverse);
}

.button.primary:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.button.primary:disabled {
  background: var(--color-bg-tertiary);
  border-color: var(--color-bg-tertiary);
  cursor: not-allowed;
  opacity: 0.6;
}

.button.secondary {
  background: var(--color-bg);
  border-color: var(--color-border);
  color: var(--color-text);
}

.button.secondary:hover {
  background: var(--color-bg-secondary);
  border-color: var(--color-border-light);
}
</style>
