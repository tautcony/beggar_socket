<template>
  <div
    v-if="showDebugPanel"
    ref="panelRef"
    class="debug-panel"
    :class="{
      'debug-panel--collapsed': isCollapsed,
      'debug-panel--dragging': isDragging,
      'debug-panel--docked-left': dockSide === 'left',
      'debug-panel--docked-right': dockSide === 'right',
    }"
    :style="panelStyle"
  >
    <div
      class="debug-header"
      @pointerdown="beginDrag"
      @dblclick.stop="togglePanelCollapsed"
    >
      <div
        v-if="isCollapsed"
        class="debug-header__collapsed"
      >
        <IonIcon
          :icon="constructOutline"
          class="debug-header__icon"
        />
        <span class="collapsed-label">{{ $t('ui.debug.panel') }}</span>
        <span
          class="collapsed-status"
          :class="debugEnabled ? 'collapsed-status--active' : 'collapsed-status--idle'"
        />
      </div>
      <div
        v-else
        class="debug-header__main"
      >
        <h3 class="debug-title">
          <IonIcon
            :icon="constructOutline"
            class="debug-title__icon"
          />
          {{ $t('ui.debug.panel') }}
        </h3>
        <span
          class="status-pill"
          :class="debugEnabled ? 'status-pill--active' : 'status-pill--idle'"
        >
          {{ debugEnabled ? $t('ui.debug.enabled') : $t('ui.debug.disabled') }}
        </span>
      </div>

      <div class="panel-actions">
        <button
          type="button"
          class="panel-icon-button"
          :title="collapseActionTitle"
          @click.stop="togglePanelCollapsed"
        >
          <IonIcon :icon="collapseActionIcon" />
        </button>
        <button
          type="button"
          class="panel-icon-button"
          :title="$t('ui.common.close')"
          @click.stop="handleClose"
        >
          <IonIcon :icon="closeOutline" />
        </button>
      </div>
    </div>

    <div
      v-if="!isCollapsed"
      class="debug-content"
    >
      <section class="debug-section">
        <div class="section-title-row">
          <h4>{{ $t('ui.debug.sessionStatus') }}</h4>
          <BaseButton
            variant="secondary"
            size="sm"
            :text="$t('ui.debug.connectMockDevice')"
            :disabled="simulatedConnected"
            @click="connectSimulatedDevice"
          />
        </div>

        <div class="status-grid">
          <div class="status-card">
            <span class="status-label">{{ $t('ui.debug.debugMode') }}</span>
            <span :class="['status-value', debugEnabled ? 'active' : 'inactive']">
              {{ debugEnabled ? $t('ui.debug.enabled') : $t('ui.debug.disabled') }}
            </span>
          </div>
          <div class="status-card">
            <span class="status-label">{{ $t('ui.debug.currentSession') }}</span>
            <span :class="['status-value', simulatedConnected ? 'active' : 'inactive']">
              {{ simulatedConnected ? $t('ui.debug.simulatedConnected') : $t('ui.debug.disconnected') }}
            </span>
          </div>
          <div class="status-card">
            <span class="status-label">{{ $t('ui.debug.currentPlatform') }}</span>
            <span class="status-value">{{ currentPlatformLabel }}</span>
          </div>
          <div class="status-card">
            <span class="status-label">{{ $t('ui.debug.customResources') }}</span>
            <span class="status-value">{{ configuredResourceCountLabel }}</span>
          </div>
        </div>
      </section>

      <section class="debug-section">
        <h4>{{ $t('ui.debug.behaviorSettings') }}</h4>

        <label class="debug-switch">
          <input
            v-model="debugEnabled"
            type="checkbox"
            @change="onDebugToggle"
          >
          <span class="slider">{{ $t('ui.debug.enableDebugMode') }}</span>
        </label>

        <div
          v-if="debugEnabled"
          class="control-stack"
        >
          <div class="debug-control">
            <div class="control-head">
              <label>{{ $t('ui.debug.delayTime') }}</label>
              <span class="debug-value">{{ simulatedDelay }}ms</span>
            </div>
            <input
              v-model.number="simulatedDelay"
              type="range"
              min="0"
              max="3000"
              step="50"
              @change="updateDelay"
            >
            <div class="preset-row">
              <button
                v-for="preset in delayPresets"
                :key="preset"
                type="button"
                class="preset-chip"
                :class="{ 'preset-chip--active': simulatedDelay === preset }"
                @click="applyDelayPreset(preset)"
              >
                {{ preset }}ms
              </button>
            </div>
          </div>

          <div class="debug-control">
            <div class="control-head">
              <label>{{ $t('ui.debug.readSpeed') }}</label>
              <span class="debug-value">{{ simulatedReadSpeedKiB }} KiB/s</span>
            </div>
            <input
              v-model.number="simulatedReadSpeedKiB"
              type="range"
              min="32"
              max="4096"
              step="32"
              @change="updateReadSpeed"
            >
          </div>

          <div class="debug-control">
            <div class="control-head">
              <label>{{ $t('ui.debug.writeSpeed') }}</label>
              <span class="debug-value">{{ simulatedWriteSpeedKiB }} KiB/s</span>
            </div>
            <input
              v-model.number="simulatedWriteSpeedKiB"
              type="range"
              min="32"
              max="4096"
              step="32"
              @change="updateWriteSpeed"
            >
          </div>

          <div class="debug-control">
            <label class="debug-switch">
              <input
                v-model="simulateErrors"
                type="checkbox"
                @change="updateErrorSimulation"
              >
              <span class="slider">{{ $t('ui.debug.simulateErrors') }}</span>
            </label>
          </div>

          <div
            v-if="simulateErrors"
            class="debug-control"
          >
            <div class="control-head">
              <label>{{ $t('ui.debug.errorProbability') }}</label>
              <span class="debug-value">{{ (errorProbability * 100).toFixed(0) }}%</span>
            </div>
            <input
              v-model.number="errorProbability"
              type="range"
              min="0"
              max="1"
              step="0.05"
              @change="updateErrorProbability"
            >
          </div>
        </div>
      </section>

      <section class="debug-section">
        <div class="section-title-row">
          <h4>{{ $t('ui.debug.simulationData') }}</h4>
          <span class="section-subtitle">{{ $t('ui.debug.appliesNextSession') }}</span>
        </div>

        <div class="memory-grid">
          <article
            v-for="slot in memorySlots"
            :key="slot.slot"
            class="memory-card"
          >
            <div class="memory-card__head">
              <div>
                <div class="memory-card__title">
                  {{ $t(slot.label) }}
                </div>
                <div class="memory-card__meta">
                  {{ $t('ui.debug.capacity') }}: {{ slot.capacityLabel }}
                </div>
              </div>
              <span
                class="memory-badge"
                :class="slot.image ? 'memory-badge--custom' : 'memory-badge--default'"
              >
                {{ slot.image ? $t('ui.debug.customImage') : $t('ui.debug.defaultImage') }}
              </span>
            </div>

            <div class="memory-card__body">
              <template v-if="slot.image">
                <div class="memory-line">
                  <span>{{ slot.image.fileName }}</span>
                </div>
                <div class="memory-line memory-line--muted">
                  {{ formatBytes(slot.image.size) }} / {{ slot.capacityLabel }}
                </div>
              </template>
              <template v-else>
                <div class="memory-line memory-line--muted">
                  {{ $t('ui.debug.noCustomImage') }}
                </div>
              </template>
            </div>

            <div class="memory-card__actions">
              <input
                :ref="el => setFileInputRef(slot.slot, el as HTMLInputElement | null)"
                type="file"
                class="hidden-file-input"
                @change="event => onMemoryFileSelected(slot.slot, event)"
              >
              <BaseButton
                variant="debug"
                size="sm"
                :text="$t('ui.debug.uploadImage')"
                @click="openFilePicker(slot.slot)"
              />
              <BaseButton
                variant="secondary"
                size="sm"
                :text="$t('ui.debug.clearImage')"
                :disabled="!slot.image"
                @click="clearMemorySlot(slot.slot)"
              />
            </div>
          </article>
        </div>
      </section>

      <section class="debug-section">
        <h4>{{ $t('ui.debug.sessionActions') }}</h4>
        <div class="debug-buttons debug-buttons--wide">
          <BaseButton
            variant="secondary"
            size="sm"
            :text="$t('ui.debug.refreshSimulatedSession')"
            :disabled="!simulatedConnected"
            @click="refreshSimulatedSession"
          />
          <BaseButton
            variant="debug"
            size="sm"
            :text="$t('ui.debug.generateTestRom')"
            @click="generateTestRom"
          />
          <BaseButton
            variant="debug"
            size="sm"
            :text="$t('ui.debug.generateTestRam')"
            @click="generateTestRam"
          />
          <BaseButton
            variant="secondary"
            size="sm"
            :text="$t('ui.debug.clearMockData')"
            @click="clearSimulatedData"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { chevronBackOutline, chevronForwardOutline, closeOutline, constructOutline } from 'ionicons/icons';
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseButton from '@/components/common/BaseButton.vue';
import {
  DebugSettings,
  type SimulatedMemorySlot,
} from '@/settings/debug-settings';
import type { DeviceInfo } from '@/types/device-info';
import { formatBytes } from '@/utils/formatter-utils';
import { GBA_NINTENDO_LOGO } from '@/utils/parsers/rom-parser';

