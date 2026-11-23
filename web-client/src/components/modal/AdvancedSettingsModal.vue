<template>
  <RetroModal
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

          <div class="setting-item">
            <label>{{ $t('ui.settings.firmware.profile') }}</label>
            <div
              class="variant-options"
              role="radiogroup"
              :aria-label="$t('ui.settings.firmware.profile')"
            >
              <button
                v-for="variant in variantOptions"
                :key="variant.id"
                type="button"
                class="variant-option"
                :class="{ 'is-active': selectedVariantId === variant.id }"
                role="radio"
                :aria-checked="selectedVariantId === variant.id"
                :data-testid="`variant-${variant.id}`"
                @click="selectVariant(variant.id)"
              >
                <span class="variant-name">{{ variant.label }}</span>
                <span class="variant-description">{{ variant.description }}</span>
              </button>
            </div>
            <small
              v-if="!selectedVariantId"
              class="hint variant-required"
              data-testid="variant-required"
            >
              {{ $t('ui.settings.firmware.selectionRequired') }}
            </small>
            <small
              class="hint active-profile-status"
              data-testid="active-session-profile"
            >
              {{ activeSessionLabel }}
            </small>
            <small
              class="hint firmware-reconnect-notice"
              data-testid="firmware-reconnect-notice"
            >
              {{ $t('ui.settings.firmware.reconnectNotice') }}
            </small>
          </div>
        </div>

        <div
          v-show="activeSection === 'appearance'"
          class="setting-group"
        >
          <h4>{{ $t('ui.settings.appearance.title') }}</h4>

          <div class="setting-item appearance-block">
            <label>{{ $t('ui.settings.appearance.colorMode') }}</label>
            <div
              class="color-mode-options"
              role="radiogroup"
              :aria-label="$t('ui.settings.appearance.colorMode')"
            >
              <button
                v-for="mode in colorModes"
                :key="mode.id"
                type="button"
                class="color-mode-btn"
                :class="{ 'is-active': currentColorMode === mode.id }"
                :data-testid="`color-mode-${mode.id}`"
                role="radio"
                :aria-checked="currentColorMode === mode.id"
                @click="setColorMode(mode.id)"
              >
                {{ $t(mode.labelKey) }}
              </button>
            </div>
          </div>

          <div class="setting-item appearance-block">
            <label>{{ $t('ui.settings.appearance.colorTheme') }}</label>
            <div
              class="theme-options"
              role="radiogroup"
              :aria-label="$t('ui.settings.appearance.colorTheme')"
            >
              <button
                v-for="theme in themes"
                :key="theme.id"
                type="button"
                class="theme-option-card"
                :class="{ 'is-active': currentTheme === theme.id }"
                role="radio"
                :aria-checked="currentTheme === theme.id"
                @click="setTheme(theme.id)"
              >
                <span
                  class="theme-option-swatch"
                  :style="{ backgroundColor: theme.swatch }"
                />
                <span class="theme-option-meta">
                  <span class="theme-option-name">{{ $t(theme.labelKey) }}</span>
                  <span class="theme-option-hex">{{ theme.swatch }}</span>
                </span>
              </button>
            </div>
          </div>

          <div class="setting-item appearance-block">
            <label for="appearance-font-family">{{ $t('ui.settings.appearance.fontFamily') }}</label>
            <div class="input-group">
              <RetroSelect
                id="appearance-font-family"
                :model-value="currentFont"
                size="md"
                full-width
                @update:model-value="onFontChange"
              >
                <option
                  v-for="font in fonts"
                  :key="font.id"
                  :value="font.id"
                >
                  {{ $t(font.labelKey) }}
                </option>
              </RetroSelect>
            </div>
            <div
              class="font-preview"
              :class="{ 'is-pixel': currentFont === 'ark-pixel' }"
            >
              {{ $t('ui.settings.appearance.fontPreview') }} — ABC 0123 ChisFlash
            </div>
          </div>
        </div>

        <!-- 封包大小设置（按参数命名空间渲染） -->
        <div
          v-show="activeSection === 'size'"
          class="setting-group"
        >
          <div class="size-section-header">
            <h4>{{ $t('ui.settings.size.title') }}</h4>
            <div
              class="profile-switch"
              data-testid="size-profile-switch"
            >
              <button
                v-for="tab in namespaceTabs"
                :key="tab.id"
                type="button"
                class="profile-switch-btn"
                :class="{ active: editingNamespace === tab.id }"
                :data-testid="`size-profile-${tab.id}`"
                @click="switchNamespace(tab.id)"
              >
                {{ tab.label }}
              </button>
            </div>
          </div>

          <div class="setting-row">
            <div
              v-for="field in namespaceFields"
              :key="field.key"
              class="setting-item"
            >
              <label :for="`param-${field.key}`">{{ field.label }}</label>
              <div class="input-group">
                <RetroSelect
                  v-if="field.kind === 'enum'"
                  :id="`param-${field.key}`"
                  :model-value="String(field.value)"
                  size="md"
                  full-width
                  @update:model-value="value => onEnumFieldChange(field.key, value)"
                >
                  <option
                    v-for="option in field.options"
                    :key="String(option)"
                    :value="String(option)"
                  >
                    {{ formatEnumOption(option) }}
                  </option>
                </RetroSelect>
                <input
                  v-else
                  :id="`param-${field.key}`"
                  v-model.number="namespaceDrafts[editingNamespace][field.key]"
                  type="number"
                  :min="field.min"
                  :max="field.max"
                  :step="64"
                  :data-testid="`param-${editingNamespace}-${field.key}`"
                  @input="validateNamespaceFields"
                >
                <span
                  v-if="field.kind !== 'enum'"
                  class="unit"
                >{{ $t('ui.settings.size.bytes') }}</span>
              </div>
              <div
                v-if="fieldErrors[editingNamespace]?.[field.key]"
                class="validation-error"
              >
                {{ fieldErrors[editingNamespace][field.key] }}
              </div>
              <small
                v-if="field.hint"
                class="hint"
              >{{ field.hint }}</small>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-item">
              <RetroSwitch
                id="independent-sizes"
                v-model="independentSizes"
                :label="$t('ui.settings.size.independentSizes')"
                data-testid="independent-sizes"
                @update:model-value="onIndependentSizesChange"
              />
              <small class="hint">{{ independentSizesHint }}</small>
            </div>
          </div>
        </div>

        <!-- 读写异常控制（超时、节流、重试） -->
        <div
          v-show="activeSection === 'control'"
          class="control-sections"
        >
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
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <RetroButton
        variant="ghost"
        size="sm"
        @click="resetToDefaults"
      >
        {{ $t('ui.settings.actions.reset') }}
      </RetroButton>
      <div class="footer-right">
        <RetroButton
          variant="secondary"
          size="sm"
          @click="$emit('close')"
        >
          {{ $t('ui.settings.actions.close') }}
        </RetroButton>
        <RetroButton
          variant="primary"
          size="sm"
          :disabled="!isValid"
          @click="applySettings"
        >
          {{ $t('ui.settings.actions.apply') }}
        </RetroButton>
      </div>
    </template>
  </RetroModal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { RetroButton, RetroModal, RetroSelect, RetroSwitch } from '@/components/retro';
