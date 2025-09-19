<template>
  <div class="rom-assembly-view">
    <!-- 页面头部 -->
    <div class="page-header">
      <h2 class="page-title">
        {{ $t('ui.romAssembly.title') }}
      </h2>
      <div class="header-controls">
        <div class="rom-type-info">
          <span class="rom-type-label">{{ $t('ui.romAssembly.romType') }}:</span>
          <select
            v-model="selectedRomType"
            class="rom-type-select"
            @change="onRomTypeChange"
          >
            <option value="MBC5">
              MBC5
            </option>
            <option value="GBA">
              GBA
            </option>
          </select>
        </div>
        <div class="size-info">
          <span class="size-label">{{ $t('ui.romAssembly.totalSize') }}:</span>
          <span class="size-value">{{ formatBytes(actualRomSize) }}</span>
        </div>
        <div
          class="usage-text"
          :style="{ color: getUsageBarColor(usagePercentage) }"
        >
          {{ $t('ui.romAssembly.usageStats', {
            used: formatBytes(usedSpace),
            total: formatBytes(config.totalSize),
            percentage: usagePercentage.toFixed(1)
          }) }}
        </div>
        <button
          class="back-btn"
          @click="goBack"
        >
          <IonIcon :icon="arrowBackOutline" />
          返回
        </button>
      </div>
    </div>

    <div class="rom-assembly-content">
      <!-- 文件上传区域 -->
      <div class="file-upload-section">
        <FileDropZone
          accept-types=".rom,.gba,.gb,.gbc,.bin"
          accept-hint=".rom,.gba,.gb,.gbc,.bin"
          :main-text="$t('ui.romAssembly.selectFiles')"
          file-title=""
          multiple
          @file-selected="onFileSelected"
        >
          <template #icon>
            <IonIcon :icon="documentsOutline" />
          </template>
        </FileDropZone>
      </div>

      <!-- 左右布局：待放置文件与槽位网格 -->
      <div class="main-layout">
        <!-- 左侧：待放置文件列表 -->
        <div class="left-panel">
          <div
            v-if="pendingFiles.length > 0"
            class="pending-files-section"
          >
            <h4>{{ $t('ui.romAssembly.pendingFiles') }}</h4>
            <div class="pending-files-list">
              <div
                v-for="file in pendingFiles"
                :key="file.name"
                class="pending-file-item"
                draggable="true"
                @dragstart="onDragStart($event, file)"
              >
                <div class="file-info">
                  <span class="file-name">{{ file.name }}</span>
                  <span class="file-size">{{ formatBytes(file.size) }}</span>
                  <span class="required-slots">
                    {{ $t('ui.romAssembly.romType', { count: getRequiredSlots(file.size, config, 0) }) }}
                  </span>
                </div>
                <button
                  class="corner-btn"
                  @click="removePendingFile(file.name)"
                >
                  <IonIcon :icon="closeOutline" />
                </button>
              </div>
            </div>
          </div>
          <div
            v-else
            class="empty-pending-message"
          >
            <p>
              {{ $t('ui.romAssembly.noPendingFiles') }}
            </p>
            <p class="hint">
              {{ $t('ui.romAssembly.uploadFilesFirst') }}
            </p>
          </div>
        </div>

        <!-- 右侧：槽位网格 -->
        <div class="right-panel">
          <h4>{{ $t('ui.romAssembly.romLayout') }}</h4>
          <div class="slots-grid">
            <div
              v-for="(slot, index) in slots"
              :key="slot.id"
              class="slot-item"
              :class="{
                'has-file': slot.file,
                'drag-over': dragOverSlot === slot.id,
                'can-drop': canDropInSlot(slot, index),
              }"
              :style="{ backgroundColor: slot.file ? slot.color : undefined }"
              @dragover.prevent="onDragOver($event, slot)"
              @dragleave="onDragLeave"
              @drop="onDrop($event, slot, index)"
              @click="onSlotClick(slot, index)"
            >
              <div class="slot-header">
                <span class="slot-index">{{ index }}</span>
                <span class="slot-offset">{{ formatHex(slot.offset, 4) }}</span>
              </div>

              <div
                v-if="slot.file"
                class="slot-content"
                :class="{
                  'multi-slot-file': slot.totalSlots && slot.totalSlots > 1,
                  'first-slot': slot.isFirstSlot,
                  'continuation-slot': !slot.isFirstSlot
                }"
              >
                <div
                  v-if="slot.isFirstSlot"
                  class="file-info"
                >
                  <span class="file-name">{{ slot.file.name }}</span>
                  <div class="size-range-info">
                    <span class="file-size">{{ formatBytes(slot.file.size) }}</span>
                    <span
                      v-if="slot.totalSlots && slot.totalSlots > 1"
                      class="slot-range"
                    >
                      {{ $t('ui.romAssembly.occupiesSlots', { start: index, end: index + slot.totalSlots - 1 }) }}
                    </span>
                  </div>
                </div>
                <div
                  v-else
                  class="continuation-info"
                >
                  <span class="continuation-text">{{ $t('ui.romAssembly.fileContinuation', { name: slot.file.name }) }}</span>
                  <span class="slot-position">{{ slot.slotIndex! + 1 }}/{{ slot.totalSlots }}</span>
                </div>
                <button
                  v-if="slot.isFirstSlot"
                  class="corner-btn"
                  @click.stop="removeFileFromSlot(slot.id)"
                >
                  <IonIcon :icon="closeOutline" />
                </button>
              </div>

              <div
                v-else
                class="slot-empty"
              >
                <span class="empty-text">{{ $t('ui.romAssembly.emptySlot') }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮区域 -->
      <div class="action-section">
        <BaseButton
          :disabled="!hasAnyFiles"
          variant="error"
          :text="$t('ui.romAssembly.clearAll')"
          @click="clearAllSlots"
        />
        <BaseButton
          :disabled="!hasAnyFiles"
          variant="success"
          :icon="downloadOutline"
          :text="$t('ui.romAssembly.assembleAndDownload')"
          @click="assembleAndDownload"
        />
        <BaseButton
          :disabled="!hasAnyFiles"
          variant="primary"
          :icon="buildOutline"
          :text="$t('ui.romAssembly.assembleAndApply')"
          @click="assembleAndApply"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { arrowBackOutline, buildOutline, closeOutline, documentsOutline, downloadOutline } from 'ionicons/icons';
import { DateTime } from 'luxon';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import BaseButton from '@/components/common/BaseButton.vue';
import FileDropZone from '@/components/common/FileDropZone.vue';
import { useToast } from '@/composables/useToast';
import { useRomAssemblyResultStore } from '@/stores/rom-assembly-store';
import type { FileInfo } from '@/types/file-info';
import type { RomSlot } from '@/types/rom-assembly';
import { formatBytes, formatHex } from '@/utils/formatter-utils';
import {
  assembleRom,
  calculateActualRomSize,
  calculateUsedSpace,
  canPlaceFile,
  checkConsecutiveSlots,
  createEmptySlots,
  getRequiredSlots,
  getRomAssemblyConfig,
  placeFileInSlots,
  removeFileFromSlots,
} from '@/utils/rom/rom-assembly-utils';

const { t } = useI18n();
const { showToast } = useToast();
const router = useRouter();

// Pinia Store (仅用于传输结果数据)
const romAssemblyResultStore = useRomAssemblyResultStore();

// Props for initial ROM type (can be passed via route params)
const route = useRoute();
const initialRomType = (route.query.romType as 'MBC5' | 'GBA') || 'GBA';

// 本地响应式数据
const selectedRomType = ref<'MBC5' | 'GBA'>(initialRomType);
const config = computed(() => getRomAssemblyConfig(selectedRomType.value));
const slots = ref<RomSlot[]>([]);
const pendingFiles = ref<FileInfo[]>([]);
const dragOverSlot = ref<string | null>(null);
const draggingFile = ref<FileInfo | null>(null);

// 计算属性
const usedSpace = computed(() => calculateUsedSpace(slots.value));
const actualRomSize = computed(() => calculateActualRomSize(slots.value));
const usagePercentage = computed(() => (usedSpace.value / config.value.totalSize) * 100);
const hasAnyFiles = computed(() => slots.value.some(slot => slot.file) || pendingFiles.value.length > 0);

// 监听ROM类型变化，重新初始化槽位
watch(selectedRomType, () => {
  initializeSlots();
}, { immediate: true });

function initializeSlots() {
  slots.value = createEmptySlots(config.value);
  pendingFiles.value = [];
}

function onRomTypeChange() {
  // ROM类型改变时重新初始化槽位
  initializeSlots();
}

function goBack() {
  router.back();
}

function onFileSelected(fileInfo: FileInfo | FileInfo[]) {
  const files = Array.isArray(fileInfo) ? fileInfo : [fileInfo];

  for (const file of files) {
    // 检查文件大小是否合理
    const requiredSlots = getRequiredSlots(file.size, config.value, 0);

    if (requiredSlots > config.value.maxSlots) {
      showToast(t('messages.romAssembly.fileTooLarge', { name: file.name }), 'error');
      continue;
    }

    // 添加到待放置列表
    if (!pendingFiles.value.find(f => f.name === file.name)) {
      pendingFiles.value.push(file);
    }
  }
}

function removePendingFile(fileName: string) {
  const index = pendingFiles.value.findIndex(f => f.name === fileName);
  if (index >= 0) {
    pendingFiles.value.splice(index, 1);
  }
}

function onDragStart(event: DragEvent, file: FileInfo) {
  draggingFile.value = file;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', file.name);
  }
}

