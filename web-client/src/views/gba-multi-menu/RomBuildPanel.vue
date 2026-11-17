<template>
  <div class="build-sidebar">
    <!-- 配置面板 -->
    <RetroCard
      :title="$t('ui.gbaMultiMenu.configuration')"
      class="config-card"
    >
      <template #header-right>
        <span class="header-badge">{{ $t('ui.gbaMultiMenu.basicSettings') }}</span>
      </template>

      <div class="form-stack">
        <div class="form-field">
          <label for="cartridgeType">{{ $t('ui.gbaMultiMenu.cartridgeType') }}</label>
          <RetroSelect
            id="cartridgeType"
            v-model="cartridgeType"
            size="md"
            full-width
          >
            <option value="1">
              1. MSP55LV100S (64MB)
            </option>
            <option value="2">
              2. 6600M0U0BE (256MB)
            </option>
            <option value="3">
              3. MSP54LV100 (128MB)
            </option>
            <option value="4">
              4. F0095H0 (512MB)
            </option>
            <option value="5">
              5. ChisFlash 1.0G (128MB)
            </option>
          </RetroSelect>
        </div>

        <div class="form-field">
          <label for="outputName">{{ $t('ui.gbaMultiMenu.outputName') }}</label>
          <input
            id="outputName"
            v-model="outputName"
            type="text"
            class="retro-input mono-input"
          >
        </div>

        <label class="checkbox-row">
          <input
            v-model="batteryPresent"
            type="checkbox"
            class="retro-checkbox"
          >
          <span>{{ $t('ui.gbaMultiMenu.batterySupport') }}</span>
        </label>
      </div>

      <div class="section-divider" />

      <div class="sub-header">
        <h4>{{ $t('ui.gbaMultiMenu.fileSettings') }}</h4>
      </div>

      <div class="file-rows">
        <!-- 菜单ROM -->
        <div class="file-row">
          <div class="file-row-top">
            <span class="file-row-label">{{ $t('ui.gbaMultiMenu.menuRom') }}</span>
            <input
              ref="menuRomInput"
              type="file"
              accept=".gba"
              style="display: none"
              @change="handleMenuRomChange"
            >
            <RetroButton
              size="xs"
              variant="secondary"
              icon="pixelarticons:file-alt"
              :text="$t('ui.file.browse')"
              @click="() => menuRomInput?.click()"
            />
          </div>
          <div
            v-if="menuRomData"
            class="file-meta-pill"
            :title="menuRomFileName"
          >
            <span class="file-meta-name">{{ menuRomFileName }}</span>
            <span class="file-meta-size">{{ formatFileSize(menuRomData.byteLength) }}</span>
          </div>
          <div
            v-else
            class="file-meta-empty"
          >
            {{ $t('ui.gbaMultiMenu.noFileSelected') }}
          </div>
        </div>

        <!-- 背景图片 -->
        <div class="file-row">
          <div class="file-row-top">
            <span class="file-row-label">{{ $t('ui.gbaMultiMenu.backgroundImage') }}</span>
            <input
              ref="bgImageInput"
              type="file"
              accept=".png,.jpg,.jpeg"
              style="display: none"
              @change="handleBgImageChange"
            >
            <RetroButton
              size="xs"
              variant="secondary"
              icon="pixelarticons:image"
              :text="$t('ui.file.browse')"
              @click="() => bgImageInput?.click()"
            />
          </div>
          <div
            v-if="bgImageData"
            class="file-meta-pill preview-trigger"
            :title="bgImageFileName"
            @mouseenter="showBgImagePreviewHandler"
            @mouseleave="hideBgImagePreviewHandler"
          >
            <span class="file-meta-name">
              {{ bgImageFileName === 'bg.png' ? `${bgImageFileName} (默认)` : bgImageFileName }}
            </span>
            <span class="file-meta-size">{{ formatFileSize(bgImageData.byteLength) }}</span>
          </div>
          <div
            v-else
            class="file-meta-empty"
          >
            {{ $t('ui.gbaMultiMenu.noFileSelected') }}
          </div>
        </div>
      </div>
    </RetroCard>

    <!-- 构建动作 -->
    <RetroCard class="action-card">
      <div class="action-stack">
        <RetroButton
          variant="primary"
          size="md"
          block
          icon="pixelarticons:sliders"
          :disabled="!canBuild"
          @click="buildRom"
        >
          {{ isLoadingLibrary ? $t('ui.gbaMultiMenu.loadingLibrary') : $t('ui.gbaMultiMenu.buildRom') }}
        </RetroButton>

        <!-- 构建结果 -->
        <div
          v-if="buildResult"
          class="result-block"
        >
          <div class="result-meta">
            <span class="result-badge">{{ $t('ui.gbaMultiMenu.buildSuccess') }}</span>
            <span class="result-specs">
              {{ formatFileSize(buildResult.rom.byteLength) }} · {{ buildResult.code }}
            </span>
          </div>
          <div class="result-actions">
            <RetroButton
              variant="secondary"
              size="md"
              block
              icon="pixelarticons:download"
              :text="$t('ui.gbaMultiMenu.downloadRom')"
              @click="downloadRom"
            />
            <RetroButton
              variant="primary"
              size="md"
              block
              icon="pixelarticons:save"
              :text="$t('ui.gbaMultiMenu.applyRom')"
              @click="applyRom"
            />
          </div>
        </div>
      </div>
    </RetroCard>

    <!-- 背景图像预览 -->
    <div
      v-if="showBgImagePreview && bgImagePreviewUrl"
      class="bg-image-preview-overlay"
    >
      <RetroCard padding="md">
        <div class="preview-images-container">
          <div class="preview-item">
            <h6>{{ $t('ui.gbaMultiMenu.originalImage') }}</h6>
            <div
              v-if="bgImageDimensions"
              class="image-dimensions"
            >
              {{ bgImageDimensions.width }} × {{ bgImageDimensions.height }}
            </div>
            <img
              :src="bgImagePreviewUrl"
              :alt="$t('ui.gbaMultiMenu.originalImage')"
              class="preview-thumbnail"
            >
          </div>
          <div class="preview-item">
            <h6>{{ $t('ui.gbaMultiMenu.processedImage') }}</h6>
            <div class="image-dimensions">
              240 × 160
            </div>
            <img
              v-if="processedBgImagePreviewUrl"
              :src="processedBgImagePreviewUrl"
              :alt="$t('ui.gbaMultiMenu.processedImage')"
              class="preview-thumbnail"
            >
          </div>
        </div>
      </RetroCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import { RetroButton, RetroCard, RetroSelect } from '@/components/retro';