import { DEFAULT_FONT_FAMILY, type FontFamilyId, useFont } from '@/composables/useFont';
import { DEFAULT_COLOR_MODE, DEFAULT_COLOR_THEME, useTheme } from '@/composables/useTheme';
import { VARIANT_IDS } from '@/device/definitions';
import { displayTextToString } from '@/device/display';
import type { ParameterDescriptor, ParameterSchema, ParameterValue } from '@/device/parameters';
import { getDeviceRuntime } from '@/device-runtime/runtime-instance';
import { AdvancedSettings, CORE_PARAMETER_NAMESPACE, type GlobalParameterKey } from '@/settings/advanced-settings';
import type { DeviceInfo } from '@/types/device-info';
import { formatBytes, formatTimeClock } from '@/utils/formatter-utils';

const { t } = useI18n();
const { currentTheme, themes, setTheme, currentColorMode, colorModes, setColorMode } = useTheme();
const { currentFont, fonts, setFont } = useFont();

const runtime = getDeviceRuntime();

type SettingsSectionId = 'firmware' | 'appearance' | 'size' | 'control';

function onFontChange(value: string | number | undefined) {
  if (typeof value === 'string') {
    setFont(value as FontFamilyId);
  }
}

// 定义 props
const props = withDefaults(defineProps<{
  modelValue: boolean;
  device?: DeviceInfo | null;
}>(), {
  device: null,
});

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

