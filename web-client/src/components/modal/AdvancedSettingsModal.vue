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
                  :step="field.step"
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

        <!-- 读写异常控制（超时、节流、重试）：分组、范围、单位都来自参数描述符 -->
        <div
          v-show="activeSection === 'control'"
          class="control-sections"
        >
          <div
            v-for="group in controlGroups"
            :key="group.id"
            class="setting-group"
          >
            <h4>{{ group.title }}</h4>

            <div
              v-for="(row, rowIndex) in group.rows"
              :key="rowIndex"
              class="setting-row"
            >
              <div
                v-for="field in row"
                :key="field.key"
                class="setting-item"
              >
                <label :for="field.id">{{ field.label }}</label>
                <div class="input-group">
                  <input
                    :id="field.id"
                    v-model.number="controlValues[field.key]"
                    type="number"
                    :min="field.min"
                    :max="field.max"
                    :step="field.step"
                  >
                  <span class="unit">{{ field.unitLabel }}</span>
                </div>
                <div
                  v-if="field.error"
                  class="validation-error"
                >
                  {{ field.error }}
                </div>
                <small
                  v-if="field.hint"
                  class="hint"
                >{{ field.hint }}</small>
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
import {
  GLOBAL_PARAMETER_SCHEMA,
  type ParameterDescriptor,
  type ParameterSchema,
  type ParameterValue,
} from '@/device/parameters';
import { getDeviceRuntime } from '@/device-runtime/runtime-instance';
import { AdvancedSettings, CORE_PARAMETER_NAMESPACE } from '@/settings/advanced-settings';
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
  if (!namespace) return;
  editingNamespace.value = visibleNamespaceFor(namespace);
  validateNamespaceFields();
}

/** Link group declared by a namespace's page-size descriptor, when it declares one. */
function sizeLinkGroupOf(namespace: string): string | undefined {
  return schemaFor(namespace).find(descriptor => descriptor.key === 'romPageSize')?.linkGroup;
}

/**
 * Namespace the size editor can actually show for a selection.
 *
 * Applying writes only the visible tabs, so leaving the editor on a hidden namespace would
 * drop the edit without a word. A linked namespace (STC while sizes are shared) maps onto the
 * tab that owns the same link group; anything else falls back to the first visible tab.
 */
function visibleNamespaceFor(namespace: string): string {
  const tabs = namespaceTabs.value;
  if (tabs.some(tab => tab.id === namespace)) {
    return namespace;
  }
  const linkGroup = sizeLinkGroupOf(namespace);
  const linked = linkGroup
    ? tabs.find(tab => sizeLinkGroupOf(tab.id) === linkGroup)
    : undefined;
  return linked?.id ?? tabs[0]?.id ?? namespace;
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
    step: descriptor.alignment ?? 1,
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
  const issue = fieldIssue(descriptor, value);
  return issue ? messageForSize(descriptor, issue) : '';
}

type FieldIssue = 'invalid' | 'range' | 'alignment' | 'option';

/**
 * One verdict per descriptor, shared by the size form and the control form.
 *
 * The alignment comes from the descriptor (`0x40` for page sizes) instead of a literal in the
 * template, so a bound cannot be enforced by the form and forgotten by the store.
 */
function fieldIssue(descriptor: ParameterDescriptor, value: ParameterValue): FieldIssue | undefined {
  const { min, max, options } = descriptor.constraints ?? {};
  if (descriptor.kind === 'enum') {
    return options && !options.includes(value) ? 'option' : undefined;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 'invalid';
  }
  if ((min !== undefined && numeric < min) || (max !== undefined && numeric > max)) {
    return 'range';
  }
  const alignment = descriptor.alignment ?? 1;
  if (alignment > 1 && numeric % alignment !== 0) {
    return 'alignment';
  }
  return undefined;
}

function messageForSize(descriptor: ParameterDescriptor, issue: FieldIssue): string {
  const { min, max } = descriptor.constraints ?? {};
  switch (issue) {
    case 'range':
      return t('ui.settings.size.validation.range', { min: min ?? 0, max: max ?? 0 });
    case 'alignment':
      return t('ui.settings.size.validation.multiple', { multipler: descriptor.alignment ?? 1 });
    default:
      return t('ui.settings.size.validation.invalid');
  }
}

function messageForControl(descriptor: ParameterDescriptor, issue: FieldIssue): string {
  if (issue !== 'range') {
    return t('ui.settings.size.validation.invalid');
  }
  const { min, max } = descriptor.constraints ?? {};
  const range = { min: min ?? 0, max: max ?? 0 };
  switch (descriptor.section) {
    case 'throttle':
      return t('ui.settings.throttle.validation.range', range);
    case 'retry':
      return descriptor.unit === 'count'
        ? t('ui.settings.retry.validation.countRange', range)
        : t('ui.settings.retry.validation.delayRange', range);
    default:
      return t('ui.settings.timeout.validation.range', range);
  }
}

// --- 全局读写参数（超时/节流/重试）表单视图模型 ---

/**
 * Presentation of one global parameter: element id, locale key and input step.
 *
 * Ranges, units, grouping and validation live in `GLOBAL_PARAMETER_SCHEMA`; keeping only the
 * id and the label here means a parameter cannot be described twice.
 */
interface GlobalFieldView {
  readonly id: string;
  readonly labelKey: string;
  readonly step: number;
}