const PANEL_MARGIN = 16;
const PANEL_WIDTH = 420;
const PANEL_COLLAPSED_WIDTH = 56;
const PANEL_EDGE_SNAP_THRESHOLD = 72;
const PANEL_LAYOUT_STORAGE_KEY = 'chisflash:debug-panel-layout:v1';

type DockSide = 'left' | 'right' | null;
type CollapseReason = 'manual' | 'docked' | null;

interface PanelLayoutState {
  x: number;
  y: number;
  dockSide: DockSide;
  collapseReason: CollapseReason;
}

const props = defineProps<{
  device?: DeviceInfo | null;
  deviceReady?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  'connect-simulated-device': [];
  'clear-simulated-data': [];
  'refresh-simulated-device': [];
}>();

const { t } = useI18n();

const panelRef = ref<HTMLElement | null>(null);
const showDebugPanel = ref(false);
const debugEnabled = ref(false);
const simulatedDelay = ref(1000);
const simulateErrors = ref(false);
const errorProbability = ref(0.1);
const simulatedReadSpeedKiB = ref(512);
const simulatedWriteSpeedKiB = ref(512);
const stateVersion = ref(0);
const fileInputs = new Map<SimulatedMemorySlot, HTMLInputElement>();
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1440);
const viewportHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 900);
const panelPosition = ref({ x: PANEL_MARGIN, y: PANEL_MARGIN });
const dockSide = ref<DockSide>('left');
const collapseReason = ref<CollapseReason>(null);
const isDragging = ref(false);