// --- 设备与固件选择（来自注册定义） ---

const VARIANT_LABEL_KEYS: Readonly<Record<string, string>> = {
  [VARIANT_IDS.stm]: 'ui.settings.firmware.stm',
  [VARIANT_IDS.stmBoost]: 'ui.settings.firmware.stmBoostOption',
  [VARIANT_IDS.stc]: 'ui.settings.firmware.stc',
  [VARIANT_IDS.gbflash]: 'ui.settings.firmware.flashgbx',
};

const VARIANT_HINT_KEYS: Readonly<Record<string, string>> = {
  [VARIANT_IDS.stm]: 'ui.settings.firmware.stmHint',
  [VARIANT_IDS.stmBoost]: 'ui.settings.firmware.stmBoostHint',
  [VARIANT_IDS.stc]: 'ui.settings.firmware.stcHint',
  [VARIANT_IDS.gbflash]: 'ui.settings.firmware.flashgbxHint',
};

const variantOptions = computed(() => runtime.registry.listSelectable().map(variant => ({
  id: variant.variantId,
  label: t(VARIANT_LABEL_KEYS[variant.variantId] ?? '') || displayTextToString(variant.firmwareName),
  description: VARIANT_HINT_KEYS[variant.variantId] ? t(VARIANT_HINT_KEYS[variant.variantId]) : '',
})));

const selectedVariantId = ref<string | null>(null);

/** Active session (not the saved selection): what is really on the wire right now. */
const activeSessionLabel = computed(() => {
  const session = props.device?.session;
  if (!session) {
    return t('ui.settings.firmware.noActiveSession');
  }
  const device = displayTextToString(session.device.displayName);
  const firmware = displayTextToString(session.firmware.displayName);
  const version = session.firmwareVersion ? ` ${session.firmwareVersion}` : '';
  return `${t('ui.settings.firmware.activeProfile')}: ${device} / ${firmware}${version}`;
});

// --- 参数命名空间与 schema 表单 ---

const NAMESPACE_LABEL_KEYS: Readonly<Record<string, string>> = {
  'beggar.stm': 'ui.settings.firmware.stm',
  'beggar.stc': 'ui.settings.firmware.stc',
  'flashgbx.cfw': 'ui.settings.firmware.flashgbx',
};

/** Labels come from the locale files; the schema only declares the parameter itself. */
const PARAMETER_LABEL_KEYS: Readonly<Record<string, string>> = {
  romPageSize: 'ui.settings.size.romPageSize',
  romReadPageSize: 'ui.settings.size.romReadPageSize',
  ramPageSize: 'ui.settings.size.ramPageSize',
  baudRate: 'ui.settings.firmware.flashgbxBaudRate',
};

const editingNamespace = ref<string>(CORE_PARAMETER_NAMESPACE);
const independentSizes = ref(AdvancedSettings.getIndependentSizes());
/** Draft values per namespace; the schema supplies defaults and ranges. */
const namespaceDrafts = ref<Record<string, Record<string, ParameterValue>>>({});
const fieldErrors = ref<Record<string, Record<string, string>>>({});

const namespaceTabs = computed(() => {
  const namespaces = independentSizes.value
    ? ['beggar.stm', 'beggar.stc', 'flashgbx.cfw']
    // Linked sizes: STM and STC are one group, so only the shared entry is offered.
    : ['beggar.stm', 'flashgbx.cfw'];
  return namespaces.map(namespace => ({
    id: namespace,
    label: t(NAMESPACE_LABEL_KEYS[namespace] ?? ''),
  }));
});

function selectVariant(variantId: string) {
  selectedVariantId.value = variantId;
  const namespace = runtime.registry.findVariant(variantId)?.parameterNamespace;
  if (namespace && !namespaceTabs.value.some(tab => tab.id === namespace)) {
    editingNamespace.value = namespace;
  }
}

const independentSizesHint = computed(() => (
  independentSizes.value
    ? t('ui.settings.size.independentHint')
    : t('ui.settings.size.linkedHint')
));

function schemaFor(namespace: string): ParameterSchema {
  return runtime.registry.resolveNamespaceSchema(namespace)?.schema ?? [];
}

