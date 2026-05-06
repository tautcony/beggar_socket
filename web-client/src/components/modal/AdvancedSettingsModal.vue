<template>
  <BaseModal
    v-model="localVisible"
    :title="$t('ui.settings.title')"
    width="92%"
    max-width="860px"
    max-height="82vh"
    :mask-closable="false"
    @close="$emit('close')"
  >
    <div class="settings-layout">
      <nav
        class="settings-nav"
        :aria-label="$t('ui.settings.title')"
      >
        <button
          v-for="section in settingsSections"
          :key="section.id"
          type="button"
          class="settings-nav-button"
          :class="{
            active: activeSection === section.id,
            invalid: hasSectionError(section.id),
          }"
          :aria-pressed="activeSection === section.id"
          @click="activeSection = section.id"
        >
          <span class="nav-title">{{ section.title }}</span>
          <span class="nav-summary">{{ section.summary }}</span>
          <span
            v-if="hasSectionError(section.id)"
            class="nav-error"
            aria-hidden="true"
          />
        </button>
      </nav>

      <div class="settings-content">
        <div
          v-show="activeSection === 'firmware'"
          class="setting-group"
        >
          <h4>{{ $t('ui.settings.firmware.title') }}</h4>

          <div class="setting-row">
            <div class="setting-item">
              <label for="firmware-profile">{{ $t('ui.settings.firmware.profile') }}</label>
              <div class="input-group">
                <select
                  id="firmware-profile"
                  v-model="localSettings.firmware.profile"
                  @change="validateAndUpdate"
                >
                  <option value="stm">
                    {{ $t('ui.settings.firmware.stm') }}
                  </option>
                  <option value="stc">
                    {{ $t('ui.settings.firmware.stc') }}
                  </option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- 页面大小设置 -->
        <div
          v-show="activeSection === 'size'"
          class="setting-group"
        >
          <h4>{{ $t('ui.settings.size.title') }}</h4>

          <div class="setting-row">
            <div class="setting-item">
              <label for="rom-page-size">{{ $t('ui.settings.size.romPageSize') }}</label>
              <div class="input-group">
                <input
                  id="rom-page-size"
                  v-model.number="localSettings.size.romPageSize"
                  type="number"
                  :min="limits.pageSize.min"
                  :max="limits.pageSize.max"
                  :step="64"
                  @input="validateAndUpdate"
                >
                <span class="unit">{{ $t('ui.settings.size.bytes') }}</span>
              </div>
              <div
                v-if="validationErrors.romPageSize"
                class="validation-error"
              >
                {{ validationErrors.romPageSize }}
              </div>
              <small class="hint">{{ formatBytes(localSettings.size.romPageSize) }}</small>
            </div>

            <div class="setting-item">
              <label for="ram-page-size">{{ $t('ui.settings.size.ramPageSize') }}</label>
              <div class="input-group">
                <input
                  id="ram-page-size"
                  v-model.number="localSettings.size.ramPageSize"
                  type="number"
                  :min="limits.pageSize.min"
                  :max="limits.pageSize.max"
                  :step="64"
                  @input="validateAndUpdate"
                >
                <span class="unit">{{ $t('ui.settings.size.bytes') }}</span>
              </div>
              <div
                v-if="validationErrors.ramPageSize"
                class="validation-error"
              >
                {{ validationErrors.ramPageSize }}
              </div>
              <small class="hint">{{ formatBytes(localSettings.size.ramPageSize) }}</small>
            </div>
          </div>
        </div>

        <!-- 超时设置 -->
        <div
          v-show="activeSection === 'timeout'"
          class="setting-group"
        >
          <h4>{{ $t('ui.settings.timeout.title') }}</h4>

          <div class="setting-row">
            <div class="setting-item">
              <label for="default-timeout">{{ $t('ui.settings.timeout.defaultTimeout') }}</label>
              <div class="input-group">
                <input
                  id="default-timeout"
                  v-model.number="localSettings.timeout.default"
                  type="number"
                  :min="limits.timeout.min"
                  :max="limits.timeout.max"
                  :step="100"
                  @input="validateAndUpdate"
                >
                <span class="unit">{{ $t('ui.settings.timeout.milliseconds') }}</span>
              </div>
              <div
                v-if="validationErrors.defaultTimeout"
                class="validation-error"
              >
                {{ validationErrors.defaultTimeout }}
              </div>
              <small class="hint">{{ formatTimeClock(localSettings.timeout.default, 'ms') }}</small>
            </div>

            <div class="setting-item">
              <label for="package-send-timeout">{{ $t('ui.settings.timeout.packageSendTimeout') }}</label>
              <div class="input-group">
                <input
                  id="package-send-timeout"
                  v-model.number="localSettings.timeout.packageSend"
                  type="number"
                  :min="limits.timeout.min"
                  :max="limits.timeout.max"
                  :step="100"
                  @input="validateAndUpdate"
                >
                <span class="unit">{{ $t('ui.settings.timeout.milliseconds') }}</span>
              </div>
              <div
                v-if="validationErrors.packageSendTimeout"
                class="validation-error"
              >
                {{ validationErrors.packageSendTimeout }}
              </div>
              <small class="hint">{{ formatTimeClock(localSettings.timeout.packageSend, 'ms') }}</small>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-item">
              <label for="package-receive-timeout">{{ $t('ui.settings.timeout.packageReceiveTimeout') }}</label>
              <div class="input-group">
                <input
                  id="package-receive-timeout"
                  v-model.number="localSettings.timeout.packageReceive"
                  type="number"
                  :min="limits.timeout.min"
                  :max="limits.timeout.max"
                  :step="100"
                  @input="validateAndUpdate"
                >
                <span class="unit">{{ $t('ui.settings.timeout.milliseconds') }}</span>
              </div>
              <div
                v-if="validationErrors.packageReceiveTimeout"
                class="validation-error"
              >
                {{ validationErrors.packageReceiveTimeout }}
              </div>
              <small class="hint">{{ formatTimeClock(localSettings.timeout.packageReceive, 'ms') }}</small>
            </div>

            <div class="setting-item">
              <label for="operation-timeout">{{ $t('ui.settings.timeout.operationTimeout') }}</label>
              <div class="input-group">
                <input
                  id="operation-timeout"
                  v-model.number="localSettings.timeout.operation"
                  type="number"
                  :min="limits.timeout.min"
                  :max="limits.timeout.max"
                  :step="1000"
                  @input="validateAndUpdate"
                >
                <span class="unit">{{ $t('ui.settings.timeout.milliseconds') }}</span>
              </div>
              <div
                v-if="validationErrors.operationTimeout"
                class="validation-error"
              >
                {{ validationErrors.operationTimeout }}
              </div>
              <small class="hint">{{ formatTimeClock(localSettings.timeout.operation, 'ms') }}</small>
            </div>
          </div>
        </div>

        <div
          v-show="activeSection === 'throttle'"
          class="setting-group"
        >
          <h4>{{ $t('ui.settings.throttle.title') }}</h4>

          <div class="setting-row">
            <div class="setting-item">
              <label for="rom-read-throttle">{{ $t('ui.settings.throttle.romRead') }}</label>
              <div class="input-group">
                <input
                  id="rom-read-throttle"
                  v-model.number="localSettings.throttle.romRead"
                  type="number"
                  :min="limits.throttle.min"
                  :max="limits.throttle.max"
                  :step="1"
                  @input="validateAndUpdate"
                >
                <span class="unit">{{ $t('ui.settings.timeout.milliseconds') }}</span>
              </div>
              <div
                v-if="validationErrors.romReadThrottle"
                class="validation-error"
              >
                {{ validationErrors.romReadThrottle }}
              </div>
              <small class="hint">{{ formatTimeClock(localSettings.throttle.romRead, 'ms') }}</small>
            </div>

            <div class="setting-item">
              <label for="ram-read-throttle">{{ $t('ui.settings.throttle.ramRead') }}</label>
              <div class="input-group">
                <input
                  id="ram-read-throttle"
                  v-model.number="localSettings.throttle.ramRead"
                  type="number"
                  :min="limits.throttle.min"
                  :max="limits.throttle.max"
                  :step="1"
                  @input="validateAndUpdate"
                >
                <span class="unit">{{ $t('ui.settings.timeout.milliseconds') }}</span>
              </div>
              <div
                v-if="validationErrors.ramReadThrottle"
                class="validation-error"
              >
                {{ validationErrors.ramReadThrottle }}
              </div>
              <small class="hint">{{ formatTimeClock(localSettings.throttle.ramRead, 'ms') }}</small>
            </div>
          </div>
        </div>

        <div
          v-show="activeSection === 'retry'"
          class="setting-group"
        >
          <h4>{{ $t('ui.settings.retry.title') }}</h4>

          <div class="setting-row">
            <div class="setting-item">
              <label for="rom-read-retry-count">{{ $t('ui.settings.retry.romReadCount') }}</label>
              <div class="input-group">
                <input
                  id="rom-read-retry-count"
                  v-model.number="localSettings.retry.romReadCount"
                  type="number"
                  :min="limits.retryCount.min"
                  :max="limits.retryCount.max"
                  :step="1"
                  @input="validateAndUpdate"
                >
                <span class="unit">x</span>
              </div>
              <div
                v-if="validationErrors.romReadRetryCount"
                class="validation-error"
              >
                {{ validationErrors.romReadRetryCount }}
              </div>
            </div>

            <div class="setting-item">
              <label for="ram-read-retry-count">{{ $t('ui.settings.retry.ramReadCount') }}</label>
              <div class="input-group">
                <input
                  id="ram-read-retry-count"
                  v-model.number="localSettings.retry.ramReadCount"
                  type="number"
                  :min="limits.retryCount.min"
                  :max="limits.retryCount.max"
                  :step="1"
                  @input="validateAndUpdate"
                >
                <span class="unit">x</span>
              </div>
              <div
                v-if="validationErrors.ramReadRetryCount"
                class="validation-error"
              >
                {{ validationErrors.ramReadRetryCount }}
              </div>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-item">
              <label for="rom-write-retry-count">{{ $t('ui.settings.retry.romWriteRetryCount') }}</label>
              <div class="input-group">
                <input
                  id="rom-write-retry-count"
                  v-model.number="localSettings.retry.romWriteRetryCount"
                  type="number"
                  :min="limits.retryCount.min"
                  :max="limits.retryCount.max"
                  :step="1"
                  @input="validateAndUpdate"
                >
                <span class="unit">x</span>
              </div>
              <div
                v-if="validationErrors.romWriteRetryCount"
                class="validation-error"
              >
                {{ validationErrors.romWriteRetryCount }}
              </div>
            </div>

            <div class="setting-item">
              <label for="rom-erase-retry-count">{{ $t('ui.settings.retry.romEraseRetryCount') }}</label>
              <div class="input-group">
                <input
                  id="rom-erase-retry-count"
                  v-model.number="localSettings.retry.romEraseRetryCount"
                  type="number"
                  :min="limits.retryCount.min"
                  :max="limits.retryCount.max"
                  :step="1"
                  @input="validateAndUpdate"
                >
                <span class="unit">x</span>
              </div>
              <div
                v-if="validationErrors.romEraseRetryCount"
                class="validation-error"
              >
                {{ validationErrors.romEraseRetryCount }}
              </div>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-item">
              <label for="rom-read-retry-delay">{{ $t('ui.settings.retry.romReadDelay') }}</label>
              <div class="input-group">
                <input
                  id="rom-read-retry-delay"
                  v-model.number="localSettings.retry.romReadDelay"
                  type="number"
                  :min="limits.retryDelay.min"
                  :max="limits.retryDelay.max"
                  :step="1"
                  @input="validateAndUpdate"
                >
                <span class="unit">{{ $t('ui.settings.timeout.milliseconds') }}</span>
              </div>
              <div
                v-if="validationErrors.romReadRetryDelay"
                class="validation-error"
              >
                {{ validationErrors.romReadRetryDelay }}
              </div>
              <small class="hint">{{ formatTimeClock(localSettings.retry.romReadDelay, 'ms') }}</small>
            </div>

            <div class="setting-item">
              <label for="ram-read-retry-delay">{{ $t('ui.settings.retry.ramReadDelay') }}</label>
              <div class="input-group">
                <input
                  id="ram-read-retry-delay"
                  v-model.number="localSettings.retry.ramReadDelay"
                  type="number"
                  :min="limits.retryDelay.min"
                  :max="limits.retryDelay.max"
                  :step="1"
                  @input="validateAndUpdate"
                >
                <span class="unit">{{ $t('ui.settings.timeout.milliseconds') }}</span>
              </div>
              <div
                v-if="validationErrors.ramReadRetryDelay"
                class="validation-error"
              >
                {{ validationErrors.ramReadRetryDelay }}
              </div>
              <small class="hint">{{ formatTimeClock(localSettings.retry.ramReadDelay, 'ms') }}</small>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-item">
              <label for="rom-write-retry-delay">{{ $t('ui.settings.retry.romWriteRetryDelay') }}</label>
              <div class="input-group">
                <input
                  id="rom-write-retry-delay"
                  v-model.number="localSettings.retry.romWriteRetryDelay"
                  type="number"
                  :min="limits.retryDelay.min"
                  :max="limits.retryDelay.max"
                  :step="1"
                  @input="validateAndUpdate"
                >
                <span class="unit">{{ $t('ui.settings.timeout.milliseconds') }}</span>
              </div>
              <div
                v-if="validationErrors.romWriteRetryDelay"
                class="validation-error"
              >
                {{ validationErrors.romWriteRetryDelay }}
              </div>
              <small class="hint">{{ formatTimeClock(localSettings.retry.romWriteRetryDelay, 'ms') }}</small>
            </div>

            <div class="setting-item">
              <label for="rom-erase-retry-delay">{{ $t('ui.settings.retry.romEraseRetryDelay') }}</label>
              <div class="input-group">
                <input
                  id="rom-erase-retry-delay"
                  v-model.number="localSettings.retry.romEraseRetryDelay"
                  type="number"
                  :min="limits.retryDelay.min"
                  :max="limits.retryDelay.max"
                  :step="1"
                  @input="validateAndUpdate"
                >
                <span class="unit">{{ $t('ui.settings.timeout.milliseconds') }}</span>
              </div>
              <div
                v-if="validationErrors.romEraseRetryDelay"
                class="validation-error"
              >
                {{ validationErrors.romEraseRetryDelay }}
              </div>
              <small class="hint">{{ formatTimeClock(localSettings.retry.romEraseRetryDelay, 'ms') }}</small>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <button
        class="btn-secondary"
        @click="resetToDefaults"
      >
        {{ $t('ui.settings.actions.reset') }}
      </button>
      <div class="footer-right">
        <button
          class="btn-secondary"
          @click="$emit('close')"
        >
          {{ $t('ui.settings.actions.close') }}
        </button>
        <button
          class="btn-primary"
          :disabled="!isValid"
          @click="applySettings"
        >
          {{ $t('ui.settings.actions.apply') }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseModal from '@/components/common/BaseModal.vue';
import { AdvancedSettings } from '@/settings/advanced-settings';
import type { ConfigurableFirmwareProfileId } from '@/types/firmware-profile';
import { formatBytes, formatTimeClock } from '@/utils/formatter-utils';

const { t } = useI18n();

type SettingsSectionId = 'firmware' | 'size' | 'timeout' | 'throttle' | 'retry';

// 定义 props
const props = defineProps<{
  modelValue: boolean;
}>();

// 定义事件
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: []
  applied: []
}>();

