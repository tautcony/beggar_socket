<template>
  <div class="rom-split-merge-panel">
    <!-- 顶部硬件规格与容量栏 -->
    <div class="panel-toolbar">
      <div class="toolbar-left">
        <div
          class="platform-segmented"
          role="group"
        >
          <button
            v-for="platform in (['GBA', 'MBC5'] as const)"
            :key="platform"
            type="button"
            class="segment-btn"
            :class="{ active: selectedRomType === platform }"
            @click="selectPlatform(platform)"
          >
            {{ platform }}
          </button>
        </div>

        <span class="spec-chip">
          {{ selectedRomType === 'GBA' ? '4 MiB / BANK · 128 MiB MAX' : '1–2 MiB / BANK · 32 MiB MAX' }}
        </span>
      </div>

      <div class="toolbar-right">
        <div class="capacity-meter">
          <div class="capacity-labels">
            <span class="capacity-size">{{ formatBytes(actualRomSize) }}</span>
            <span class="capacity-sep">/</span>
            <span class="capacity-total">{{ formatBytes(config.totalSize) }}</span>
            <span
              class="capacity-percent"
              :style="{ color: getUsageBarColor(usagePercentage) }"
            >
              ({{ usagePercentage.toFixed(1) }}%)
            </span>
          </div>
          <div class="capacity-track">
            <div
              class="capacity-fill"
              :style="{
                width: `${Math.min(100, usagePercentage)}%`,
                backgroundColor: getUsageBarColor(usagePercentage),
              }"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 双栏工作区：左侧控制栏（上传 + 操作按钮 + 待放置队列），右侧卡带布局画布 -->
    <div class="main-layout">
      <aside class="left-sidebar">
        <RetroCard>
          <RetroDropZone
            icon="pixelarticons:file-multiple"
            :title="$t('ui.romAssembly.selectFiles')"
            hint=".rom, .gba, .gb, .gbc, .bin"
            accept=".rom,.gba,.gb,.gbc,.bin"
            multiple
            @files-selected="handleFilesSelected"
          />
        </RetroCard>

        <RetroCard>
          <div class="action-card">
            <RetroButton
              variant="primary"
              size="md"
              block
              icon="pixelarticons:sliders"
              :disabled="!hasAnyFiles"
              @click="assembleAndApply"
            >
              {{ $t('ui.romAssembly.assembleAndApply') }}
            </RetroButton>
            <RetroButton
              variant="secondary"
              size="md"
              block
              icon="pixelarticons:download"
              :disabled="!hasAnyFiles"
              @click="assembleAndDownload"
            >
              {{ $t('ui.romAssembly.assembleAndDownload') }}
            </RetroButton>
            <RetroButton
              variant="danger"
              size="md"
              block
              icon="pixelarticons:close"
              :disabled="!hasAnyFiles"
              @click="clearAllSlots"
            >
              {{ $t('ui.romAssembly.clearAll') }}
            </RetroButton>
          </div>
        </RetroCard>

        <!-- 待放置队列 -->
        <RetroCard
          :title="$t('ui.romAssembly.pendingFiles')"
          :badge="pendingFiles.length"
          fill
          class="queue-panel"
        >
          <div
            v-if="pendingFiles.length > 0"
            class="pending-files-list"
          >
            <div
              v-for="file in pendingFiles"
              :key="file.name"
              class="pending-file-item"
              draggable="true"
              @dragstart="onDragStart($event, file)"
            >
              <div class="pending-file-main">
                <div
                  class="file-name"
                  :title="file.name"
                >
                  {{ file.name }}
                </div>
                <div class="file-meta">
                  <span>{{ formatBytes(file.size) }}</span>
                  <span>·</span>
                  <span>{{ getRequiredSlots(file.size, config, 0) }} {{ selectedRomType === 'GBA' ? 'Banks' : 'Slots' }}</span>
                </div>
              </div>
              <RetroButton
                variant="danger"
                icon-only
                icon="pixelarticons:close"
                :title="$t('ui.common.remove')"
                @click="removePendingFile(file.name)"
              />
            </div>
          </div>

          <div
            v-else
            class="empty-pending-message"
          >
            <p class="empty-title">
              {{ $t('ui.romAssembly.noPendingFiles') }}
            </p>
            <p class="empty-hint">
              {{ $t('ui.romAssembly.uploadFilesFirst') }}
            </p>
          </div>
        </RetroCard>
      </aside>

      <!-- 右侧：Retro 风格卡带布局网格 -->
      <section class="layout-panel">
        <div class="panel-header">
          <h4>{{ $t('ui.romAssembly.romLayout') }}</h4>
          <span class="count-pill">
            {{ occupiedCartCount }} CARTS · {{ slots.filter(s => s.file).length }}/{{ slots.length }} SLOTS
          </span>
        </div>

        <div class="cartridges-grid">
          <template
            v-for="entry in layoutEntries"
            :key="entry.key"
          >
            <!-- 已占用：按 4 列行边界切分跨行分段，同卡同色并保持严格物理地址顺序 -->
            <article
              v-if="entry.isOccupied && entry.slot.file"
              class="cart-shell"
              :class="{
                'split-head': entry.partTotal > 1 && entry.partIndex === 0,
                'split-mid': entry.partTotal > 1 && entry.partIndex > 0 && entry.partIndex < entry.partTotal - 1,
                'split-tail': entry.partTotal > 1 && entry.partIndex === entry.partTotal - 1,
              }"
              :style="cartThemeStyle(entry.totalStartIndex, entry.colSpan)"
            >
              <!-- 卡带顶部：编号 + 占用区块标尺 + 横向防滑纹 -->
              <div class="cart-top-bar">
                <span class="cart-num">
                  {{ formatSlotRange(entry.startIndex, entry.endIndex) }}
                  <template v-if="entry.partTotal > 1">
                    ({{ entry.partIndex + 1 }}/{{ entry.partTotal }})
                  </template>
                </span>
                <div
                  class="cart-bank-ruler"
                  :title="`${entry.totalEndIndex - entry.totalStartIndex + 1} banks`"
                >
                  <span
                    v-for="b in (entry.endIndex - entry.startIndex + 1)"
                    :key="b"
                    class="bank-pip"
                  />
                </div>
                <div
                  class="cart-grip-lines"
                  aria-hidden="true"
                >
                  <span />
                  <span />
                  <span />
                </div>
              </div>

              <!-- 卡带中间贴纸区 -->
              <div class="cart-label-screen">
                <div class="label-top-meta">
                  <span class="label-type-badge">
                    {{ entry.romMeta?.type && entry.romMeta.type !== 'Unknown' ? entry.romMeta.type : selectedRomType }}
                  </span>
                  <span class="label-offset">{{ formatHex(slots[entry.startIndex].offset, 4) }}</span>
                </div>

                <div class="label-center">
                  <div
                    class="label-internal-title"
                    :title="entry.romMeta?.title || entry.slot.file.name"
                  >
                    {{ entry.romMeta?.title || entry.slot.file.name }}
                  </div>
                  <div class="label-specs">
                    <span>{{ formatBytes(entry.slot.file.size) }}</span>
                    <span v-if="entry.romMeta?.gameCode">· {{ entry.romMeta.gameCode }}</span>
                  </div>
                </div>

                <div class="label-bottom-meta">
                  <span>
                    {{ entry.totalEndIndex > entry.totalStartIndex
                      ? `${entry.totalEndIndex - entry.totalStartIndex + 1} BANKS`
                      : '1 BANK' }}
                  </span>
                  <span>
                    {{ formatHex(
                      entry.partIndex === entry.partTotal - 1
                        ? entry.slot.offset + entry.slot.file.size - 1
                        : slots[entry.endIndex].offset + slots[entry.endIndex].size - 1,
                      4,
                    ) }}
                  </span>
                </div>
              </div>

              <!-- 卡带底部：文件名 + 提取/移除方形按钮 -->
              <div class="cart-footer-row">
                <span
                  class="cart-file-name"
                  :title="entry.slot.file.name"
                >
                  {{ entry.slot.file.name }}
                </span>
                <div
                  v-if="entry.partIndex === entry.partTotal - 1"
                  class="cart-footer-actions"
                >
                  <RetroButton
                    variant="ghost"
                    icon-only
                    icon="pixelarticons:download"
                    :title="$t('ui.romAnalyzer.extract')"
                    @click.stop="extractSlotFile(entry.slot.file)"
                  />
                  <RetroButton
                    variant="danger"
                    icon-only
                    icon="pixelarticons:close"
                    :title="$t('ui.common.remove')"
                    @click.stop="removeFileFromSlot(entry.slot.id)"
                  />
                </div>
                <span
                  v-else
                  class="split-cont-tag"
                >
                  CONT →
                </span>
              </div>

              <!-- 卡带底部金手指槽位装饰 -->
              <div
                class="cart-connector-notch"
                aria-hidden="true"
              >
                <span
                  v-for="pin in 10"
                  :key="pin"
                  class="pin-tooth"
                />
              </div>
            </article>

            <!-- 空槽位：虚线卡座占位 -->
            <div
              v-else
              class="cart-socket-empty"
              :class="{
                'drag-over': dragOverSlot === entry.slot.id,
                'can-drop': canDropInSlot(entry.slot, entry.startIndex),
              }"
              @dragover.prevent="onDragOver($event, entry.slot)"
              @dragleave="onDragLeave"
              @drop="onDrop($event, entry.slot, entry.startIndex)"
              @click="onSlotClick(entry.slot, entry.startIndex)"
            >
              <div class="cart-top-bar">
                <span class="cart-num">{{ entry.startIndex.toString().padStart(2, '0') }}</span>
                <span class="socket-offset">{{ formatHex(entry.slot.offset, 4) }}</span>
              </div>

              <div class="socket-center">
                <span class="socket-size">{{ formatBytes(entry.slot.size) }}</span>
                <span class="socket-hint">{{ $t('ui.romAssembly.emptySlot') }}</span>
              </div>

              <div
                class="cart-connector-notch muted"
                aria-hidden="true"
              >
                <span
                  v-for="pin in 8"
                  :key="pin"
                  class="pin-tooth"
                />
              </div>
            </div>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { RetroButton, RetroCard, RetroDropZone } from '@/components/retro';
