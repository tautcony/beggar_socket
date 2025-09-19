<template>
  <BaseModal
    v-model="localVisible"
    :title="$t('ui.menu.romAnalyzer')"
    width="90vw"
    max-width="1000px"
    max-height="90vh"
    :mask-closable="false"
    @close="closeModal"
  >
    <!-- 文件上传区域 -->
    <div class="upload-section">
      <div class="upload-area">
        <input
          ref="fileInput"
          type="file"
          accept=".rom,.gba,.gb,.gbc"
          class="file-input"
          @change="handleFileSelect"
        >
        <div
          class="upload-drop-zone"
          :class="{ 'dragover': isDragOver, 'has-file': selectedFile }"
          @drop="handleDrop"
          @dragover.prevent="handleDragOver"
          @dragleave="handleDragLeave"
          @click="triggerFileInput"
        >
          <template v-if="!selectedFile">
            <div class="upload-content">
              <IonIcon
                :icon="cloudUploadOutline"
                class="upload-icon"
              />
              <p>{{ $t('ui.romAnalyzer.uploadPrompt') }}</p>
              <p class="upload-hint">
                {{ $t('ui.romAnalyzer.uploadHint') }}
              </p>
            </div>
          </template>
          <template v-else>
            <div class="file-preview">
              <div class="file-icon">
                <IonIcon :icon="documentOutline" />
              </div>
              <div class="file-details">
                <div class="file-name">
                  {{ selectedFile.name }}
                </div>
                <div class="file-size">
                  {{ formatBytes(selectedFile.size) }}
                </div>
              </div>
              <BaseButton
                variant="error"
                size="sm"
                :icon="closeOutline"
                @click.stop="clearFile"
              />
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 分析结果区域 -->
    <div
      v-if="detectedGames.length > 0"
      class="analysis-results"
    >
      <h4>{{ $t('ui.romAnalyzer.detectedGames') }}</h4>
      <div class="games-list">
        <div
          v-for="(game, index) in detectedGames"
          :key="index"
          class="game-item"
        >
          <div class="game-info">
            <div class="game-header">
              <span class="game-type">{{ game.romInfo.type }}</span>
              <span class="game-title">{{ game.romInfo.title }}</span>
            </div>
            <div class="game-details">
              <div class="detail-item">
                <span class="detail-label">{{ $t('ui.romAnalyzer.startAddress') }}:</span>
                <span class="detail-value">{{ formatHex(game.startAddress, 4) }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">{{ $t('ui.romAnalyzer.romSize') }}:</span>
                <span class="detail-value">{{ formatBytes(game.romInfo.romSize) }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">{{ $t('ui.romAnalyzer.description') }}:</span>
                <span class="detail-value">{{ game.desc }}</span>
              </div>
            </div>
          </div>
          <div class="game-actions">
            <BaseButton
              variant="success"
              :icon="downloadOutline"
              :text="$t('ui.romAnalyzer.extract')"
              :disabled="isExtracting"
              @click="extractGame(game)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 分析进度 -->
    <div
      v-if="isAnalyzing"
      class="analysis-progress"
    >
      <div class="progress-info">
        <IonIcon
          :icon="hourglass"
          class="loading-icon"
        />
        <span>{{ $t('ui.romAnalyzer.analyzing') }}</span>
      </div>
    </div>

    <!-- 提取进度 -->
    <div
      v-if="isExtracting"
      class="extract-progress"
    >
      <div class="progress-info">
        <IonIcon
          :icon="downloadOutline"
          class="loading-icon"
        />
        <span>{{ $t('ui.romAnalyzer.extracting') }}</span>
      </div>
    </div>

    <template #footer>
      <BaseButton
        variant="secondary"
        :text="$t('ui.common.cancel')"
        @click="closeModal"
      />
      <BaseButton
        v-if="selectedFile && !isAnalyzing"
        variant="primary"
        :text="$t('ui.romAnalyzer.analyze')"
        @click="analyzeRom"
      />
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import {
  closeOutline,
  cloudUploadOutline,
  documentOutline,
  downloadOutline,
  hourglass,
} from 'ionicons/icons';
import { computed, ref, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseButton from '@/components/common/BaseButton.vue';
import BaseModal from '@/components/common/BaseModal.vue';
import { useToast } from '@/composables/useToast';
import { MBC5_ROM_BASE_ADDRESS } from '@/utils/address-utils';
import { formatBytes, formatHex } from '@/utils/formatter-utils';
import { parseRom, type RomInfo } from '@/utils/parsers/rom-parser';

interface GameDetectionResult {
  startAddress: number;
  endAddress: number;
  calculatedSize: number;
  desc: string;
  romInfo: RomInfo;
}

const { t } = useI18n();
const { showToast } = useToast();

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'close': [];
}>();

// 创建一个计算属性来处理 v-model
const localVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => {
    emit('update:modelValue', value);
  },
});

