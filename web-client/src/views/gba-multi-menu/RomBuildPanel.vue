<template>
  <!-- 配置选项 -->
  <div class="config-section">
    <h4>{{ $t('ui.gbaMultiMenu.configuration') }}</h4>

    <!-- 基础配置组 -->
    <div class="config-group">
      <h5>{{ $t('ui.gbaMultiMenu.basicSettings') }}</h5>
      <div class="config-grid-row">
        <div class="config-item config-item-flex">
          <label for="cartridgeType">{{ $t('ui.gbaMultiMenu.cartridgeType') }}</label>
          <select
            id="cartridgeType"
            v-model="cartridgeType"
            class="config-select"
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
            <option value="6">
              6. ChisFlash 2.0G (256MB)
            </option>
          </select>
        </div>

        <div class="config-item config-item-flex">
          <label for="outputName">{{ $t('ui.gbaMultiMenu.outputName') }}</label>
          <input
            id="outputName"
            v-model="outputName"
            type="text"
            class="config-input"
          >
        </div>
      </div>

      <div class="config-grid-row config-checkboxes">
        <div class="config-item config-checkbox-item">
          <label class="checkbox-label">
            <input
              v-model="batteryPresent"
              type="checkbox"
              class="config-checkbox"
            >
            {{ $t('ui.gbaMultiMenu.batterySupport') }}
          </label>
        </div>
      </div>
    </div>

    <!-- 文件配置组 -->
    <div class="config-group">
      <h5>{{ $t('ui.gbaMultiMenu.fileSettings') }}</h5>

      <!-- 菜单ROM配置 -->
      <div class="config-item config-file-item">
        <label for="menuRom">{{ $t('ui.gbaMultiMenu.menuRom') }}</label>
        <div class="file-config-row">
          <input
            ref="menuRomInput"
            type="file"
            accept=".gba"
            style="display: none"
            @change="handleMenuRomChange"
          >
          <BaseButton
            variant="primary"
            :icon="documentOutline"
            :text="$t('ui.file.browse')"
            @click="() => menuRomInput?.click()"
          />
          <span
            v-if="menuRomData"
            class="file-info-text"
          >
            {{ menuRomFileName }}
            <span class="file-size-small">({{ formatFileSize(menuRomData.byteLength) }})</span>
          </span>
          <span
            v-else
            class="file-info-text text-muted"
          >
            {{ $t('ui.gbaMultiMenu.noFileSelected') }}
          </span>
        </div>
      </div>

      <!-- 背景图片配置 -->
      <div class="config-item config-file-item">
        <label for="bgImage">{{ $t('ui.gbaMultiMenu.backgroundImage') }}</label>
        <div class="file-config-row">
          <input
            ref="bgImageInput"
            type="file"
            accept=".png,.jpg,.jpeg"
            style="display: none"
            @change="handleBgImageChange"
          >
          <BaseButton
            variant="primary"
            :icon="imageOutline"
            :text="$t('ui.file.browse')"
            @click="() => bgImageInput?.click()"
          />
          <span
            v-if="bgImageData"
            class="file-info-text bg-image-info-inline"
            @mouseenter="showBgImagePreviewHandler"
            @mouseleave="hideBgImagePreviewHandler"
          >
            {{ bgImageFileName === 'bg.png' ? `${bgImageFileName} (默认)` : bgImageFileName }}
            <span class="file-size-small">({{ formatFileSize(bgImageData.byteLength) }})</span>
          </span>
          <span
            v-else
            class="file-info-text text-muted"
          >
            {{ $t('ui.gbaMultiMenu.noFileSelected') }}
          </span>
        </div>
      </div>
    </div>
  </div>

  <!-- 构建按钮 -->
  <div class="action-section">
    <BaseButton
      variant="success"
      :icon="buildOutline"
      :text="isLoadingLibrary ? $t('ui.gbaMultiMenu.loadingLibrary') : $t('ui.gbaMultiMenu.buildRom')"
      :disabled="!canBuild"
      @click="buildRom"
    />
  </div>

  <!-- 下载区域 -->
  <div
    v-if="buildResult"
    class="download-section"
  >
    <h4>{{ $t('ui.gbaMultiMenu.buildSuccess') }}</h4>
    <div class="download-info">
      <p>{{ $t('ui.gbaMultiMenu.romSize') }}: {{ formatFileSize(buildResult.rom.byteLength) }}</p>
      <p>{{ $t('ui.gbaMultiMenu.romCode') }}: {{ buildResult.code }}</p>
    </div>
    <div class="download-actions">
      <BaseButton
        variant="success"
        :icon="downloadOutline"
        :text="$t('ui.gbaMultiMenu.downloadRom')"
        @click="downloadRom"
      />
      <BaseButton
        variant="primary"
        :icon="saveOutline"
        :text="$t('ui.gbaMultiMenu.applyRom')"
        @click="applyRom"
      />
    </div>
  </div>

  <!-- 背景图像预览 -->
  <div
    v-if="showBgImagePreview && bgImagePreviewUrl"
    class="bg-image-preview-overlay"
  >
    <div class="bg-image-preview">
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
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  buildOutline,
  documentOutline,
  downloadOutline,
  imageOutline,
  saveOutline,
} from 'ionicons/icons';
import { ref } from 'vue';

