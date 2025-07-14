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
          <span class="rom-info-value">{{ romInfo.title }}</span>
        </div>
        <div class="rom-info-item">
          <span class="rom-info-label">{{ $t('ui.rom.type') }}:</span>
          <span
            class="rom-info-value rom-type"
            :class="romInfo.type.toLowerCase()"
          >{{ romInfo.type }}</span>
        </div>
        <div
          v-if="romInfo.gameCode"
          class="rom-info-item"
        >
          <span class="rom-info-label">{{ $t('ui.rom.gameCode') }}:</span>
          <span class="rom-info-value">{{ romInfo.gameCode }}</span>
        </div>
        <div
          v-if="romInfo.makerCode"
          class="rom-info-item"
        >
          <span class="rom-info-label">{{ $t('ui.rom.maker') }}:</span>
          <span class="rom-info-value">{{ romInfo.makerCode }}</span>
        </div>
        <div
          v-if="romInfo.version !== undefined"
          class="rom-info-item"
        >
          <span class="rom-info-label">{{ $t('ui.rom.version') }}:</span>
          <span class="rom-info-value">v{{ romInfo.version }}</span>
        </div>
        <div
          v-if="romInfo.region"
          class="rom-info-item"
        >
          <span class="rom-info-label">{{ $t('ui.rom.region') }}:</span>
          <span class="rom-info-value">{{ romInfo.region }}</span>
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { checkmarkCircle, chevronDown, chevronUp, closeCircle, imageOutline, informationCircleOutline } from 'ionicons/icons';
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { processGBALogoData } from '@/utils/compression-utils';
import { formatBytes } from '@/utils/formatter-utils';
import { CartridgeTypeMapper, type RomInfo } from '@/utils/rom-parser.ts';

const { t } = useI18n();

const props = defineProps<{
  romInfo: RomInfo;
  isCollapsed?: boolean;
}>();

const emit = defineEmits<{
  'update-is-collapsed': [value: boolean];
}>();

const isCollapsed = ref(props.isCollapsed ?? true);
const logoCanvas = useTemplateRef<HTMLCanvasElement>('logoCanvas');

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

<style scoped>
.rom-info-panel {
  margin-bottom: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 1px solid #dee2e6;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.rom-info-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #495057;
  cursor: pointer;
  transition: color 0.2s ease;
  user-select: none;
}

.rom-info-title:hover {
  color: #007bff;
}

.info-icon {
  font-size: 1.2rem;
  color: #007bff;
}

.collapse-icon {
  margin-left: auto;
  font-size: 1rem;
  transition: transform 0.3s ease;
  color: #6c757d;
}

.rom-info-content {
  background: #ffffff;
  border-radius: 6px;
  padding: 16px;
  border: 1px solid #e9ecef;
  overflow: hidden;
  transition: max-height 0.3s ease, opacity 0.3s ease, padding 0.3s ease;
  max-height: 800px;
  opacity: 1;
  margin-top: 16px;
}

.rom-info-content.collapsed {
  max-height: 0;
  opacity: 0;
  padding: 0 16px;
  margin-top: 0;
}

/* Logo部分样式 */
.rom-logo-section {
  margin-bottom: 20px;
  padding: 16px;
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
  border: 1px solid #ffcc02;
  border-radius: 8px;
}

.logo-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px 0;
  font-size: 1rem;
  font-weight: 600;
  color: #ef6c00;
}

.logo-icon {
  font-size: 1.1rem;
  color: #ff9800;
}

.logo-container {
  display: flex;
  justify-content: center;
  align-items: center;
}

.logo-canvas {
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: #ffffff;
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-width: 100%;
  height: auto;
}

.logo-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 200px;
}

.logo-info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 4px;
  border-left: 3px solid #ff9800;
  min-height: 40px;
}

.logo-info-label {
  font-weight: 500;
  color: #ef6c00;
  font-size: 0.9rem;
  flex-shrink: 0;
  margin-right: 12px;
}

.logo-info-value {
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  color: #212529;
  font-size: 0.9rem;
  text-align: right;
  flex: 1;
}

.logo-validity {
  display: flex;
  align-items: center;
  gap: 4px;
}

.logo-validity.valid {
  color: #28a745;
}

.logo-validity.invalid {
  color: #dc3545;
}

/* ROM信息网格 */
.rom-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
}

.rom-info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 4px;
  border-left: 3px solid #007bff;
}

.rom-info-label {
  font-weight: 500;
  color: #495057;
  white-space: nowrap;
}

.rom-info-value {
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  color: #212529;
  text-align: right;
  word-break: break-all;
}

.rom-type {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
}

.rom-type.gba {
  background: linear-gradient(45deg, #4e54c8, #8f94fb);
  color: white;
}

.rom-type.gb {
  background: linear-gradient(45deg, #90a955, #b8c77a);
  color: white;
}

.rom-type.gbc {
  background: linear-gradient(45deg, #ff6b6b, #ffa726);
  color: white;
}

.rom-type.unknown {
  background: linear-gradient(45deg, #6c757d, #adb5bd);
  color: white;
}

.rom-validity {
  display: flex;
  align-items: center;
  gap: 4px;
}

.validity-icon {
  font-size: 1.1rem;
}

.rom-validity.valid {
  color: #28a745;
}

.rom-validity.invalid {
  color: #dc3545;
}

/* 响应式布局 */
@media (max-width: 768px) {
  .logo-container {
    flex-direction: column;
    gap: 12px;
  }

  .logo-canvas {
    align-self: center;
  }

  .logo-info {
    min-width: auto;
    width: 100%;
  }

  .rom-info-grid {
    grid-template-columns: 1fr;
  }

  .rom-info-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .rom-info-value {
    text-align: left;
  }

  .logo-info-item {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .logo-info-label {
    margin-right: 8px;
  }
}

@media (max-width: 480px) {
  .logo-info-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .logo-info-label {
    margin-right: 0;
  }

  .logo-info-value {
    text-align: left;
    width: 100%;
  }
}
</style>