function onDragOver(event: DragEvent, slot: RomSlot) {
  if (!draggingFile.value) return;

  dragOverSlot.value = slot.id;

  if (canDropInSlot(slot, getSlotIndex(slot))) {
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  } else {
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'none';
    }
  }
}

function onDragLeave() {
  dragOverSlot.value = null;
}

function onDrop(event: DragEvent, slot: RomSlot, slotIndex: number) {
  event.preventDefault();
  dragOverSlot.value = null;

  if (!draggingFile.value) return;

  if (canDropInSlot(slot, slotIndex)) {
    placeFileInSlot(draggingFile.value, slotIndex);
    removePendingFile(draggingFile.value.name);
  } else {
    showToast(t('messages.romAssembly.cannotPlaceFile'), 'error');
  }

  draggingFile.value = null;
}

function onSlotClick(slot: RomSlot, slotIndex: number) {
  // 如果正在拖拽文件且可以放置，则放置文件
  if (draggingFile.value && canDropInSlot(slot, slotIndex)) {
    placeFileInSlot(draggingFile.value, slotIndex);
    removePendingFile(draggingFile.value.name);
    draggingFile.value = null;
    return;
  }

  // 如果槽位为空且有待放置文件，尝试放置第一个文件
  if (pendingFiles.value.length > 0 && !slot.file) {
    const file = pendingFiles.value[0];

    // 临时设置拖拽文件以检查是否可以放置
    draggingFile.value = file;
    if (canDropInSlot(slot, slotIndex)) {
      placeFileInSlot(file, slotIndex);
      removePendingFile(file.name);
    } else {
      showToast(t('messages.romAssembly.cannotPlaceFile'), 'error');
    }
    draggingFile.value = null;
  }
}