function labelFor(descriptor: ParameterDescriptor): string {
  const key = PARAMETER_LABEL_KEYS[descriptor.key];
  return key ? t(key) : displayTextToString(descriptor.label);
}

const namespaceFields = computed(() => schemaFor(editingNamespace.value).map((descriptor) => {
  const value = namespaceDrafts.value[editingNamespace.value]?.[descriptor.key] ?? descriptor.default;
  const hint = descriptor.key === 'baudRate'
    ? t('ui.settings.firmware.flashgbxBaudHint')
    : typeof value === 'number'
      ? formatBytes(value)
      : descriptor.description
        ? displayTextToString(descriptor.description)
        : '';
  return {
    key: descriptor.key,
    kind: descriptor.kind === 'enum' ? 'enum' as const : 'int' as const,
    label: labelFor(descriptor),
    value,
    min: descriptor.constraints?.min,
    max: descriptor.constraints?.max,
    options: descriptor.constraints?.options ?? [],
    hint,
  };
}));

function formatEnumOption(option: ParameterValue): string {
  return option === 'auto' ? t('ui.settings.firmware.flashgbxBaudAuto') : String(option);
}

function onEnumFieldChange(key: string, value: string | number | undefined) {
  const raw = String(value ?? '');
  namespaceDrafts.value[editingNamespace.value] = {
    ...namespaceDrafts.value[editingNamespace.value],
    [key]: raw === 'auto' ? 'auto' : Number(raw),
  };
  validateNamespaceFields();
}

function switchNamespace(namespace: string) {
  if (editingNamespace.value === namespace) return;
  editingNamespace.value = namespace;
  validateNamespaceFields();
}

function onIndependentSizesChange(next: boolean | undefined) {
  independentSizes.value = next === true;
  if (!independentSizes.value && editingNamespace.value === 'beggar.stc') {
    editingNamespace.value = 'beggar.stm';
  }
  validateNamespaceFields();
}

function validateNamespaceFields() {
  const errors: Record<string, Record<string, string>> = {};
  for (const tab of namespaceTabs.value) {
    const namespace = tab.id;
    const draft = namespaceDrafts.value[namespace] ?? {};
    for (const descriptor of schemaFor(namespace)) {
      const value = draft[descriptor.key] ?? descriptor.default;
      const message = validateDescriptor(descriptor, value);
      if (message) {
        errors[namespace] = { ...(errors[namespace] ?? {}), [descriptor.key]: message };
      }
    }
  }
  fieldErrors.value = errors;
}

function validateDescriptor(descriptor: ParameterDescriptor, value: ParameterValue): string {
  const { min, max, options } = descriptor.constraints ?? {};
  if (descriptor.kind === 'enum') {
    return options && !options.includes(value)
      ? t('ui.settings.size.validation.invalid')
      : '';
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return t('ui.settings.size.validation.invalid');
  }
  if ((min !== undefined && numeric < min) || (max !== undefined && numeric > max)) {
    return t('ui.settings.size.validation.range', { min: min ?? 0, max: max ?? 0 });
  }
  if (numeric % 64 !== 0 && numeric !== 0x0c00) {
    return t('ui.settings.size.validation.multiple', { multipler: 64 });
  }
  return '';
}

// --- 全局读写参数（超时/节流/重试）表单视图模型 ---

interface ControlSettings {
  throttle: { romRead: number; ramRead: number };
  retry: {
    romReadCount: number;
    ramReadCount: number;
    romReadDelay: number;
    ramReadDelay: number;
    romEraseRetryCount: number;
    romEraseRetryDelay: number;
    romWriteRetryCount: number;
    romWriteRetryDelay: number;
  };
  timeout: { default: number; packageSend: number; packageReceive: number; operation: number };
}

