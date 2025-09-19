<template>
  <div class="gba-multi-menu-view">
    <!-- 加载遮罩 -->
    <div
      v-if="isLoadingLibrary"
      class="loading-overlay"
    >
      <div class="loading-content">
        <div class="loading-spinner" />
        <div class="loading-text">
          {{ $t('ui.gbaMultiMenu.loadingLibrary') }}
        </div>
        <div class="loading-description">
          {{ $t('ui.gbaMultiMenu.loadingDescription') }}
        </div>
      </div>
    </div>
    <!-- 页面头部 -->
    <div class="page-header">
      <h2 class="page-title">
        {{ $t('ui.gbaMultiMenu.title') }}
      </h2>
      <div class="header-controls">
        <div class="status-info">
          <span class="status-label">{{ $t('ui.gbaMultiMenu.status') }}:</span>
          <span
            class="status-value"
            :class="statusClass"
          >
            {{ statusText }}
          </span>
        </div>
        <div
          v-if="buildResult"
          class="result-info"
        >
          <span class="result-label">{{ $t('ui.gbaMultiMenu.romCode') }}:</span>
          <span class="result-value">{{ buildResult.code }}</span>
        </div>
        <button
          class="back-btn"
          @click="goBack"
        >
          <IonIcon :icon="arrowBackOutline" />
          返回
        </button>
      </div>
    </div>

    <div class="gba-multi-menu-content">
      <!-- 文件选择区域 - 左右布局 -->
      <div class="main-layout">
        <!-- 左侧：游戏ROM -->
        <div class="left-section">
          <div class="file-section">
            <h4>{{ $t('ui.gbaMultiMenu.gameRoms') }}</h4>
            <div class="file-upload-area">
              <input
                ref="gameRomInput"
                type="file"
                accept=".gba"
                multiple
                style="display: none"
                @change="onGameRomsSelected"
              >
              <div
                class="file-drop-zone"
                @click="() => gameRomInput?.click()"
                @dragover.prevent
                @drop.prevent="handleGameRomDrop"
              >
                <div
                  v-if="gameRomItems.length > 0"
                  class="file-list"
                >
                  <div
                    v-for="(item, index) in gameRomItems"
                    :key="item.id"
                    class="file-item-container"
                    draggable="true"
                    @dragstart="handleDragStart($event, index)"
                    @dragover.prevent
                    @drop.prevent="handleDrop($event, index)"
                    @dragenter.prevent
                  >
                    <div class="file-item">
                      <button
                        class="drag-handle"
                        :title="$t('ui.gbaMultiMenu.dragToReorder')"
                      >
                        <IonIcon :icon="menuOutline" />
                      </button>
                      <IonIcon :icon="gameControllerOutline" />
                      <div class="file-info">
                        <span class="file-name">{{ item.fileName }}</span>
                        <span class="file-size">({{ formatFileSize(item.data.byteLength) }})</span>
                      </div>
                      <div class="file-actions">
                        <BaseButton
                          variant="secondary"
                          size="sm"
                          :icon="buildOutline"
                          :title="$t('ui.gbaMultiMenu.configureGame')"
                          @click.stop="toggleGameConfig(item.fileName)"
                        />
                        <BaseButton
                          variant="error"
                          size="sm"
                          :icon="closeCircleOutline"
                          @click.stop="removeGameRom(item.fileName)"
                        />
                      </div>
                    </div>

                    <!-- 游戏配置面板 -->
                    <div
                      v-if="expandedConfigs.has(item.fileName)"
                      class="game-config-panel"
                      @click.stop
                    >
                      <div class="config-row">
                        <label>{{ $t('ui.gbaMultiMenu.gameTitle') }}:</label>
                        <input
                          v-model="item.config.title"
                          type="text"
                          class="config-input"
                        >
                      </div>
                      <div class="config-row">
                        <label>{{ $t('ui.gbaMultiMenu.titleFont') }}:</label>
                        <select
                          v-model.number="item.config.title_font"
                          class="config-select"
                        >
                          <option value="1">
                            Font 1
                          </option>
                          <option value="2">
                            Font 2
                          </option>
                        </select>
                      </div>
                      <div class="config-row">
                        <label>{{ $t('ui.gbaMultiMenu.saveSlot') }}:</label>
                        <input
                          v-model.number="item.config.save_slot"
                          type="number"
                          min="1"
                          max="10"
                          class="config-input"
                        >
                      </div>
                      <div class="config-row">
                        <label>
                          <input
                            v-model="item.config.enabled"
                            type="checkbox"
                          >
                          {{ $t('ui.gbaMultiMenu.enabled') }}
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  v-else
                  class="file-placeholder"
                >
                  <div class="placeholder-content">
                    <IonIcon
                      :icon="gameControllerOutline"
                      class="placeholder-icon"
                    />
                    <div class="placeholder-text">
                      <p>
                        {{ $t('ui.gbaMultiMenu.dropGameRoms') }}
                      </p>
                      <p class="hint">
                        {{ $t('ui.file.browse') }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧：存档文件 -->
        <div class="right-section">
          <!-- 存档文件 -->
          <div class="file-section">
            <h4>{{ $t('ui.gbaMultiMenu.saveFiles') }}</h4>
            <div class="file-upload-area">
              <input
                ref="saveFileInput"
                type="file"
                accept=".sav"
                multiple
                style="display: none"
                @change="handleSaveFileChange"
              >
              <div
                v-if="saveFiles.size > 0"
                class="file-list"
              >
                <div
                  v-for="[fileName, data] of saveFiles"
                  :key="fileName"
                  class="file-item"
                >
                  <IonIcon :icon="saveOutline" />
                  <span class="file-name">{{ fileName }}</span>
                  <span class="file-size">({{ formatFileSize(data.byteLength) }})</span>
                  <BaseButton
                    variant="error"
                    size="sm"
                    :icon="closeCircleOutline"
                    @click="removeSaveFile(fileName)"
                  />
                </div>
              </div>
              <div
                v-else
                class="file-drop-zone"
                @click="() => saveFileInput?.click()"
                @dragover.prevent
                @drop.prevent="handleSaveFileDrop"
              >
                <div class="placeholder-content">
                  <IonIcon
                    :icon="saveOutline"
                    class="placeholder-icon"
                  />
                  <div class="placeholder-text">
                    <p>
                      {{ $t('ui.gbaMultiMenu.dropSaveFiles') }}
                    </p>
                    <p class="hint">
                      {{ $t('ui.file.browse') }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
                <option value="0">
                  MSP55LV100S (64MB)
                </option>
                <option value="1">
                  6600M0U0BE (256MB)
                </option>
                <option value="2">
                  MSP54LV100 (128MB)
                </option>
                <option value="3">
                  ChisFlash1.0G-128MB (128MB)
                </option>
                <option value="4">
                  ChisFlash2.0G-256MB (256MB)
                </option>
                <option value="5">
                  F0095H0 (512MB)
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
                accept=".png"
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
    </div>

    <!-- 背景图像预览 -->
    <div
      v-if="showBgImagePreview && bgImagePreviewUrl"
      class="bg-image-preview-overlay"
    >
      <div class="bg-image-preview">
        <img
          :src="bgImagePreviewUrl"
          :alt="bgImageFileName"
          class="preview-image"
        >
        <div class="preview-info">
          <span class="preview-filename">{{ bgImageFileName }}</span>
          <span class="preview-size">{{ formatFileSize(bgImageData?.byteLength || 0) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import {
  arrowBackOutline,
  buildOutline,
  closeCircleOutline,
  documentOutline,
  downloadOutline,
  gameControllerOutline,
  imageOutline,
  menuOutline,
  saveOutline,
} from 'ionicons/icons';
import { computed, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import BaseButton from '@/components/common/BaseButton.vue';
import { type BuildInput, type BuildResult, buildRom as buildRomFromService } from '@/services/lk';
import { useRomAssemblyResultStore } from '@/stores/rom-assembly-store';
import { FileInfo } from '@/types/file-info';
import { formatBytes } from '@/utils/formatter-utils';

const { t } = useI18n();
const router = useRouter();
const romAssemblyResultStore = useRomAssemblyResultStore();

// Navigation methods
const goBack = () => {
  router.back();
};

// Refs
const menuRomInput = ref<HTMLInputElement>();
const gameRomInput = ref<HTMLInputElement>();
const bgImageInput = ref<HTMLInputElement>();
const saveFileInput = ref<HTMLInputElement>();

// 游戏配置接口
interface GameConfig {
  file: string;
  title: string;
  title_font: number;
  save_slot: number;
  enabled: boolean;
}

// 游戏ROM项目接口
interface GameRomItem {
  id: string;
  fileName: string;
  data: ArrayBuffer;
  config: GameConfig;
}

// 响应式数据
const menuRomData = ref<ArrayBuffer | null>(null);
const menuRomFileName = ref('');
const gameRomItems = ref<GameRomItem[]>([]);
const bgImageData = ref<ArrayBuffer | null>(null);
const bgImageFileName = ref('');
const saveFiles = ref(new Map<string, ArrayBuffer>());
const expandedConfigs = ref<Set<string>>(new Set());

// 背景图像预览相关
const showBgImagePreview = ref(false);
const bgImagePreviewUrl = ref<string | null>(null);

const cartridgeType = ref(3);
const batteryPresent = ref(true);
const outputName = ref('LK_MULTIMENU_<CODE>.gba');

const isBuilding = ref(false);
const buildResult = ref<BuildResult | null>(null);
const isLoadingLibrary = ref(false);
const libraryLoaded = ref(false);
let gameIdCounter = 0; // 用于生成唯一的游戏ID
let draggedIndex = -1; // 当前拖拽的项目索引

// 计算属性
const canBuild = computed(() => {
  return menuRomData.value !== null &&
         gameRomItems.value.length > 0 &&
         !isBuilding.value &&
         libraryLoaded.value;
});

const statusText = computed(() => {
  if (isLoadingLibrary.value) return t('ui.gbaMultiMenu.loadingLibrary');
  if (isBuilding.value) return t('ui.gbaMultiMenu.statusBuilding');
  if (buildResult.value) return t('ui.gbaMultiMenu.statusSuccess');
  return t('ui.gbaMultiMenu.statusReady');
});

const statusClass = computed(() => {
  if (isLoadingLibrary.value) return 'status-building';
  if (isBuilding.value) return 'status-building';
  if (buildResult.value) return 'status-success';
  return 'status-ready';
});

// 预加载图像处理库
async function preloadImageLibrary() {
  if (libraryLoaded.value || isLoadingLibrary.value) return;

  isLoadingLibrary.value = true;
  try {
    // 动态导入 jimp 库以预加载
    await import('jimp');
    libraryLoaded.value = true;
    console.log(t('ui.gbaMultiMenu.libraryLoaded'));
  } catch (error) {
    console.error('Failed to preload image library:', error);
    // 即使预加载失败，也设置为 true，在实际使用时再处理错误
    libraryLoaded.value = true;
  } finally {
    isLoadingLibrary.value = false;
  }
}

// 页面初始化
resetState();
void loadDefaultBackground();
void loadDefaultMenuRom();
void preloadImageLibrary();

// 组件卸载时清理预览URL
onUnmounted(() => {
  cleanupBgImagePreview();
});

// 加载默认背景图像
async function loadDefaultBackground() {
  try {
    // 清理旧的预览URL
    cleanupBgImagePreview();

    // 从public目录加载默认背景图像
    const response = await fetch('bg.png');

    // 检查成功状态码：200-299 或 304 (Not Modified)
    if (response.ok || response.status === 304) {
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      bgImageData.value = arrayBuffer;
      bgImageFileName.value = 'bg.png';
      console.log(t('messages.gbaMultiMenu.logBgImageLoaded', { name: 'bg.png (默认)' }));
    } else {
      console.log(`默认背景图像无法访问，状态码: ${response.status}`);
    }
  } catch (error) {
    console.log('默认背景图像加载失败:', error);
  }
}

// 加载默认菜单ROM
async function loadDefaultMenuRom() {
  const defaultMenuRom = 'lk_multimenu_for_chisflash_01_02G.gba';
  try {
    // 从public目录加载默认菜单ROM
    const response = await fetch(defaultMenuRom);

    // 检查成功状态码：200-299 或 304 (Not Modified)
    if (response.ok || response.status === 304) {
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      menuRomData.value = arrayBuffer;
      menuRomFileName.value = defaultMenuRom;
      console.log(t('messages.gbaMultiMenu.logMenuRomLoaded', { name: defaultMenuRom }));
    } else {
      console.log(`默认菜单ROM无法访问，状态码: ${response.status}`);
    }
  } catch (error) {
    console.log('默认菜单ROM加载失败:', error);
  }
}

// 文件处理函数
function onMenuRomSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (files && files.length > 0) {
    processMenuRomFile(files[0]);
  }
}

function onGameRomsSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (files && files.length > 0) {
    Array.from(files).forEach(file => {
      if (file.name.toLowerCase().endsWith('.gba')) {
        processGameRomFile(file);
      }
    });
  }
}

function onBgImageSelected(fileInfo: FileInfo | FileInfo[]) {
  let file: FileInfo;
  if (Array.isArray(fileInfo)) {
    if (fileInfo.length > 0) {
      file = fileInfo[0];
    } else {
      return;
    }
  } else {
    file = fileInfo;
  }
  const buffer = new ArrayBuffer(file.data.buffer.byteLength);
  new Uint8Array(buffer).set(new Uint8Array(file.data.buffer));
  bgImageData.value = buffer;
  bgImageFileName.value = file.name;
  console.log(t('messages.gbaMultiMenu.logBgImageLoaded', { name: file.name }));
}

function onSaveFilesSelected(fileInfos: FileInfo | FileInfo[]) {
  const files = Array.isArray(fileInfos) ? fileInfos : [fileInfos];
  files.forEach((file) => {
    try {
      const data = file.data.buffer.slice(file.data.byteOffset, file.data.byteOffset + file.data.byteLength) as ArrayBuffer;
      saveFiles.value.set(file.name, data);
      console.log(t('messages.gbaMultiMenu.logSaveFileLoaded', { name: file.name }));
    } catch (error: unknown) {
      console.log(t('messages.gbaMultiMenu.logSaveFileLoadFailed', { name: file.name, error: (error as Error).message }));
    }
  });
}

// 文件移除函数
function removeGameRom(fileName: string) {
  const index = gameRomItems.value.findIndex(item => item.fileName === fileName);
  if (index !== -1) {
    gameRomItems.value.splice(index, 1);
    // 重新分配save_slot
    gameRomItems.value.forEach((item, idx) => {
      item.config.save_slot = idx + 1;
    });
  }
  expandedConfigs.value.delete(fileName);
  console.log(t('messages.gbaMultiMenu.logGameRomRemoved', { name: fileName }));
}

function removeSaveFile(fileName: string) {
  saveFiles.value.delete(fileName);
  console.log(t('messages.gbaMultiMenu.logSaveFileRemoved', { name: fileName }));
}

// 拖拽处理函数
function handleGameRomDrop(e: DragEvent) {
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    Array.from(files).forEach(file => {
      if (file.name.toLowerCase().endsWith('.gba')) {
        processGameRomFile(file);
      }
    });
  }
}

function handleSaveFileDrop(e: DragEvent) {
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    Array.from(files).forEach(file => {
      if (file.name.toLowerCase().endsWith('.sav')) {
        processSaveFile(file);
      }
    });
  }
}

function processMenuRomFile(file: File) {
  const reader = new FileReader();
  reader.onload = () => {
    const data = reader.result as ArrayBuffer;
    menuRomData.value = data;
    menuRomFileName.value = file.name;
    console.log(t('messages.gbaMultiMenu.logMenuRomLoaded', { name: file.name }));
  };
  reader.readAsArrayBuffer(file);
}

function processGameRomFile(file: File) {
  // 检查是否已存在同名文件
  const existingIndex = gameRomItems.value.findIndex(item => item.fileName === file.name);
  if (existingIndex !== -1) {
    return; // 忽略重复文件
  }

  const reader = new FileReader();
  reader.onload = () => {
    const data = reader.result as ArrayBuffer;

    // 创建游戏配置
    const config: GameConfig = {
      file: file.name,
      title: file.name.replace('.gba', ''),
      title_font: 1,
      save_slot: gameRomItems.value.length + 1,
      enabled: true,
    };

    // 创建新的游戏ROM项目
    const newItem: GameRomItem = {
      id: `game_${gameIdCounter++}`,
      fileName: file.name,
      data: data,
      config: config,
    };

    gameRomItems.value.push(newItem);
    console.log(t('messages.gbaMultiMenu.logGameRomLoaded', { name: file.name }));
  };
  reader.readAsArrayBuffer(file);
}

function processBgImageFile(file: File) {
  // 清理旧的预览URL
  cleanupBgImagePreview();

  const reader = new FileReader();
  reader.onload = () => {
    const data = reader.result as ArrayBuffer;
    bgImageData.value = data;
    bgImageFileName.value = file.name;
    console.log(t('messages.gbaMultiMenu.logBgImageLoaded', { name: file.name }));
  };
  reader.readAsArrayBuffer(file);
}

function processSaveFile(file: File) {
  const reader = new FileReader();
  reader.onload = () => {
    const data = reader.result as ArrayBuffer;
    saveFiles.value.set(file.name, data);
    console.log(t('messages.gbaMultiMenu.logSaveFileLoaded', { name: file.name }));
  };
  reader.readAsArrayBuffer(file);
}

// 清除函数
function clearMenuRom() {
  menuRomData.value = null;
  menuRomFileName.value = '';
  if (menuRomInput.value) {
    menuRomInput.value.value = '';
  }
  // 重新加载默认菜单ROM
  void loadDefaultMenuRom();
}

function clearBgImage() {
  bgImageData.value = null;
  bgImageFileName.value = '';
  if (bgImageInput.value) {
    bgImageInput.value.value = '';
  }
  // 清理预览URL
  if (bgImagePreviewUrl.value) {
    URL.revokeObjectURL(bgImagePreviewUrl.value);
    bgImagePreviewUrl.value = null;
  }
  // 重新加载默认背景
  void loadDefaultBackground();
}

// 背景图像预览相关函数
function showBgImagePreviewHandler() {
  if (bgImageData.value && !bgImagePreviewUrl.value) {
    const blob = new Blob([bgImageData.value], { type: 'image/png' });
    bgImagePreviewUrl.value = URL.createObjectURL(blob);
  }
  showBgImagePreview.value = true;
}

function hideBgImagePreviewHandler() {
  showBgImagePreview.value = false;
}

function cleanupBgImagePreview() {
  if (bgImagePreviewUrl.value) {
    URL.revokeObjectURL(bgImagePreviewUrl.value);
    bgImagePreviewUrl.value = null;
  }
}

// 构建ROM
async function buildRom() {
  if (!canBuild.value) return;

  isBuilding.value = true;
  buildResult.value = null;

  try {
    console.log(t('messages.gbaMultiMenu.logBuildStarted'));

    // 生成游戏配置
    const games = gameRomItems.value.map(item => item.config);

    const config = {
      cartridge: {
        type: cartridgeType.value,
        battery_present: batteryPresent.value,
        min_rom_size: 0x400000,
      },
      games: games,
    };

    // 准备构建输入
    const romFilesMap = new Map<string, ArrayBuffer>();
    gameRomItems.value.forEach(item => {
      romFilesMap.set(item.fileName, item.data);
    });

    const input: BuildInput = {
      config: config,
      menuRom: menuRomData.value ?? new ArrayBuffer(0),
      romFiles: romFilesMap,
      saveFiles: saveFiles.value,
      options: {
        split: false,
        noLog: false,
        bgImage: bgImageData.value instanceof ArrayBuffer ? bgImageData.value : undefined,
        output: outputName.value,
      },
    };

    console.log(t('messages.gbaMultiMenu.logConfigReady'));

    // 执行构建
    const result = await buildRomFromService(input);

    buildResult.value = result;

    console.log(t('messages.gbaMultiMenu.logBuildCompleted'));

  } catch (error: unknown) {
    console.error(t('messages.gbaMultiMenu.logBuildFailed', { error: (error as Error).message }), error);
    console.log(t('messages.gbaMultiMenu.logBuildFailed', { error: (error as Error).message }));
  } finally {
    isBuilding.value = false;
  }
}

// 下载ROM
function downloadRom() {
  if (!buildResult.value) return;

  const blob = new Blob([buildResult.value.rom], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = outputName.value.replace('<CODE>', buildResult.value.code);
  a.click();
  URL.revokeObjectURL(url);

  console.log(t('messages.gbaMultiMenu.logRomDownloaded'));
}

// 应用ROM到主页面
function applyRom() {
  if (!buildResult.value) return;

  // 创建AssembledRom格式的数据
  const assembledRom = {
    data: new Uint8Array(buildResult.value.rom),
    totalSize: buildResult.value.rom.byteLength,
    slots: [], // GBA多游戏菜单不需要具体的slots信息
  };

  // 保存到store，用于传递到主页
  romAssemblyResultStore.setResult(assembledRom, 'GBA');

  console.log(t('messages.gbaMultiMenu.logRomApplied'));

  // 导航回主页
  void router.push('/');
}

// 工具函数
function formatFileSize(size: number): string {
  return formatBytes(size);
}

function resetState() {
  menuRomData.value = null;
  menuRomFileName.value = '';
  gameRomItems.value = [];
  bgImageData.value = null;
  bgImageFileName.value = '';
  saveFiles.value.clear();
  expandedConfigs.value.clear();
  cartridgeType.value = 3;
  batteryPresent.value = true;
  outputName.value = 'LK_MULTIMENU_<CODE>.gba';
  isBuilding.value = false;
  buildResult.value = null;
  gameIdCounter = 0;
  draggedIndex = -1;
}

function closeView() {
  goBack();
}

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
    if (file.name.toLowerCase().endsWith('.png')) {
      processBgImageFile(file);
    }
  }
}

function handleSaveFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (files && files.length > 0) {
    Array.from(files).forEach(file => {
      if (file.name.toLowerCase().endsWith('.sav')) {
        processSaveFile(file);
      }
    });
  }
}

// 拖拽处理函数
function handleDragStart(e: DragEvent, index: number) {
  draggedIndex = index;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
  }
}

function handleDrop(e: DragEvent, dropIndex: number) {
  e.preventDefault();

  if (draggedIndex === -1 || draggedIndex === dropIndex) {
    return;
  }

  const items = [...gameRomItems.value];
  const draggedItem = items[draggedIndex];

  // 移除原位置的项目
  items.splice(draggedIndex, 1);

  // 在新位置插入项目
  items.splice(dropIndex, 0, draggedItem);

  // 更新save_slot以反映新的顺序
  items.forEach((item, idx) => {
    item.config.save_slot = idx + 1;
  });

  gameRomItems.value = items;
  draggedIndex = -1;

  console.log(t('messages.gbaMultiMenu.logGameReordered'));
}

// 切换游戏配置面板
function toggleGameConfig(fileName: string) {
  if (expandedConfigs.value.has(fileName)) {
    expandedConfigs.value.delete(fileName);
  } else {
    expandedConfigs.value.add(fileName);
  }
}
</script>