const dragPointerId = ref<number | null>(null);
const dragOffset = ref({ x: 0, y: 0 });

const delayPresets = [0, 100, 300, 1000];

const isCollapsed = computed(() => collapseReason.value !== null);

const currentPanelWidth = computed(() => {
  const targetWidth = isCollapsed.value ? PANEL_COLLAPSED_WIDTH : PANEL_WIDTH;
  return Math.max(56, Math.min(targetWidth, viewportWidth.value - PANEL_MARGIN * 2));
});

const panelStyle = computed(() => ({
  left: `${panelPosition.value.x}px`,
  top: `${panelPosition.value.y}px`,
  width: `${currentPanelWidth.value}px`,
  maxHeight: `${Math.max(120, viewportHeight.value - PANEL_MARGIN * 2)}px`,
}));

const currentPlatformLabel = computed(() => {
  if (!props.deviceReady || !props.device?.serialHandle?.platform) {
    return 'none';
  }

  return props.device.serialHandle.platform;
});

const simulatedConnected = computed(() => {
  return props.deviceReady && props.device?.serialHandle?.platform === 'simulated';
});

const configuredResourceCountLabel = computed(() => {
  void stateVersion.value;
  const count = DebugSettings.countConfiguredSimulatedMemoryImages();
  return `${count}/${DebugSettings.getSimulatedMemorySlots().length}`;
});