const GLOBAL_FIELD_VIEWS: Readonly<Record<string, GlobalFieldView>> = {
  romReadThrottleMs: { id: 'rom-read-throttle', labelKey: 'ui.settings.throttle.romRead', step: 1 },
  ramReadThrottleMs: { id: 'ram-read-throttle', labelKey: 'ui.settings.throttle.ramRead', step: 1 },
  romReadRetryCount: { id: 'rom-read-retry-count', labelKey: 'ui.settings.retry.romReadCount', step: 1 },
  ramReadRetryCount: { id: 'ram-read-retry-count', labelKey: 'ui.settings.retry.ramReadCount', step: 1 },
  romReadRetryDelayMs: { id: 'rom-read-retry-delay', labelKey: 'ui.settings.retry.romReadDelay', step: 1 },
  ramReadRetryDelayMs: { id: 'ram-read-retry-delay', labelKey: 'ui.settings.retry.ramReadDelay', step: 1 },
  romEraseRetryCount: { id: 'rom-erase-retry-count', labelKey: 'ui.settings.retry.romEraseRetryCount', step: 1 },
  romEraseRetryDelayMs: { id: 'rom-erase-retry-delay', labelKey: 'ui.settings.retry.romEraseRetryDelay', step: 1 },
  romWriteRetryCount: { id: 'rom-write-retry-count', labelKey: 'ui.settings.retry.romWriteRetryCount', step: 1 },
  romWriteRetryDelayMs: { id: 'rom-write-retry-delay', labelKey: 'ui.settings.retry.romWriteRetryDelay', step: 1 },
  defaultTimeout: { id: 'default-timeout', labelKey: 'ui.settings.timeout.defaultTimeout', step: 100 },
  packageSendTimeout: { id: 'package-send-timeout', labelKey: 'ui.settings.timeout.packageSendTimeout', step: 100 },
  packageReceiveTimeout: { id: 'package-receive-timeout', labelKey: 'ui.settings.timeout.packageReceiveTimeout', step: 100 },
  operationTimeout: { id: 'operation-timeout', labelKey: 'ui.settings.timeout.operationTimeout', step: 1000 },
};

type GlobalSection = NonNullable<ParameterDescriptor['section']>;

const CONTROL_GROUP_ORDER: readonly GlobalSection[] = ['timeout', 'throttle', 'retry'];

const CONTROL_GROUP_TITLES: Readonly<Record<GlobalSection, string>> = {
  timeout: 'ui.settings.timeout.title',
  throttle: 'ui.settings.throttle.title',
  retry: 'ui.settings.retry.title',
};

/** Draft values keyed by parameter key; the schema supplies defaults and ranges. */
const controlValues = ref<Record<string, number>>({});

const controlErrors = computed<Record<string, string>>(() => {
  const errors: Record<string, string> = {};
  for (const descriptor of GLOBAL_PARAMETER_SCHEMA) {
    const value = controlValues.value[descriptor.key];
    const issue = fieldIssue(descriptor, value ?? descriptor.default);
    if (issue) {
      errors[descriptor.key] = messageForControl(descriptor, issue);
    }
  }
  return errors;
});

interface ControlField {
  key: string;
  id: string;
  label: string;
  min?: number;
  max?: number;
  step: number;
  unitLabel: string;
  error: string;
  hint: string;
}

function toControlField(descriptor: ParameterDescriptor): ControlField {
  const view = GLOBAL_FIELD_VIEWS[descriptor.key];
  const value = controlValues.value[descriptor.key] ?? Number(descriptor.default);
  const { min, max } = descriptor.constraints ?? {};
  return {
    key: descriptor.key,
    id: view?.id ?? descriptor.key,
    label: view ? t(view.labelKey) : displayTextToString(descriptor.label),
    min,
    max,
    step: view?.step ?? 1,
    unitLabel: descriptor.unit === 'count' ? 'x' : t('ui.settings.timeout.milliseconds'),
    error: controlErrors.value[descriptor.key] ?? '',
    hint: descriptor.unit === 'ms' ? formatTimeClock(value, 'ms') : '',
  };
}

function chunkRows<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

const controlGroups = computed(() => CONTROL_GROUP_ORDER.map((section) => {
  const fields = GLOBAL_PARAMETER_SCHEMA
    .filter(descriptor => descriptor.section === section)
    .map(descriptor => toControlField(descriptor));
  return {
    id: section,
    title: t(CONTROL_GROUP_TITLES[section]),
    rows: chunkRows(fields, 2),
  };
}).filter(group => group.rows.length > 0));

const activeSection = ref<SettingsSectionId>('firmware');

const hasSectionError = (sectionId: SettingsSectionId): boolean => {
  switch (sectionId) {
    case 'size':
      return Object.values(fieldErrors.value).some(errors => Object.keys(errors).length > 0);
    case 'control':
      return Object.keys(controlErrors.value).length > 0;
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
      summary: `${formatTimeClock(controlValues.value.defaultTimeout ?? 0, 'ms')} / ${controlValues.value.romReadThrottleMs ?? 0}ms / ${controlValues.value.romReadRetryCount ?? 0}x`,
    },
  ];
});

// 检查是否有效
const isValid = computed(() => {
  return Boolean(selectedVariantId.value)
    && Object.keys(controlErrors.value).length === 0
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

    for (const descriptor of GLOBAL_PARAMETER_SCHEMA) {
      const value = controlValues.value[descriptor.key];
      runtime.store.set(namespace, descriptor.key, value ?? descriptor.default);
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
  editingNamespace.value = selectedNamespace ? visibleNamespaceFor(selectedNamespace) : 'beggar.stm';

  const globals = AdvancedSettings.getGlobalParameters();
  controlValues.value = Object.fromEntries(
    GLOBAL_PARAMETER_SCHEMA.map(descriptor => [
      descriptor.key,
      Number(globals[descriptor.key] ?? descriptor.default),
    ]),
  );
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
