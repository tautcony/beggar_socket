<template>
  <BaseModal
    :visible="isVisible"
    :title="$t('ui.romAssembly.title')"
    width="90vw"
    max-width="1200px"
    max-height="90vh"
    @close="closeModal"
  >
    <template #header>
      <h3 class="modal-title">
        {{ $t('ui.romAssembly.title') }}
      </h3>
      <div class="assembly-controls">
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
      </div>      <button
        class="close-btn"
        @click="closeModal"
      >
        <IonIcon :icon="closeOutline" />
      </button>
    </template>

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

    <template #footer>
      <button
        class="cancel-btn"
        @click="closeModal"
      >
        {{ $t('ui.common.cancel') }}
      </button>
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
        {{ $t('ui.romAssembly.assembleAndDownload') }}
      </button>
      <button
        :disabled="!hasAnyFiles"
        class="assemble-btn"
        @click="assembleAndApply"
      >
        {{ $t('ui.romAssembly.assembleAndApply') }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { closeOutline, documentsOutline } from 'ionicons/icons';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseModal from '@/components/common/BaseModal.vue';
import FileDropZone from '@/components/common/FileDropZone.vue';
import { useToast } from '@/composables/useToast';
import type { FileInfo } from '@/types/file-info';
import type { AssembledRom, RomSlot } from '@/types/rom-assembly';
import { formatHex } from '@/utils/formatter-utils';
import {
  assembleRom,
  calculateActualRomSize,
  calculateUsedSpace,
  canPlaceFile,
  checkConsecutiveSlots,
  createEmptySlots,
  formatBytes,
  getRequiredSlots,
  getRomAssemblyConfig,
  placeFileInSlots,
  removeFileFromSlots,
} from '@/utils/rom-assembly-utils';

const { t } = useI18n();
const { showToast } = useToast();

const props = withDefaults(defineProps<{
  isVisible: boolean;
  initialRomType?: 'MBC5' | 'GBA';
}>(), {
  initialRomType: 'GBA',
});

const emit = defineEmits<{
  close: [];
  assembled: [rom: AssembledRom, romType: 'MBC5' | 'GBA'];
}>();

// 响应式数据
const selectedRomType = ref<'MBC5' | 'GBA'>(props.initialRomType);
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

// 监听弹框显示状态，重置数据
watch(() => props.isVisible, (visible) => {
  if (visible) {
    selectedRomType.value = props.initialRomType;
    initializeSlots();
  }
});

function initializeSlots() {
  slots.value = createEmptySlots(config.value);
  pendingFiles.value = [];
}

function onRomTypeChange() {
  // ROM类型改变时重新初始化槽位
  initializeSlots();
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
  slots.value = placeFileInSlots(file, slotIndex, slots.value, config.value);
  showToast(t('messages.romAssembly.filePlaced', { name: file.name }), 'success');
}

function removeFileFromSlot(slotId: string) {
  const slot = slots.value.find(s => s.id === slotId);
  if (slot?.file) {
    pendingFiles.value.push(slot.file);
    slots.value = removeFileFromSlots(slotId, slots.value);
    showToast(t('messages.romAssembly.fileRemoved', { name: slot.file.name }), 'success');
  }
}

function clearAllSlots() {
  for (const slot of slots.value) {
    if (slot.file && !pendingFiles.value.find(f => f.name === slot.file?.name)) {
      pendingFiles.value.push(slot.file);
    }
  }

  slots.value = createEmptySlots(config.value);
  showToast(t('messages.romAssembly.allCleared'), 'success');
}

function assembleAndApply() {
  const assembled = assembleRom(slots.value, config.value);
  emit('assembled', assembled, selectedRomType.value);
  showToast(t('messages.romAssembly.assembled', {
    size: formatBytes(assembled.totalSize),
    usedSlots: assembled.slots.filter(s => s.file && s.isFirstSlot).length.toString(),
  }), 'success');
  closeModal();
}

function assembleAndDownload() {
  const assembled = assembleRom(slots.value, config.value);

  // 创建文件名
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '_');
  const fileName = `assembled_${selectedRomType.value.toLowerCase()}_${timestamp}.rom`;

  // 下载文件
  const blob = new Blob([assembled.data], { type: 'application/octet-stream' });
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

function closeModal() {
  emit('close');
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
/* 头部样式 */
.modal-title {
  margin: 0;
  color: #2c3e50;
  font-size: 1.5rem;
  font-weight: 600;
}

.close-btn {
  background: rgba(108, 117, 125, 0.1);
  border: none;
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;
  color: #6c757d;
  transition: background 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: rgba(108, 117, 125, 0.2);
  color: #495057;
}

.assembly-controls {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  align-items: center;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 8px;
}

.rom-type-info,
.size-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rom-type-label,
.size-label {
  font-size: 0.9rem;
  color: #6c757d;
  font-weight: 500;
}

.rom-type-select {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  font-size: 0.9rem;
  color: #333;
  cursor: pointer;
}

.size-value {
  font-size: 0.9rem;
  color: #2c3e50;
  font-weight: 600;
}

.usage-text {
  font-size: 0.85rem;
  color: #666;
  text-align: center;
}

/* 主体内容样式 */
.file-upload-section {
  margin-bottom: 24px;
}

/* 左右布局样式 */
.main-layout {
  display: flex;
  gap: 20px;
  height: 400px;
  margin-top: 20px;
}

.left-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 220px;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #e1e8ed;
}

.right-panel {
  flex: 3;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #e1e8ed;
}

.left-panel .pending-files-section h4,
.right-panel h4 {
  margin: 0 0 12px 0;
  color: #34495e;
  font-size: 1rem;
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
  background: #ffffff;
  border-radius: 6px;
  border: 1px solid #e1e8ed;
  min-height: 100px;
}

.pending-file-item {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px 12px 12px;
  background: #ffffff;
  border: 2px solid #e1e8ed;
  border-radius: 6px;
  cursor: grab;
  transition: all 0.2s ease;
  flex-shrink: 0;
  margin: 0;
  overflow: visible;
}

.pending-file-item:hover {
  border-color: #1976d2;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.1);
  transform: translateY(-1px);
}

.pending-file-item:active {
  cursor: grabbing;
  transform: translateY(0);
}

.file-info {
  display: flex;
  padding-left: 5px;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.file-name {
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100% - 20px);
  line-height: 1.3;
}

.file-size {
  font-size: 0.8rem;
  color: #666;
}

.required-slots {
  font-size: 0.8rem;
  color: #1976d2;
  font-weight: 500;
}

/* 角标样式移除按钮 */
.corner-btn {
  box-sizing: border-box;
  width: 20px;
  height: 20px;
  padding: 0;
  min-width: 0;
  overflow: hidden;
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
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
  font-size: 12px;
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
  background: #ffffff;
  border-radius: 6px;
  border: 2px dashed #e1e8ed;
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
  background: #ffffff;
  border-radius: 6px;
  border: 1px solid #e1e8ed;
  min-height: 200px;
}

.slot-item {
  position: relative;
  border: 2px solid #e1e8ed;
  border-radius: 6px;
  padding: 8px 16px 8px 8px;
  background: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 80px;
  display: flex;
  flex-direction: column;
  overflow: visible;
}

.slot-item:hover {
  border-color: #1976d2;
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
  border-color: #1976d2;
}

.slot-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 0.75rem;
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
  padding-right: 4px;
}