// 创建一个计算属性来处理 v-model
const localVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => {
    emit('update:modelValue', value);
  },
});

// 获取限制值
const limits = AdvancedSettings.getLimits();

const createDefaultSettings = (): ReturnType<typeof AdvancedSettings.getSettings> => ({
  firmware: {
    profile: 'stm',
  },
  size: {
    romPageSize: 0x200,
    ramPageSize: 0x100,
  },
  throttle: {
    romRead: 0,
    ramRead: 0,
  },
  retry: {
    romReadCount: 1,
    ramReadCount: 1,
    romReadDelay: 0,
    ramReadDelay: 0,
    romWriteRetryCount: 1,
    romWriteRetryDelay: 0,
    romEraseRetryCount: 1,
    romEraseRetryDelay: 0,
  },
  timeout: {
    default: 3000,
    packageSend: 3000,
    packageReceive: 3000,
    operation: 30000,
  },
});

// 本地设置状态
const localSettings = ref(createDefaultSettings());
const activeSection = ref<SettingsSectionId>('firmware');

// 验证错误
const validationErrors = ref({
  romPageSize: '',
  ramPageSize: '',
  romReadThrottle: '',
  ramReadThrottle: '',
  romReadRetryCount: '',
  ramReadRetryCount: '',
  romReadRetryDelay: '',
  ramReadRetryDelay: '',
  romWriteRetryCount: '',
  romWriteRetryDelay: '',
  romEraseRetryCount: '',
  romEraseRetryDelay: '',
  defaultTimeout: '',
  packageSendTimeout: '',
  packageReceiveTimeout: '',
  operationTimeout: '',
});

