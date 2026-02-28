<template>
  <div
    v-if="shouldShowSectorVisualization"
    class="sector-visualization"
  >
    <div class="sector-title">
      <span>{{ $t('ui.progress.sectorMap') }}</span>
      <div class="sector-title-right">
        <span class="sector-counter">
          {{ sectorProgress?.completedSectors ?? 0 }} / {{ sectorProgress?.totalSectors ?? 0 }}
        </span>
        <div class="render-mode-wrap">
          <ToggleSwitch
            v-model="useCanvasRenderer"
            :label="$t('ui.progress.rendererCanvas')"
          />
        </div>
      </div>
    </div>

    <div
      v-if="!useCanvasRenderer"
      class="sector-grid"
    >
      <div
        v-for="(sector, index) in displaySectors"
        :key="`sector-${sector.address}`"
        v-memo="[renderedSectorStates[index], locale]"
        class="sector-block"
        :class="[
          sectorStateClassMap[renderedSectorStates[index] ?? 'pending'],
          { 'sector-current': (renderedSectorStates[index] ?? 'pending') === 'processing' },
          `sector-size-${sector.sizeClass}`
        ]"
        :title="getSectorTooltip(sector, index)"
      >
        <div class="sector-inner">
          <div
            v-if="(renderedSectorStates[index] ?? 'pending') === 'processing'"
            class="sector-spinner"
          />
        </div>
      </div>
    </div>

    <div
      v-else
      ref="canvasContainer"
      class="sector-canvas-container"
      @mousemove="handleCanvasMouseMove"
      @mouseleave="handleCanvasMouseLeave"
    >
      <canvas
        ref="sectorCanvas"
        class="sector-canvas"
        :width="canvasMetrics.width"
        :height="canvasMetrics.height"
        :title="canvasHoverTitle"
      />
    </div>

    <div class="sector-legend">
      <div class="legend-row">
        <div
          v-if="existingSectorSizes.has('small')"
          class="legend-group"
        >
          <span class="legend-size-label">{{ formatBytes(sectorSizeLabels.small) }}:</span>
          <div class="legend-item">
            <div class="legend-color sector-pending sector-size-small" />
            <span>{{ $t('ui.progress.sectorState.pending') }}</span>
          </div>
          <div class="legend-item">
            <div class="legend-color sector-completed sector-size-small" />
            <span>{{ $t('ui.progress.sectorState.completed') }}</span>
          </div>
        </div>
        <div
          v-if="existingSectorSizes.has('medium')"
          class="legend-group"
        >
          <span class="legend-size-label">{{ formatBytes(sectorSizeLabels.medium) }}:</span>
          <div class="legend-item">
            <div class="legend-color sector-pending sector-size-medium" />
            <span>{{ $t('ui.progress.sectorState.pending') }}</span>
          </div>
          <div class="legend-item">
            <div class="legend-color sector-completed sector-size-medium" />
            <span>{{ $t('ui.progress.sectorState.completed') }}</span>
          </div>
        </div>
        <div
          v-if="existingSectorSizes.has('large')"
          class="legend-group"
        >
          <span class="legend-size-label">{{ formatBytes(sectorSizeLabels.large) }}:</span>
          <div class="legend-item">
            <div class="legend-color sector-pending sector-size-large" />
            <span>{{ $t('ui.progress.sectorState.pending') }}</span>
          </div>
          <div class="legend-item">
            <div class="legend-color sector-completed sector-size-large" />
            <span>{{ $t('ui.progress.sectorState.completed') }}</span>
          </div>
        </div>
        <div class="legend-group">
          <div class="legend-item">
            <div class="legend-color sector-processing" />
            <span>{{ $t('ui.progress.sectorState.processing') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ToggleSwitch from '@/components/common/ToggleSwitch.vue';
import { type ProgressInfo, type SectorProgressInfo, type SectorSizeClass, type SectorStateCode } from '@/types/progress-info';
import { formatBytes, formatHex } from '@/utils/formatter-utils';

const { t, locale } = useI18n();

const props = defineProps<{
  type?: ProgressInfo['type'];
  sectorProgress?: ProgressInfo['sectorProgress'];
}>();

const sectorStateClassMap: Record<SectorProgressInfo['state'], string> = {
  pending: 'sector-pending',
  processing: 'sector-processing',
  completed: 'sector-completed',
  error: 'sector-error',
};

interface SectorDisplayInfo {
  index: number;
  address: number;
  size: number;
  sizeClass: SectorSizeClass;
  formattedAddress: string;
  formattedSize: string;
}

let cachedMetaSource: ProgressInfo['sectorProgress'] | undefined;
const displaySectors = shallowRef<SectorDisplayInfo[]>([]);
const renderedSectorStates = shallowRef<SectorProgressInfo['state'][]>([]);
const useCanvasRenderer = ref(true);

const canvasContainer = ref<HTMLDivElement | null>(null);
const sectorCanvas = ref<HTMLCanvasElement | null>(null);
const hoverSectorIndex = ref<number>(-1);
const canvasMetrics = ref({ width: 1, height: 1, columns: 1, rows: 1 });
let canvasResizeObserver: ResizeObserver | null = null;

const CANVAS_BLOCK_SIZE = 18;
const CANVAS_GAP = 2;
const CANVAS_STEP = CANVAS_BLOCK_SIZE + CANVAS_GAP;
const SECTOR_RENDER_THROTTLE_MS = 120;
let lastSectorRenderAt = 0;
let pendingSectorRenderTimer: ReturnType<typeof setTimeout> | null = null;
let pendingRenderStates: SectorProgressInfo['state'][] | null = null;
// let lastViewLogSignature = '';

const shouldShowSectorVisualization = computed(() => {
  return Boolean(props.sectorProgress && (props.type === 'erase' || props.type === 'write' || props.type === 'verify'));
});

function getSectorSizeClass(sectorSize: number): SectorSizeClass {
  if (sectorSize <= 0x1000) {
    return 'small';
  }
  if (sectorSize <= 0x8000) {
    return 'medium';
  }
  return 'large';
}

function decodeSectorState(code: SectorStateCode | undefined): SectorProgressInfo['state'] {
  if (code === 1) return 'processing';
  if (code === 2) return 'completed';
  if (code === 3) return 'error';
  return 'pending';
}

function resolveSectorStates(sectorProgress: ProgressInfo['sectorProgress']): SectorProgressInfo['state'][] {
  if (!sectorProgress) {
    return [];
  }

  return displaySectors.value.map((sector) => decodeSectorState(sectorProgress.stateBuffer[sector.index] as SectorStateCode));
}

function findProcessingIndex(states: SectorProgressInfo['state'][]): number {
  return states.findIndex((state) => state === 'processing');
}

function applySectorStates(states: SectorProgressInfo['state'][]): void {
  renderedSectorStates.value = states;
  lastSectorRenderAt = Date.now();
  let pending = 0;
  let processing = 0;
  let completed = 0;
  let error = 0;
  for (const state of states) {
    if (state === 'pending') pending += 1;
    else if (state === 'processing') processing += 1;
    else if (state === 'completed') completed += 1;
    else error += 1;
  }
  /*
  const signature = `render|p=${pending}|r=${processing}|d=${completed}|e=${error}|len=${states.length}`;
  if (signature !== lastViewLogSignature) {
    lastViewLogSignature = signature;
    console.info(`[SectorVisualization] ${signature}`);
  }
  */
  if (useCanvasRenderer.value) {
    drawCanvas();
  }
}

function scheduleSectorStatesRender(nextStates: SectorProgressInfo['state'][]): void {
  const currentStates = renderedSectorStates.value;

  // First frame must show pending immediately.
  if (currentStates.length === 0 || currentStates.length !== nextStates.length) {
    if (pendingSectorRenderTimer) {
      clearTimeout(pendingSectorRenderTimer);
      pendingSectorRenderTimer = null;
    }
    pendingRenderStates = null;
    applySectorStates(nextStates);
    return;
  }

  // Processing change should render immediately.
  if (findProcessingIndex(currentStates) !== findProcessingIndex(nextStates)) {
    if (pendingSectorRenderTimer) {
      clearTimeout(pendingSectorRenderTimer);
      pendingSectorRenderTimer = null;
    }
    pendingRenderStates = null;
    applySectorStates(nextStates);
    return;
  }

  const elapsed = Date.now() - lastSectorRenderAt;
  if (elapsed >= SECTOR_RENDER_THROTTLE_MS && !pendingSectorRenderTimer) {
    applySectorStates(nextStates);
    return;
  }

  pendingRenderStates = nextStates;
  if (!pendingSectorRenderTimer) {
    const wait = Math.max(0, SECTOR_RENDER_THROTTLE_MS - elapsed);
    pendingSectorRenderTimer = setTimeout(() => {
      pendingSectorRenderTimer = null;
      if (pendingRenderStates) {
        applySectorStates(pendingRenderStates);
        pendingRenderStates = null;
      }
    }, wait);
  }
}

watch(
  () => props.sectorProgress,
  (sectorProgress) => {
    if (!sectorProgress) {
      cachedMetaSource = undefined;
      displaySectors.value = [];
      renderedSectorStates.value = [];
      if (pendingSectorRenderTimer) {
        clearTimeout(pendingSectorRenderTimer);
        pendingSectorRenderTimer = null;
      }
      pendingRenderStates = null;
      return;
    }

    const hasMeta = Boolean(
      sectorProgress.addresses?.length
      && sectorProgress.sizes?.length
      && sectorProgress.addresses.length === sectorProgress.sizes.length,
    );

    if (sectorProgress !== cachedMetaSource) {
      cachedMetaSource = sectorProgress;

      if (hasMeta) {
        const addresses = sectorProgress.addresses ?? [];
        const sizes = sectorProgress.sizes ?? [];
        const sizeClasses = sectorProgress.sizeClasses;
        displaySectors.value = addresses.map((address, index) => {
          const size = sizes[index] ?? 0;
          const sizeClass = sizeClasses?.[index] ?? getSectorSizeClass(size);
          return {
            index,
            address,
            size,
            sizeClass,
            formattedAddress: formatHex(address, 4),
            formattedSize: formatBytes(size),
          };
        }).sort((a, b) => a.address - b.address);
      } else {
        displaySectors.value = [];
      }

      if (useCanvasRenderer.value) {
        void nextTick(() => {
          updateCanvasLayout();
          drawCanvas();
        });
      }
    }

    scheduleSectorStatesRender(resolveSectorStates(sectorProgress));
  },
  { immediate: true },
);

watch(useCanvasRenderer, (enabled) => {
  hoverSectorIndex.value = -1;
  if (enabled) {
    void nextTick(() => {
      ensureCanvasObserver();
      updateCanvasLayout();
      drawCanvas();
    });
  }
});

watch(
  [renderedSectorStates, () => locale.value],
  () => {
    if (useCanvasRenderer.value) {
      drawCanvas();
    }
  },
  { deep: false },
);

const sectorStateLabelMap = computed<Record<SectorProgressInfo['state'], string>>(() => ({
  pending: t('ui.progress.sectorState.pending'),
  processing: t('ui.progress.sectorState.processing'),
  completed: t('ui.progress.sectorState.completed'),
  error: t('ui.progress.sectorState.error'),
}));

function getSectorTooltip(sector: SectorDisplayInfo, index: number): string {
  const state = renderedSectorStates.value[index] ?? 'pending';
  return t('ui.progress.sectorTooltip', {
    address: sector.formattedAddress,
    size: sector.formattedSize,
    state: sectorStateLabelMap.value[state],
  });
}

const canvasHoverTitle = computed(() => {
  if (hoverSectorIndex.value < 0 || hoverSectorIndex.value >= displaySectors.value.length) {
    return '';
  }
  return getSectorTooltip(displaySectors.value[hoverSectorIndex.value], hoverSectorIndex.value);
});

function getCanvasColor(sizeClass: SectorSizeClass, state: SectorProgressInfo['state']): { fill: string; stroke: string; current: boolean } {
  // Keep Canvas colors aligned with DIV/CSS definitions:
  // pending: small #ddd6fe, medium #bfdbfe, large color-bg-tertiary(#e9ecef), border color-border(#cccccc)
  // processing: fill color-warning(#fbc02d), border #f59e0b
  // completed: small #a855f7, medium color-primary(#1976d2), large color-success(#388e3c), border #15803d
  // error: fill color-error(#d32f2f), border #dc2626
  if (state === 'error') {
    return { fill: '#d32f2f', stroke: '#dc2626', current: false };
  }
  if (state === 'processing') {
    return { fill: '#fbc02d', stroke: '#f59e0b', current: true };
  }
  if (state === 'completed') {
    if (sizeClass === 'small') {
      return { fill: '#a855f7', stroke: '#15803d', current: false };
    }
    if (sizeClass === 'medium') {
      return { fill: '#1976d2', stroke: '#15803d', current: false };
    }
    return { fill: '#388e3c', stroke: '#15803d', current: false };
  }

  if (sizeClass === 'small') {
    return { fill: '#ddd6fe', stroke: '#cccccc', current: false };
  }
  if (sizeClass === 'medium') {
    return { fill: '#bfdbfe', stroke: '#cccccc', current: false };
  }
  return { fill: '#e9ecef', stroke: '#cccccc', current: false };
}

function updateCanvasLayout(): void {
  const count = displaySectors.value.length;
  const containerWidth = canvasContainer.value?.clientWidth ?? 0;
  const safeWidth = Math.max(1, containerWidth);
  const columns = Math.max(1, Math.floor((safeWidth + CANVAS_GAP) / CANVAS_STEP));
  const rows = Math.max(1, Math.ceil(count / columns));
  const width = Math.max(1, columns * CANVAS_STEP - CANVAS_GAP);
  const height = Math.max(1, rows * CANVAS_STEP - CANVAS_GAP);
  canvasMetrics.value = { width, height, columns, rows };
}

function drawCanvas(): void {
  const canvas = sectorCanvas.value;
  if (!canvas || !useCanvasRenderer.value) {
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  const { width, height, columns } = canvasMetrics.value;
  ctx.clearRect(0, 0, width, height);

  for (let index = 0; index < displaySectors.value.length; index += 1) {
    const sector = displaySectors.value[index];
    const state = renderedSectorStates.value[index] ?? 'pending';
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = col * CANVAS_STEP;
    const y = row * CANVAS_STEP;
    const { fill, stroke, current } = getCanvasColor(sector.sizeClass, state);

    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, CANVAS_BLOCK_SIZE, CANVAS_BLOCK_SIZE);
    ctx.strokeRect(x + 0.5, y + 0.5, CANVAS_BLOCK_SIZE - 1, CANVAS_BLOCK_SIZE - 1);

    if (current) {
      ctx.strokeStyle = '#1976d2';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, CANVAS_BLOCK_SIZE - 2, CANVAS_BLOCK_SIZE - 2);
    }
  }
}

function getSectorIndexFromCanvasEvent(event: MouseEvent): number {
  if (!canvasContainer.value) {
    return -1;
  }
  const x = event.offsetX + canvasContainer.value.scrollLeft;
  const y = event.offsetY + canvasContainer.value.scrollTop;
  const col = Math.floor(x / CANVAS_STEP);
  const row = Math.floor(y / CANVAS_STEP);
  if (col < 0 || row < 0) {
    return -1;
  }

  const xInCell = x - col * CANVAS_STEP;
  const yInCell = y - row * CANVAS_STEP;
  if (xInCell > CANVAS_BLOCK_SIZE || yInCell > CANVAS_BLOCK_SIZE) {
    return -1;
  }

  const index = row * canvasMetrics.value.columns + col;
  if (index < 0 || index >= displaySectors.value.length) {
    return -1;
  }
  return index;
}

function handleCanvasMouseMove(event: MouseEvent): void {
  hoverSectorIndex.value = getSectorIndexFromCanvasEvent(event);
}

function handleCanvasMouseLeave(): void {
  hoverSectorIndex.value = -1;
}

const existingSectorSizes = computed(() => {
  const sizes = new Set<string>();
  displaySectors.value.forEach((sector) => {
    sizes.add(sector.sizeClass);
  });
  return sizes;
});

const sectorSizeLabels = computed(() => {
  const sizeMap: Record<string, number> = {};
  displaySectors.value.forEach((sector) => {
    if (!sizeMap[sector.sizeClass] || sector.size < sizeMap[sector.sizeClass]) {
      sizeMap[sector.sizeClass] = sector.size;
    }
  });
  return sizeMap;
});

onMounted(() => {
  ensureCanvasObserver();
});

onUnmounted(() => {
  if (canvasResizeObserver) {
    canvasResizeObserver.disconnect();
    canvasResizeObserver = null;
  }
  if (pendingSectorRenderTimer) {
    clearTimeout(pendingSectorRenderTimer);
    pendingSectorRenderTimer = null;
  }
  pendingRenderStates = null;
});

function ensureCanvasObserver(): void {
  canvasResizeObserver ??= new ResizeObserver(() => {
    if (useCanvasRenderer.value) {
      updateCanvasLayout();
      drawCanvas();
    }
  });
  if (canvasContainer.value) {
    canvasResizeObserver.disconnect();
    canvasResizeObserver.observe(canvasContainer.value);
  }
}
</script>

<style lang="scss" scoped>
@use '@/styles/variables/colors' as color-vars;
@use '@/styles/variables/spacing' as spacing-vars;
@use '@/styles/variables/typography' as typography-vars;
@use '@/styles/variables/radius' as radius-vars;
@use '@/styles/mixins' as mixins;

.sector-visualization {
  margin: spacing-vars.$space-5 0;
  padding: spacing-vars.$space-4;
  background: color-vars.$color-bg-secondary;
  border-radius: radius-vars.$radius-lg;
  border: 1px solid color-vars.$color-border-light;
}

.sector-title {
  @include mixins.flex-between;
  margin-bottom: spacing-vars.$space-3;
  font-size: typography-vars.$font-size-sm;
  font-weight: typography-vars.$font-weight-semibold;
  color: color-vars.$color-text;
  gap: spacing-vars.$space-2;
}

.sector-title-right {
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-2;
}

.render-mode-wrap {
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-1;
}

.sector-counter {
  font-family: monospace;
  background: color-vars.$color-bg-tertiary;
  padding: spacing-vars.$space-1 spacing-vars.$space-2;
  border-radius: radius-vars.$radius-base;
  font-size: typography-vars.$font-size-xs;
  color: color-vars.$color-text-secondary;
}

.sector-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-bottom: spacing-vars.$space-3;
  max-height: 200px;
  overflow-y: auto;
  overflow-x: hidden;
  justify-content: flex-start;
  align-content: flex-start;
}