import BaseButton from '@/components/common/BaseButton.vue';
import { useMultiMenu } from '@/composables/useMultiMenuState';

const {
  menuRomData, menuRomFileName,
  bgImageData, bgImageFileName,
  cartridgeType, batteryPresent, outputName,
  isLoadingLibrary, canBuild, buildResult,
  showBgImagePreview, bgImagePreviewUrl, processedBgImagePreviewUrl, bgImageDimensions,
  processMenuRomFile, processBgImageFile,
  showBgImagePreviewHandler, hideBgImagePreviewHandler,
  buildRom, downloadRom, applyRom,
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
      processMenuRomFile(file);
    }
  }
}

function handleBgImageChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (files && files.length > 0) {
    const file = files[0];
    if (file.name.toLowerCase().endsWith('.png') || file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg')) {
      processBgImageFile(file);
    }
  }
}
</script>

<style scoped>
.config-section {
  margin: var(--space-6) 0;
  padding: var(--space-6);
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  border: var(--border-width) var(--border-style) var(--color-border-light);
  box-shadow: var(--shadow-sm);
  text-align: left;
}

.config-section h4 {
  margin: 0 0 var(--space-4) 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  text-align: left;
}

.config-group {
  margin-bottom: var(--space-6);
}

.config-group:last-child {
  margin-bottom: 0;
}

.config-group h5 {
  margin: 0 0 var(--space-3) 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  border-bottom: var(--border-width) var(--border-style) var(--color-border-light);
  padding-bottom: var(--space-1);
  text-align: left;
}

.config-grid-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.config-grid-row.config-checkboxes {
  grid-template-columns: auto auto;
  justify-content: start;
  gap: var(--space-8);
}

.config-item-flex {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.config-checkbox-item {
  display: flex;
  align-items: center;
}

.config-file-item {
  margin-bottom: var(--space-3);
}

.config-file-item:last-child {
  margin-bottom: 0;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.config-item label {
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  text-align: left;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  font-weight: var(--font-weight-medium) !important;
}

.config-checkbox {
  padding: var(--space-2) var(--space-3);
  border: var(--border-width) var(--border-style) var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  background-color: var(--color-bg);
}

.config-input,
.config-select {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  border: var(--border-width) var(--border-style) var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  background-color: var(--color-bg);
  transition: border-color 0.2s;
}

.config-input:focus,
.config-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--shadow-focus);
}

.action-section {
  text-align: center;
  margin: var(--space-6) 0;
  padding: var(--space-6);
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.download-section {
  margin: var(--space-6) 0;
  padding: var(--space-6);
  background: var(--color-success-light);
  border: var(--border-width) var(--border-style) var(--color-success-light);
  border-radius: var(--radius-lg);
  text-align: center;
  box-shadow: var(--shadow-sm);
}

.download-section h4 {
  margin: 0 0 var(--space-3) 0;
  color: var(--color-success);
  font-size: var(--font-size-xl);
}

.download-info {
  margin-bottom: var(--space-4);
}

.download-info p {
  margin: var(--space-1) 0;
  color: var(--color-success);
  font-weight: var(--font-weight-medium);
}

.download-actions {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
  justify-content: center;
}

/* 文件配置行样式 */
.file-config-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.file-info-text {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  flex: 1;
  min-width: 0;
}

.file-info-text.text-muted {
  color: var(--color-text-secondary);
  font-style: italic;
}

.file-size-small {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.bg-image-info-inline {
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
}

.bg-image-info-inline:hover {
  background-color: var(--color-primary-light);
}

/* 背景图像预览样式 */
.bg-image-preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10001;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bg-image-preview {
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: var(--space-4);
  max-width: 600px;
  max-height: 500px;
  border: var(--border-width) var(--border-style) var(--color-primary);
}

.preview-images-container {
  display: flex;
  gap: var(--space-4);
  align-items: flex-start;
  justify-content: center;
  margin-bottom: var(--space-3);
}

.preview-images-container .preview-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  max-width: 250px;
}

.preview-images-container .preview-item h6 {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  text-align: center;
}

.image-dimensions {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-2);
  text-align: center;
}

.preview-thumbnail {
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
  display: block;
  box-shadow: var(--shadow-sm);
  border: var(--border-width) var(--border-style) var(--color-border-light);
  border-radius: var(--radius-sm);
}
</style>