const hasSectionError = (sectionId: SettingsSectionId): boolean => {
  switch (sectionId) {
    case 'size':
      return Boolean(validationErrors.value.romPageSize || validationErrors.value.ramPageSize);
    case 'timeout':
      return Boolean(
        validationErrors.value.defaultTimeout
        || validationErrors.value.packageSendTimeout
        || validationErrors.value.packageReceiveTimeout
        || validationErrors.value.operationTimeout,
      );
    case 'throttle':
      return Boolean(validationErrors.value.romReadThrottle || validationErrors.value.ramReadThrottle);
    case 'retry':
      return Boolean(
        validationErrors.value.romReadRetryCount
        || validationErrors.value.ramReadRetryCount
        || validationErrors.value.romReadRetryDelay
        || validationErrors.value.ramReadRetryDelay
        || validationErrors.value.romWriteRetryCount
        || validationErrors.value.romWriteRetryDelay
        || validationErrors.value.romEraseRetryCount
        || validationErrors.value.romEraseRetryDelay,
      );
    case 'firmware':
      return false;
  }
};

const settingsSections = computed(() => [
  {
    id: 'firmware' as const,
    title: t('ui.settings.firmware.title'),
    summary: localSettings.value.firmware.profile === 'stm'
      ? t('ui.settings.firmware.stm')
      : t('ui.settings.firmware.stc'),
  },
  {
    id: 'size' as const,
    title: t('ui.settings.size.title'),
    summary: `${formatBytes(localSettings.value.size.romPageSize)} / ${formatBytes(localSettings.value.size.ramPageSize)}`,
  },
  {
    id: 'timeout' as const,
    title: t('ui.settings.timeout.title'),
    summary: `${formatTimeClock(localSettings.value.timeout.default, 'ms')} / ${formatTimeClock(localSettings.value.timeout.operation, 'ms')}`,
  },
  {
    id: 'throttle' as const,
    title: t('ui.settings.throttle.title'),
    summary: `${localSettings.value.throttle.romRead}ms / ${localSettings.value.throttle.ramRead}ms`,
  },
  {
    id: 'retry' as const,
    title: t('ui.settings.retry.title'),
    summary: `${localSettings.value.retry.romReadCount}x / ${localSettings.value.retry.romWriteRetryCount}x`,
  },
]);

