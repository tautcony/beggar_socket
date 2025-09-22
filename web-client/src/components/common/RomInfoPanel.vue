<template>
  <div class="rom-info-panel">
    <h3
      class="rom-info-title"
      @click="toggleCollapsed"
    >
      <IonIcon
        :icon="informationCircleOutline"
        class="info-icon"
      />
      {{ $t('ui.rom.info') }}
      <IonIcon
        :icon="isCollapsed ? chevronDown : chevronUp"
        class="collapse-icon"
      />
    </h3>
    <div
      class="rom-info-content"
      :class="{ 'collapsed': isCollapsed }"
    >
      <!-- Logo数据显示区 -->
      <div
        v-if="romInfo.logoData && romInfo.logoData.length > 0"
        class="rom-logo-section"
      >
        <h4 class="logo-title">
          <IonIcon
            :icon="imageOutline"
            class="logo-icon"
          />
          {{ $t('ui.rom.logo') }}
        </h4>
        <div class="logo-container">
          <canvas
            ref="logoCanvas"
            class="logo-canvas"
            :width="logoCanvasSize.width"
            :height="logoCanvasSize.height"
          />
        </div>
      </div>

      <!-- ROM基本信息 -->
      <div class="rom-info-grid">
        <div class="rom-info-item">
          <span class="rom-info-label">{{ $t('ui.rom.romTitle') }}:</span>
          <div class="rom-info-value-container">
            <input
              v-if="isEditing"
              v-model="editData.title"
              type="text"
              class="rom-edit-input"
              :maxlength="romInfo.type === 'GBA' ? 12 : 15"
            >
            <span
              v-else
              class="rom-info-value"
            >{{ romInfo.title || 'Untitled' }}</span>
          </div>
        </div>
        <div class="rom-info-item">
          <span class="rom-info-label">{{ $t('ui.rom.type') }}:</span>
          <span
            class="rom-info-value rom-type"
            :class="romInfo.type.toLowerCase()"
          >{{ romInfo.type }}</span>
        </div>
        <div
          class="rom-info-item"
        >
          <span class="rom-info-label">{{ $t('ui.rom.gameCode') }}:</span>
          <div class="rom-info-value-container">
            <input
              v-if="isEditing && romInfo.type === 'GBA'"
              v-model="editData.gameCode"
              type="text"
              class="rom-edit-input"
              maxlength="4"
            >
            <span
              v-else
              class="rom-info-value"
            >{{ romInfo.gameCode }}</span>
          </div>
        </div>
        <div
          v-if="romInfo.makerCode"
          class="rom-info-item"
        >
          <span class="rom-info-label">{{ $t('ui.rom.maker') }}:</span>
          <div class="rom-info-value-container">
            <input
              v-if="isEditing"
              v-model="editData.makerCode"
              type="text"
              class="rom-edit-input"
              :maxlength="romInfo.type === 'GBA' ? 2 : 4"
            >
            <span
              v-else
              class="rom-info-value"
            >{{ romInfo.makerCode }}</span>
          </div>
        </div>
        <div
          v-if="romInfo.version !== undefined"
          class="rom-info-item"
        >
          <span class="rom-info-label">{{ $t('ui.rom.version') }}:</span>
          <div class="rom-info-value-container">
            <input
              v-if="isEditing"
              v-model.number="editData.version"
              type="number"
              class="rom-edit-input"
              min="0"
              max="255"
            >
            <span
              v-else
              class="rom-info-value"
            >v{{ romInfo.version }}</span>
          </div>
        </div>
        <div
          v-if="romInfo.region"
          class="rom-info-item"
        >
          <span class="rom-info-label">{{ $t('ui.rom.region') }}:</span>
          <div class="rom-info-value-container">
            <select
              v-if="isEditing && romInfo.type === 'GBA'"
              v-model="editData.region"
              class="rom-edit-select"
            >
              <option value="Japan">
                Japan
              </option>
              <option value="USA">
                USA
              </option>
              <option value="Europe">
                Europe
              </option>
              <option value="Germany">
                Germany
              </option>
              <option value="France">
                France
              </option>
              <option value="Italy">
                Italy
              </option>
              <option value="Spain">
                Spain
              </option>
            </select>
            <select
              v-else-if="isEditing && (romInfo.type === 'GB' || romInfo.type === 'GBC')"
              v-model="editData.region"
              class="rom-edit-select"
            >
              <option value="Japan">
                Japan
              </option>
              <option value="Non-Japan">
                Non-Japan
              </option>
            </select>
            <span
              v-else
              class="rom-info-value"
            >{{ romInfo.region }}</span>
          </div>
        </div>
        <div class="rom-info-item">
          <span class="rom-info-label">{{ $t('ui.rom.romSize') }}:</span>
          <span class="rom-info-value">{{ formatBytes(romInfo.romSize) }}</span>
        </div>
        <div
          v-if="romInfo.ramSize !== undefined && romInfo.ramSize > 0"
          class="rom-info-item"
        >
          <span class="rom-info-label">{{ $t('ui.rom.ramSize') }}:</span>
          <span class="rom-info-value">{{ formatBytes(romInfo.ramSize) }}</span>
        </div>
        <div
          v-if="romInfo.cartType !== undefined"
          class="rom-info-item"
        >
          <span class="rom-info-label">{{ $t('ui.rom.cartType') }}:</span>
          <span class="rom-info-value">{{ CartridgeTypeMapper[romInfo.cartType] }}</span>
        </div>
        <div class="rom-info-item">
          <span class="rom-info-label">{{ $t('ui.rom.valid') }}:</span>
          <span
            class="rom-info-value rom-validity"
            :class="romInfo.isValid ? 'valid' : 'invalid'"
          >
            <IonIcon
              :icon="romInfo.isValid ? checkmarkCircle : closeCircle"
              class="validity-icon"
            />
            {{ romInfo.isValid ? $t('ui.common.yes') : $t('ui.common.no') }}
          </span>
        </div>
      </div>

      <!-- 编辑操作按钮 -->
      <div
        v-if="romData && (romInfo.type === 'GBA' || romInfo.type === 'GB' || romInfo.type === 'GBC')"
        class="rom-edit-actions"
      >
        <button
          v-if="!isEditing"
          class="rom-edit-button"
          @click="startEdit"
        >
          <IonIcon :icon="createOutline" />
          {{ $t('ui.rom.edit') }}
        </button>
        <div
          v-else
          class="rom-edit-buttons"
        >
          <button
            class="rom-save-button"
            @click="saveEdit"
          >
            <IonIcon :icon="saveOutline" />
            {{ $t('ui.common.save') }}
          </button>
          <button
            class="rom-cancel-button"
            @click="cancelEdit"
          >
            <IonIcon :icon="closeOutline" />
            {{ $t('ui.common.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { checkmarkCircle, chevronDown, chevronUp, closeCircle, closeOutline, createOutline, imageOutline, informationCircleOutline, saveOutline } from 'ionicons/icons';
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useToast } from '@/composables/useToast';
import { processGBALogoData } from '@/utils/compression-utils';
import { formatBytes } from '@/utils/formatter-utils';
import { CartridgeTypeMapper, type RomInfo } from '@/utils/parsers/rom-parser.ts';
import { type RomEditData, updateRomInfo } from '@/utils/rom/rom-editor';

const { t } = useI18n();
const { showToast } = useToast();

const props = defineProps<{
  romInfo: RomInfo;
  isCollapsed?: boolean;
  romData?: Uint8Array;
}>();

const emit = defineEmits<{
  'update-is-collapsed': [value: boolean];
  'rom-updated': [newRomData: Uint8Array];
}>();

const isCollapsed = ref(props.isCollapsed ?? true);
const isEditing = ref(false);
const logoCanvas = useTemplateRef<HTMLCanvasElement>('logoCanvas');

// 编辑数据
const editData = ref<RomEditData>({
  title: '',
  gameCode: '',
  makerCode: '',
  version: 0,
  region: '',
});

// 初始化编辑数据
const initEditData = () => {
  editData.value = {
    title: props.romInfo.title ?? '',
    gameCode: props.romInfo.gameCode ?? '',
    makerCode: props.romInfo.makerCode ?? '',
    version: props.romInfo.version ?? 0,
    region: props.romInfo.region ?? 'USA',
  };
};

// 监听romInfo变化，重新初始化编辑数据
watch(() => props.romInfo, initEditData, { immediate: true });

// 开始编辑
const startEdit = () => {
  if (!props.romData) {
    showToast(t('messages.rom.noRomDataForEdit'), 'error');
    return;
  }
  initEditData();
  isEditing.value = true;
};

// 保存编辑
const saveEdit = () => {
  if (!props.romData) {
    showToast(t('messages.rom.noRomDataForEdit'), 'error');
    return;
  }

  if (props.romInfo.type === 'Unknown') {
    showToast(t('messages.rom.unsupportedRomType'), 'error');
    return;
  }

  try {
    const updatedRomData = updateRomInfo(props.romData, props.romInfo.type, editData.value);
    emit('rom-updated', updatedRomData);
    isEditing.value = false;
    showToast(t('messages.rom.romInfoUpdated'), 'success');
  } catch (error) {
    console.error('Failed to update ROM info:', error);
    showToast(t('messages.rom.romInfoUpdateFailed'), 'error');
  }
};

// 取消编辑
const cancelEdit = () => {
  initEditData();
  isEditing.value = false;
};

// 根据ROM类型计算Logo画布大小
const logoCanvasSize = computed(() => {
  if (props.romInfo.type === 'GBA') {
    // GBA Logo 104xx16像素
    return { width: 416, height: 64 };
  } else {
    // GB/GBC Logo 48x8像素
    return { width: 192, height: 32 };
  }
});

function toggleCollapsed() {
  isCollapsed.value = !isCollapsed.value;
  emit('update-is-collapsed', isCollapsed.value);
}

function renderLogo() {
  if (!logoCanvas.value || !props.romInfo.logoData || props.romInfo.logoData.length === 0) {
    return;
  }

  const canvas = logoCanvas.value;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 清空画布
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const logoData = props.romInfo.logoData;

  if (props.romInfo.type === 'GBA') {
    renderGBALogo(ctx, logoData, canvas.width, canvas.height);
  } else if (props.romInfo.type === 'GB' || props.romInfo.type === 'GBC') {
    renderGBLogo(ctx, logoData, canvas.width, canvas.height);
  }
}

function renderGBALogo(ctx: CanvasRenderingContext2D, logoData: Uint8Array, width: number, height: number) {
  const processedData = processGBALogoData(logoData);
  if (processedData === null) {
    return;
  }

  const logoWidth = 104;
  const logoHeight = 16;
  const scale = Math.round(Math.min(width / logoWidth, height / logoHeight));

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  for (let tileRow = 0; tileRow < 2; tileRow++) {
    for (let tileW = 0; tileW < 13; tileW++) {
      for (let tileH = 0; tileH < 8; tileH++) {
        for (let bit = 0; bit < 8; bit++) {
          const pos = (tileRow * 13 * 8) + (tileW * 8) + tileH;
          if (pos >= processedData.length) break;

          const pixel = (processedData[pos] >> bit) & 1;
          const x = tileW * 8 + bit;
          const y = tileRow * 8 + tileH;

          const fillStyle = pixel === 1 ? '#EA33F7' : '#FFFFFF';
          ctx.fillStyle = fillStyle;
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }
  }

}

function renderGBLogo(ctx: CanvasRenderingContext2D, logoData: Uint8Array, width: number, height: number) {
  const logoWidth = 48;
  const logoHeight = 8;
  const scale = Math.min(width / logoWidth, height / logoHeight);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const palette = ['#9bbc0f', '#8bac0f', '#306230', '#0f380f'];

  for (let row = 0; row < 4; row++) {
    for (let tile = 0; tile < 12; tile++) {
      const tileIndex = tile * 2;
      const byteIndex = Math.floor(row / 2) * 24 + tileIndex + (row % 2);

      if (byteIndex < logoData.length) {
        const byte = logoData[byteIndex];

        const highNibble = (byte >> 4) & 0xF;
        const lowNibble = byte & 0xF;

        for (let bit = 3; bit >= 0; bit--) {
          const pixel1 = (highNibble >> bit) & 1;
          const pixel2 = (lowNibble >> bit) & 1;
          const colorIndex1 = pixel1 ? 3 : 0;
          const colorIndex2 = pixel2 ? 3 : 0;

          const pixelX = tile * 4 + (3 - bit);
          const pixelY1 = row * 2;
          const pixelY2 = row * 2 + 1;

          const drawX = (width - logoWidth * scale) / 2 + pixelX * scale;
          const drawY1 = (height - logoHeight * scale) / 2 + pixelY1 * scale;
          const drawY2 = (height - logoHeight * scale) / 2 + pixelY2 * scale;

          ctx.fillStyle = palette[colorIndex1];
          ctx.fillRect(drawX, drawY1, scale, scale);
          ctx.fillStyle = palette[colorIndex2];
          ctx.fillRect(drawX, drawY2, scale, scale);
        }
      }
    }
  }
}

// 监听logoData变化，重新渲染
watch(() => props.romInfo.logoData, async () => {
  await nextTick(() => {
    renderLogo();
  });
}, { immediate: true });

// 监听画布大小变化
watch(logoCanvasSize, async () => {
  await nextTick(() => {
    renderLogo();
  });
});

onMounted(async () => {
  await nextTick(() => {
    renderLogo();
  });
});
</script>

<style lang="scss" scoped>
@use '@/styles/variables/colors' as color-vars;
@use '@/styles/variables/spacing' as spacing-vars;
@use '@/styles/variables/typography' as typography-vars;
@use '@/styles/variables/radius' as radius-vars;
@use '@/styles/mixins' as mixins;

.rom-info-panel {
  margin-bottom: spacing-vars.$space-3;
  padding: spacing-vars.$space-4;
  background: linear-gradient(135deg, color-vars.$color-bg-secondary 0%, color-vars.$color-bg-tertiary 100%);
  border: 1px solid color-vars.$color-border-light;
  border-radius: radius-vars.$radius-lg;
  box-shadow: color-vars.$shadow-sm;
}

.rom-info-title {
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-2;
  margin: 0;
  font-size: typography-vars.$font-size-lg;
  font-weight: typography-vars.$font-weight-semibold;
  color: color-vars.$color-text-secondary;
  cursor: pointer;
  transition: color 0.2s ease;
  user-select: none;

  &:hover {
    color: color-vars.$color-primary;
  }
}

.info-icon {
  font-size: typography-vars.$font-size-lg;
  color: color-vars.$color-primary;
}

.collapse-icon {
  margin-left: auto;
  font-size: typography-vars.$font-size-base;
  transition: transform 0.3s ease;
  color: color-vars.$color-text-secondary;
}

.rom-info-content {
  background: color-vars.$color-bg;
  border-radius: radius-vars.$radius-md;
  padding: spacing-vars.$space-4;
  border: 1px solid color-vars.$color-border-light;
  overflow: hidden;
  transition: max-height 0.3s ease, opacity 0.3s ease, padding 0.3s ease;
  max-height: 800px;
  opacity: 1;
  margin-top: spacing-vars.$space-4;

  &.collapsed {
    max-height: 0;
    opacity: 0;
    padding: 0 spacing-vars.$space-4;
    margin-top: 0;
  }
}

/* Logo部分样式 */
.rom-logo-section {
  margin-bottom: spacing-vars.$space-5;
  padding: spacing-vars.$space-4;
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
  border: 1px solid #ffcc02;
  border-radius: radius-vars.$radius-lg;
}

.logo-title {
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-2;
  margin: 0 0 spacing-vars.$space-3 0;
  font-size: typography-vars.$font-size-base;
  font-weight: typography-vars.$font-weight-semibold;
  color: #ef6c00;
}

.logo-icon {
  font-size: typography-vars.$font-size-lg;
  color: #ff9800;
}

.logo-container {
  display: flex;
  justify-content: center;
  align-items: center;
}

.logo-canvas {
  border: 2px solid color-vars.$color-border-light;
  border-radius: radius-vars.$radius-lg;
  background: color-vars.$color-bg;
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
  box-shadow: color-vars.$shadow-sm;
  max-width: 100%;
  height: auto;
}

.logo-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: spacing-vars.$space-2;
  min-width: 200px;
}

.logo-info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: spacing-vars.$space-2 spacing-vars.$space-3;
  background: rgba(255, 255, 255, 0.8);
  border-radius: radius-vars.$radius-base;
  border-left: 3px solid #ff9800;
  min-height: 40px;
}

.logo-info-label {
  font-weight: typography-vars.$font-weight-medium;
  color: #ef6c00;
  font-size: typography-vars.$font-size-sm;
  flex-shrink: 0;
  margin-right: spacing-vars.$space-3;
}

.logo-info-value {
  font-family: typography-vars.$font-family-mono;
  color: #212529;
  font-size: typography-vars.$font-size-sm;
  text-align: right;
  flex: 1;
}

.logo-validity {
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-1;

  &.valid {
    color: color-vars.$color-success;
  }

  &.invalid {
    color: color-vars.$color-error;
  }
}

/* ROM信息网格 */
.rom-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: spacing-vars.$space-3;
}

.rom-info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: spacing-vars.$space-2 spacing-vars.$space-3;
  background: color-vars.$color-bg-secondary;
  border-radius: radius-vars.$radius-base;
  border-left: 3px solid color-vars.$color-primary;
}

