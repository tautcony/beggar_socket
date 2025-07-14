<template>
  <div
    v-if="isVisible"
    class="modal-overlay"
    @click="handleOverlayClick"
  >
    <div class="modal-content">
      <div class="modal-header">
        <div class="header-content">
          <h3>{{ $t('ui.menu.romAnalyzer') }}</h3>
        </div>
        <button
          class="close-button"
          @click="closeModal"
        >
          <IonIcon :icon="closeOutline" />
        </button>
      </div>

      <div class="modal-body">
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
                  <button
                    class="remove-file-btn"
                    @click.stop="clearFile"
                  >
                    <IonIcon :icon="closeOutline" />
                  </button>
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
                  <span class="game-title">{{ game.romInfo.title }}</span>
                  <span class="game-type">{{ game.romInfo.type }}</span>
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
                <button
                  class="extract-button"
                  :disabled="isExtracting"
                  @click="extractGame(game)"
                >
                  <IonIcon :icon="downloadOutline" />
                  {{ $t('ui.romAnalyzer.extract') }}
                </button>
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
      </div>

      <div class="modal-footer">
        <button
          class="cancel-button"
          @click="closeModal"
        >
          {{ $t('ui.common.cancel') }}
        </button>
        <button
          v-if="selectedFile && !isAnalyzing"
          class="analyze-button"
          @click="analyzeRom"
        >
          {{ $t('ui.romAnalyzer.analyze') }}
        </button>
      </div>
    </div>
  </div>
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
import { ref, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useToast } from '@/composables/useToast';
import { formatBytes, formatHex } from '@/utils/formatter-utils';
import { parseRom, type RomInfo } from '@/utils/rom-parser';

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
  isVisible: boolean;
}>();

const emit = defineEmits<{
  'close': [];
}>();

const fileInput = useTemplateRef<HTMLInputElement>('fileInput');
const selectedFile = ref<File | null>(null);
const isDragOver = ref(false);
const isAnalyzing = ref(false);
const isExtracting = ref(false);
const detectedGames = ref<GameDetectionResult[]>([]);

// 监听可见性变化，重置状态
watch(() => props.isVisible, (visible) => {
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

function handleOverlayClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    closeModal();
  }
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
    console.error('ROM分析失败:', error);
    showToast(t('ui.romAnalyzer.analysisFailed'), 'error');
  } finally {
    isAnalyzing.value = false;
  }
}