// 验证单个值
const validatePageSize = (value: number): string => {
  if (isNaN(value) || value < limits.pageSize.min || value > limits.pageSize.max) {
    return t('ui.settings.size.validation.range', {
      min: limits.pageSize.min,
      max: limits.pageSize.max,
    });
  }
  if (value % 64 !== 0) {
    return t('ui.settings.size.validation.multiple', { multipler: 64 });
  }
  return '';
};

const validateTimeout = (value: number): string => {
  if (isNaN(value) || value < limits.timeout.min || value > limits.timeout.max) {
    return t('ui.settings.timeout.validation.range', {
      min: limits.timeout.min,
      max: limits.timeout.max,
    });
  }
  return '';
};

const validateThrottle = (value: number): string => {
  if (isNaN(value) || value < limits.throttle.min || value > limits.throttle.max) {
    return t('ui.settings.throttle.validation.range', {
      min: limits.throttle.min,
      max: limits.throttle.max,
    });
  }
  return '';
};

const validateRetryCount = (value: number): string => {
  if (isNaN(value) || value < limits.retryCount.min || value > limits.retryCount.max) {
    return t('ui.settings.retry.validation.countRange', {
      min: limits.retryCount.min,
      max: limits.retryCount.max,
    });
  }
  return '';
};

const validateRetryDelay = (value: number): string => {
  if (isNaN(value) || value < limits.retryDelay.min || value > limits.retryDelay.max) {
    return t('ui.settings.retry.validation.delayRange', {
      min: limits.retryDelay.min,
      max: limits.retryDelay.max,
    });
  }
  return '';
};