const memorySlots = computed(() => {
  void stateVersion.value;
  return DebugSettings.getSimulatedMemorySlots().map((slot) => {
    const definition = DebugSettings.getSimulatedMemoryDefinition(slot);
    const image = DebugSettings.getSimulatedMemoryImageSummary(slot);

    return {
      slot,
      label: definition.labelKey,
      capacityLabel: formatBytes(definition.capacity),
      image,
    };
  });
});

const collapseActionIcon = computed(() => {
  const targetSide = dockSide.value ?? inferNearestDockSide();
  if (isCollapsed.value) {
    return targetSide === 'right' ? chevronBackOutline : chevronForwardOutline;
  }

  return targetSide === 'right' ? chevronForwardOutline : chevronBackOutline;
});

const collapseActionTitle = computed(() => {
  return isCollapsed.value ? t('ui.debug.expandPanel') : t('ui.debug.collapsePanel');
});

onMounted(() => {
  showDebugPanel.value = DebugSettings.showDebugPanel || import.meta.env.DEV;
  syncConfig();
  restorePanelLayout();
  updateViewportSize();
  window.addEventListener('resize', handleViewportResize);
  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
  window.addEventListener('pointercancel', handlePointerUp);
  void nextTick(() => {
    normalizePanelWithinViewport();
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleViewportResize);
  window.removeEventListener('pointermove', handlePointerMove);
  window.removeEventListener('pointerup', handlePointerUp);
  window.removeEventListener('pointercancel', handlePointerUp);
});

function getPanelHeight(): number {
  return panelRef.value?.offsetHeight ?? (isCollapsed.value ? 180 : 640);
}

function getPanelWidth(): number {
  return panelRef.value?.offsetWidth ?? currentPanelWidth.value;
}

function updateViewportSize(): void {
  viewportWidth.value = window.innerWidth;
  viewportHeight.value = window.innerHeight;
}

function clampPanelPosition(
  x: number,
  y: number,
  width = currentPanelWidth.value,
  allowEdgeDock = false,
): { x: number; y: number } {
  const height = getPanelHeight();
  const horizontalMargin = allowEdgeDock ? 0 : PANEL_MARGIN;
  const minX = horizontalMargin;
  const maxX = Math.max(minX, viewportWidth.value - width - horizontalMargin);
  const maxY = Math.max(PANEL_MARGIN, viewportHeight.value - height - PANEL_MARGIN);

  return {
    x: Math.min(Math.max(minX, x), maxX),
    y: Math.min(Math.max(PANEL_MARGIN, y), maxY),
  };
}

function inferNearestDockSide(): Exclude<DockSide, null> {
  const panelCenter = panelPosition.value.x + (getPanelWidth() / 2);
  return panelCenter >= viewportWidth.value / 2 ? 'right' : 'left';
}

function applyDockedPosition(): void {
  const width = currentPanelWidth.value;
  if (dockSide.value === 'left') {
    panelPosition.value = clampPanelPosition(0, panelPosition.value.y, width, true);
  } else if (dockSide.value === 'right') {
    panelPosition.value = clampPanelPosition(viewportWidth.value - width, panelPosition.value.y, width, true);
  } else {
    panelPosition.value = clampPanelPosition(panelPosition.value.x, panelPosition.value.y, width);
  }
}

function normalizePanelWithinViewport(): void {
  applyDockedPosition();
  persistPanelLayout();
}

function persistPanelLayout(): void {
  try {
    const layout: PanelLayoutState = {
      x: panelPosition.value.x,
      y: panelPosition.value.y,
      dockSide: dockSide.value,
      collapseReason: collapseReason.value,
    };
    window.localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Ignore storage failures in restricted environments.
  }
}

function restorePanelLayout(): void {
  try {
    const raw = window.localStorage.getItem(PANEL_LAYOUT_STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw) as Partial<PanelLayoutState>;
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      panelPosition.value = { x: parsed.x, y: parsed.y };
    }
    if (parsed.dockSide === 'left' || parsed.dockSide === 'right') {
      dockSide.value = parsed.dockSide;
    } else {
      dockSide.value = null;
    }
    if (parsed.collapseReason === 'manual' || parsed.collapseReason === 'docked') {
      collapseReason.value = parsed.collapseReason;
    } else {
      collapseReason.value = null;
    }
  } catch {
    panelPosition.value = { x: PANEL_MARGIN, y: PANEL_MARGIN };
    dockSide.value = 'left';
    collapseReason.value = null;
  }
}