const CONTROL_FIELD_KEYS: readonly { group: keyof ControlSettings; field: string; key: GlobalParameterKey }[] = [
  { group: 'throttle', field: 'romRead', key: 'romReadThrottleMs' },
  { group: 'throttle', field: 'ramRead', key: 'ramReadThrottleMs' },
  { group: 'retry', field: 'romReadCount', key: 'romReadRetryCount' },
  { group: 'retry', field: 'ramReadCount', key: 'ramReadRetryCount' },
  { group: 'retry', field: 'romReadDelay', key: 'romReadRetryDelayMs' },
  { group: 'retry', field: 'ramReadDelay', key: 'ramReadRetryDelayMs' },
  { group: 'retry', field: 'romEraseRetryCount', key: 'romEraseRetryCount' },
  { group: 'retry', field: 'romEraseRetryDelay', key: 'romEraseRetryDelayMs' },
  { group: 'retry', field: 'romWriteRetryCount', key: 'romWriteRetryCount' },
  { group: 'retry', field: 'romWriteRetryDelay', key: 'romWriteRetryDelayMs' },
  { group: 'timeout', field: 'default', key: 'defaultTimeout' },
  { group: 'timeout', field: 'packageSend', key: 'packageSendTimeout' },
  { group: 'timeout', field: 'packageReceive', key: 'packageReceiveTimeout' },
  { group: 'timeout', field: 'operation', key: 'operationTimeout' },
];

function toControlSettings(values: Readonly<Record<string, ParameterValue>>): ControlSettings {
  const num = (key: string, fallback: number) => {
    const value = values[key];
    return typeof value === 'number' ? value : fallback;
  };
  return {
    throttle: { romRead: num('romReadThrottleMs', 0), ramRead: num('ramReadThrottleMs', 0) },
    retry: {
      romReadCount: num('romReadRetryCount', 1),
      ramReadCount: num('ramReadRetryCount', 1),
      romReadDelay: num('romReadRetryDelayMs', 0),
      ramReadDelay: num('ramReadRetryDelayMs', 0),
      romEraseRetryCount: num('romEraseRetryCount', 1),
      romEraseRetryDelay: num('romEraseRetryDelayMs', 0),
      romWriteRetryCount: num('romWriteRetryCount', 1),
      romWriteRetryDelay: num('romWriteRetryDelayMs', 0),
    },
    timeout: {
      default: num('defaultTimeout', 3000),
      packageSend: num('packageSendTimeout', 3000),
      packageReceive: num('packageReceiveTimeout', 3000),
      operation: num('operationTimeout', 30000),
    },
  };
}

const localSettings = ref<ControlSettings>(toControlSettings(AdvancedSettings.getGlobalParameters()));
const activeSection = ref<SettingsSectionId>('firmware');

// 验证错误
const validationErrors = ref({
  romReadThrottle: '',
  ramReadThrottle: '',
  romReadRetryCount: '',
  ramReadRetryCount: '',
  romReadRetryDelay: '',
  ramReadRetryDelay: '',
  romEraseRetryCount: '',
  romEraseRetryDelay: '',
  romWriteRetryCount: '',
  romWriteRetryDelay: '',
  defaultTimeout: '',
  packageSendTimeout: '',
  packageReceiveTimeout: '',
  operationTimeout: '',
});

const hasSectionError = (sectionId: SettingsSectionId): boolean => {
  switch (sectionId) {
    case 'size':
      return Object.values(fieldErrors.value).some(errors => Object.keys(errors).length > 0);
    case 'control':
      return Object.values(validationErrors.value).some(error => error !== '');
    case 'firmware':
    case 'appearance':
      return false;
  }
};

const selectedVariantLabel = computed(() => {
  const option = variantOptions.value.find(variant => variant.id === selectedVariantId.value);
  return option ? option.label : t('ui.settings.firmware.selectionRequired');
});

