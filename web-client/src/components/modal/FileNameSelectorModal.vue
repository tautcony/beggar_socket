<template>
  <BaseModal
    v-model="modelValue"
    :title="$t('ui.ram.selectFileName')"
    width="500px"
    @close="closeModal"
  >
    <div class="file-name-selector">
      <div class="input-section">
        <label class="input-label">{{ $t('ui.ram.fileName') }}</label>
        <div class="input-wrapper">
          <input
            v-model="selectedFileName"
            type="text"
            class="file-name-input"
            :placeholder="$t('ui.ram.enterFileName')"
            @keyup.enter="downloadFile"
          >
          <BaseButton
            v-if="selectedFileName !== defaultFileName"
            variant="error"
            size="sm"
            text="✕"
            :title="$t('ui.ram.resetToDefault')"
            @click="resetFileName"
          />
        </div>
      </div>

      <div
        v-if="recentFileNames.length > 0"
        class="recent-section"
      >
        <label class="section-label">{{ $t('ui.ram.recentFileNames') }}</label>
        <div class="recent-list">
          <button
            v-for="fileName in recentFileNames"
            :key="fileName"
            class="recent-item"
            @click="selectRomBasedFileName(fileName)"
          >
            <span class="rom-name">{{ fileName }}</span>
            <span class="arrow">→</span>
            <span class="sav-name">{{ getRomBasedSavName(fileName) }}</span>
          </button>
        </div>
      </div>

      <div class="action-section">
        <BaseButton
          variant="primary"
          :text="$t('ui.ram.download')"
          :disabled="!selectedFileName.trim()"
          @click="downloadFile"
        />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseButton from '@/components/common/BaseButton.vue';
import BaseModal from '@/components/common/BaseModal.vue';
import { useRecentFileNamesStore } from '@/stores/recent-file-names-store';

const { t } = useI18n();
const recentFileNamesStore = useRecentFileNamesStore();

const modelValue = defineModel<boolean>({ default: false });

const emit = defineEmits<{
  'file-name-selected': [fileName: string];
}>();

// 生成默认文件名
const now = DateTime.now().toLocal().toFormat('yyyyMMdd-HHmmss');
const defaultFileName = `exported_${now}.sav`;

const selectedFileName = ref(defaultFileName);
// 使用 computed 使 recentFileNames 变为响应式
const recentFileNames = computed(() => recentFileNamesStore.getFileNames());

function closeModal() {
  modelValue.value = false;
  selectedFileName.value = defaultFileName;
}

function getRomBasedSavName(romFileName: string) {
  // 将ROM文件名转换为.sav文件名
  // 例如：XXX.gba -> XXX.sav，YYYY -> YYYY.sav
  const baseName = romFileName.replace(/\.(gba|gb|gbc)$/i, '');
  return `${baseName}.sav`;
}

function selectRomBasedFileName(romFileName: string) {
  selectedFileName.value = getRomBasedSavName(romFileName);
}

function resetFileName() {
  selectedFileName.value = defaultFileName;
}

function downloadFile() {
  if (selectedFileName.value.trim()) {
    emit('file-name-selected', selectedFileName.value.trim());
    closeModal();
  }
}

// 当模态框打开时重置文件名为默认值
watch(modelValue, (newValue) => {
  if (newValue) {
    selectedFileName.value = defaultFileName;
  }
});
</script>

<style lang="scss" scoped>
@use '@/styles/variables/colors' as color-vars;
@use '@/styles/variables/spacing' as spacing-vars;
@use '@/styles/variables/typography' as typography-vars;
@use '@/styles/variables/radius' as radius-vars;
@use '@/styles/mixins' as mixins;

.file-name-selector {
  @include mixins.flex-column;
  gap: spacing-vars.$space-5;
}

.input-section {
  @include mixins.flex-column;
  gap: spacing-vars.$space-2;
}

.input-label {
  font-weight: typography-vars.$font-weight-semibold;
  color: color-vars.$color-primary;
  font-size: typography-vars.$font-size-sm;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.file-name-input {
  width: 100%;
  padding: spacing-vars.$space-3 spacing-vars.$space-4;
  padding-right: 40px; /* 为清除按钮留出空间 */
  border: 1px solid color-vars.$color-border;
  border-radius: radius-vars.$radius-base;
  background: color-vars.$color-bg;
  color: color-vars.$color-text;
  font-family: monospace;
  font-size: typography-vars.$font-size-sm;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:focus {
    outline: none;
    border-color: color-vars.$color-primary;
    box-shadow: color-vars.$shadow-sm;
  }
}

.recent-section {
  @include mixins.flex-column;
  gap: spacing-vars.$space-3;
}

.section-label {
  font-weight: typography-vars.$font-weight-semibold;
  color: color-vars.$color-primary;
  font-size: typography-vars.$font-size-sm;
}

.recent-list {
  @include mixins.flex-column;
  border: 1px solid color-vars.$color-border;
  border-radius: radius-vars.$radius-lg;
  overflow: hidden;
  max-height: 240px;
  overflow-y: auto;
  background: color-vars.$color-bg;

  /* 美化滚动条 */
  &::-webkit-scrollbar {
    width: spacing-vars.$space-2;
  }

  &::-webkit-scrollbar-track {
    background: color-vars.$color-bg-secondary;
    border-radius: radius-vars.$radius-sm;
  }

  &::-webkit-scrollbar-thumb {
    background: color-vars.$color-secondary;
    border-radius: radius-vars.$radius-sm;

    &:hover {
      background: color-vars.$color-text-secondary;
    }
  }
}

.recent-item {
  display: flex;
  align-items: center;
  padding: spacing-vars.$space-4;
  border: none;
  border-bottom: 1px solid color-vars.$color-border-light;
  background: transparent;
  color: color-vars.$color-text;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  gap: spacing-vars.$space-3;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: rgba(color-vars.$color-primary, 0.1);
  }
}

.rom-name {
  font-family: monospace;
  font-weight: typography-vars.$font-weight-medium;
  color: color-vars.$color-primary;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arrow {
  color: color-vars.$color-text-secondary;
  font-weight: bold;
  flex-shrink: 0;
  margin: 0 spacing-vars.$space-1;
  font-size: typography-vars.$font-size-base;
}

.sav-name {
  font-family: monospace;
  color: color-vars.$color-success;
  font-weight: typography-vars.$font-weight-medium;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-section {
  display: flex;
  justify-content: flex-end;
  padding-top: spacing-vars.$space-2;
  border-top: 1px solid color-vars.$color-border-light;
}
</style>
