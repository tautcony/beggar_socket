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

// 验证并更新
const validateAndUpdate = () => {
  // 验证页面大小
  validationErrors.value.romPageSize = validatePageSize(localSettings.value.size.romPageSize);
  validationErrors.value.ramPageSize = validatePageSize(localSettings.value.size.ramPageSize);

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

<style scoped>
.setting-group {
  margin-bottom: var(--space-8);
}

.setting-group:last-child {
  margin-bottom: 0;
}

.setting-group h4 {
  margin: 0 0 var(--space-4) 0;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  border-bottom: 1px solid var(--color-border-light);
  padding-bottom: var(--space-2);
}

.setting-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-5);
  margin-bottom: var(--space-4);
}

.setting-row:last-child {
  margin-bottom: 0;
}

.setting-item {
  margin-bottom: 0;
}

.setting-item label {
  display: block;
  margin-bottom: var(--space-1-5);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}

.input-group {
  position: relative;
  display: flex;
  align-items: center;
}

.input-group input {
  width: 100%;
  padding: var(--space-2) 70px var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-base);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  transition: border-color 0.2s;
}

.input-group input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.input-group input:invalid {
  border-color: var(--color-error);
}

.unit {
  position: absolute;
  right: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-secondary);
  font-size: var(--font-size-xs);
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
}

.hint {
  display: block;
  margin-top: var(--space-1);
  color: var(--color-secondary);
  font-size: var(--font-size-xs);
  text-align: center;
}

.validation-error {
  margin-top: var(--space-1);
  color: var(--color-error);
  font-size: var(--font-size-xs);
}

.footer-right {
  display: flex;
  gap: var(--space-3);
}

.btn-primary,
.btn-secondary {
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-base);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--color-bg);
  color: var(--color-text);
}

.btn-secondary:hover {
  background: var(--color-bg-secondary);
  border-color: var(--color-border-dark);
}
</style>
