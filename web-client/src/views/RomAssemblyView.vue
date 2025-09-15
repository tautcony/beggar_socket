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
                    {{ $t('ui.romAssembly.requiredSlots', { count: getRequiredSlots(file.size, config, 0) }) }}
                  </span>
                </div>
                <button
                  class="remove-file-btn corner-btn"
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
                  class="remove-slot-btn corner-btn"
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
        <button
          :disabled="!hasAnyFiles"
          class="clear-all-btn"
          @click="clearAllSlots"
        >
          {{ $t('ui.romAssembly.clearAll') }}
        </button>
        <button
          :disabled="!hasAnyFiles"
          class="download-btn"
          @click="assembleAndDownload"
        >
          <IonIcon :icon="downloadOutline" />
          {{ $t('ui.romAssembly.assembleAndDownload') }}
        </button>
        <button
          :disabled="!hasAnyFiles"
          class="assemble-btn"
          @click="assembleAndApply"
        >
          <IonIcon :icon="buildOutline" />
          {{ $t('ui.romAssembly.assembleAndApply') }}
        </button>
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
  background: white;
  border-bottom: 1px solid #e9ecef;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  position: sticky;
  top: 0;
  z-index: 100;
}

.page-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: #333;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 20px;
}

.rom-type-info,
.size-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
}

.rom-type-label,
.size-label {
  font-weight: 500;
  color: #666;
}

.rom-type-select {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  font-size: 0.9rem;
  color: #333;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.rom-type-select:focus {
  outline: none;
  border-color: #007bff;
}

.size-value {
  font-weight: 600;
  color: #333;
}

.usage-text {
  font-size: 0.85rem;
  color: #666;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  background: #5a6268;
  transform: translateY(-1px);
}

/* 主体内容样式 */
.rom-assembly-content {
  padding: 24px;
  max-width: 80%;
  margin: 0 auto;
}

.file-upload-section {
  margin-bottom: 24px;
}

/* 左右布局样式 */
.main-layout {
  display: flex;
  gap: 20px;
  height: 500px;
  margin-bottom: 24px;
}

.left-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 280px;
  background: white;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #e9ecef;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.right-panel {
  flex: 3;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: white;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #e9ecef;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.left-panel .pending-files-section h4,
.right-panel h4 {
  margin: 0 0 16px 0;
  color: #333;
  font-size: 1.1rem;
  font-weight: 600;
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
  gap: 12px;
  flex: 1;
  overflow-y: auto;
  overflow-x: visible;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
  min-height: 120px;
}

.pending-file-item {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px 12px 12px;
  background: #ffffff;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  cursor: grab;
  transition: all 0.2s ease;
  flex-shrink: 0;
  margin: 0;
  overflow: visible;
}

.pending-file-item:hover {
  border-color: #007bff;
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.15);
  transform: translateY(-1px);
}

.pending-file-item:active {
  cursor: grabbing;
  transform: translateY(0);
}

.file-info {
  display: flex;
  padding-left: 8px;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.file-name {
  font-weight: 600;
  color: #333;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100% - 24px);
  line-height: 1.3;
}

.file-size {
  font-size: 0.8rem;
  color: #666;
}

.required-slots {
  font-size: 0.8rem;
  color: #007bff;
  font-weight: 500;
}

/* 角标样式移除按钮 */
.corner-btn {
  box-sizing: border-box;
  width: 24px;
  height: 24px;
  padding: 0;
  min-width: 0;
  overflow: hidden;
  position: absolute;
  top: -10px;
  right: -10px;
  border-radius: 50%;
  background: #dc3545;
  color: white;
  border: 2px solid white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  transition: all 0.2s ease;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  pointer-events: auto;
}

.corner-btn:hover {
  background: #c82333;
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
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
  color: #666;
  text-align: center;
  background: #f8f9fa;
  border-radius: 6px;
  border: 2px dashed #e9ecef;
  padding: 20px;
}

.empty-pending-message p {
  margin: 0;
  font-size: 0.9rem;
}

.empty-pending-message .hint {
  font-size: 0.8rem;
  color: #999;
  margin-top: 8px;
}

.slots-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  flex: 1;
  overflow-y: auto;
  overflow-x: visible;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
  min-height: 240px;
}

.slot-item {
  position: relative;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 12px 20px 12px 12px;
  background: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 80px;
  display: flex;
  flex-direction: column;
  overflow: visible;
}

.slot-item:hover {
  border-color: #007bff;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.1);
}

.slot-item.drag-over {
  border-color: #28a745;
  background: #f8fff9;
}

.slot-item.can-drop {
  border-color: #28a745;
  border-style: dashed;
}

.slot-item.has-file {
  border-color: #007bff;
}

.slot-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 0.8rem;
  color: #666;
}

.slot-index {
  font-weight: 600;
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
  padding-right: 6px;
}

.slot-content .file-info {
  margin-bottom: 8px;
  min-width: 0;
}

.slot-content .file-info .file-name {
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100% - 24px);
  display: block;
  line-height: 1.3;
}

.slot-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-text {
  color: #adb5bd;
  font-size: 0.8rem;
  font-style: italic;
}

.slot-content.multi-slot-file.first-slot {
  border-left: 3px solid #007bff;
}

.slot-content.multi-slot-file.continuation-slot {
  background: rgba(0, 123, 255, 0.1);
  border-left: 3px solid #007bff;
}

.continuation-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85rem;
  padding-left: 8px;
  overflow: visible;
  min-width: 0;
  padding-right: 6px;
}

.continuation-text {
  color: #007bff;
  font-size: 0.8rem;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100% - 24px);
  line-height: 1.3;
}

.slot-position {
  color: #666;
  font-size: 0.75rem;
}

.slot-range {
  font-size: 0.75rem;
  color: #007bff;
  font-weight: 500;
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.size-range-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.size-range-info .file-size {
  color: #666;
  font-size: 0.85rem;
}

.size-range-info .slot-range {
  color: #007bff;
  font-weight: 500;
  font-size: 0.75rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

/* 操作按钮区域样式 */
.action-section {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  padding: 20px 0;
}

.clear-all-btn,
.download-btn,
.assemble-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s ease;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 6px;
}

.clear-all-btn {
  background: #ffc107;
  color: #212529;
  border: 1px solid #ffc107;
}

.clear-all-btn:hover:not(:disabled) {
  background: #e0a800;
  border-color: #e0a800;
}

.download-btn {
  background: #17a2b8;
  color: white;
  border: 1px solid #17a2b8;
}

.download-btn:hover:not(:disabled) {
  background: #138496;
  border-color: #138496;
}

.assemble-btn {
  background: #28a745;
  color: white;
  border: 1px solid #28a745;
}

.assemble-btn:hover:not(:disabled) {
  background: #218838;
  border-color: #218838;
}

.clear-all-btn:disabled,
.download-btn:disabled,
.assemble-btn:disabled {
  background: #e9ecef;
  color: #adb5bd;
  border-color: #e9ecef;
  cursor: not-allowed;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .rom-assembly-content {
    max-width: 90%;
  }
}

@media (max-width: 768px) {
  .rom-assembly-content {
    max-width: 95%;
    padding: 16px;
  }

  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    padding: 12px 16px;
  }

  .header-controls {
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 12px;
  }

  .main-layout {
    flex-direction: column;
    height: auto;
    gap: 16px;
  }

  .left-panel,
  .right-panel {
    min-width: 0;
    height: 300px;
  }

  .action-section {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .clear-all-btn,
  .download-btn,
  .assemble-btn {
    justify-content: center;
  }
}
</style>