import { useToast } from '@/composables/useToast';
import { useRomAssemblyResultStore } from '@/stores/rom-assembly-store';
import type { FileInfo } from '@/types/file-info';
import type { RomSlot } from '@/types/rom-assembly';
import { downloadBlob } from '@/utils/file-io';
import { formatBytes, formatHex } from '@/utils/formatter-utils';
import { parseRom, type RomInfo } from '@/utils/parsers/rom-parser';
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
import { detectMultiRoms } from '@/utils/rom/rom-split-utils';

interface CartShellPalette {
  shell: string;
  screen: string;
  accent: string;
}

const CART_PALETTES: readonly CartShellPalette[] = [
  { shell: '#E7E2F8', screen: '#17132B', accent: '#7C6CE0' },
  { shell: '#FDE3D7', screen: '#241410', accent: '#E07A5F' },
  { shell: '#DCF1DC', screen: '#102218', accent: '#4D9F6D' },
  { shell: '#DFECFA', screen: '#101D2C', accent: '#4B88D4' },
  { shell: '#F6EFC9', screen: '#231F0E', accent: '#C69D2B' },
  { shell: '#F8DFEC', screen: '#27121E', accent: '#CE5D93' },
];

interface LayoutEntry {
  key: string;
  slot: RomSlot;
  startIndex: number;
  endIndex: number;
  totalStartIndex: number;
  totalEndIndex: number;
  colSpan: number;
  partIndex: number;
  partTotal: number;
  isOccupied: boolean;
  romMeta?: RomInfo;
}