// 验证并更新
const validateAndUpdate = () => {
  // 验证页面大小
  validationErrors.value.romPageSize = validatePageSize(localSettings.value.size.romPageSize);
  validationErrors.value.ramPageSize = validatePageSize(localSettings.value.size.ramPageSize);
  validationErrors.value.romReadThrottle = validateThrottle(localSettings.value.throttle.romRead);
  validationErrors.value.ramReadThrottle = validateThrottle(localSettings.value.throttle.ramRead);
  validationErrors.value.romReadRetryCount = validateRetryCount(localSettings.value.retry.romReadCount);
  validationErrors.value.ramReadRetryCount = validateRetryCount(localSettings.value.retry.ramReadCount);
  validationErrors.value.romReadRetryDelay = validateRetryDelay(localSettings.value.retry.romReadDelay);
  validationErrors.value.ramReadRetryDelay = validateRetryDelay(localSettings.value.retry.ramReadDelay);
  validationErrors.value.romWriteRetryCount = validateRetryCount(localSettings.value.retry.romWriteRetryCount);
  validationErrors.value.romWriteRetryDelay = validateRetryDelay(localSettings.value.retry.romWriteRetryDelay);
  validationErrors.value.romEraseRetryCount = validateRetryCount(localSettings.value.retry.romEraseRetryCount);
  validationErrors.value.romEraseRetryDelay = validateRetryDelay(localSettings.value.retry.romEraseRetryDelay);

  // 验证超时
  validationErrors.value.defaultTimeout = validateTimeout(localSettings.value.timeout.default);
  validationErrors.value.packageSendTimeout = validateTimeout(localSettings.value.timeout.packageSend);
  validationErrors.value.packageReceiveTimeout = validateTimeout(localSettings.value.timeout.packageReceive);
  validationErrors.value.operationTimeout = validateTimeout(localSettings.value.timeout.operation);
};