<style scoped>
.gba-multi-menu-view {
  min-height: 100vh;
  background: var(--color-bg);
  padding: 0;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  overflow-y: auto;
}

.page-header {
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border-light);
  padding: var(--space-4) var(--space-6);
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: 100;
}

.page-title {
  margin: 0;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.header-controls {
  display: flex;
  align-items: center;
  gap: var(--space-5);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background 0.2s ease;
}

.back-btn:hover {
  background: var(--color-bg-hover);
}

.back-btn:active {
  transform: scale(0.98);
}

.gba-multi-menu-content {
  padding: var(--space-6);
  max-width: 80%;
  margin: 0 auto;
}

.modal-title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
}

.header-controls {
  display: flex;
  align-items: center;
  gap: var(--space-5);
}

.status-info,
.result-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
}

.status-label,
.result-label {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.status-value {
  font-weight: var(--font-weight-semibold);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
}

.status-ready {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text);
}

.status-building {
  background-color: var(--color-bg-secondary);
  color: var(--color-primary);
}

.status-success {
  background-color: var(--color-success-light);
  color: var(--color-success);
}

.main-layout {
  display: flex;
  gap: var(--space-6);
  margin-bottom: var(--space-6);
  align-items: stretch;
}

.left-section {
  flex: 3;
  display: flex;
  flex-direction: column;
  max-width: 70%;
}