const GRID_COLS = 4;

const { t } = useI18n();
const { showToast } = useToast();
const router = useRouter();
const route = useRoute();
const romAssemblyResultStore = useRomAssemblyResultStore();

const initialRomType: 'MBC5' | 'GBA' = route.query.romType === 'MBC5' ? 'MBC5' : 'GBA';

const selectedRomType = ref<'MBC5' | 'GBA'>(initialRomType);
const config = computed(() => getRomAssemblyConfig(selectedRomType.value));
const slots = ref<RomSlot[]>(createEmptySlots(getRomAssemblyConfig(initialRomType)));
const pendingFiles = ref<FileInfo[]>([]);
const dragOverSlot = ref<string | null>(null);
const draggingFile = ref<FileInfo | null>(null);

const usedSpace = computed(() => calculateUsedSpace(slots.value));
const actualRomSize = computed(() => calculateActualRomSize(slots.value));
const usagePercentage = computed(() => (usedSpace.value / config.value.totalSize) * 100);
const hasAnyFiles = computed(() => slots.value.some(slot => slot.file) || pendingFiles.value.length > 0);
const occupiedCartCount = computed(() => slots.value.filter(s => s.file && s.isFirstSlot).length);

const layoutEntries = computed<LayoutEntry[]>(() => {
  const entries: LayoutEntry[] = [];
  for (let i = 0; i < slots.value.length; i++) {
    const slot = slots.value[i];
    if (slot.file) {
      if (!slot.isFirstSlot) {
        continue;
      }
      const totalStart = i;
      const totalEnd = i + (slot.totalSlots ?? 1) - 1;
      const parsed = parseRom(slot.file.data.subarray(0, Math.min(0x200, slot.file.data.length)));
      const romMeta = parsed.isValid ? parsed : undefined;

      // 按 4 列行边界拆分成不折行的连续分段，保证每行严格对齐 4 列且无空格洞
      const segments: { start: number; end: number }[] = [];
      let cursor = totalStart;
      while (cursor <= totalEnd) {
        const rowEnd = Math.floor(cursor / GRID_COLS) * GRID_COLS + (GRID_COLS - 1);
        const segEnd = Math.min(totalEnd, rowEnd);
        segments.push({ start: cursor, end: segEnd });
        cursor = segEnd + 1;
      }

      segments.forEach((seg, partIndex) => {
        entries.push({
          key: `${slot.id}-seg-${partIndex}`,
          slot,
          startIndex: seg.start,
          endIndex: seg.end,
          totalStartIndex: totalStart,
          totalEndIndex: totalEnd,
          colSpan: seg.end - seg.start + 1,
          partIndex,
          partTotal: segments.length,
          isOccupied: true,
          romMeta,
        });
      });
    } else {
      entries.push({
        key: slot.id,
        slot,
        startIndex: i,
        endIndex: i,
        totalStartIndex: i,
        totalEndIndex: i,
        colSpan: 1,
        partIndex: 0,
        partTotal: 1,
        isOccupied: false,
      });
    }
  }
  return entries;
});

