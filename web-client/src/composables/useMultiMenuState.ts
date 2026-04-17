import { computed, inject, type InjectionKey, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { useToast } from '@/composables/useToast';
import { type BuildInput, type BuildResult, buildRom as buildRomFromService } from '@/services/lk';
import { useRomAssemblyResultStore } from '@/stores/rom-assembly-store';
import { formatBytes } from '@/utils/formatter-utils';

export interface GameConfig {
  file: string;
  title: string;
  title_font: number;
  save_slot: number;
  enabled: boolean;
}

export interface GameRomItem {
  id: string;
  fileName: string;
  data: ArrayBuffer;
  config: GameConfig;
}

export function useMultiMenuState() {
  const { showToast } = useToast();
  const { t } = useI18n();
  const router = useRouter();
  const romAssemblyResultStore = useRomAssemblyResultStore();

  // --- Reactive State ---
  const menuRomData = ref<ArrayBuffer | null>(null);
  const menuRomFileName = ref('');
  const gameRomItems = ref<GameRomItem[]>([]);
  const bgImageData = ref<ArrayBuffer | null>(null);
  const bgImageFileName = ref('');
  const saveFiles = ref(new Map<string, ArrayBuffer>());
  const expandedConfigs = ref<Set<string>>(new Set());

  const showBgImagePreview = ref(false);
  const bgImagePreviewUrl = ref<string | null>(null);
  const processedBgImagePreviewUrl = ref<string | null>(null);
  const bgImageDimensions = ref<{ width: number; height: number } | null>(null);

  const cartridgeType = ref(5);
  const batteryPresent = ref(true);
  const outputName = ref('LK_MULTIMENU_<CODE>.gba');

  const isBuilding = ref(false);
  const buildResult = ref<BuildResult | null>(null);
  const isLoadingLibrary = ref(false);
  const libraryLoaded = ref(false);

  let gameIdCounter = 0;

  // --- Computed ---
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

  // --- Init ---
  const initAbortController = new AbortController();

  // --- Methods ---
  function goBack() {
    router.back();
  }

  async function preloadImageLibrary() {
    if (libraryLoaded.value || isLoadingLibrary.value) return;

    isLoadingLibrary.value = true;
    try {
      await import('jimp');
      libraryLoaded.value = true;
      showToast(t('ui.gbaMultiMenu.libraryLoaded'), 'success');
    } catch (error) {
      showToast(t('ui.gbaMultiMenu.libraryLoadFailed'), 'error');
      console.error('Failed to load image library:', error);
      libraryLoaded.value = true;
    } finally {
      isLoadingLibrary.value = false;
    }
  }

  async function loadDefaultBackground() {
    try {
      cleanupBgImagePreview();

      const response = await fetch('bg.png', { signal: initAbortController.signal });

      if (response.ok || response.status === 304) {
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        bgImageData.value = arrayBuffer;
        bgImageFileName.value = 'bg.png';

        try {
          const { Jimp } = await import('jimp');
          const img = await Jimp.fromBuffer(arrayBuffer) as InstanceType<typeof Jimp>;

          bgImageDimensions.value = { width: img.width, height: img.height };

          const { generateIndexedPreviewImage } = await import('@/services/lk/imageUtils');
          const processedPreviewUrl = await generateIndexedPreviewImage(img);
          processedBgImagePreviewUrl.value = processedPreviewUrl;
        } catch (error) {
          console.error('Failed to generate processed preview for default image:', error);
          processedBgImagePreviewUrl.value = null;
          bgImageDimensions.value = null;
        }

        showToast(t('messages.gbaMultiMenu.bgImageLoaded', { name: 'bg.png (默认)' }), 'success');
      } else {
        showToast(t('messages.gbaMultiMenu.bgImageLoadFailed', { name: 'bg.png (默认)', status: response.status }), 'error');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      showToast(t('messages.gbaMultiMenu.bgImageLoadFailed', { name: 'bg.png (默认)', status: (error as Error).message }), 'error');
    }
  }

  async function loadDefaultMenuRom() {
    const defaultMenuRom = 'lk_multimenu_for_chisflash_01_02G.gba';
    try {
      const response = await fetch(defaultMenuRom, { signal: initAbortController.signal });

      if (response.ok || response.status === 304) {
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        menuRomData.value = arrayBuffer;
        menuRomFileName.value = defaultMenuRom;
        showToast(t('messages.gbaMultiMenu.menuRomLoaded', { name: defaultMenuRom }), 'success');
      } else {
        showToast(t('messages.gbaMultiMenu.menuRomLoadFailed', { name: defaultMenuRom, status: response.status }), 'error');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      showToast(t('messages.gbaMultiMenu.menuRomLoadFailed', { name: defaultMenuRom, status: (error as Error).message }), 'error');
    }
  }

  function processMenuRomFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result as ArrayBuffer;
      menuRomData.value = data;
      menuRomFileName.value = file.name;
      showToast(t('messages.gbaMultiMenu.menuRomLoaded', { name: file.name }), 'success');
    };
    reader.readAsArrayBuffer(file);
  }

  function processGameRomFile(file: File) {
    const existingIndex = gameRomItems.value.findIndex(item => item.fileName === file.name);
    if (existingIndex !== -1) return;

    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result as ArrayBuffer;

      const config: GameConfig = {
        file: file.name,
        title: file.name.replace('.gba', ''),
        title_font: 1,
        save_slot: gameRomItems.value.length + 1,
        enabled: true,
      };

      const newItem: GameRomItem = {
        id: `game_${gameIdCounter++}`,
        fileName: file.name,
        data: data,
        config: config,
      };

      gameRomItems.value.push(newItem);
      showToast(t('messages.gbaMultiMenu.gameRomLoaded', { name: file.name }), 'success');
    };
    reader.readAsArrayBuffer(file);
  }

  function processBgImageFile(file: File) {
    cleanupBgImagePreview();

    const reader = new FileReader();
    reader.onload = async () => {
      const data = reader.result as ArrayBuffer;
      bgImageData.value = data;
      bgImageFileName.value = file.name;

      try {
        const { Jimp } = await import('jimp');
        const img = await Jimp.fromBuffer(data) as InstanceType<typeof Jimp>;

        bgImageDimensions.value = { width: img.width, height: img.height };

        const { generateIndexedPreviewImage } = await import('@/services/lk/imageUtils');
        const processedPreviewUrl = await generateIndexedPreviewImage(img);
        processedBgImagePreviewUrl.value = processedPreviewUrl;
      } catch (error) {
        console.error('Failed to generate processed preview:', error);
        processedBgImagePreviewUrl.value = null;
        bgImageDimensions.value = null;
      }

      showToast(t('messages.gbaMultiMenu.bgImageLoaded', { name: file.name }), 'success');
    };
    reader.readAsArrayBuffer(file);
  }

  function processSaveFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result as ArrayBuffer;
      saveFiles.value.set(file.name, data);
      showToast(t('messages.gbaMultiMenu.saveFileLoaded', { name: file.name }), 'success');
    };
    reader.readAsArrayBuffer(file);
  }

  function removeGameRom(fileName: string) {
    const index = gameRomItems.value.findIndex(item => item.fileName === fileName);
    if (index !== -1) {
      gameRomItems.value.splice(index, 1);
      gameRomItems.value.forEach((item, idx) => {
        item.config.save_slot = idx + 1;
      });
    }
    expandedConfigs.value.delete(fileName);
    showToast(t('messages.gbaMultiMenu.gameRomRemoved', { name: fileName }), 'info');
  }

  function removeSaveFile(fileName: string) {
    saveFiles.value.delete(fileName);
    showToast(t('messages.gbaMultiMenu.saveFileRemoved', { name: fileName }), 'info');
  }

  function reorderGameRom(fromIndex: number, toIndex: number) {
    if (fromIndex === -1 || fromIndex === toIndex) return;

    const items = [...gameRomItems.value];
    const draggedItem = items[fromIndex];

    items.splice(fromIndex, 1);
    items.splice(toIndex, 0, draggedItem);

    items.forEach((item, idx) => {
      item.config.save_slot = idx + 1;
    });

    gameRomItems.value = items;
    showToast(t('messages.gbaMultiMenu.gameReordered'), 'success');
  }

  function toggleGameConfig(fileName: string) {
    if (expandedConfigs.value.has(fileName)) {
      expandedConfigs.value.delete(fileName);
    } else {
      expandedConfigs.value.add(fileName);
    }
  }

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

  async function buildRom() {
    if (!canBuild.value) return;

    isBuilding.value = true;
    buildResult.value = null;

    try {
      showToast(t('messages.gbaMultiMenu.buildStarted'), 'info');

      const games = gameRomItems.value.map(item => item.config);

      const config = {
        cartridge: {
          type: cartridgeType.value,
          battery_present: batteryPresent.value,
          min_rom_size: 0x400000,
        },
        games: games,
      };

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

      showToast(t('messages.gbaMultiMenu.configReady'), 'info');

      const result = await buildRomFromService(input);

      buildResult.value = result;

      showToast(t('messages.gbaMultiMenu.buildCompleted'), 'success');

    } catch (error: unknown) {
      showToast(t('messages.gbaMultiMenu.buildFailed', { error: (error as Error).message }), 'error');
      console.error('Build failed:', error);
    } finally {
      isBuilding.value = false;
    }
  }

  function downloadRom() {
    if (!buildResult.value) return;

    const blob = new Blob([buildResult.value.rom], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outputName.value.replace('<CODE>', buildResult.value.code);
    a.click();
    URL.revokeObjectURL(url);

    showToast(t('messages.gbaMultiMenu.romDownloaded'), 'success');
  }

  function applyRom() {
    if (!buildResult.value) return;

    const assembledRom = {
      data: new Uint8Array(buildResult.value.rom),
      totalSize: buildResult.value.rom.byteLength,
      slots: [],
    };

    romAssemblyResultStore.setResult(assembledRom, 'GBA');

    showToast(t('messages.gbaMultiMenu.romApplied'), 'success');

    void router.push('/');
  }

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
    cartridgeType.value = 5;
    batteryPresent.value = true;
    outputName.value = 'LK_MULTIMENU_<CODE>.gba';
    isBuilding.value = false;
    buildResult.value = null;
    gameIdCounter = 0;
  }

  // --- Initialize ---
  resetState();
  void loadDefaultBackground();
  void loadDefaultMenuRom();
  void preloadImageLibrary();

  // --- Cleanup ---
  onUnmounted(() => {
    cleanupBgImagePreview();
    initAbortController.abort();
  });

  return {
    menuRomData, menuRomFileName,
    gameRomItems, expandedConfigs,
    bgImageData, bgImageFileName,
    saveFiles,
    showBgImagePreview, bgImagePreviewUrl, processedBgImagePreviewUrl, bgImageDimensions,
    cartridgeType, batteryPresent, outputName,
    isBuilding, buildResult, isLoadingLibrary, libraryLoaded,
    canBuild, statusText, statusClass,
    goBack,
    processMenuRomFile, processGameRomFile, processBgImageFile, processSaveFile,
    removeGameRom, removeSaveFile, reorderGameRom, toggleGameConfig,
    showBgImagePreviewHandler, hideBgImagePreviewHandler,
    buildRom, downloadRom, applyRom,
    formatFileSize,
  };
}

export type MultiMenuState = ReturnType<typeof useMultiMenuState>;
export const MULTI_MENU_KEY: InjectionKey<MultiMenuState> = Symbol('multiMenu');

export function useMultiMenu(): MultiMenuState {
  const state = inject(MULTI_MENU_KEY);
  if (!state) throw new Error('useMultiMenu() requires MultiMenuState to be provided by a parent component');
  return state;
}