.sector-canvas-container {
  margin-bottom: spacing-vars.$space-3;
  max-height: 200px;
  overflow: auto;
  border-radius: radius-vars.$radius-sm;
}

.sector-canvas {
  display: block;
}

.sector-block {
  width: 16px;
  height: 16px;
  border-radius: radius-vars.$radius-sm;
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover {
    transform: scale(1.1);
    z-index: 10;
  }
}

.sector-inner {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  @include mixins.flex-center;
}

/* 扇区状态颜色 */
.sector-pending {
  border: 1px solid color-vars.$color-border;

  &.sector-size-small {
    background: #ddd6fe; /* 浅紫色 - 4KB */
  }

  &.sector-size-medium {
    background: #bfdbfe; /* 浅蓝色 - 32KB */
  }

  &.sector-size-large {
    background: color-vars.$color-bg-tertiary; /* 浅灰色 - 64KB+ */
  }
}

.sector-processing {
  background: color-vars.$color-warning;
  border: 1px solid #f59e0b;
  animation: sectorPulse 1s infinite;
}

.sector-completed {
  border: 1px solid #15803d;

  &.sector-size-small {
    background: #a855f7; /* 紫色 - 4KB 完成 */
  }

  &.sector-size-medium {
    background: color-vars.$color-primary; /* 蓝色 - 32KB 完成 */
  }

  &.sector-size-large {
    background: color-vars.$color-success; /* 绿色 - 64KB+ 完成 */
  }
}