const settingsSections = computed(() => {
  const activeColorModeOption = colorModes.find((item) => item.id === currentColorMode.value);
  const activeThemeOption = themes.find((item) => item.id === currentTheme.value);
  const activeFontOption = fonts.find((item) => item.id === currentFont.value);
  const sizeSummary = namespaceFields.value
    .filter(field => field.kind === 'int')
    .map(field => formatBytes(Number(field.value)))
    .join(' / ');
  return [
    {
      id: 'firmware' as const,
      title: t('ui.settings.firmware.title'),
      summary: selectedVariantLabel.value,
    },
    {
      id: 'appearance' as const,
      title: t('ui.settings.appearance.title'),
      summary: `${activeColorModeOption ? t(activeColorModeOption.labelKey) : ''} / ${activeThemeOption ? t(activeThemeOption.labelKey) : ''} / ${activeFontOption ? t(activeFontOption.labelKey) : ''}`,
    },
    {
      id: 'size' as const,
      title: t('ui.settings.size.title'),
      summary: sizeSummary,
    },
    {
      id: 'control' as const,
      title: t('ui.settings.control.title'),
      summary: `${formatTimeClock(localSettings.value.timeout.default, 'ms')} / ${localSettings.value.throttle.romRead}ms / ${localSettings.value.retry.romReadCount}x`,
    },
  ];
});

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
  validationErrors.value.romReadThrottle = validateThrottle(localSettings.value.throttle.romRead);
  validationErrors.value.ramReadThrottle = validateThrottle(localSettings.value.throttle.ramRead);
  validationErrors.value.romReadRetryCount = validateRetryCount(localSettings.value.retry.romReadCount);
  validationErrors.value.ramReadRetryCount = validateRetryCount(localSettings.value.retry.ramReadCount);
  validationErrors.value.romReadRetryDelay = validateRetryDelay(localSettings.value.retry.romReadDelay);
  validationErrors.value.ramReadRetryDelay = validateRetryDelay(localSettings.value.retry.ramReadDelay);
  validationErrors.value.romEraseRetryCount = validateRetryCount(localSettings.value.retry.romEraseRetryCount);
  validationErrors.value.romEraseRetryDelay = validateRetryDelay(localSettings.value.retry.romEraseRetryDelay);
  validationErrors.value.romWriteRetryCount = validateRetryCount(localSettings.value.retry.romWriteRetryCount);
  validationErrors.value.romWriteRetryDelay = validateRetryDelay(localSettings.value.retry.romWriteRetryDelay);

  // 验证超时
  validationErrors.value.defaultTimeout = validateTimeout(localSettings.value.timeout.default);
  validationErrors.value.packageSendTimeout = validateTimeout(localSettings.value.timeout.packageSend);
  validationErrors.value.packageReceiveTimeout = validateTimeout(localSettings.value.timeout.packageReceive);
  validationErrors.value.operationTimeout = validateTimeout(localSettings.value.timeout.operation);
};

// 检查是否有效
const isValid = computed(() => {
  return Boolean(selectedVariantId.value)
    && Object.values(validationErrors.value).every(error => error === '')
    && Object.values(fieldErrors.value).every(errors => Object.keys(errors).length === 0);
});

// 重置为默认值
const resetToDefaults = () => {
  if (confirm(t('ui.settings.actions.resetConfirm'))) {
    AdvancedSettings.resetToDefaults();
    AdvancedSettings.setVariantId(VARIANT_IDS.stm);
    setColorMode(DEFAULT_COLOR_MODE);
    setTheme(DEFAULT_COLOR_THEME);
    setFont(DEFAULT_FONT_FAMILY);
    loadCurrentSettings();
  }
};

// 应用设置
const applySettings = () => {
  if (!isValid.value) return;

  try {
    const namespace = CORE_PARAMETER_NAMESPACE;
    AdvancedSettings.setIndependentSizes(independentSizes.value);

    for (const tab of namespaceTabs.value) {
      for (const descriptor of schemaFor(tab.id)) {
        const value = namespaceDrafts.value[tab.id]?.[descriptor.key] ?? descriptor.default;
        runtime.store.set(tab.id, descriptor.key, value);
      }
    }

    for (const mapping of CONTROL_FIELD_KEYS) {
      const group = localSettings.value[mapping.group] as unknown as Record<string, number>;
      runtime.store.set(namespace, mapping.key, group[mapping.field]);
    }

    if (selectedVariantId.value) {
      AdvancedSettings.setVariantId(selectedVariantId.value);
    }

    console.log(t('ui.settings.messages.saveSuccess'));
    emit('applied');
    emit('close');
  } catch (error) {
    console.error(t('ui.settings.messages.saveError'), error);
    alert(t('ui.settings.messages.saveError'));
  }
};

// 组件挂载或打开时加载当前设置
function loadCurrentSettings() {
  selectedVariantId.value = runtime.selection.read().variantId ?? null;
  independentSizes.value = AdvancedSettings.getIndependentSizes();

  const drafts: Record<string, Record<string, ParameterValue>> = {};
  for (const namespace of ['beggar.stm', 'beggar.stc', 'flashgbx.cfw']) {
    drafts[namespace] = { ...runtime.store.snapshot(namespace) };
  }
  namespaceDrafts.value = drafts;

  const selectedNamespace = runtime.registry.findVariant(selectedVariantId.value ?? '')?.parameterNamespace;
  editingNamespace.value = selectedNamespace && namespaceTabs.value.some(tab => tab.id === selectedNamespace)
    ? selectedNamespace
    : 'beggar.stm';

  localSettings.value = toControlSettings(AdvancedSettings.getGlobalParameters());
  validateAndUpdate();
  validateNamespaceFields();
};

