<template>
  <div
    v-if="showDebugPanel"
    ref="panelRef"
    class="debug-panel"
    :class="{
      'debug-panel--dragging': isDragging,
    }"
    :style="panelStyle"
  >
    <div
      class="debug-header"
      @pointerdown="beginDrag"
    >
      <div class="debug-header__main">
        <h3 class="debug-title">
          <RetroIcon
            icon="pixelarticons:sliders"
            class="debug-title__icon"
          />
          {{ $t('ui.debug.panel') }}
        </h3>
        <RetroSwitch
          v-model="debugEnabled"
          :tooltip="$t('ui.debug.enableDebugMode')"
          @pointerdown.stop
          @update:model-value="onDebugToggle"
        />
      </div>

      <div class="panel-actions">
        <button
          type="button"
          class="panel-icon-button"
          :title="$t('ui.common.close')"
          @click.stop="handleClose"
        >
          <RetroIcon icon="pixelarticons:close" />
        </button>
      </div>
    </div>

    <div class="debug-content">
      <section class="debug-section">
        <div class="section-title-row">
          <h4>{{ $t('ui.debug.sessionStatus') }}</h4>
          <RetroButton
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

      <section
        v-if="debugEnabled"
        class="debug-section"
      >
        <h4>{{ $t('ui.debug.behaviorSettings') }}</h4>

        <div class="control-stack">
          <div class="debug-control debug-control--wide">
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

          <div class="debug-control debug-control--wide">
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
            class="debug-control debug-control--wide"
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
          <div
            class="memory-platform-tabs"
            role="tablist"
            aria-label="Simulated memory platform"
          >
            <button
              type="button"
              role="tab"
              class="memory-platform-tab"
              :class="{ 'is-active': activeMemoryPlatform === 'gba' }"
              :aria-selected="activeMemoryPlatform === 'gba'"
              @click="activeMemoryPlatform = 'gba'"
            >
              GBA
            </button>
            <button
              type="button"
              role="tab"
              class="memory-platform-tab"
              :class="{ 'is-active': activeMemoryPlatform === 'gbc' }"
              :aria-selected="activeMemoryPlatform === 'gbc'"
              @click="activeMemoryPlatform = 'gbc'"
            >
              GBC
            </button>
          </div>
        </div>

        <div class="memory-grid">
          <article
            v-for="slot in filteredMemorySlots"
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
              <RetroButton
                variant="warning"
                size="sm"
                :text="$t('ui.debug.uploadImage')"
                @click="openFilePicker(slot.slot)"
              />
              <RetroButton
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
          <RetroButton
            variant="secondary"
            size="sm"
            :text="$t('ui.debug.refreshSimulatedSession')"
            :disabled="!simulatedConnected"
            @click="refreshSimulatedSession"
          />
          <RetroButton
            variant="warning"
            size="sm"
            :text="$t('ui.debug.generateTestRom')"
            @click="generateTestRom"
          />
          <RetroButton
            variant="warning"
            size="sm"
            :text="$t('ui.debug.generateTestRam')"
            @click="generateTestRam"
          />
          <RetroButton
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { RetroButton, RetroIcon, RetroSwitch } from '@/components/retro';
import {
  DebugSettings,
  type SimulatedMemorySlot,
} from '@/settings/debug-settings';
import type { DeviceInfo } from '@/types/device-info';
import { formatBytes } from '@/utils/formatter-utils';
import { GBA_NINTENDO_LOGO } from '@/utils/parsers/rom-parser';

const PANEL_MARGIN = 16;
const PANEL_WIDTH = 420;
const PANEL_LAYOUT_STORAGE_KEY = 'chisflash:debug-panel-layout:v2';

interface PanelLayoutState {
  x: number;
  y: number;
}