.right-section {
  flex: 2;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.right-section .file-section {
  flex: 1; /* 右侧两个区域等高 */
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.left-section .file-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.right-section .file-upload-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.left-section .file-upload-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.file-upload-area {
  background-color: transparent;
  padding: 0;
  cursor: pointer;
  transition: background-color 0.2s;
  min-height: 120px;
}

.file-upload-area:hover {
  background-color: transparent;
}

.file-drop-zone {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  min-height: 120px;
  border: var(--border-width) var(--border-style) var(--color-border);
  border-radius: var(--radius-lg);
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
  background-color: var(--color-bg-tertiary);
  padding: var(--space-4);
}

.file-drop-zone:has(.file-list) {
  align-items: flex-start;
  justify-content: flex-start;
  padding: 0;
}

.file-list {
  border: var(--border-width) var(--border-style) var(--color-border-light);
  border-radius: var(--radius-base);
  background-color: var(--color-bg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  width: 100%;
  margin-top: 0;
  margin-bottom: auto;
}

.file-item-container {
  border-bottom: var(--border-width) var(--border-style) var(--color-border-light);
  cursor: move;
  transition: all 0.2s ease;
  background-color: var(--color-bg);
  position: relative;
}

.file-item-container:hover {
  background-color: var(--color-bg-secondary);
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

.file-item-container:last-child {
  border-bottom: none;
}

.file-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: var(--border-width) var(--border-style) var(--color-border-light);
  background-color: var(--color-bg);
  transition: all 0.2s ease;
}

.file-item:hover {
  background-color: var(--color-bg-secondary);
}

.file-item:last-child {
  border-bottom: none;
}

.placeholder-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  flex: 1;
  flex-direction: column;
  text-align: center;
}

.placeholder-icon {
  font-size: var(--font-size-3xl);
  color: var(--color-primary);
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.placeholder-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  text-align: left;
}

.placeholder-text p {
  margin: 0;
}

.hint {
  background: var(--color-primary);
  color: var(--color-bg);
  padding: var(--space-2) var(--space-4);
  border-radius: 20px;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  margin-top: var(--space-2);
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
}

.file-drop-zone:hover .hint {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.file-drop-zone:hover .placeholder-icon {
  color: var(--color-primary-hover);
  transform: scale(1.1);
}

.file-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.file-name {
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-size {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.file-item-container {
  border-bottom: var(--border-width) var(--border-style) var(--color-border-light);
  cursor: move;
  transition: all 0.2s ease;
}

.file-item-container:hover {
  background-color: var(--color-bg-secondary);
}

.file-item-container:last-child {
  border-bottom: none;
}

.file-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
}

.drag-handle {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: grab;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-base);
}

.drag-handle:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text);
}

.drag-handle:active {
  cursor: grabbing;
}

/* 游戏配置面板样式 */
.game-config-panel {
  margin-top: var(--space-3);
  padding: var(--space-4);
  background-color: var(--color-bg-secondary);
  border: var(--border-width) var(--border-style) var(--color-border);
  border-radius: var(--radius-base);
  border-top: var(--border-width-thick) var(--border-style) var(--color-primary);
}

.config-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.config-row:last-child {
  margin-bottom: 0;
}

.config-row label {
  min-width: 80px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.config-row label:has(input[type="checkbox"]) {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  min-width: auto;
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

/* 背景图像预览样式 */
.bg-image-info {
  cursor: pointer;
  transition: all 0.2s ease;
}

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
  max-width: 400px;
  max-height: 500px;
  border: var(--border-width) var(--border-style) var(--color-primary);
}

.preview-image {
  max-width: 100%;
  max-height: 300px;
  object-fit: contain;
  display: block;
  box-shadow: var(--shadow-sm);
}

.preview-info {
  margin-top: var(--space-3);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.preview-filename {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  text-align: center;
}

.preview-size {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
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

/* 加载遮罩样式 */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--color-overlay);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-content {
  text-align: center;
  padding: var(--space-8);
  background: var(--color-bg);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  border: var(--border-width) var(--border-style) var(--color-border);
}

.loading-spinner {
  width: var(--space-12);
  height: var(--space-12);
  margin: 0 auto var(--space-4) auto;
  border: var(--border-width-thick) var(--border-style) var(--color-bg-tertiary);
  border-top: var(--border-width-thick) var(--border-style) var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin-bottom: var(--space-2);
}

.loading-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}
</style>