// 检查是否有效
const isValid = computed(() => {
  return Object.values(validationErrors.value).every(error => error === '');
});

// 重置为默认值
const resetToDefaults = () => {
  if (confirm(t('ui.settings.actions.resetConfirm'))) {
    localSettings.value = createDefaultSettings();
    validateAndUpdate();
  }
};

// 应用设置
const applySettings = () => {
  if (!isValid.value) return;

  try {
    // 应用设置
    AdvancedSettings.setSettings(localSettings.value);

    console.log(t('ui.settings.messages.saveSuccess'), AdvancedSettings.getSettings());
    emit('applied');
    emit('close');
  } catch (error) {
    console.error(t('ui.settings.messages.saveError'), error);
    alert(t('ui.settings.messages.saveError'));
  }
};

// 组件挂载时加载当前设置
onMounted(() => {
  localSettings.value = AdvancedSettings.getSettings();
  validateAndUpdate();
});
</script>

<style lang="scss" scoped>
@use '@/styles/variables/colors' as color-vars;
@use '@/styles/variables/spacing' as spacing-vars;
@use '@/styles/variables/typography' as typography-vars;
@use '@/styles/variables/radius' as radius-vars;
@use '@/styles/mixins' as mixins;

.settings-layout {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: spacing-vars.$space-6;
  min-height: 430px;
}

.settings-nav {
  display: flex;
  flex-direction: column;
  gap: spacing-vars.$space-2;
  padding-right: spacing-vars.$space-4;
  border-right: 1px solid color-vars.$color-border-light;
}

.settings-nav-button {
  position: relative;
  display: grid;
  gap: spacing-vars.$space-1;
  width: 100%;
  min-height: 58px;
  padding: spacing-vars.$space-3;
  border: 1px solid transparent;
  border-radius: radius-vars.$radius-base;
  background: transparent;
  color: color-vars.$color-text;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s;

  &:hover {
    background: color-vars.$color-bg-secondary;
    border-color: color-vars.$color-border-light;
  }

  &.active {
    background: rgba(0, 123, 255, 0.08);
    border-color: color-vars.$color-primary;
    color: color-vars.$color-primary;
  }

  &.invalid {
    border-color: color-vars.$color-error;
  }
}