function canDropInSlot(slot: RomSlot, slotIndex: number): boolean {
  if (!draggingFile.value) return false;

  const requiredSlots = getRequiredSlots(draggingFile.value.size, config.value, slotIndex);

  // 检查文件是否能放置在这个槽位（基本检查）
  const canPlace = canPlaceFile(draggingFile.value, slot, config.value, slotIndex);

  // 检查是否有足够的连续空槽位
  const hasConsecutiveSlots = checkConsecutiveSlots(slotIndex, requiredSlots, slots.value);

  return canPlace && hasConsecutiveSlots;
}

function getSlotIndex(slot: RomSlot): number {
  return slots.value.findIndex(s => s.id === slot.id);
}

function placeFileInSlot(file: FileInfo, slotIndex: number) {
  const updatedSlots = placeFileInSlots(file, slotIndex, slots.value, config.value);
  slots.value = updatedSlots;
  showToast(t('messages.romAssembly.filePlaced', { name: file.name }), 'success');
}

function removeFileFromSlot(slotId: string) {
  const slot = slots.value.find(s => s.id === slotId);
  if (slot?.file) {
    if (!pendingFiles.value.find(f => f.name === slot.file?.name)) {
      pendingFiles.value.push(slot.file);
    }
    const updatedSlots = removeFileFromSlots(slotId, slots.value);
    slots.value = updatedSlots;
    showToast(t('messages.romAssembly.fileRemoved', { name: slot.file.name }), 'success');
  }
}

