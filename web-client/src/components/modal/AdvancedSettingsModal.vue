<template>
  <BaseModal
    v-model="localVisible"
    :title="$t('ui.settings.title')"
    width="90%"
    max-width="600px"
    max-height="80vh"
    :mask-closable="false"
    @close="$emit('close')"
  >
    <!-- 页面大小设置 -->
    <div class="setting-group">
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
    <div class="setting-group">
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

    <div class="setting-group">
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

    <div class="setting-group">
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
import { formatBytes, formatTimeClock } from '@/utils/formatter-utils';

const { t } = useI18n();

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

// 本地设置状态
const localSettings = ref({
  size: {
    romPageSize: 0x200,
    ramPageSize: 0x100,
  },
  throttle: {
    romRead: 0,
    ramRead: 0,
  },
  retry: {
    romReadCount: 0,
    ramReadCount: 0,
    romReadDelay: 0,
    ramReadDelay: 0,
  },
  timeout: {
    default: 3000,
    packageSend: 3000,
    packageReceive: 3000,
    operation: 30000,
  },
});

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
  defaultTimeout: '',
  packageSendTimeout: '',
  packageReceiveTimeout: '',
  operationTimeout: '',
});

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
    localSettings.value = {
      size: {
        romPageSize: 0x400,
        ramPageSize: 0x200,
      },
      throttle: {
        romRead: 0,
        ramRead: 0,
      },
      retry: {
        romReadCount: 0,
        ramReadCount: 0,
        romReadDelay: 0,
        ramReadDelay: 0,
      },
      timeout: {
        default: 3000,
        packageSend: 3000,
        packageReceive: 3000,
        operation: 100000,
      },
    };
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
  localSettings.value = {
    size: {
      romPageSize: AdvancedSettings.romPageSize,
      ramPageSize: AdvancedSettings.ramPageSize,
    },
    throttle: {
      romRead: AdvancedSettings.romReadThrottleMs,
      ramRead: AdvancedSettings.ramReadThrottleMs,
    },
    retry: {
      romReadCount: AdvancedSettings.romReadRetryCount,
      ramReadCount: AdvancedSettings.ramReadRetryCount,
      romReadDelay: AdvancedSettings.romReadRetryDelayMs,
      ramReadDelay: AdvancedSettings.ramReadRetryDelayMs,
    },
    timeout: {
      default: AdvancedSettings.defaultTimeout,
      packageSend: AdvancedSettings.packageSendTimeout,
      packageReceive: AdvancedSettings.packageReceiveTimeout,
      operation: AdvancedSettings.operationTimeout,
    },
  };
  validateAndUpdate();
});
</script>

<style lang="scss" scoped>
@use '@/styles/variables/colors' as color-vars;
@use '@/styles/variables/spacing' as spacing-vars;
@use '@/styles/variables/typography' as typography-vars;
@use '@/styles/variables/radius' as radius-vars;
@use '@/styles/mixins' as mixins;

.setting-group {
  margin-bottom: spacing-vars.$space-8;

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
</style>