function handleViewportResize(): void {
  updateViewportSize();
  void nextTick(() => {
    normalizePanelWithinViewport();
  });
}

function beginDrag(event: PointerEvent): void {
  if (event.button !== 0) {
    return;
  }

  const target = event.target as HTMLElement | null;
  if (target?.closest('.panel-icon-button')) {
    return;
  }

  dragPointerId.value = event.pointerId;
  dragOffset.value = {
    x: event.clientX - panelPosition.value.x,
    y: event.clientY - panelPosition.value.y,
  };
  isDragging.value = true;
  dockSide.value = null;
  event.preventDefault();
}

function handlePointerMove(event: PointerEvent): void {
  if (!isDragging.value || dragPointerId.value !== event.pointerId) {
    return;
  }

  panelPosition.value = clampPanelPosition(
    event.clientX - dragOffset.value.x,
    event.clientY - dragOffset.value.y,
  );
}

function handlePointerUp(event: PointerEvent): void {
  if (!isDragging.value || dragPointerId.value !== event.pointerId) {
    return;
  }

  isDragging.value = false;
  dragPointerId.value = null;

  const width = getPanelWidth();
  const nearLeftEdge = panelPosition.value.x <= PANEL_MARGIN + PANEL_EDGE_SNAP_THRESHOLD;
  const nearRightEdge = panelPosition.value.x + width >= viewportWidth.value - PANEL_MARGIN - PANEL_EDGE_SNAP_THRESHOLD;

  if (nearLeftEdge || nearRightEdge) {
    dockSide.value = nearLeftEdge ? 'left' : 'right';
    collapseReason.value = 'docked';
  } else {
    dockSide.value = null;
    if (collapseReason.value === 'docked') {
      collapseReason.value = null;
    }
  }

  void nextTick(() => {
    normalizePanelWithinViewport();
  });
}

function togglePanelCollapsed(): void {
  if (isCollapsed.value) {
    collapseReason.value = null;
  } else {
    collapseReason.value = 'manual';
    dockSide.value = dockSide.value ?? inferNearestDockSide();
  }

  void nextTick(() => {
    normalizePanelWithinViewport();
  });
}

function handleClose(): void {
  emit('close');
}

function bumpStateVersion(): void {
  stateVersion.value += 1;
}

function syncConfig(): void {
  debugEnabled.value = DebugSettings.debugMode;
  simulatedDelay.value = DebugSettings.simulatedDelay;
  simulateErrors.value = DebugSettings.simulateErrors;
  errorProbability.value = DebugSettings.errorProbability;
  simulatedReadSpeedKiB.value = Math.round(DebugSettings.simulatedReadSpeed / 1024);
  simulatedWriteSpeedKiB.value = Math.round(DebugSettings.simulatedWriteSpeed / 1024);
  bumpStateVersion();
}

function onDebugToggle(): void {
  DebugSettings.debugMode = debugEnabled.value;
  bumpStateVersion();
}

function updateDelay(): void {
  DebugSettings.simulatedDelay = simulatedDelay.value;
  bumpStateVersion();
}

function applyDelayPreset(preset: number): void {
  simulatedDelay.value = preset;
  updateDelay();
}