// Fill the drafts before the first render so every v-model target exists.
loadCurrentSettings();

onMounted(loadCurrentSettings);

watch(() => props.modelValue, (visible) => {
  if (visible) {
    loadCurrentSettings();
  }
});
</script>

<style lang="scss" scoped>
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
  border-right: 1px solid var(--retro-divider);
}

.settings-nav-button {
  position: relative;
  display: grid;
  gap: spacing-vars.$space-1;
  width: 100%;
  min-height: 58px;
  padding: spacing-vars.$space-3;
  border: 1.5px solid var(--retro-border-subtle);
  border-radius: 6px;
  background: var(--retro-bg-surface);
  color: var(--retro-ink);
  text-align: left;
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.1s ease, border-color 0.12s ease, background-color 0.12s ease;

  &:hover {
    border-color: var(--retro-border);
    background: var(--retro-bg-elevated);
    transform: translate(-1px, 1px);
    box-shadow: var(--retro-shadow-btn-hover);
  }

  &.active {
    background: var(--retro-bg-tint);
    border-color: var(--retro-border);
    color: var(--retro-ink);
    box-shadow: var(--retro-shadow-btn);
  }

  &.invalid {
    border-color: var(--retro-danger-fg);
    background: var(--retro-danger-bg);
  }
}

.nav-title {
  font-size: typography-vars.$font-size-sm;
  font-weight: typography-vars.$font-weight-medium;
}

.nav-summary {
  overflow: hidden;
  color: var(--color-secondary);
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
  background: var(--color-error);
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
    color: var(--retro-ink);
    font-size: typography-vars.$font-size-lg;
    border-bottom: 1px solid var(--retro-divider);
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

  > label {
    display: block;
    margin-bottom: spacing-vars.$space-2;
    color: var(--retro-ink-muted);
    font-weight: typography-vars.$font-weight-medium;
  }
}

.variant-options {
  display: grid;
  gap: spacing-vars.$space-2;
}

.variant-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid var(--retro-border);
  border-radius: 4px;
  background: var(--retro-bg-surface);
  color: var(--retro-ink);
  box-shadow: var(--retro-shadow-btn);
  text-align: left;
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.1s ease, background-color 0.12s ease;

  &:hover {
    background: var(--retro-bg-tint);
    transform: translate(-1px, 1px);
    box-shadow: var(--retro-shadow-btn-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--retro-primary-bg);
    outline-offset: 2px;
  }

  &.is-active {
    background: var(--retro-bg-tint);
    outline: 2px solid var(--retro-primary-bg);
    outline-offset: -2px;
  }
}

.variant-name {
  font-size: typography-vars.$font-size-sm;
  font-weight: typography-vars.$font-weight-semibold;
  line-height: 1.4;
}

.variant-description {
  color: var(--retro-ink-muted);
  font-size: typography-vars.$font-size-xs;
  line-height: 1.5;
}

.input-group {
  position: relative;
  display: flex;
  align-items: center;

  input {
    width: 100%;
    box-sizing: border-box;
    padding: 7px 52px 7px 10px;
    border: 1.5px solid var(--retro-border);
    border-radius: 4px;
    background: var(--retro-bg-surface);
    color: var(--retro-ink);
    font-family: var(--retro-font-mono);
    font-size: typography-vars.$font-size-sm;
    transition: box-shadow 0.12s ease;

    &:focus {
      outline: none;
      box-shadow: var(--retro-shadow-btn);
    }

    &:invalid {
      border-color: var(--retro-danger-fg);
    }
  }
}

.unit {
  position: absolute;
  right: spacing-vars.$space-3;
  top: 50%;
  transform: translateY(-50%);
  color: var(--retro-ink-muted);
  font-size: typography-vars.$font-size-xs;
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
}