.rom-info-label {
  font-weight: typography-vars.$font-weight-medium;
  color: color-vars.$color-text-secondary;
  white-space: nowrap;
}

.rom-info-value {
  font-family: typography-vars.$font-family-mono;
  color: #212529;
  text-align: right;
  word-break: break-all;
}

.rom-type {
  padding: spacing-vars.$space-1 spacing-vars.$space-2;
  border-radius: radius-vars.$radius-2xl;
  font-size: typography-vars.$font-size-xs;
  font-weight: typography-vars.$font-weight-semibold;
  text-transform: uppercase;

  &.gba {
    background: linear-gradient(45deg, #4e54c8, #8f94fb);
    color: white;
  }

  &.gb {
    background: linear-gradient(45deg, #90a955, #b8c77a);
    color: white;
  }

  &.gbc {
    background: linear-gradient(45deg, #ff6b6b, #ffa726);
    color: white;
  }

  &.unknown {
    background: linear-gradient(45deg, color-vars.$color-secondary, #adb5bd);
    color: white;
  }
}

.rom-validity {
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-1;

  &.valid {
    color: color-vars.$color-success;
  }

  &.invalid {
    color: color-vars.$color-error;
  }
}

.validity-icon {
  font-size: typography-vars.$font-size-lg;
}

/* 编辑功能样式 */
.rom-info-value-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  max-width: 150px;
  max-height: 24px;
}

.rom-edit-input,
.rom-edit-select {
  width: 100%;
  max-width: 100%;
  padding: spacing-vars.$space-1 spacing-vars.$space-2;
  border: 1px solid color-vars.$color-border-light;
  border-radius: radius-vars.$radius-base;
  font-size: typography-vars.$font-size-base;
  background: color-vars.$color-bg;
  color: color-vars.$color-text;
  text-align: right;
  box-sizing: border-box;
  font-family: typography-vars.$font-family-mono;

  &:focus {
    outline: none;
    border-color: color-vars.$color-primary;
    box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
  }
}

.rom-edit-actions {
  margin-top: spacing-vars.$space-4;
  padding-top: spacing-vars.$space-4;
  border-top: 1px solid color-vars.$color-border-light;
}

.rom-edit-button,
.rom-save-button,
.rom-cancel-button {
  display: inline-flex;
  align-items: center;
  gap: spacing-vars.$space-2;
  padding: spacing-vars.$space-2 spacing-vars.$space-4;
  border: none;
  border-radius: radius-vars.$radius-md;
  font-size: typography-vars.$font-size-sm;
  cursor: pointer;
  transition: all 0.2s ease;

  &:disabled {
    background: color-vars.$color-border-light;
    color: color-vars.$color-text-secondary;
    cursor: not-allowed;
  }
}

.rom-edit-button {
  background: color-vars.$color-primary;
  color: white;

  &:hover {
    background: color-vars.$color-primary-hover;
  }
}

.rom-edit-buttons {
  display: flex;
  gap: spacing-vars.$space-2;
  justify-content: flex-end;
}

.rom-save-button {
  background: color-vars.$color-success;
  color: white;

  &:hover {
    background: #45a049;
  }
}

.rom-cancel-button {
  background: color-vars.$color-error;
  color: white;

  &:hover {
    background: #d32f2f;
  }
}
</style>