const fileInput = useTemplateRef<HTMLInputElement>('fileInput');
const selectedFile = ref<File | null>(null);
const isDragOver = ref(false);
const isAnalyzing = ref(false);
const isExtracting = ref(false);
const detectedGames = ref<GameDetectionResult[]>([]);

// 监听可见性变化，重置状态
watch(() => props.modelValue, (visible) => {
  if (!visible) {
    resetState();
  }
});

function resetState() {
  selectedFile.value = null;
  isAnalyzing.value = false;
  isExtracting.value = false;
  detectedGames.value = [];
  isDragOver.value = false;
}

function closeModal() {
  emit('close');
}

function triggerFileInput() {
  fileInput.value?.click();
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    selectedFile.value = file;
    detectedGames.value = [];
  }
}

function clearFile() {
  selectedFile.value = null;
  detectedGames.value = [];
  if (fileInput.value) {
    fileInput.value.value = '';
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault();
  isDragOver.value = true;
}

function handleDragLeave() {
  isDragOver.value = false;
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragOver.value = false;

  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    selectedFile.value = files[0];
    detectedGames.value = [];
  }
}

async function analyzeRom() {
  if (!selectedFile.value) {
    showToast(t('ui.romAnalyzer.noFileSelected'), 'error');
    return;
  }

  isAnalyzing.value = true;
  detectedGames.value = [];

  try {
    const fileBuffer = await selectedFile.value.arrayBuffer();
    const romData = new Uint8Array(fileBuffer);

    // 检测ROM类型
    const mainRomInfo = parseRom(romData);

    if (!mainRomInfo.isValid) {
      showToast(t('ui.romAnalyzer.invalidRom'), 'error');
      return;
    }

    // 检测是否为多ROM合卡
    const games = detectMultiRoms(romData, mainRomInfo.type);

    if (games.length === 0) {
      showToast(t('ui.romAnalyzer.noValidGameFound'), 'error');
      return;
    }

    detectedGames.value = games;
    showToast(t('ui.romAnalyzer.analysisComplete', { count: games.length }), 'success');

  } catch (error) {
    console.error(t('ui.romAnalyzer.analysisFailed'), error);
    showToast(t('ui.romAnalyzer.analysisFailed'), 'error');
  } finally {
    isAnalyzing.value = false;
  }
}

