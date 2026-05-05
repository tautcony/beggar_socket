<template>
  <div class="rom-operations-container">
    <section class="section">
      <div class="section-header">
        <div class="op-title-row">
          <span :class="['op-title', { busy }]">{{ $t('ui.ram.title') }}</span>
        </div>
        <div class="selector-container">
          <div class="type-selector">
            <label class="type-label">{{ $t('ui.ram.typeLabel') }}</label>
            <select
              v-model="selectedRamType"
              :disabled="!deviceReady || busy"
              class="type-dropdown"
              @change="onRamTypeChange"
            >
              <option value="SRAM">
                {{ $t('ui.ram.typeSRAM') }}
              </option>
              <option value="FLASH">
                {{ $t('ui.ram.typeFLASH') }}
              </option>
              <option
                value="FRAM"
                :disabled="!supportsFramRam"
              >
                {{ $t('ui.ram.typeFRAM') }}
              </option>
              <option
                v-if="mode === 'GBA'"
                value="BATLESS"
              >
                {{ $t('ui.ram.typeBATLESS') }}
              </option>
            </select>
          </div>
          <div
            v-if="mode === 'MBC5'"
            class="base-address-selector"
          >
            <label class="base-address-label">{{ $t('ui.ram.baseAddressLabel') }}</label>
            <select
              v-model="selectedBaseAddress"
              :disabled="!deviceReady || busy"
              class="base-address-dropdown"
              @change="onBaseAddressChange"
            >
              <option
                v-for="option in RAM_BASE_ADDRESS_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.text }}
              </option>
            </select>
          </div>
          <div class="size-selector">
            <label class="size-label">{{ $t('ui.ram.sizeLabel') }}</label>
            <select
              v-model="selectedRamSize"
              :disabled="!deviceReady || busy || selectedRamType === 'BATLESS'"
              class="size-dropdown"
              @change="onRamSizeChange"
            >
              <option
                v-for="option in RAM_SIZE_RANGE"
                :key="option.value"
                :value="option.value"
              >
                {{ option.text }}
              </option>
            </select>
          </div>
        </div>
      </div>
      <div class="ram-content">
        <FileDropZone
          :disabled="!deviceReady || busy"
          :file-data="ramFileData"
          :file-name="ramFileName"
          accept-types=".sav,.ram"
          accept-hint=".sav, .ram"
          :main-text="$t('ui.ram.selectFile')"
          :file-title="''"
          @file-selected="onFileSelected"
          @file-cleared="onFileCleared"
        >
          <template #icon>
            <IonIcon :icon="saveOutline" />
          </template>
        </FileDropZone>
        <div class="button-row">
          <BaseButton
            :disabled="!deviceReady || !ramFileData || busy"
            variant="primary"
            :text="$t('ui.ram.write')"
            @click="$emit('write-ram')"
          />
          <BaseButton
            :disabled="!deviceReady || busy"
            variant="primary"
            :text="$t('ui.ram.read')"
            @click="$emit('read-ram')"
          />
          <BaseButton
            :disabled="!deviceReady || busy"
            variant="warning"
            :text="$t('ui.ram.verify')"
            @click="onVerifyClick"
          />
        </div>
      </div>
    </section>

    <!-- 空白检测模式选择对话框 -->
    <BaseModal
      v-model="showBlankCheckDialog"
      :title="$t('ui.ram.blankCheckTitle')"
      width="360px"
    >
      <div class="blank-check-options">
        <p class="blank-check-hint">
          {{ $t('ui.ram.blankCheckHint') }}
        </p>
        <div class="blank-check-buttons">
          <BaseButton
            variant="primary"
            :text="$t('ui.ram.blankFillFF')"
            @click="selectBlankPattern(0xFF)"
          />
          <BaseButton
            variant="secondary"
            :text="$t('ui.ram.blankFill00')"
            @click="selectBlankPattern(0x00)"
          />
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { saveOutline } from 'ionicons/icons';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseButton from '@/components/common/BaseButton.vue';
import BaseModal from '@/components/common/BaseModal.vue';
import FileDropZone from '@/components/common/FileDropZone.vue';
import { type OperationFileEventPayload, RAM_OPERATION_EVENTS, type RamOperationsProps } from '@/components/operaiton/contracts';
import { MBC5_RAM_BASE_ADDRESS } from '@/utils/address-utils';
import { formatHex } from '@/utils/formatter-utils';

const { t } = useI18n();

const props = withDefaults(defineProps<RamOperationsProps>(), {
  ramFileData: null,
  ramFileName: '',
  selectedRamSize: '0x08000',
  selectedRamType: 'SRAM',
  selectedBaseAddress: '0x000000',
});