function cartThemeStyle(index: number, colSpan = 1) {
  const palette = CART_PALETTES[index % CART_PALETTES.length];
  return {
    '--cart-shell-bg': palette.shell,
    '--cart-screen-bg': palette.screen,
    '--cart-accent': palette.accent,
    '--cart-col-span': String(Math.min(GRID_COLS, Math.max(1, colSpan))),
  };
}

function formatSlotRange(start: number, end: number): string {
  const s = start.toString().padStart(2, '0');
  if (end <= start) return s;
  return `${s}–${end.toString().padStart(2, '0')}`;
}

function initializeSlots() {
  slots.value = createEmptySlots(config.value);
  pendingFiles.value = [];
}

function selectPlatform(platform: 'MBC5' | 'GBA') {
  if (selectedRomType.value === platform) {
    return;
  }
  selectedRomType.value = platform;
  initializeSlots();
}

function loadDetectedMultiCart(file: FileInfo): boolean {
  const detection = detectMultiRoms(file.data);
  if (!detection.isMultiCart || !detection.platformType || detection.games.length === 0) {
    return false;
  }

  selectedRomType.value = detection.platformType;
  const targetConfig = getRomAssemblyConfig(detection.platformType);
  let nextSlots = createEmptySlots(targetConfig);
  const unplaced: FileInfo[] = [];

  for (const game of detection.games) {
    const ext = game.romInfo.type === 'Unknown' ? 'bin' : game.romInfo.type.toLowerCase();
    const safeTitle = (game.romInfo.title || game.desc).trim().replace(/[\\/:*?"<>|]/g, '_');
    const subFile: FileInfo = {
      name: `${safeTitle}.${ext}`,
      size: game.calculatedSize,
      data: game.data,
    };

    const slotIndex = nextSlots.findIndex(s => s.offset === game.startAddress);
    if (slotIndex >= 0) {
      nextSlots = placeFileInSlots(subFile, slotIndex, nextSlots, targetConfig);
    } else {
      unplaced.push(subFile);
    }
  }

  slots.value = nextSlots;
  pendingFiles.value = unplaced;
  showToast(t('messages.romAssembly.multiRomLoaded', { count: detection.games.length }), 'success');
  return true;
}

function extractSlotFile(file: FileInfo) {
  try {
    const blob = new Blob([file.data as BlobPart], { type: 'application/octet-stream' });
    downloadBlob(blob, file.name);
    showToast(t('ui.romAnalyzer.extractSuccess'), 'success');
  } catch (error) {
    console.error(t('ui.romAnalyzer.extractFailed'), error);
    showToast(t('ui.romAnalyzer.extractFailed'), 'error');
  }
}

async function handleFilesSelected(files: File[]) {
  const fileInfos = await Promise.all(
    files.map(async file => ({
      name: file.name,
      size: file.size,
      data: new Uint8Array(await file.arrayBuffer()),
    })),
  );
  onFileSelected(fileInfos);
}

function onFileSelected(fileInfo: FileInfo | FileInfo[]) {
  const files = Array.isArray(fileInfo) ? fileInfo : [fileInfo];

  if (files.length === 1 && loadDetectedMultiCart(files[0])) {
    return;
  }

  for (const file of files) {
    const requiredSlots = getRequiredSlots(file.size, config.value, 0);
    if (requiredSlots > config.value.maxSlots) {
      showToast(t('messages.romAssembly.fileTooLarge', { name: file.name }), 'error');
      continue;
    }

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
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = canDropInSlot(slot, getSlotIndex(slot)) ? 'move' : 'none';
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
  if (draggingFile.value && canDropInSlot(slot, slotIndex)) {
    placeFileInSlot(draggingFile.value, slotIndex);
    removePendingFile(draggingFile.value.name);
    draggingFile.value = null;
    return;
  }

  if (pendingFiles.value.length > 0 && !slot.file) {
    const file = pendingFiles.value[0];
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
  return canPlaceFile(draggingFile.value, slot, config.value, slotIndex)
    && checkConsecutiveSlots(slotIndex, requiredSlots, slots.value);
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
    if (!pendingFiles.value.find(f => f.name === slot.file?.name)) {
      pendingFiles.value.push(slot.file);
    }
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
  romAssemblyResultStore.setResult(assembled, selectedRomType.value);
  showToast(t('messages.romAssembly.assembled', {
    size: formatBytes(assembled.totalSize),
    usedSlots: assembled.slots.filter(s => s.file && s.isFirstSlot).length.toString(),
  }), 'success');
  void router.push('/');
}

function assembleAndDownload() {
  const assembled = assembleRom(slots.value, config.value);
  const timestamp = DateTime.now().toFormat('yyyyMMdd_HHmmss');
  const fileName = `assembled_${selectedRomType.value.toLowerCase()}_${timestamp}.rom`;

  try {
    const blob = new Blob([assembled.data as BlobPart], { type: 'application/octet-stream' });
    downloadBlob(blob, fileName);
    showToast(t('messages.romAssembly.downloaded', {
      size: formatBytes(assembled.totalSize),
      fileName,
    }), 'success');
  } catch (error) {
    showToast(t('messages.romAssembly.downloadFailed', { error: (error as Error).message }), 'error');
  }
}

function getUsageBarColor(percentage: number): string {
  if (percentage < 25) return 'var(--color-success)';
  if (percentage < 50) return 'var(--color-primary)';
  if (percentage < 75) return 'var(--color-warning)';
  return 'var(--color-error)';
}
</script>

<style scoped>
.rom-split-merge-panel {
  box-sizing: border-box;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: 0 2px 0 4px;
}

.panel-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg);
  border: 1.5px solid #2d243b;
  border-radius: 6px;
  box-shadow: -3px 3px 0 #2d243b;
  flex-wrap: wrap;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.platform-segmented {
  display: inline-flex;
  padding: 2px;
  background: var(--color-bg-secondary);
  border: 1.5px solid #2d243b;
  border-radius: 4px;
}

.segment-btn {
  padding: 4px 12px;
  border: none;
  border-radius: 2px;
  background: transparent;
  color: var(--color-text-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.segment-btn.active {
  background: #2d243b;
  color: #ffffff;
}

.spec-chip {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: var(--color-text-secondary);
  letter-spacing: 0.04em;
}

.capacity-meter {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  min-width: 220px;
}

.capacity-labels {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: var(--font-size-xs);
}

.capacity-size {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.capacity-sep,
.capacity-total {
  color: var(--color-text-secondary);
}

.capacity-track {
  width: 100%;
  height: 5px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.capacity-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.2s ease;
}

.left-sidebar {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  height: 100%;
  min-height: 0;
  overflow: visible;
  padding: 0;
}

.action-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.main-layout {
  box-sizing: border-box;
  flex: 1;
  min-height: 0;
  overflow: visible;
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  gap: var(--space-5);
  align-items: stretch;
  padding: 0 0 4px 0;
}

.queue-panel {
  box-sizing: border-box;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  border: 1.5px solid #2d243b;
  border-radius: 6px;
  padding: var(--space-4);
  box-shadow: -3px 3px 0 #2d243b;
}

.layout-panel {
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  border: 1.5px solid #2d243b;
  border-radius: 6px;
  padding: var(--space-4);
  box-shadow: -3px 3px 0 #2d243b;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border-light);
}

.panel-header h4 {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.count-pill {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-light);
  border-radius: 4px;
  padding: 2px 8px;
}

.pending-files-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.pending-file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-bg-secondary);
  border: 1.5px solid #2d243b;
  border-radius: 4px;
  cursor: grab;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.pending-file-item:hover {
  transform: translate(1px, -1px);
  box-shadow: -2px 2px 0 #2d243b;
}

.pending-file-main {
  min-width: 0;
  flex: 1;
}

.file-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: var(--color-text-secondary);
}

.empty-pending-message {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8) var(--space-4);
  text-align: center;
  border: 1px dashed var(--color-border);
  border-radius: 4px;
}

.empty-title {
  margin: 0 0 var(--space-1) 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.empty-hint {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* Retro 风格卡带网格（每行 4 个基础槽位，跨多槽位按比例跨列/跨行，仅网格内部滚动） */
.cartridges-grid {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-auto-rows: max-content;
  gap: 18px 16px;
  padding: 4px 6px 6px 6px;
}

.cart-shell {
  position: relative;
  grid-column: span var(--cart-col-span, 1);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 10px 0 10px;
  background: var(--cart-shell-bg, #e7e2f8);
  border: 1.5px solid #2d243b;
  border-radius: 3px;
  box-shadow: -3px 3px 0 #2d243b;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.cart-shell.split-head {
  border-right-style: dashed;
}

.cart-shell.split-mid {
  border-left-style: dashed;
  border-right-style: dashed;
}

.cart-shell.split-tail {
  border-left-style: dashed;
}

.split-cont-tag {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  color: #4f465e;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

.cart-bank-ruler {
  display: flex;
  align-items: center;
  gap: 3px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.bank-pip {
  flex: 1;
  max-width: 16px;
  height: 5px;
  background: var(--cart-accent, #7c6ce0);
  border: 1px solid #2d243b;
  border-radius: 1px;
}

.cart-shell:hover {
  transform: translate(1px, -2px);
  box-shadow: -4px 5px 0 #2d243b;
}

.cart-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.cart-num {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  color: #4f465e;
  letter-spacing: 0.04em;
}

.cart-grip-lines {
  display: flex;
  align-items: center;
  gap: 4px;
}

.cart-grip-lines span {
  display: block;
  width: 14px;
  height: 2px;
  background: rgba(45, 36, 59, 0.35);
}

.cart-label-screen {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 118px;
  padding: 10px;
  background: var(--cart-screen-bg, #17132b);
  background-image: radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px);
  background-size: 8px 8px;
  border: 1.5px solid #2d243b;
  color: #f8fafc;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.label-top-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 10px;
}

.label-type-badge {
  padding: 1px 5px;
  background: var(--cart-accent, #7c6ce0);
  color: #ffffff;
  font-weight: var(--font-weight-bold);
  border-radius: 2px;
  letter-spacing: 0.05em;
}

.label-offset {
  color: rgba(248, 250, 252, 0.72);
}

.label-center {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 8px 0;
}

.label-internal-title {
  font-size: 14px;
  font-weight: var(--font-weight-bold);
  color: #ffffff;
  letter-spacing: 0.03em;
  line-height: 1.25;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.label-specs {
  font-size: 11px;
  color: rgba(248, 250, 252, 0.78);
}

.label-bottom-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.14);
  font-size: 10px;
  color: rgba(248, 250, 252, 0.65);
}

.cart-footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 26px;
}

.cart-file-name {
  min-width: 0;
  flex: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  font-weight: var(--font-weight-medium);
  color: #2d243b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cart-footer-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.cart-connector-notch {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 3px;
  width: 68%;
  height: 11px;
  margin: 0 auto;
  padding: 0 6px;
  border-top: 1.5px solid rgba(45, 36, 59, 0.45);
  border-left: 1.5px solid rgba(45, 36, 59, 0.45);
  border-right: 1.5px solid rgba(45, 36, 59, 0.45);
  background: rgba(255, 255, 255, 0.35);
}

.pin-tooth {
  display: block;
  width: 3px;
  height: 6px;
  background: rgba(45, 36, 59, 0.25);
}

/* 空槽位卡座样式 */
.cart-socket-empty {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 10px;
  min-height: 196px;
  padding: 10px 10px 0 10px;
  background: var(--color-bg-secondary);
  border: 1.5px dashed #b9b2c4;
  border-radius: 3px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.cart-socket-empty:hover,
.cart-socket-empty.drag-over.can-drop {
  border-color: #2d243b;
  border-style: solid;
  background: #ffffff;
}

.socket-offset {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  color: var(--color-text-secondary);
}

.socket-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 1;
  border: 1px dashed rgba(45, 36, 59, 0.18);
  padding: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.socket-size {
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
}

.socket-hint {
  font-size: 11px;
  color: var(--color-text-muted);
}

.cart-connector-notch.muted {
  border-color: rgba(45, 36, 59, 0.2);
  background: transparent;
}

@media (max-width: 1100px) {
  .cartridges-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .cart-shell {
    grid-column: span min(var(--cart-col-span, 1), 2);
  }
}

@media (max-width: 960px) {
  .rom-split-merge-panel {
    flex: none;
    height: auto;
    overflow: visible;
    padding: 0 2px 4px 4px;
  }

  .main-layout {
    flex: none;
    display: flex;
    flex-direction: column;
    overflow: visible;
  }

  .left-sidebar {
    position: static;
    height: auto;
    min-height: 0;
    overflow: visible;
  }

  .queue-panel,
  .layout-panel {
    flex: none;
    height: auto;
    overflow: visible;
  }

  .pending-files-list,
  .cartridges-grid {
    flex: none;
    overflow: visible;
  }

  .capacity-meter {
    align-items: flex-start;
  }
}

@media (max-width: 600px) {
  .cartridges-grid {
    grid-template-columns: 1fr;
  }

  .cart-shell {
    grid-column: span 1 !important;
  }
}
</style>