function detectMultiRoms(fileData: Uint8Array, romType: 'GBA' | 'GB' | 'GBC' | 'Unknown'): GameDetectionResult[] {
  const results: GameDetectionResult[] = [];

  if (romType === 'GBA') {
    // GBA ROM检测逻辑
    const bankSize = 0x400000; // 4MB
    const bankCount = Math.floor(fileData.length / bankSize);

    console.log(`File Size: ${fileData.length} bytes (${formatBytes(fileData.length)} MB)`);
    console.log(`Bank Count: ${bankCount}`);

    // 首先收集所有有效的游戏
    const validGames: { startAddress: number; romInfo: RomInfo; desc: string }[] = [];

    for (let i = 0; i < bankCount; i++) {
      const startAddress = i * bankSize;

      if (startAddress + 0x150 > fileData.length) continue; // 数据不够读取ROM头

      // 只读取ROM头部进行解析，而不是整个bank
      const headerSize = 0x200; // 读取512字节的头部，足够解析ROM信息
      const headerEndAddress = Math.min(startAddress + headerSize, fileData.length);
      const headerData = fileData.slice(startAddress, headerEndAddress);
      const parsedRomInfo = parseRom(headerData);

      console.log(`Bank ${i}: Address ${formatHex(startAddress, 4)}, isValid: ${parsedRomInfo.isValid}, Title: "${parsedRomInfo.title}"`);

      if (parsedRomInfo.isValid) {
        validGames.push({
          startAddress,
          romInfo: parsedRomInfo,
          desc: `Bank ${i.toString().padStart(2, '0')}`,
        });
      }
    }

    // 现在计算每个游戏的结束地址和实际大小
    for (let i = 0; i < validGames.length; i++) {
      const game = validGames[i];
      let endAddress: number;

      if (i < validGames.length - 1) {
        // 不是最后一个游戏，结束地址是下一个游戏的起始地址 - 1
        endAddress = validGames[i + 1].startAddress - 1;
      } else {
        // 是最后一个游戏，结束地址是文件结尾
        endAddress = fileData.length - 1;
      }

      const actualRomSize = endAddress - game.startAddress + 1;

      console.log(`Game ${game.desc}:`);
      console.log(`  - Start Address: 0x${game.startAddress.toString(16)}`);
      console.log(`  - End   Address: 0x${endAddress.toString(16)}`);
      console.log(`  - Rom   Size   : ${actualRomSize} bytes`);

      results.push({
        startAddress: game.startAddress,
        endAddress: endAddress + 1, // endAddress + 1 用于slice操作
        calculatedSize: actualRomSize,
        desc: game.desc,
        romInfo: {
          ...game.romInfo,
          romSize: actualRomSize,
        },
      });
    }
  } else if (romType === 'GB' || romType === 'GBC') {
    // MBC5 ROM检测逻辑 - 使用正确的地址范围
    const multiCardRanges = [
      0x000000, // MENU
    ];
    multiCardRanges.push(...MBC5_ROM_BASE_ADDRESS);

    console.log(`File Size: ${fileData.length} bytes (${formatBytes(fileData.length)} MB)`);

    for (let i = 0; i < multiCardRanges.length; ++i) {
      const baseAddress = multiCardRanges[i];

      if (baseAddress >= fileData.length) break;

      const headerEndAddress = Math.min(baseAddress + 0x150, fileData.length);
      if (headerEndAddress - baseAddress < 0x150) continue;

      const gameData = fileData.slice(baseAddress, headerEndAddress);
      const parsedRomInfo = parseRom(gameData);

      // 调试信息：记录检测过程
      console.log(`Address 0x${formatHex(baseAddress, 4)}, isValid: ${parsedRomInfo.isValid}, Title: "${parsedRomInfo.title}"`);

      // 检查该位置是否有非零数据（可能是游戏数据）
      const hasNonZeroData = gameData.some(byte => byte !== 0x00 && byte !== 0xFF);
      console.log(`  - None Zero Data: ${hasNonZeroData}`);

      if (hasNonZeroData) {
        console.log(`  - First 16 bytes: ${Array.from(gameData.slice(0, 16)).map(b => formatHex(b, 1)).join(' ')}`);
      }

      if (parsedRomInfo.isValid) {
        const endAddress = i === multiCardRanges.length - 1 ? fileData.length : multiCardRanges[i + 1];;
        const calculatedSize = endAddress - baseAddress;

        results.push({
          startAddress: baseAddress,
          endAddress,
          calculatedSize,
          desc: i === 0 ? 'Menu' : `Game ${i.toString().padStart(2, '0')}`,
          romInfo: {
            ...parsedRomInfo,
            romSize: calculatedSize,
          },
        });
      }
    }
  }

  // 对于GB/GBC ROM，如果只检测到一个游戏且它在地址0，可能是合卡的菜单
  // 我们不应该将其识别为多合一ROM
  if ((romType === 'GB' || romType === 'GBC') && results.length > 0) {
    // 检查是否只识别到了menu（地址0x00000000）
    const onlyMenuDetected = results.length === 1 && results[0].startAddress === 0;
    if (onlyMenuDetected) {
      console.log('Only menu detected, not a multi-ROM.');
      return []; // 返回空数组，表示不是多合一ROM
    }
    // 如果检测到多个游戏，或者单个游戏不在地址0，则认为是多合一ROM
    return results;
  }

  // 如果没有检测到多ROM，检查是否为单ROM
  if (results.length === 0) {
    const singleRomInfo = parseRom(fileData);
    if (singleRomInfo.isValid) {
      results.push({
        startAddress: 0,
        endAddress: fileData.length,
        calculatedSize: fileData.length,
        desc: t('ui.romAnalyzer.singleRom'),
        romInfo: {
          ...singleRomInfo,
          romSize: fileData.length, // 使用文件总大小
        },
      });
    }
  }

  return results;
}