.slot-content .file-info {
  margin-bottom: 6px;
  min-width: 0;
}

.slot-content .file-info .file-name {
  font-size: 0.8rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100% - 20px);
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
  font-size: 0.75rem;
  font-style: italic;
}

.slot-content.multi-slot-file.first-slot {
  border-left: 3px solid #1976d2;
}

.slot-content.multi-slot-file.continuation-slot {
  background: rgba(25, 118, 210, 0.1);
  border-left: 3px solid #1976d2;
}

.continuation-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.8rem;
  padding-left: 5px;
  overflow: visible;
  min-width: 0;
  padding-right: 4px;
}

.continuation-text {
  color: #1976d2;
  font-size: 0.8rem;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100% - 20px);
  line-height: 1.3;
}

.slot-position {
  color: #666;
  font-size: 0.7rem;
}

.slot-range {
  font-size: 0.75rem;
  color: #1976d2;
  font-weight: 500;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.size-range-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.size-range-info .file-size {
  color: #666;
  font-size: 0.8rem;
}

.size-range-info .slot-range {
  color: #1976d2;
  font-weight: 500;
  font-size: 0.75rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

/* 底部按钮样式 */
.cancel-btn,
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
}

.cancel-btn {
  background: #6c757d;
  color: white;
}

.cancel-btn:hover {
  background: #5a6268;
}

.clear-all-btn {
  background: #ffc107;
  color: #212529;
}

.clear-all-btn:hover:not(:disabled) {
  background: #e0a800;
}

.download-btn {
  background: #17a2b8;
  color: white;
}

.download-btn:hover:not(:disabled) {
  background: #138496;
}

.assemble-btn {
  background: #28a745;
  color: white;
}

.assemble-btn:hover:not(:disabled) {
  background: #218838;
}

.clear-all-btn:disabled,
.download-btn:disabled,
.assemble-btn:disabled {
  background: #e9ecef;
  color: #adb5bd;
  cursor: not-allowed;
}
</style>
