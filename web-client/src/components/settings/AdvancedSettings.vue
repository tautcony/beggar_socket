<template>
  <div class="advanced-settings-overlay">
    <div class="advanced-settings">
      <div class="settings-header">
        <h3>{{ $t('ui.settings.title') }}</h3>
        <button 
          class="close-btn"
          :title="$t('ui.settings.actions.close')"
          @click="$emit('close')"
        >
          ×
        </button>
      </div>

      <div class="settings-content">
        <!-- 页面大小设置 -->
        <div class="setting-group">
          <h4>{{ $t('ui.settings.pageSize.title') }}</h4>
          
          <div class="setting-row">
            <div class="setting-item">
              <label for="rom-page-size">{{ $t('ui.settings.pageSize.romPageSize') }}</label>
              <div class="input-group">
                <input
                  id="rom-page-size"
                  v-model.number="localSettings.pageSize.rom"
                  type="number"
                  :min="limits.pageSize.min"
                  :max="limits.pageSize.max"
                  :step="256"
                  @input="validateAndUpdate"
                >
                <span class="unit">{{ $t('ui.settings.pageSize.bytes') }}</span>
              </div>
              <div
                v-if="validationErrors.romPageSize" 
                class="validation-error"
              >
                {{ validationErrors.romPageSize }}
              </div>
              <small class="hint">{{ formatBytes(localSettings.pageSize.rom) }}</small>
            </div>

            <div class="setting-item">
              <label for="ram-page-size">{{ $t('ui.settings.pageSize.ramPageSize') }}</label>
              <div class="input-group">
                <input
                  id="ram-page-size"
                  v-model.number="localSettings.pageSize.ram"
                  type="number"
                  :min="limits.pageSize.min"
                  :max="limits.pageSize.max"
                  :step="256"
                  @input="validateAndUpdate"
                >
                <span class="unit">{{ $t('ui.settings.pageSize.bytes') }}</span>
              </div>
              <div
                v-if="validationErrors.ramPageSize"
                class="validation-error"
              >
                {{ validationErrors.ramPageSize }}
              </div>
              <small class="hint">{{ formatBytes(localSettings.pageSize.ram) }}</small>
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
              <small class="hint">{{ formatTime(localSettings.timeout.default) }}</small>
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
              <small class="hint">{{ formatTime(localSettings.timeout.packageSend) }}</small>
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
              <small class="hint">{{ formatTime(localSettings.timeout.packageReceive) }}</small>
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
              <small class="hint">{{ formatTime(localSettings.timeout.operation) }}</small>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-footer">
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { AdvancedSettings } from '@/utils/AdvancedSettings'

const { t } = useI18n()

// 定义事件
const emit = defineEmits<{
  close: []
  applied: []
}>()

// 获取限制值
const limits = AdvancedSettings.getLimits()

// 本地设置状态
const localSettings = ref({
  pageSize: {
    rom: 0x1000,
    ram: 0x800
  },
  timeout: {
    default: 3000,
    packageSend: 3000,
    packageReceive: 3000,
    operation: 30000
  }
})

// 验证错误
const validationErrors = ref({
  romPageSize: '',
  ramPageSize: '',
  defaultTimeout: '',
  packageSendTimeout: '',
  packageReceiveTimeout: '',
  operationTimeout: ''
})

// 格式化字节数显示
const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${bytes} B`
}

// 格式化时间显示
const formatTime = (ms: number): string => {
  if (ms >= 60000) {
    return `${(ms / 60000).toFixed(1)} min`
  } else if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)} s`
  }
  return `${ms} ms`
}

// 验证单个值
const validatePageSize = (value: number): string => {
  if (isNaN(value) || value < limits.pageSize.min || value > limits.pageSize.max) {
    return `页面大小必须在 ${limits.pageSize.min} - ${limits.pageSize.max} 字节之间`
  }
  if (value % 256 !== 0) {
    return '页面大小必须是256的倍数'
  }
  return ''
}

const validateTimeout = (value: number): string => {
  if (isNaN(value) || value < limits.timeout.min || value > limits.timeout.max) {
    return `超时时间必须在 ${limits.timeout.min} - ${limits.timeout.max} 毫秒之间`
  }
  return ''
}

// 验证并更新
const validateAndUpdate = () => {
  // 验证页面大小
  validationErrors.value.romPageSize = validatePageSize(localSettings.value.pageSize.rom)
  validationErrors.value.ramPageSize = validatePageSize(localSettings.value.pageSize.ram)

  // 验证超时
  validationErrors.value.defaultTimeout = validateTimeout(localSettings.value.timeout.default)
  validationErrors.value.packageSendTimeout = validateTimeout(localSettings.value.timeout.packageSend)
  validationErrors.value.packageReceiveTimeout = validateTimeout(localSettings.value.timeout.packageReceive)
  validationErrors.value.operationTimeout = validateTimeout(localSettings.value.timeout.operation)
}