function clearAllSlots() {
  // 将槽位中的文件移回待放置列表
  const filesToMove: FileInfo[] = [];
  for (const slot of slots.value) {
    if (slot.file && !pendingFiles.value.find(f => f.name === slot.file?.name)) {
      filesToMove.push(slot.file);
    }
  }

  // 添加到待放置列表
  for (const file of filesToMove) {
    if (!pendingFiles.value.find(f => f.name === file.name)) {
      pendingFiles.value.push(file);
    }
  }

  slots.value = createEmptySlots(config.value);
  showToast(t('messages.romAssembly.allCleared'), 'success');
}

function assembleAndApply() {
  const assembled = assembleRom(slots.value, config.value);

  // 保存组装结果到简化的store，用于传递到主页
  romAssemblyResultStore.setResult(assembled, selectedRomType.value);

  showToast(t('messages.romAssembly.assembled', {
    size: formatBytes(assembled.totalSize),
    usedSlots: assembled.slots.filter(s => s.file && s.isFirstSlot).length.toString(),
  }), 'success');

  // 导航回主页
  void router.push('/');
}

function assembleAndDownload() {
  const assembled = assembleRom(slots.value, config.value);

  // 创建文件名
  const timestamp = DateTime.now().toFormat('yyyyMMdd_HHmmss');
  const fileName = `assembled_${selectedRomType.value.toLowerCase()}_${timestamp}.rom`;

  // 下载文件
  const blob = new Blob([assembled.data as BlobPart], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);

  showToast(t('messages.romAssembly.downloaded', {
    size: formatBytes(assembled.totalSize),
    fileName,
  }), 'success');
}

// 工具函数
function getUsageBarColor(percentage: number): string {
  if (percentage < 25) {
    return '#28a745'; // 绿色 - 使用量低
  } else if (percentage < 50) {
    return '#20c997'; // 青绿色 - 使用量中等偏低
  } else if (percentage < 75) {
    return '#ffc107'; // 黄色 - 使用量中等偏高
  } else {
    return '#dc3545'; // 红色 - 使用量高
  }
}
</script>

<style scoped>
.rom-assembly-view {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 0;
  /* 突破父容器限制，占满屏幕并使用80%宽度 */
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  overflow-y: auto;
}

/* 页面头部样式 */
.page-header {
  background: var(--color-bg);
  border-bottom: var(--border-width) var(--border-style) var(--color-border-light);
  padding: var(--space-4) var(--space-6);
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: 100;
}

.page-title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.header-controls {
  display: flex;
  align-items: center;
  gap: var(--space-5);
}

.rom-type-info,
.size-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
}

.rom-type-label,
.size-label {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.rom-type-select {
  padding: var(--space-2) var(--space-3);
  border: var(--border-width) var(--border-style) var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.rom-type-select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.size-value {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.usage-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

/* 主体内容样式 */
.rom-assembly-content {
  padding: var(--space-6);
  max-width: 80%;
  margin: 0 auto;
}

.file-upload-section {
  margin-bottom: var(--space-6);
}

/* 左右布局样式 */
.main-layout {
  display: flex;
  gap: var(--space-5);
  height: 500px;
  margin-bottom: var(--space-6);
}

.left-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 280px;
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  border: var(--border-width) var(--border-style) var(--color-border-light);
  box-shadow: var(--shadow-sm);
}

.right-panel {
  flex: 3;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  border: var(--border-width) var(--border-style) var(--color-border-light);
  box-shadow: var(--shadow-sm);
}

.left-panel .pending-files-section h4,
.right-panel h4 {
  margin: 0 0 var(--space-4) 0;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  flex-shrink: 0;
}

.pending-files-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}

.pending-files-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  flex: 1;
  overflow-y: auto;
  overflow-x: visible;
  padding: var(--space-4);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-base);
  border: var(--border-width) var(--border-style) var(--color-border-light);
  min-height: 120px;
}

.pending-file-item {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-6) var(--space-3) var(--space-3);
  background: var(--color-bg);
  border: var(--border-width) var(--border-style) var(--color-border-light);
  border-radius: var(--radius-base);
  cursor: grab;
  transition: all 0.2s ease;
  flex-shrink: 0;
  margin: 0;
  overflow: visible;
}