import { useMultiMenu } from '@/composables/useMultiMenuState';

const {
  menuRomData,
  menuRomFileName,
  bgImageData,
  bgImageFileName,
  cartridgeType,
  batteryPresent,
  outputName,
  isLoadingLibrary,
  canBuild,
  buildResult,
  showBgImagePreview,
  bgImagePreviewUrl,
  processedBgImagePreviewUrl,
  bgImageDimensions,
  processMenuRomFile,
  processBgImageFile,
  showBgImagePreviewHandler,
  hideBgImagePreviewHandler,
  buildRom,
  downloadRom,
  applyRom,
  formatFileSize,
} = useMultiMenu();

const menuRomInput = ref<HTMLInputElement>();
const bgImageInput = ref<HTMLInputElement>();

function handleMenuRomChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (files && files.length > 0) {
    const file = files[0];
    if (file.name.toLowerCase().endsWith('.gba')) {
      void processMenuRomFile(file);
    }
  }
}

function handleBgImageChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (files && files.length > 0) {
    const file = files[0];
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
      void processBgImageFile(file);
    }
  }
}
</script>

<style scoped>
.build-sidebar {
  display: contents;
}

.config-card {
  grid-column: 1;
  grid-row: 1;
}

.action-card {
  grid-column: 1;
  grid-row: 2;
  align-self: start;
}

.header-badge {
  font-family: var(--retro-font-micro);
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid var(--retro-border-subtle);
  background: var(--retro-bg-elevated);
  color: var(--retro-ink-muted);
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-field label {
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  color: var(--retro-ink-muted);
}

.retro-input {
  width: 100%;
  padding: 6px 8px;
  border: 1.5px solid var(--retro-border);
  border-radius: 4px;
  background: var(--retro-bg-surface);
  color: var(--retro-ink);
  font-family: var(--retro-font-micro);
  font-size: 10px;
  line-height: 1.3;
  transition: box-shadow 0.12s ease;
}

.mono-input {
  font-family: var(--retro-font-mono);
}

.retro-input:focus {
  outline: none;
  box-shadow: var(--retro-shadow-btn);
}

.checkbox-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
  font-family: var(--retro-font-micro);
  font-size: 10px;
  font-weight: var(--font-weight-medium);
  color: var(--retro-ink);
  cursor: pointer;
}

.retro-checkbox {
  width: 15px;
  height: 15px;
  accent-color: var(--retro-ink);
  cursor: pointer;
}

.section-divider {
  height: 1px;
  background: var(--retro-divider);
  margin: var(--space-3) 0;
}

.sub-header {
  margin-bottom: var(--space-2);
}

.sub-header h4 {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  color: var(--retro-ink);
}

.file-rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.file-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 7px 8px;
  border: 1px solid var(--retro-border-subtle);
  border-radius: 4px;
  background: var(--retro-bg-surface);
}

.file-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.file-row-label {
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  color: var(--retro-ink);
}

.file-meta-pill {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-family: var(--retro-font-micro);
  font-size: 10px;
  color: var(--retro-ink);
}

.file-meta-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-meta-size {
  flex-shrink: 0;
  color: var(--retro-ink-muted);
}

.file-meta-empty {
  font-family: var(--retro-font-micro);
  font-size: 10px;
  color: var(--retro-ink-subtle);
}

.preview-trigger {
  cursor: help;
  text-decoration: underline dotted var(--retro-ink-subtle);
}

.action-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.result-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: var(--space-2);
  border-top: 1px dashed var(--retro-border-dashed);
}

.result-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.result-badge {
  font-family: var(--retro-font-micro);
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--retro-success-bg);
  border: 1px solid var(--retro-border);
  color: var(--retro-ink);
}

.result-specs {
  font-family: var(--retro-font-micro);
  font-size: 10px;
  color: var(--retro-ink-muted);
}

.result-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.bg-image-preview-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 9999;
}

.preview-images-container {
  display: flex;
  gap: var(--space-4);
}

.preview-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.preview-item h6 {
  margin: 0;
  font-family: var(--retro-font-micro);
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  color: var(--retro-ink);
}

.image-dimensions {
  font-family: var(--retro-font-micro);
  font-size: 10px;
  color: var(--retro-ink-muted);
}

.preview-thumbnail {
  max-width: 240px;
  max-height: 160px;
  border: 1.5px solid var(--retro-border);
  border-radius: 4px;
  image-rendering: pixelated;
}
</style>