.sector-error {
  background: color-vars.$color-error;
  border: 1px solid #dc2626;
}

.sector-current {
  box-shadow: 0 0 0 2px color-vars.$color-primary;
  z-index: 5;
}

/* 擦除动画 */
@keyframes sectorPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.sector-spinner {
  width: 8px;
  height: 8px;
  border: 1px solid #ffffff;
  border-top: 1px solid transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 图例 */
.sector-legend {
  @include mixins.flex-column;
  gap: spacing-vars.$space-2;
  font-size: typography-vars.$font-size-xs;
  color: color-vars.$color-text-secondary;
}

.legend-row {
  display: flex;
  flex-wrap: wrap;
  gap: spacing-vars.$space-3;
  align-items: center;
  justify-content: center;
}

.legend-group {
  display: flex;
  flex-wrap: wrap;
  gap: spacing-vars.$space-2;
  align-items: center;
  padding: spacing-vars.$space-1 spacing-vars.$space-2;
  background: rgba(0, 0, 0, 0.02);
  border-radius: radius-vars.$radius-base;
  border: 1px solid rgba(0, 0, 0, 0.05);
  min-width: 0;
  flex-shrink: 1;
}

.legend-size-label {
  font-weight: typography-vars.$font-weight-semibold;
  color: color-vars.$color-text;
  font-size: typography-vars.$font-size-xs;
  margin-right: spacing-vars.$space-1;
  white-space: nowrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-1;
  font-size: typography-vars.$font-size-xs;
  flex-shrink: 0;
  min-width: 0;

  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: radius-vars.$radius-sm;
  border: 1px solid;

  &.sector-pending {
    border-color: color-vars.$color-border;

    &.sector-size-small {
      background: #ddd6fe;
    }

    &.sector-size-medium {
      background: #bfdbfe;
    }

    &.sector-size-large {
      background: color-vars.$color-bg-tertiary;
    }
  }

  &.sector-processing {
    background: color-vars.$color-warning;
    border-color: #f59e0b;
  }

  &.sector-completed.sector-size-small {
    background: #a855f7;
    border-color: #15803d;
  }

  &.sector-completed.sector-size-medium {
    background: color-vars.$color-primary;
    border-color: #15803d;
  }

  &.sector-completed.sector-size-large {
    background: #508c46;
    border-color: #15803d;
  }
}

@media (max-width: 768px) {
  .sector-title {
    align-items: flex-start;
    flex-direction: column;
  }

  .sector-title-right {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