.hint {
  display: block;
  margin-top: spacing-vars.$space-1;
  color: var(--retro-ink-muted);
  font-size: typography-vars.$font-size-xs;
  text-align: center;
}

.validation-error {
  margin-top: spacing-vars.$space-1;
  color: var(--retro-danger-fg);
  font-size: typography-vars.$font-size-xs;
}

.footer-right {
  display: flex;
  gap: spacing-vars.$space-3;
}

.appearance-block + .appearance-block {
  margin-top: spacing-vars.$space-5;
}

.theme-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: spacing-vars.$space-3;
}

.theme-option-card {
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-2;
  padding: 10px 12px;
  border: 1.5px solid var(--retro-border);
  border-radius: 4px;
  background: var(--retro-bg-surface);
  color: var(--retro-ink);
  box-shadow: var(--retro-shadow-btn);
  cursor: pointer;
  text-align: left;
  transition: transform 0.1s ease, box-shadow 0.1s ease, background-color 0.12s ease;

  &:hover {
    background: var(--retro-bg-tint);
    transform: translate(-1px, 1px);
    box-shadow: var(--retro-shadow-btn-hover);
  }

  &.is-active {
    background: var(--retro-bg-tint);
    outline: 2px solid var(--retro-primary-bg);
    outline-offset: -2px;
  }
}

.theme-option-swatch {
  width: 20px;
  height: 20px;
  border-radius: 3px;
  border: 1.5px solid var(--retro-border);
  flex-shrink: 0;
}

.theme-option-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.theme-option-name {
  font-size: typography-vars.$font-size-xs;
  font-weight: typography-vars.$font-weight-semibold;
  color: var(--retro-ink);
}

.theme-option-hex {
  font-family: var(--retro-font-micro);
  font-size: 10px;
  color: var(--retro-ink-muted);
}

.font-preview {
  margin-top: spacing-vars.$space-3;
  padding: 10px 12px;
  border: 1.5px dashed var(--retro-border-dashed);
  border-radius: 4px;
  background: var(--retro-bg-surface);
  color: var(--retro-ink);
  font-size: typography-vars.$font-size-sm;

  &.is-pixel {
    font-family: 'Ark Pixel 12px', system-ui, sans-serif;
  }
}

@mixin btn-base {
  padding: spacing-vars.$space-2 spacing-vars.$space-4;
  border: 1px solid var(--color-border);
  border-radius: radius-vars.$radius-base;
  font-size: typography-vars.$font-size-sm;
  cursor: pointer;
  transition: all 0.2s;
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
    border-bottom: 1px solid var(--retro-divider);
  }

  .settings-nav-button {
    min-width: 150px;
  }

  .setting-row {
    grid-template-columns: 1fr;
  }

  .theme-options {
    grid-template-columns: 1fr;
  }
}

.color-mode-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: spacing-vars.$space-2;
}

.color-mode-btn {
  padding: spacing-vars.$space-2 spacing-vars.$space-3;
  border: 1px solid var(--retro-border-color, #4a5568);
  border-radius: radius-vars.$radius-sm;
  background: transparent;
  color: inherit;
  font-size: typography-vars.$font-size-xs;
  cursor: pointer;

  &.is-active {
    background: var(--retro-accent-bg, rgba(102, 126, 234, 0.2));
    border-color: var(--retro-accent-color, #667eea);
    font-weight: typography-vars.$font-weight-semibold;
  }
}

.control-sections {
  display: flex;
  flex-direction: column;
  gap: spacing-vars.$space-5;
}

.size-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: spacing-vars.$space-3;
  flex-wrap: wrap;
  margin-bottom: spacing-vars.$space-3;

  h4 {
    margin: 0;
  }
}

.profile-switch {
  display: inline-flex;
  gap: spacing-vars.$space-1;
}

.profile-switch-btn {
  padding: spacing-vars.$space-1 spacing-vars.$space-3;
  border: 1px solid var(--retro-border-color, #4a5568);
  border-radius: radius-vars.$radius-sm;
  background: transparent;
  color: inherit;
  font-size: typography-vars.$font-size-xs;
  cursor: pointer;

  &.active {
    background: var(--retro-accent-bg, rgba(102, 126, 234, 0.2));
    border-color: var(--retro-accent-color, #667eea);
    font-weight: typography-vars.$font-weight-semibold;
  }
}
</style>
