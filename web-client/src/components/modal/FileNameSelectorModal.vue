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
          <button
            v-if="selectedFileName !== defaultFileName"
            class="clear-button"
            :title="$t('ui.ram.resetToDefault')"
            @click="resetFileName"
          >
            ✕
          </button>
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
        <button
          class="download-button"
          :disabled="!selectedFileName.trim()"
          @click="downloadFile"
        >
          {{ $t('ui.ram.download') }}
        </button>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

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

<style scoped>
.file-name-selector {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.input-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-label {
  font-weight: 600;
  color: #1976d2;
  font-size: 0.9rem;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.file-name-input {
  width: 100%;
  padding: 12px 16px;
  padding-right: 40px; /* 为清除按钮留出空间 */
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #ffffff;
  color: #333333;
  font-family: monospace;
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.file-name-input:focus {
  outline: none;
  border-color: #1976d2;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
}

.clear-button {
  position: absolute;
  right: 8px;
  width: 24px !important;
  height: 24px !important;
  border: none;
  border-radius: 50%;
  background: #6c757d;
  color: white;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  display: block;
  text-align: center;
  transition: all 0.2s;
  opacity: 0.7;
  box-sizing: border-box;
  flex-shrink: 0;
  padding: 0;
  margin: 0;
}

.clear-button:hover {
  background: #dc3545;
  opacity: 1;
  transform: scale(1.1);
}

.recent-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-label {
  font-weight: 600;
  color: #1976d2;
  font-size: 0.9rem;
}

.recent-list {
  display: flex;
  flex-direction: column;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  overflow: hidden;
  max-height: 240px;
  overflow-y: auto;
  background: #ffffff;
}

.recent-item {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border: none;
  border-bottom: 1px solid #e9ecef;
  background: transparent;
  color: #333333;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  gap: 12px;
}

.recent-item:last-child {
  border-bottom: none;
}

.recent-item:hover {
  background-color: #e3f2fd;
}

.rom-name {
  font-family: monospace;
  font-weight: 500;
  color: #1976d2;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arrow {
  color: #6c757d;
  font-weight: bold;
  flex-shrink: 0;
  margin: 0 4px;
  font-size: 16px;
}

.sav-name {
  font-family: monospace;
  color: #198754;
  font-weight: 500;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-section {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid #e9ecef;
}

.download-button {
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  background: #1976d2;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 120px;
}

.download-button:hover:not(:disabled) {
  background: #1565c0;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.download-button:disabled {
  background: #6c757d;
  cursor: not-allowed;
  opacity: 0.6;
}

/* 美化滚动条 */
.recent-list::-webkit-scrollbar {
  width: 6px;
}

.recent-list::-webkit-scrollbar-track {
  background: #f8f9fa;
  border-radius: 3px;
}

.recent-list::-webkit-scrollbar-thumb {
  background: #6c757d;
  border-radius: 3px;
}

.recent-list::-webkit-scrollbar-thumb:hover {
  background: #5a6268;
}
</style>