const props = defineProps<{
  device?: DeviceInfo | null;
  deviceReady?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  'connect-simulated-device': [];
  'disconnect-simulated-device': [];
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
const isDragging = ref(false);

const dragPointerId = ref<number | null>(null);
const dragOffset = ref({ x: 0, y: 0 });

const delayPresets = [0, 100, 300, 1000];

const currentPanelWidth = computed(() => {
  return Math.max(56, Math.min(PANEL_WIDTH, viewportWidth.value - PANEL_MARGIN * 2));
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
  const count = stateVersion.value >= 0 ? DebugSettings.countConfiguredSimulatedMemoryImages() : 0;
  return `${count}/${DebugSettings.getSimulatedMemorySlots().length}`;
});

const activeMemoryPlatform = ref<'gba' | 'gbc'>('gba');

const memorySlots = computed(() => {
  if (stateVersion.value < 0) {
    return [];
  }
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

const filteredMemorySlots = computed(() =>
  memorySlots.value.filter((item) => item.slot.startsWith(activeMemoryPlatform.value)),
);

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
  return panelRef.value?.offsetHeight ?? 640;
}

function updateViewportSize(): void {
  viewportWidth.value = window.innerWidth;
  viewportHeight.value = window.innerHeight;
}

function clampPanelPosition(x: number, y: number, width = currentPanelWidth.value): { x: number; y: number } {
  const height = getPanelHeight();
  const maxX = Math.max(PANEL_MARGIN, viewportWidth.value - width - PANEL_MARGIN);
  const maxY = Math.max(PANEL_MARGIN, viewportHeight.value - height - PANEL_MARGIN);

  return {
    x: Math.min(Math.max(PANEL_MARGIN, x), maxX),
    y: Math.min(Math.max(PANEL_MARGIN, y), maxY),
  };
}

function normalizePanelWithinViewport(): void {
  panelPosition.value = clampPanelPosition(panelPosition.value.x, panelPosition.value.y);
  persistPanelLayout();
}

function persistPanelLayout(): void {
  try {
    const layout: PanelLayoutState = {
      x: panelPosition.value.x,
      y: panelPosition.value.y,
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
  } catch {
    panelPosition.value = { x: PANEL_MARGIN, y: PANEL_MARGIN };
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
  normalizePanelWithinViewport();
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
  if (!debugEnabled.value && simulatedConnected.value) {
    emit('disconnect-simulated-device');
  }
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
  if (simulatedConnected.value) {
    emit('refresh-simulated-device');
  }
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
  background: var(--retro-bg-surface);
  border: 1.5px solid var(--retro-border);
  border-radius: 6px;
  box-shadow: var(--retro-shadow-card);
  z-index: 1000;
  color: var(--retro-ink);
  overflow: hidden;
  transition:
    left 0.18s ease-out,
    top 0.18s ease-out,
    width 0.18s ease-out,
    box-shadow 0.12s ease-out,
    border-color 0.12s ease-out;
}

.debug-panel--dragging {
  transition: none;
  border-color: var(--retro-ink);
  box-shadow: -5px 5px 0 var(--retro-shadow-color);
}

@media (prefers-reduced-motion: reduce) {
  .debug-panel {
    transition: none;
  }
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--retro-bg-elevated);
  border-bottom: 1.5px solid var(--retro-border);
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

.debug-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  min-width: 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--retro-ink);
}

.debug-title__icon {
  font-size: var(--font-size-base);
  flex-shrink: 0;
  color: currentColor;
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.panel-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1.5px solid var(--retro-border);
  border-radius: 3px;
  background: var(--retro-bg-surface);
  color: var(--retro-ink);
  box-shadow: var(--retro-shadow-btn);
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.1s ease, background-color 0.12s ease;
}

.panel-icon-button:hover {
  background: var(--retro-bg-tint);
  transform: translate(-1px, 1px);
  box-shadow: var(--retro-shadow-btn-hover);
}

.debug-content {
  padding: var(--space-3);
  overflow-y: auto;
  max-height: calc(100vh - 140px);
  background: var(--retro-bg-surface);
}

.debug-section {
  margin-bottom: var(--space-3);
}

.debug-section:last-child {
  margin-bottom: 0;
}

.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
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
  padding: 6px var(--space-2);
  border-radius: 6px;
  background: var(--retro-bg-elevated);
  border: 1.5px solid var(--retro-border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.status-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.status-value {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  text-align: right;
}

.status-value.active {
  color: var(--color-success);
}

.status-value.inactive {
  color: var(--color-text-secondary);
}

.control-stack {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.debug-control--wide {
  grid-column: 1 / -1;
}

.debug-switch {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  color: var(--retro-ink);
}

.debug-switch input[type='checkbox'] {
  accent-color: var(--retro-ink);
}

.debug-control {
  padding: var(--space-2);
  border-radius: 6px;
  background: var(--retro-bg-elevated);
  border: 1.5px solid var(--retro-border-subtle);
}

.control-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: 4px;
}

.debug-control label {
  font-size: var(--font-size-xs);
  color: var(--retro-ink-muted);
  font-weight: var(--font-weight-semibold);
}

.debug-control input[type='range'] {
  width: 100%;
  accent-color: var(--retro-ink);
}

.debug-value {
  font-family: var(--retro-font-mono);
  font-size: var(--font-size-xs);
  color: var(--retro-ink);
  font-weight: var(--font-weight-bold);
}

.preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.preset-chip {
  border: 1.5px solid var(--retro-border);
  background: var(--retro-bg-surface);
  color: var(--retro-ink);
  border-radius: 4px;
  padding: 2px 7px;
  font-family: var(--retro-font-mono);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  box-shadow: var(--retro-shadow-btn);
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.1s ease, background-color 0.12s ease;
}

.preset-chip:hover:not(.preset-chip--active) {
  background: var(--retro-bg-tint);
  transform: translate(-1px, 1px);
  box-shadow: var(--retro-shadow-btn-hover);
}

.preset-chip--active {
  background: var(--retro-primary-bg);
  color: var(--retro-primary-fg);
}

.memory-platform-tabs {
  display: inline-flex;
  gap: 4px;
  padding: 2px;
  border-radius: 6px;
  background: var(--retro-bg-elevated);
  border: 1.5px solid var(--retro-border-subtle);
}

.memory-platform-tab {
  padding: 2px 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-secondary);
  font-family: var(--retro-font-micro);
  font-size: var(--font-size-micro);
  font-weight: var(--font-weight-bold);
  cursor: pointer;

  &.is-active {
    background: var(--retro-primary-bg);
    color: var(--retro-primary-fg);
  }
}

.memory-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.memory-card {
  display: flex;
  flex-direction: column;
  padding: var(--space-2);
  border-radius: 6px;
  background: var(--retro-bg-elevated);
  border: 1.5px solid var(--retro-border-subtle);
  min-width: 0;
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
  border-radius: 4px;
  border: 1px solid var(--retro-border);
  padding: 2px 7px;
  font-family: var(--retro-font-micro);
  font-size: var(--font-size-micro);
  font-weight: var(--font-weight-bold);
}

.memory-badge--custom {
  background: var(--retro-success-bg);
  color: var(--retro-ink);
}

.memory-badge--default {
  background: var(--retro-bg-surface);
  color: var(--retro-ink-muted);
}

.memory-card__body {
  flex: 1;
  font-size: var(--font-size-xs);
  line-height: 1.4;
  margin-bottom: var(--space-2);
  min-height: 2.8em;
}

.memory-line {
  font-size: var(--font-size-xs);
  line-height: 1.4;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

  .debug-panel {
    width: calc(100vw - 32px) !important;
  }
}
</style>