function updateErrorSimulation(): void {
  DebugSettings.simulateErrors = simulateErrors.value;
  bumpStateVersion();
}

function updateErrorProbability(): void {
  DebugSettings.errorProbability = errorProbability.value;
  bumpStateVersion();
}

function updateReadSpeed(): void {
  DebugSettings.simulatedReadSpeed = simulatedReadSpeedKiB.value * 1024;
  simulatedReadSpeedKiB.value = Math.round(DebugSettings.simulatedReadSpeed / 1024);
  bumpStateVersion();
}

function updateWriteSpeed(): void {
  DebugSettings.simulatedWriteSpeed = simulatedWriteSpeedKiB.value * 1024;
  simulatedWriteSpeedKiB.value = Math.round(DebugSettings.simulatedWriteSpeed / 1024);
  bumpStateVersion();
}

function setFileInputRef(slot: SimulatedMemorySlot, element: HTMLInputElement | null): void {
  if (element) {
    fileInputs.set(slot, element);
  } else {
    fileInputs.delete(slot);
  }
}

function openFilePicker(slot: SimulatedMemorySlot): void {
  fileInputs.get(slot)?.click();
}

async function onMemoryFileSelected(slot: SimulatedMemorySlot, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) {
    return;
  }

  const buffer = await file.arrayBuffer();
  DebugSettings.setSimulatedMemoryImage(slot, new Uint8Array(buffer), file.name);
  syncConfig();
  input.value = '';

  if (simulatedConnected.value) {
    emit('refresh-simulated-device');
  }
}

function clearMemorySlot(slot: SimulatedMemorySlot): void {
  DebugSettings.clearSimulatedMemoryImage(slot);
  syncConfig();

  if (simulatedConnected.value) {
    emit('refresh-simulated-device');
  }
}

function connectSimulatedDevice(): void {
  DebugSettings.debugMode = true;
  syncConfig();
  emit('connect-simulated-device');
}

function refreshSimulatedSession(): void {
  emit('refresh-simulated-device');
}

function clearSimulatedData(): void {
  DebugSettings.clearAllSimulatedMemoryImages();
  syncConfig();
  emit('clear-simulated-data');
}