// 检查是否有效
const isValid = computed(() => {
  return Object.values(validationErrors.value).every(error => error === '')
})

// 重置为默认值
const resetToDefaults = () => {
  if (confirm(t('ui.settings.actions.resetConfirm'))) {
    localSettings.value = {
      pageSize: {
        rom: 0x400,
        ram: 0x200
      },
      timeout: {
        default: 3000,
        packageSend: 3000,
        packageReceive: 3000,
        operation: 100000
      }
    }
    validateAndUpdate()
  }
}

// 应用设置
const applySettings = () => {
  if (!isValid.value) return

  try {
    // 应用设置
    AdvancedSettings.setSettings(localSettings.value)
    
    console.log('设置已保存:', AdvancedSettings.getSettings())
    emit('applied')
    emit('close')
  } catch (error) {
    console.error('保存设置失败:', error)
    alert('保存设置失败，请检查输入值')
  }
}

// 组件挂载时加载当前设置
onMounted(() => {
  localSettings.value = {
    pageSize: {
      rom: AdvancedSettings.romPageSize,
      ram: AdvancedSettings.ramPageSize
    },
    timeout: {
      default: AdvancedSettings.defaultTimeout,
      packageSend: AdvancedSettings.packageSendTimeout,
      packageReceive: AdvancedSettings.packageReceiveTimeout,
      operation: AdvancedSettings.operationTimeout
    }
  }
  validateAndUpdate()
})
</script>

<style scoped>
.advanced-settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.advanced-settings {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa;
}

.settings-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.2em;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: #666;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #e0e0e0;
  color: #333;
}

.settings-content {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.setting-group {
  margin-bottom: 24px;
}

.setting-group:last-child {
  margin-bottom: 0;
}

.setting-group h4 {
  margin: 0 0 16px 0;
  color: #333;
  font-size: 1.1em;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 8px;
}

.setting-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 16px;
}

.setting-row:last-child {
  margin-bottom: 0;
}

.setting-item {
  margin-bottom: 0;
}

.setting-item label {
  display: block;
  margin-bottom: 6px;
  color: #555;
  font-weight: 500;
}

.input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.input-group input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  color: #333;
  font-size: 14px;
  transition: border-color 0.2s;
}

.input-group input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.input-group input:invalid,
.input-group input.error {
  border-color: #dc3545;
}

.unit {
  color: #666;
  font-size: 0.9em;
  white-space: nowrap;
  min-width: 60px;
}

.hint {
  display: block;
  margin-top: 4px;
  color: #666;
  font-size: 12px;
}

.validation-error {
  margin-top: 4px;
  color: #dc3545;
  font-size: 0.85em;
}

.settings-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-top: 1px solid #e0e0e0;
  background: #f8f9fa;
}

.footer-right {
  display: flex;
  gap: 12px;
}

.btn-primary,
.btn-secondary {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
  border-color: #0056b3;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: white;
  color: #333;
}

.btn-secondary:hover {
  background: #f8f9fa;
  border-color: #bbb;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .advanced-settings {
    background: #2d3748;
    border-color: #4a5568;
  }
  
  .settings-header,
  .settings-footer {
    background: #1a202c;
    border-color: #4a5568;
  }
  
  .settings-header h3,
  .setting-group h4,
  .setting-item label {
    color: #e2e8f0;
  }
  
  .input-group input {
    background: #4a5568;
    border-color: #718096;
    color: #e2e8f0;
  }
  
  .input-group input:focus {
    border-color: #63b3ed;
  }
  
  .unit,
  .hint {
    color: #a0aec0;
  }
  
  .close-btn {
    color: #a0aec0;
  }
  
  .close-btn:hover {
    background: #4a5568;
    color: #e2e8f0;
  }
  
  .btn-secondary {
    background: #4a5568;
    color: #e2e8f0;
    border-color: #718096;
  }
  
  .btn-secondary:hover {
    background: #2d3748;
    border-color: #a0aec0;
  }
}

/* Responsive design */
@media (max-width: 768px) {
  .advanced-settings {
    width: 95%;
    max-height: 90vh;
  }
  
  .setting-row {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .settings-header,
  .settings-content,
  .settings-footer {
    padding: 12px 16px;
  }
  
  .settings-footer {
    flex-direction: column;
    gap: 12px;
  }
  
  .footer-right {
    width: 100%;
    justify-content: center;
  }
  
  .btn-primary,
  .btn-secondary {
    width: 100%;
  }
}
</style>
