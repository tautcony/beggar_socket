import { invoke } from '@tauri-apps/api/core';
import { ref } from 'vue';

import type { FileInfo } from '@/types/file-info';
import { formatBytes } from '@/utils/formatter-utils';
import { isTauri } from '@/utils/tauri';

export function useCartBurnerFileState(log: (message: string) => void, translate: (key: string, params?: Record<string, unknown>) => string) {
  const romFileData = ref<Uint8Array | null>(null);
  const romFileName = ref('');
  const selectedRomSize = ref('0x00800000');
  const selectedBaseAddress = ref('0x00000000');

  const ramFileData = ref<Uint8Array | null>(null);
  const ramFileName = ref('');
  const selectedRamSize = ref('0x08000');
  const selectedRamType = ref('SRAM');
  const selectedRamBaseAddress = ref('0x000000');

  const showFileNameSelector = ref(false);
  const pendingRamData = ref<Uint8Array | null>(null);

  function getSelectedFile(fileInfo: FileInfo | FileInfo[]): FileInfo | null {
    if (Array.isArray(fileInfo)) {
      return fileInfo[0] ?? null;
    }

    return fileInfo ?? null;
  }

  function onRomFileSelected(fileInfo: FileInfo | FileInfo[]) {
    const selected = getSelectedFile(fileInfo);
    if (!selected) {
      return;
    }
    romFileName.value = selected.name;
    romFileData.value = selected.data;
    log(translate('messages.file.selectRom', { name: selected.name, size: formatBytes(selected.size) }));
  }

  function onRomFileCleared() {
    romFileData.value = null;
    romFileName.value = '';
    log(translate('messages.file.clearRom'));
  }

  function onRamFileSelected(fileInfo: FileInfo | FileInfo[]) {
    const selected = getSelectedFile(fileInfo);
    if (!selected) {
      return;
    }
    ramFileName.value = selected.name;
    ramFileData.value = selected.data;
    log(translate('messages.file.selectRam', { name: selected.name, size: formatBytes(selected.size) }));
  }

  function onRamFileCleared() {
    ramFileData.value = null;
    ramFileName.value = '';
    log(translate('messages.file.clearRam'));
  }

  function onRomSizeChange(hexSize: string) {
    selectedRomSize.value = hexSize;
    const bytes = parseInt(hexSize, 16);
    log(translate('messages.rom.sizeChanged', { size: formatBytes(isNaN(bytes) ? 0 : bytes) }));
  }

  function onRomBaseAddressChange(hexAddress: string) {
    selectedBaseAddress.value = hexAddress;
    log(translate('messages.rom.baseAddressChanged', { address: hexAddress }));
  }

  function onRamBaseAddressChange(hexAddress: string) {
    selectedRamBaseAddress.value = hexAddress;
    log(translate('messages.ram.baseAddressChanged', { address: hexAddress }));
  }

  function onRamSizeChange(hexSize: string) {
    selectedRamSize.value = hexSize;
    const bytes = parseInt(hexSize, 16);
    log(translate('messages.ram.sizeChanged', { size: formatBytes(isNaN(bytes) ? 0 : bytes) }));
  }

  function onRamTypeChange(type: string) {
    selectedRamType.value = type;
    log(translate('messages.ram.typeChanged', { type }));
  }

  async function saveAsFile(data: Uint8Array, filename: string): Promise<{ saved: boolean; path?: string }> {
    if (isTauri()) {
      const savedPath = await invoke<string | null>('save_binary_file', {
        suggestedFilename: filename,
        bytes: Array.from(data),
      });
      return {
        saved: Boolean(savedPath),
        path: savedPath ?? undefined,
      };
    }

    let url: string | null = null;
    let anchor: HTMLAnchorElement | null = null;

    try {
      const blob = new Blob([data as BlobPart], { type: 'application/octet-stream' });
      url = URL.createObjectURL(blob);
      anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
    } finally {
      if (anchor?.parentNode) {
        anchor.parentNode.removeChild(anchor);
      }
      if (url) {
        URL.revokeObjectURL(url);
      }
    }

    return { saved: true };
  }

  async function onFileNameSelected(fileName: string) {
    if (pendingRamData.value) {
      const fileExtension = fileName.includes('.') ? '' : '.sav';
      const outputName = `${fileName}${fileExtension}`;
      const result = await saveAsFile(pendingRamData.value, outputName);
      if (result.saved) {
        pendingRamData.value = null;
        log(translate('messages.ram.exportSuccess', { name: outputName }));
      } else {
        log(translate('messages.operation.cancelled'));
      }
    }
  }

  return {
    romFileData,
    romFileName,
    selectedRomSize,
    selectedBaseAddress,
    ramFileData,
    ramFileName,
    selectedRamSize,
    selectedRamType,
    selectedRamBaseAddress,
    showFileNameSelector,
    pendingRamData,
    onRomFileSelected,
    onRomFileCleared,
    onRamFileSelected,
    onRamFileCleared,
    onRomSizeChange,
    onRomBaseAddressChange,
    onRamBaseAddressChange,
    onRamSizeChange,
    onRamTypeChange,
    onFileNameSelected,
    saveAsFile,
  };
}
