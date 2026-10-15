import { ref } from 'vue';

import type { GbaPreviewSavePayload } from '@/features/gba-save/types';
import { saveBinaryFile } from '@/platform/native';
import type { FileInfo } from '@/types/file-info';
import { formatBytes } from '@/utils/formatter-utils';

export function useCartBurnerFileState(log: (message: string) => void, translate: (key: string, params?: Record<string, unknown>) => string) {
  const romFileData = ref<Uint8Array | null>(null);
  const romFileName = ref('');
  const selectedRomSize = ref('0x00800000');
  const selectedBaseAddress = ref('0x00000000');

  const ramFileData = ref<Uint8Array | null>(null);
  const ramFileName = ref('');
  const romRevision = ref(0);
  const ramRevision = ref(0);
  const selectedRamSize = ref('0x08000');
  const selectedRamType = ref('SRAM');
  const selectedRamBaseAddress = ref('0x000000');

  const showFileNameSelector = ref(false);
  const pendingRamData = ref<Uint8Array | null>(null);
  const pendingPreviewResult = ref<GbaPreviewSavePayload | null>(null);
  const handledPreviewSessions = new Set<string>();
  const activePreviewSessionId = ref<string | null>(null);

  function copyBytes(data: Uint8Array): Uint8Array {
    return new Uint8Array(data);
  }

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
    romFileData.value = copyBytes(selected.data);
    romRevision.value += 1;
    log(translate('messages.file.selectRom', { name: selected.name, size: formatBytes(selected.size) }));
  }

  function onRomFileCleared() {
    romFileData.value = null;
    romFileName.value = '';
    romRevision.value += 1;
    log(translate('messages.file.clearRom'));
  }

  function onRamFileSelected(fileInfo: FileInfo | FileInfo[]) {
    const selected = getSelectedFile(fileInfo);
    if (!selected) {
      return;
    }
    ramFileName.value = selected.name;
    ramFileData.value = copyBytes(selected.data);
    ramRevision.value += 1;
    log(translate('messages.file.selectRam', { name: selected.name, size: formatBytes(selected.size) }));
  }

  function onRamFileCleared() {
    ramFileData.value = null;
    ramFileName.value = '';
    ramRevision.value += 1;
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
    return saveBinaryFile(data, filename);
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

  function activatePreviewSession(sessionId: string) {
    activePreviewSessionId.value = sessionId;
  }

  function markPreviewSessionHandled(sessionId: string) {
    handledPreviewSessions.add(sessionId);
    if (handledPreviewSessions.size > 10) {
      const oldestSession = handledPreviewSessions.values().next().value;
      if (oldestSession) handledPreviewSessions.delete(oldestSession);
    }
  }

  function applyPreviewSaveResult(payload: GbaPreviewSavePayload, busy: boolean): 'applied' | 'unchanged' | 'retained' | 'stale' {
    if (handledPreviewSessions.has(payload.launch.sessionId)) return 'unchanged';
    const output = { ...payload, data: copyBytes(payload.data) };
    if (activePreviewSessionId.value !== payload.launch.sessionId) {
      if (payload.changed) {
        markPreviewSessionHandled(payload.launch.sessionId);
        pendingPreviewResult.value ??= output;
      }
      return 'stale';
    }
    markPreviewSessionHandled(payload.launch.sessionId);
    if (!payload.changed) return 'unchanged';

    const launch = payload.launch;
    const selectionIsCurrent = romRevision.value === launch.romRevision
      && ramRevision.value === launch.ramRevision;
    const hasAuthorizedTarget = launch.usesSelectedSave || launch.ramWasEmptyAtLaunch;
    if (selectionIsCurrent && !busy && hasAuthorizedTarget) {
      ramFileData.value = copyBytes(output.data);
      ramFileName.value = launch.saveName ?? `${launch.romName.replace(/\.[^.]*$/, '')}.sav`;
      ramRevision.value += 1;
      log(translate('messages.ram.previewSaveApplied', { name: ramFileName.value, size: formatBytes(output.data.length) }));
      return 'applied';
    }

    // A skipped existing SAV, stale selection, or busy burner must never
    // authorize replacing RAM. Keep a single result available for export.
    pendingPreviewResult.value ??= output;
    return 'retained';
  }

  function discardPendingPreviewResult() {
    pendingPreviewResult.value = null;
  }

  function endPreviewSession(sessionId: string) {
    if (activePreviewSessionId.value === sessionId) activePreviewSessionId.value = null;
  }

  function resetSelectedFiles() {
    romFileData.value = null;
    romFileName.value = '';
    romRevision.value += 1;
    ramFileData.value = null;
    ramFileName.value = '';
    ramRevision.value += 1;
  }

  return {
    romFileData,
    romFileName,
    romRevision,
    selectedRomSize,
    selectedBaseAddress,
    ramFileData,
    ramFileName,
    ramRevision,
    selectedRamSize,
    selectedRamType,
    selectedRamBaseAddress,
    showFileNameSelector,
    pendingRamData,
    pendingPreviewResult,
    activePreviewSessionId,
    onRomFileSelected,
    onRomFileCleared,
    onRamFileSelected,
    onRamFileCleared,
    onRomSizeChange,
    onRomBaseAddressChange,
    onRamBaseAddressChange,
    onRamSizeChange,
    onRamTypeChange,
    applyPreviewSaveResult,
    discardPendingPreviewResult,
    activatePreviewSession,
    endPreviewSession,
    resetSelectedFiles,
    onFileNameSelected,
    saveAsFile,
  };
}