function generateTestRom(): void {
  const romSize = 0x200000;
  const romData = new Uint8Array(romSize);
  const randomData = DebugSettings.generateRandomData(romSize);
  romData.set(randomData);

  const encoder = new TextEncoder();
  romData[0x00] = 0x00;
  romData[0x01] = 0x00;
  romData[0x02] = 0x00;
  romData[0x03] = 0xEA;
  romData.set(GBA_NINTENDO_LOGO, 0x04);
  romData.set(encoder.encode('TEST ROM    '.substring(0, 12)), 0xA0);
  romData.set(encoder.encode('TESJ'), 0xAC);
  romData.set(encoder.encode('01'), 0xB0);
  romData[0xB2] = 0x96;
  romData[0xBC] = 0x01;

  let headerSum = 0;
  for (let i = 0xA0; i <= 0xBC; i += 1) {
    headerSum += romData[i];
  }
  romData[0xBD] = (-(headerSum + 0x19)) & 0xFF;

  const blob = new Blob([romData], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'test_rom.gba';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function generateTestRam(): void {
  const testData = DebugSettings.generateRandomData(0x8000);
  const blob = new Blob([testData as BlobPart], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'test_ram.sav';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
</script>

<style scoped>
.debug-panel {
  position: fixed;
  background: rgba(255, 251, 245, 0.96);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(209, 157, 52, 0.35);
  border-radius: var(--radius-xl);
  box-shadow: 0 20px 60px rgba(67, 48, 20, 0.18);
  z-index: 1000;
  color: var(--color-text);
  overflow: hidden;
  transition:
    width 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.debug-panel--dragging {
  box-shadow: 0 28px 72px rgba(67, 48, 20, 0.24);
}

.debug-panel--collapsed {
  border-color: rgba(180, 97, 25, 0.35);
}

.debug-panel--collapsed .debug-header {
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  gap: 6px;
  padding: 10px 8px;
}

.debug-panel--docked-left {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.debug-panel--docked-right {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.35), transparent 45%),
    linear-gradient(135deg, #f6b84c 0%, #e47b32 100%);
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.debug-panel--dragging .debug-header {
  cursor: grabbing;
}

.debug-header__main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  width: 100%;
  min-width: 0;
}

.debug-header__collapsed {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.94);
}

.debug-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  min-width: 0;
  font-size: var(--font-size-base);
  color: #fff;
}

.debug-title__icon,
.debug-header__icon {
  font-size: 1.1em;
  flex-shrink: 0;
  color: currentColor;
}

.collapsed-label {
  font-size: var(--font-size-xs);
  color: rgba(255, 255, 255, 0.94);
  letter-spacing: 0.08em;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.collapsed-status {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.2);
}

.collapsed-status--active {
  background: #27ae60;
}

.collapsed-status--idle {
  background: rgba(255, 255, 255, 0.35);
}

.status-pill {
  border-radius: 999px;
  padding: 6px 10px;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  white-space: nowrap;
}

.status-pill--active {
  background: rgba(39, 174, 96, 0.22);
}

.status-pill--idle {
  background: rgba(0, 0, 0, 0.12);
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.debug-panel--collapsed .panel-actions {
  flex-direction: column;
  width: 100%;
  align-items: center;
  justify-content: center;
}

.panel-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.panel-icon-button:hover {
  background: rgba(255, 255, 255, 0.28);
  transform: translateY(-1px);
}

.debug-content {
  padding: var(--space-4);
  overflow-y: auto;
  max-height: calc(100vh - 140px);
  background: linear-gradient(180deg, rgba(255, 248, 239, 0.96) 0%, rgba(250, 250, 248, 0.98) 100%);
}

.debug-section {
  margin-bottom: var(--space-5);
}

.debug-section:last-child {
  margin-bottom: 0;
}

.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.section-subtitle {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.debug-section h4 {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text);
  font-weight: var(--font-weight-semibold);
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.status-card {
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(214, 214, 214, 0.8);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.status-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.status-value {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.status-value.active {
  color: var(--color-success);
}

.status-value.inactive {
  color: var(--color-text-secondary);
}

.control-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.debug-switch {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}

.debug-control {
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(214, 214, 214, 0.8);
}

.control-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.debug-control label {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}

.debug-control input[type='range'] {
  width: 100%;
}

.debug-value {
  font-size: var(--font-size-xs);
  color: #b46119;
  font-weight: var(--font-weight-semibold);
}

.preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.preset-chip {
  border: 1px solid rgba(180, 97, 25, 0.18);
  background: rgba(246, 184, 76, 0.12);
  color: #8d4d17;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: var(--font-size-xs);
  cursor: pointer;
}

.preset-chip--active {
  background: #e47b32;
  color: #fff;
  border-color: #e47b32;
}

.memory-grid {
  display: grid;
  gap: var(--space-3);
}

.memory-card {
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(214, 214, 214, 0.8);
}

.memory-card__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.memory-card__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.memory-card__meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.memory-badge {
  border-radius: 999px;
  padding: 4px 8px;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.memory-badge--custom {
  background: rgba(39, 174, 96, 0.16);
  color: var(--color-success);
}

.memory-badge--default {
  background: rgba(120, 120, 120, 0.12);
  color: var(--color-text-secondary);
}

.memory-card__body {
  margin-bottom: var(--space-3);
}

.memory-line {
  font-size: var(--font-size-xs);
  color: var(--color-text);
}

.memory-line--muted {
  color: var(--color-text-secondary);
}

.memory-card__actions,
.debug-buttons {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.debug-buttons--wide {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.hidden-file-input {
  display: none;
}

@media (max-width: 720px) {
  .status-grid,
  .debug-buttons,
  .debug-buttons--wide {
    grid-template-columns: 1fr;
  }

  .debug-panel:not(.debug-panel--collapsed) {
    width: calc(100vw - 32px) !important;
  }
}
</style>