const RAM_SIZE_RANGE = [
  { value: '0x00800', size: 0x00800, text: '2KiB' }, // 2KB
  { value: '0x01000', size: 0x01000, text: '4KiB' }, // 4KB
  { value: '0x02000', size: 0x02000, text: '8KiB' }, // 8KB
  { value: '0x08000', size: 0x08000, text: '32KiB' }, // 32KB
  { value: '0x10000', size: 0x10000, text: '64KiB' }, // 64KB
  { value: '0x20000', size: 0x20000, text: '128KiB' }, // 128KB
];

const RAM_BASE_ADDRESS_OPTIONS = computed(() => {
  const options: { value: string, text: string }[] = [];
  for (let i = 0; i < 16; ++i) {
    options.push({
      value: formatHex(MBC5_RAM_BASE_ADDRESS[i], 3),
      text: t('ui.ram.baseAddressOptions.game', { index: i + 1 }),
    });
  }

  return options;
});

const supportsFramRam = computed(() => {
  if (!props.firmwareProfile) {
    return true;
  }
  return props.mode === 'GBA'
    ? props.firmwareProfile.capabilities.gbaFramRam
    : props.firmwareProfile.capabilities.gbcFramRam;
});

const emit = defineEmits([...RAM_OPERATION_EVENTS]);

// 空白检测对话框状态
const showBlankCheckDialog = ref(false);

function onVerifyClick() {
  if (props.ramFileData && props.ramFileData.length > 0) {
    emit('verify-ram');
  } else {
    showBlankCheckDialog.value = true;
  }
}

function selectBlankPattern(fillByte: number) {
  showBlankCheckDialog.value = false;
  emit('verify-blank', fillByte);
}

const selectedRamSize = ref(props.selectedRamSize);
const selectedRamType = ref(props.selectedRamType);
const selectedBaseAddress = ref(props.selectedBaseAddress);

// 当RAM文件数据变化时，根据文件大小自动更新选择的RAM大小
watch(() => props.ramFileData, (newData) => {
  if (newData && newData.length > 0) {
    const ramSize = newData.length;

    // 找到最接近且不小于RAM大小的选项
    const matchedOption = RAM_SIZE_RANGE.find(option => option.size >= ramSize) ?? RAM_SIZE_RANGE[RAM_SIZE_RANGE.length - 1];

    selectedRamSize.value = matchedOption.value;
    // 发射事件通知父组件RAM大小已更改
    emit('ram-size-change', matchedOption.value);
  }
}, { immediate: true });

function onFileSelected(fileInfo: OperationFileEventPayload) {
  emit('file-selected', fileInfo);
}

function onFileCleared() {
  emit('file-cleared');
}

function onRamSizeChange() {
  emit('ram-size-change', selectedRamSize.value);
}

function onRamTypeChange() {
  if (selectedRamType.value === 'FRAM' && !supportsFramRam.value) {
    selectedRamType.value = 'SRAM';
  }
  emit('ram-type-change', selectedRamType.value);
}

function onBaseAddressChange() {
  emit('base-address-change', selectedBaseAddress.value);
}
</script>

<style scoped>
.section {
  margin-bottom: var(--space-7);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-top: var(--space-4);
  margin-bottom: var(--space-2);
  gap: var(--space-3);
  flex-wrap: wrap;
}

.op-title-row {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-bottom: var(--space-3);
  min-width: 0;
}

.op-title {
  font-size: var(--font-size-lg);
  color: var(--color-text);
  font-weight: var(--font-weight-semibold);
  transition: color 0.2s, font-weight 0.2s;
  white-space: nowrap;
}

.op-title.busy {
  color: var(--color-warning);
  font-weight: bold;
}

.selector-container {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
  min-width: 0;
  margin-bottom: var(--space-3);
}

.type-selector,
.size-selector,
.base-address-selector {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: fit-content;
  flex-shrink: 0;
}

.type-selector > *,
.size-selector > *,
.base-address-selector > * {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.type-label,
.size-label,
.base-address-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
  white-space: nowrap;
}

.type-dropdown,
.size-dropdown,
.base-address-dropdown {
  padding: var(--space-1) var(--space-2);
  border: none;
  border-radius: var(--radius-base);
  box-shadow: var(--shadow-sm);
  background: var(--color-bg);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
  min-width: 80px;
  max-width: 180px;
  white-space: nowrap;
}

.type-dropdown:hover:not(:disabled),
.size-dropdown:hover:not(:disabled),
.base-address-dropdown:hover:not(:disabled) {
  box-shadow: var(--shadow-md);
}

.type-dropdown:disabled,
.size-dropdown:disabled,
.base-address-dropdown:disabled {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  cursor: not-allowed;
}

.button-row {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
  flex-wrap: wrap;
  min-width: 0;
}

.button-row > * {
  flex: 1 1 auto;
}

.blank-check-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.blank-check-hint {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.blank-check-buttons {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.blank-check-buttons > * {
  flex: 1 1 auto;
}
</style>