.pending-file-item:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.pending-file-item:active {
  cursor: grabbing;
  transform: translateY(0);
}

.file-info {
  display: flex;
  padding-left: var(--space-2);
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
}

.file-name {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100% - 24px);
  line-height: var(--line-height-normal);
}

.file-size {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.required-slots {
  font-size: var(--font-size-xs);
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
}

/* 角标样式移除按钮 */
.corner-btn {
  box-sizing: border-box !important;
  width: 24px !important;
  height: 24px !important;
  padding: 0 !important;
  min-width: 0 !important;
  overflow: hidden;
  position: absolute;
  top: -10px;
  right: -10px;
  border-radius: 50%;
  background: var(--color-error);
  color: var(--color-text-inverse);
  border: var(--border-width-thick) var(--border-style) var(--color-bg);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  transition: all 0.2s ease;
  font-size: var(--font-size-sm);
  box-shadow: var(--shadow-lg);
  pointer-events: auto;
}

.corner-btn:hover {
  background: var(--color-error-hover);
  transform: scale(1.1);
  box-shadow: var(--shadow-xl);
  z-index: 1001;
}

.corner-btn:active {
  transform: scale(0.95);
}

.empty-pending-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-secondary);
  text-align: center;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-base);
  border: var(--border-width-thick) var(--border-style-dashed) var(--color-border-light);
  padding: var(--space-5);
}

.empty-pending-message p {
  margin: 0;
  font-size: var(--font-size-sm);
}

.empty-pending-message .hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--space-2);
}

.slots-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-2);
  flex: 1;
  overflow-y: auto;
  overflow-x: visible;
  padding: var(--space-4);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-base);
  border: var(--border-width) var(--border-style) var(--color-border-light);
  min-height: 240px;
}

.slot-item {
  position: relative;
  border: var(--border-width) var(--border-style) var(--color-border-light);
  border-radius: var(--radius-base);
  padding: var(--space-3) var(--space-5) var(--space-3) var(--space-3);
  background: var(--color-bg);
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 80px;
  display: flex;
  flex-direction: column;
  overflow: visible;
}

.slot-item:hover {
  border-color: var(--color-primary);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.slot-item.drag-over {
  border-color: var(--color-success);
  background: var(--color-success-light);
}

.slot-item.can-drop {
  border-color: var(--color-success);
  border-style: dashed;
}

.slot-item.has-file {
  border-color: var(--color-primary);
}

.slot-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-2);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.slot-index {
  font-weight: var(--font-weight-semibold);
}

.slot-offset {
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', 'Menlo', 'Consolas', monospace;
}

.slot-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: visible;
  min-width: 0;
  padding-right: var(--space-2);
}

.slot-content .file-info {
  margin-bottom: var(--space-2);
  min-width: 0;
}

.slot-content .file-info .file-name {
  font-size: var(--font-size-xs);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100% - 24px);
  display: block;
  line-height: var(--line-height-normal);
}

.slot-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-text {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  font-style: italic;
}

.slot-content.multi-slot-file.first-slot {
  border-left: var(--border-width-thick) var(--border-style) var(--color-primary);
}

.slot-content.multi-slot-file.continuation-slot {
  background: var(--color-primary-light);
  border-left: var(--border-width-thick) var(--border-style) var(--color-primary);
}

.continuation-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  padding-left: var(--space-2);
  overflow: visible;
  min-width: 0;
  padding-right: var(--space-2);
}

.continuation-text {
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100% - 24px);
  line-height: var(--line-height-normal);
}

.slot-position {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.slot-range {
  font-size: var(--font-size-xs);
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
  margin-top: var(--space-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.size-range-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.size-range-info .file-size {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.size-range-info .slot-range {
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-xs);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.back-btn {
  display: flex;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background 0.2s ease;
}

.back-btn:hover {
  background: var(--color-bg-hover);
}

.back-btn:active {
  transform: scale(0.98);
}

.action-section {
  display: flex;
  gap: var(--space-4);
  justify-content: center;
  align-items: center;
  margin-top: var(--space-6);
  flex-wrap: wrap;
}

.action-section > * {
  flex: 0 0 auto;
}
</style>
