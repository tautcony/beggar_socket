import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCartBurnerFileState } from '@/composables/cartburner/useCartBurnerFileState';
import type { FileInfo } from '@/types/file-info';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('useCartBurnerFileState', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('ignores empty file selections', () => {
    const log = vi.fn();
    const state = useCartBurnerFileState(log, (key) => key);

    state.onRomFileSelected([]);
    state.onRamFileSelected([]);

    expect(state.romFileName.value).toBe('');
    expect(state.romFileData.value).toBeNull();
    expect(state.ramFileName.value).toBe('');
    expect(state.ramFileData.value).toBeNull();
    expect(log).not.toHaveBeenCalled();
  });

  it('revokes blob URLs even when anchor click fails', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    const appendChild = vi.spyOn(document.body, 'appendChild');
    const removeChild = vi.spyOn(document.body, 'removeChild');
    const originalCreateObjectURL = URL.createObjectURL.bind(URL);
    const originalRevokeObjectURL = URL.revokeObjectURL.bind(URL);

    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    try {
      const state = useCartBurnerFileState(vi.fn(), (key) => key);
      const anchor = document.createElement('a');
      vi.spyOn(document, 'createElement').mockReturnValue(anchor);
      vi.spyOn(anchor, 'click').mockImplementation(() => {
        throw new Error('click failed');
      });

      await expect(state.saveAsFile(new Uint8Array([1, 2, 3]), 'dump.bin')).rejects.toThrow('click failed');
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(appendChild).toHaveBeenCalledWith(anchor);
      expect(removeChild).toHaveBeenCalledWith(anchor);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });

  it('stores selected rom and ram files when present', () => {
    const log = vi.fn();
    const state = useCartBurnerFileState(
      log,
      (key, params) => `${key}:${typeof params?.name === 'string' ? params.name : ''}`,
    );
    const romFile: FileInfo = {
      name: 'game.gb',
      size: 3,
      data: new Uint8Array([1, 2, 3]),
    };
    const ramFile: FileInfo = {
      name: 'save.sav',
      size: 2,
      data: new Uint8Array([4, 5]),
    };

    state.onRomFileSelected(romFile);
    state.onRamFileSelected([ramFile]);

    expect(state.romFileName.value).toBe('game.gb');
    expect(state.romFileData.value).toEqual(new Uint8Array([1, 2, 3]));
    expect(state.ramFileName.value).toBe('save.sav');
    expect(state.ramFileData.value).toEqual(new Uint8Array([4, 5]));
    expect(log).toHaveBeenCalledTimes(2);
  });

  it('increments selection revisions, returns owned save output, and rejects stale sessions', () => {
    const state = useCartBurnerFileState(vi.fn(), (key) => key);
    const romData = new Uint8Array([1, 2, 3]);
    const ramData = new Uint8Array([4, 5]);
    state.onRomFileSelected({ name: 'game.gba', size: 3, data: romData });
    state.onRamFileSelected({ name: 'game.sav', size: 2, data: ramData });
    expect(state.romRevision.value).toBe(1);
    expect(state.ramRevision.value).toBe(1);
    expect(state.romFileData.value).not.toBe(romData);
    expect(state.ramFileData.value).not.toBe(ramData);

    const launch = {
      sessionId: 'old-session', romName: 'game.gba',
      romRevision: state.romRevision.value, ramRevision: state.ramRevision.value,
      saveName: 'game.sav', usesSelectedSave: true, ramWasEmptyAtLaunch: false,
    };
    state.activatePreviewSession(launch.sessionId);
    state.onRamFileSelected({ name: 'game.sav', size: 2, data: new Uint8Array([6, 7]) });
    const delayed = { launch, data: new Uint8Array([8, 9]), capacity: 2, changed: true };
    expect(state.applyPreviewSaveResult(delayed, false)).toBe('retained');
    expect(state.ramFileData.value).toEqual(new Uint8Array([6, 7]));
    expect(state.pendingPreviewResult.value?.data).toEqual(new Uint8Array([8, 9]));

    state.discardPendingPreviewResult();
    state.activatePreviewSession('new-session');
    const staleOutput = { ...delayed, launch: { ...launch, sessionId: 'older-session' } };
    expect(state.applyPreviewSaveResult(staleOutput, false)).toBe('stale');
    expect(state.pendingPreviewResult.value?.launch.sessionId).toBe('older-session');
    state.discardPendingPreviewResult();
    expect(state.applyPreviewSaveResult(staleOutput, false)).toBe('unchanged');
    expect(state.pendingPreviewResult.value).toBeNull();
  });

  it('allows a new save to populate RAM only when RAM was empty at launch', () => {
    const state = useCartBurnerFileState(vi.fn(), (key) => key);
    state.onRomFileSelected({ name: 'new.gba', size: 1, data: new Uint8Array([1]) });
    const launch = {
      sessionId: 'new-save', romName: 'new.gba',
      romRevision: state.romRevision.value, ramRevision: state.ramRevision.value,
      usesSelectedSave: false, ramWasEmptyAtLaunch: true,
    };
    state.activatePreviewSession(launch.sessionId);
    const bytes = new Uint8Array([3, 4, 5]);
    expect(state.applyPreviewSaveResult({ launch, data: bytes, capacity: 3, changed: true }, false)).toBe('applied');
    bytes[0] = 99;
    expect(state.ramFileName.value).toBe('new.sav');
    expect(state.ramFileData.value).toEqual(new Uint8Array([3, 4, 5]));
  });
});