.nav-title {
  font-size: typography-vars.$font-size-sm;
  font-weight: typography-vars.$font-weight-medium;
}

.nav-summary {
  overflow: hidden;
  color: color-vars.$color-secondary;
  font-size: typography-vars.$font-size-xs;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-error {
  position: absolute;
  top: spacing-vars.$space-2;
  right: spacing-vars.$space-2;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: color-vars.$color-error;
}

.settings-content {
  min-width: 0;
}

.setting-group {
  margin-bottom: 0;

  &:last-child {
    margin-bottom: 0;
  }

  h4 {
    margin: 0 0 spacing-vars.$space-4 0;
    color: color-vars.$color-text;
    font-size: typography-vars.$font-size-lg;
    border-bottom: 1px solid color-vars.$color-border-light;
    padding-bottom: spacing-vars.$space-2;
  }
}

.setting-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: spacing-vars.$space-5;
  margin-bottom: spacing-vars.$space-4;

  &:last-child {
    margin-bottom: 0;
  }
}

.setting-item {
  margin-bottom: 0;

  label {
    display: block;
    margin-bottom: spacing-vars.$space-2;
    color: color-vars.$color-text-secondary;
    font-weight: typography-vars.$font-weight-medium;
  }
}

.input-group {
  position: relative;
  display: flex;
  align-items: center;

  input {
    width: 100%;
    padding: spacing-vars.$space-2 70px spacing-vars.$space-2 spacing-vars.$space-3;
    border: 1px solid color-vars.$color-border;
    border-radius: radius-vars.$radius-base;
    background: color-vars.$color-bg;
    color: color-vars.$color-text;
    font-size: typography-vars.$font-size-sm;
    transition: border-color 0.2s;

    &:focus {
      outline: none;
      border-color: color-vars.$color-primary;
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
    }

    &:invalid {
      border-color: color-vars.$color-error;
    }
  }

  select {
    width: 100%;
    padding: spacing-vars.$space-2 spacing-vars.$space-3;
    border: 1px solid color-vars.$color-border;
    border-radius: radius-vars.$radius-base;
    background: color-vars.$color-bg;
    color: color-vars.$color-text;
    font-size: typography-vars.$font-size-sm;
    transition: border-color 0.2s;

    &:focus {
      outline: none;
      border-color: color-vars.$color-primary;
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
    }
  }
}

.unit {
  position: absolute;
  right: spacing-vars.$space-3;
  top: 50%;
  transform: translateY(-50%);
  color: color-vars.$color-secondary;
  font-size: typography-vars.$font-size-xs;
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
}

.hint {
  display: block;
  margin-top: spacing-vars.$space-1;
  color: color-vars.$color-secondary;
  font-size: typography-vars.$font-size-xs;
  text-align: center;
}

.validation-error {
  margin-top: spacing-vars.$space-1;
  color: color-vars.$color-error;
  font-size: typography-vars.$font-size-xs;
}

.footer-right {
  display: flex;
  gap: spacing-vars.$space-3;
}

@mixin btn-base {
  padding: spacing-vars.$space-2 spacing-vars.$space-4;
  border: 1px solid color-vars.$color-border;
  border-radius: radius-vars.$radius-base;
  font-size: typography-vars.$font-size-sm;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  @include btn-base;
  @include mixins.button-variant(white, color-vars.$color-primary);

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btn-secondary {
  @include btn-base;
  background: color-vars.$color-bg;
  color: color-vars.$color-text;

  &:hover {
    background: color-vars.$color-bg-secondary;
    border-color: color-vars.$color-border-dark;
  }
}

@media (max-width: 720px) {
  .settings-layout {
    grid-template-columns: 1fr;
    gap: spacing-vars.$space-4;
    min-height: 0;
  }

  .settings-nav {
    flex-direction: row;
    gap: spacing-vars.$space-2;
    overflow-x: auto;
    padding-right: 0;
    padding-bottom: spacing-vars.$space-2;
    border-right: 0;
    border-bottom: 1px solid color-vars.$color-border-light;
  }

  .settings-nav-button {
    min-width: 150px;
  }

  .setting-row {
    grid-template-columns: 1fr;
  }
}
</style>
