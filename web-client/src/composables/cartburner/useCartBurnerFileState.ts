import { ref } from 'vue';

import type { FileInfo } from '@/types/file-info';
import { formatBytes } from '@/utils/formatter-utils';

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

  function onRomFileSelected(fileInfo: FileInfo | FileInfo[]) {
    const selected = Array.isArray(fileInfo) ? fileInfo[0] : fileInfo;
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
    const selected = Array.isArray(fileInfo) ? fileInfo[0] : fileInfo;
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
    log(translate('messages.rom.sizeChanged', { size: formatBytes(parseInt(hexSize, 16)) }));
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
    log(translate('messages.ram.sizeChanged', { size: formatBytes(parseInt(hexSize, 16)) }));
  }

  function onRamTypeChange(type: string) {
    selectedRamType.value = type;
    log(translate('messages.ram.typeChanged', { type }));
  }

  function saveAsFile(data: Uint8Array, filename: string) {
    const blob = new Blob([data as BlobPart], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function onFileNameSelected(fileName: string) {
    if (pendingRamData.value) {
      const fileExtension = fileName.includes('.') ? '' : '.sav';
      const outputName = `${fileName}${fileExtension}`;
      saveAsFile(pendingRamData.value, outputName);
      pendingRamData.value = null;
      log(translate('messages.ram.exportSuccess', { name: outputName }));
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
