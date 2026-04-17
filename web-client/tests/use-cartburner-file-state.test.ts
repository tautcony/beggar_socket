import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCartBurnerFileState } from '@/composables/cartburner/useCartBurnerFileState';
import type { FileInfo } from '@/types/file-info';

const { isTauriMock } = vi.hoisted(() => ({
  isTauriMock: vi.fn(() => false),
}));

vi.mock('@/utils/tauri', () => ({
  isTauri: isTauriMock,
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('useCartBurnerFileState', () => {
  beforeEach(() => {
    isTauriMock.mockReturnValue(false);
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
});