async function extractGame(game: GameDetectionResult) {
  if (!selectedFile.value) {
    showToast(t('ui.romAnalyzer.noFileSelected'), 'error');
    return;
  }

  isExtracting.value = true;

  try {
    const fileBuffer = await selectedFile.value.arrayBuffer();
    const romData = new Uint8Array(fileBuffer);

    // 使用计算出的ROM大小
    const romSize = game.calculatedSize;

    // 确保不超过文件大小
    const endAddress = Math.min(game.startAddress + romSize, romData.length);
    const gameData = romData.slice(game.startAddress, endAddress);

    // 创建下载
    const blob = new Blob([gameData], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${game.romInfo.title}.${game.romInfo.type.toLowerCase()}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);

    showToast(t('ui.romAnalyzer.extractSuccess'), 'success');

  } catch (error) {
    console.error(t('ui.romAnalyzer.extractFailed'), error);
    showToast(t('ui.romAnalyzer.extractFailed'), 'error');
  } finally {
    isExtracting.value = false;
  }
}
</script>

<style scoped>
.upload-section {
  margin-bottom: var(--space-5);
}

.file-input {
  display: none;
}

.upload-drop-zone {
  border: var(--border-width-thick) var(--border-style-dashed) var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-10) var(--space-5);
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 120px;
}

.upload-drop-zone:hover,
.upload-drop-zone.dragover {
  border-color: var(--color-primary);
  background: var(--color-bg-secondary);
}

.upload-drop-zone.has-file {
  padding: var(--space-5);
  background: var(--color-bg-secondary);
  border-color: var(--color-success);
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-preview {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  width: 100%;
  text-align: left;
}

.file-icon {
  font-size: var(--font-size-3xl);
  color: var(--color-success);
  flex-shrink: 0;
}

.file-details {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin-bottom: var(--space-1);
  word-break: break-all;
}

.file-size {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-1);
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.upload-icon {
  font-size: var(--font-size-5xl);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-3);
}

.upload-drop-zone p {
  margin: 0;
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}

.upload-hint {
  margin-top: var(--space-2) !important;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary) !important;
}

.analysis-results {
  margin-bottom: var(--space-5);
}

.analysis-results h4 {
  margin: 0 0 var(--space-4) 0;
  color: var(--color-text);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
}

.games-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', 'Menlo', 'Consolas', monospace;
}

.game-item {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
}

.game-info {
  flex: 1;
}

.game-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.game-title {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  font-size: var(--font-size-lg);
}

.game-type {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.game-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.detail-item {
  display: flex;
  gap: var(--space-2);
}

.detail-label {
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  min-width: 80px;
}

.detail-value {
  color: var(--color-text);
}

.game-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.analysis-progress,
.extract-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-10) var(--space-5);
}

.progress-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--color-text-secondary);
}

.loading-icon {
  font-size: var(--font-size-xl);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