function detectMultiRoms(romData: Uint8Array, romType: string): GameDetectionResult[] {
  const results: GameDetectionResult[] = [];

  if (romType === 'GBA') {
    // GBA ROM检测逻辑
    const bankSize = 0x400000; // 4MB
    const bankCount = Math.floor(romData.length / bankSize);

    console.log(`文件大小: ${romData.length} bytes (${(romData.length / 1024 / 1024).toFixed(1)} MB)`);
    console.log(`Bank数量: ${bankCount}`);

    // 首先收集所有有效的游戏
    const validGames: { startAddress: number; romInfo: RomInfo; desc: string }[] = [];

    for (let i = 0; i < bankCount; i++) {
      const startAddress = i * bankSize;

      if (startAddress + 0x150 > romData.length) continue; // 数据不够读取ROM头

      // 只读取ROM头部进行解析，而不是整个bank
      const headerSize = 0x200; // 读取512字节的头部，足够解析ROM信息
      const headerEndAddress = Math.min(startAddress + headerSize, romData.length);
      const headerData = romData.slice(startAddress, headerEndAddress);
      const parsedRomInfo = parseRom(headerData);

      console.log(`检测Bank ${i}: 地址 0x${startAddress.toString(16).padStart(8, '0')}, 有效: ${parsedRomInfo.isValid}, 标题: "${parsedRomInfo.title}"`);

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
        endAddress = romData.length - 1;
      }

      const actualRomSize = endAddress - game.startAddress + 1;

      console.log(`游戏 ${game.desc}:`);
      console.log(`  - 起始地址: 0x${game.startAddress.toString(16)}`);
      console.log(`  - 结束地址: 0x${endAddress.toString(16)}`);
      console.log(`  - 实际ROM大小: ${actualRomSize} bytes`);

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
  } else if (romType === 'GB') {
    // MBC5 ROM检测逻辑 - 使用正确的地址范围
    const multiCardRanges = [
      { from: 0x00000000, to: 0x000FFFFF, name: 'Menu   ' }, // 菜单 1MB
      { from: 0x00100000, to: 0x001FFFFF, name: 'Game 01' }, // 游戏1 1MB
      { from: 0x00200000, to: 0x003FFFFF, name: 'Game 02' }, // 游戏2 2MB
      { from: 0x00400000, to: 0x005FFFFF, name: 'Game 03' }, // 游戏3 2MB
      { from: 0x00600000, to: 0x007FFFFF, name: 'Game 04' }, // 游戏4 2MB
      { from: 0x00800000, to: 0x009FFFFF, name: 'Game 05' }, // 游戏5 2MB
      { from: 0x00A00000, to: 0x00BFFFFF, name: 'Game 06' }, // 游戏6 2MB
      { from: 0x00C00000, to: 0x00DFFFFF, name: 'Game 07' }, // 游戏7 2MB
      { from: 0x00E00000, to: 0x00FFFFFF, name: 'Game 08' }, // 游戏8 2MB
      { from: 0x01000000, to: 0x011FFFFF, name: 'Game 09' }, // 游戏9 2MB
      { from: 0x01200000, to: 0x013FFFFF, name: 'Game 10' }, // 游戏10 2MB
      { from: 0x01400000, to: 0x015FFFFF, name: 'Game 11' }, // 游戏11 2MB
      { from: 0x01600000, to: 0x017FFFFF, name: 'Game 12' }, // 游戏12 2MB
      { from: 0x01800000, to: 0x019FFFFF, name: 'Game 13' }, // 游戏13 2MB
      { from: 0x01A00000, to: 0x01BFFFFF, name: 'Game 14' }, // 游戏14 2MB
      { from: 0x01C00000, to: 0x01DFFFFF, name: 'Game 15' }, // 游戏15 2MB
      { from: 0x01E00000, to: 0x01FFFFFF, name: 'Game 16' }, // 游戏16 2MB
    ];

    console.log(`文件大小: ${romData.length} bytes (${(romData.length / 1024 / 1024).toFixed(1)} MB)`);

    for (const range of multiCardRanges) {
      if (range.from >= romData.length) break;

      const headerEndAddress = Math.min(range.from + 0x150, romData.length);
      if (headerEndAddress - range.from < 0x150) continue;

      const gameData = romData.slice(range.from, headerEndAddress);
      const parsedRomInfo = parseRom(gameData);

      // 调试信息：记录检测过程
      console.log(`检测地址 0x${range.from.toString(16).padStart(8, '0')}: ${range.name}, 有效: ${parsedRomInfo.isValid}, 标题: "${parsedRomInfo.title}"`);

      // 检查该位置是否有非零数据（可能是游戏数据）
      const hasNonZeroData = gameData.some(byte => byte !== 0x00 && byte !== 0xFF);
      console.log(`  - 有非零数据: ${hasNonZeroData}`);

      if (hasNonZeroData) {
        console.log(`  - 前16字节: ${Array.from(gameData.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      }

      if (parsedRomInfo.isValid) {
        // 计算实际的ROM大小：to地址 - from地址 + 1
        const calculatedSize = range.to - range.from + 1;
        // 但不能超过文件实际大小
        const endAddress = Math.min(range.from + calculatedSize, romData.length);
        const actualSize = endAddress - range.from;

        results.push({
          startAddress: range.from,
          endAddress,
          calculatedSize: actualSize,
          desc: range.name,
          romInfo: {
            ...parsedRomInfo,
            romSize: actualSize, // 使用计算出的实际大小
          },
        });
      } else if (hasNonZeroData && range.from > 0) {
        // 如果该位置有数据但ROM头无效，可能是压缩或加密的游戏数据
        // 为了演示目的，我们创建一个占位符条目
        console.log('  - 检测到可能的游戏数据但ROM头无效');

        const calculatedSize = range.to - range.from + 1;
        const endAddress = Math.min(range.from + calculatedSize, romData.length);
        const actualSize = endAddress - range.from;

        results.push({
          startAddress: range.from,
          endAddress,
          calculatedSize: actualSize,
          desc: `${range.name} (无效头)`,
          romInfo: {
            title: '未知游戏',
            type: 'GB',
            romSize: actualSize,
            isValid: false,
            logoData: new Uint8Array(0),
          },
        });
      }
    }
  }

  // 对于GB/GBC ROM，如果只检测到一个游戏且它在地址0，可能是合卡的菜单
  // 我们不应该将其识别为多合一ROM
  if (romType === 'GB' && results.length > 0) {
    // 检查是否只识别到了menu（地址0x00000000）
    const onlyMenuDetected = results.length === 1 && results[0].startAddress === 0;
    if (onlyMenuDetected) {
      console.log('只检测到menu，不识别为多合一ROM');
      return []; // 返回空数组，表示不是多合一ROM
    }
    // 如果检测到多个游戏，或者单个游戏不在地址0，则认为是多合一ROM
    return results;
  }

  // 如果没有检测到多ROM，检查是否为单ROM
  if (results.length === 0) {
    const singleRomInfo = parseRom(romData);
    if (singleRomInfo.isValid) {
      results.push({
        startAddress: 0,
        endAddress: romData.length,
        calculatedSize: romData.length,
        desc: t('ui.romAnalyzer.singleRom'),
        romInfo: {
          ...singleRomInfo,
          romSize: romData.length, // 使用文件总大小
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
    console.error('ROM提取失败:', error);
    showToast(t('ui.romAnalyzer.extractFailed'), 'error');
  } finally {
    isExtracting.value = false;
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  max-width: 800px;
  width: 100%;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px;
  border-bottom: 1px solid #e1e8ed;
}

.header-content {
  flex: 1;
}

.modal-header h3 {
  margin: 0 0 8px 0;
  color: #2c3e50;
  font-size: 1.2rem;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  cursor: pointer;
  color: #6c757d;
  font-size: 1.5rem;
  padding: 4px;
  border-radius: 4px;
  transition: color 0.2s ease;
}

.close-button:hover {
  color: #dc3545;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.upload-section {
  margin-bottom: 20px;
}

.file-input {
  display: none;
}

.upload-drop-zone {
  border: 2px dashed #dee2e6;
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 120px;
}

.upload-drop-zone:hover,
.upload-drop-zone.dragover {
  border-color: #007bff;
  background: #f8f9fa;
}

.upload-drop-zone.has-file {
  padding: 20px;
  background: #f8f9fa;
  border-color: #28a745;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-preview {
  display: flex;
  align-items: center;
  gap: 15px;
  width: 100%;
  text-align: left;
}

.file-icon {
  font-size: 2rem;
  color: #28a745;
  flex-shrink: 0;
}

.file-details {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 4px;
  word-break: break-all;
}

.file-size {
  color: #6c757d;
  font-size: 0.9rem;
  margin-bottom: 4px;
}

.remove-file-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #dc3545;
  font-size: 1.2rem;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s ease;
  flex-shrink: 0;
}

.remove-file-btn:hover {
  background: rgba(220, 53, 69, 0.1);
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.upload-icon {
  font-size: 3rem;
  color: #6c757d;
  margin-bottom: 10px;
}

.upload-drop-zone p {
  margin: 0;
  color: #495057;
  font-weight: 500;
}

.upload-hint {
  margin-top: 5px !important;
  font-size: 0.9rem;
  color: #6c757d !important;
}

.analysis-results {
  margin-bottom: 20px;
}

.analysis-results h4 {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 1rem;
  font-weight: 600;
}

.games-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.game-item {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 15px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 15px;
}

.game-info {
  flex: 1;
}

.game-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.game-title {
  font-weight: 600;
  color: #2c3e50;
  font-size: 1.1rem;
}

.game-type {
  background: #007bff;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.game-details {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.detail-item {
  display: flex;
  gap: 8px;
}

.detail-label {
  font-weight: 500;
  color: #495057;
  min-width: 80px;
}

.detail-value {
  color: #2c3e50;
}

.game-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.extract-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: background 0.2s ease;
}

.extract-button:hover:not(:disabled) {
  background: #218838;
}

.extract-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.analysis-progress,
.extract-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.progress-info {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #6c757d;
}

.loading-icon {
  font-size: 1.5rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #6c757d;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 10px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 20px;
  border-top: 1px solid #e1e8ed;
}

.cancel-button,
.analyze-button {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s ease;
}

.cancel-button {
  background: #6c757d;
  color: white;
}

.cancel-button:hover {
  background: #5a6268;
}

.analyze-button {
  background: #007bff;
  color: white;
}

.analyze-button:hover {
  background: #0056b3;
}

@media (max-width: 768px) {
  .modal-content {
    max-width: 100%;
    margin: 10px;
    max-height: 90vh;
  }

  .game-item {
    flex-direction: column;
    align-items: stretch;
  }

  .game-actions {
    flex-direction: row;
    justify-content: flex-end;
  }
}
</style>
