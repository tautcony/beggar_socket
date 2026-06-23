import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getNativeRuntimeMetadata,
  listNativeSerialPorts,
  saveBinaryFile,
} from '@/platform/native';

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

describe('native platform facade', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    invokeMock.mockReset();
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it('uses Rust save command in Tauri and maps cancel result', async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    invokeMock.mockResolvedValueOnce(null);

    await expect(saveBinaryFile(new Uint8Array([1, 2]), 'dump.sav')).resolves.toEqual({ saved: false });
    expect(invokeMock).toHaveBeenCalledWith('save_binary_file', {
      suggestedFilename: 'dump.sav',
      bytes: [1, 2],
    });
  });

  it('keeps browser save path native to the web runtime', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    const appendChild = vi.spyOn(document.body, 'appendChild');
    const removeChild = vi.spyOn(document.body, 'removeChild');
    const originalCreateObjectURL = URL.createObjectURL.bind(URL);
    const originalRevokeObjectURL = URL.revokeObjectURL.bind(URL);

    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    try {
      const anchor = document.createElement('a');
      vi.spyOn(document, 'createElement').mockReturnValue(anchor);
      vi.spyOn(anchor, 'click').mockImplementation(() => {});

      await expect(saveBinaryFile(new Uint8Array([1, 2, 3]), 'dump.bin')).resolves.toEqual({ saved: true });
      expect(invokeMock).not.toHaveBeenCalled();
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(appendChild).toHaveBeenCalledWith(anchor);
      expect(removeChild).toHaveBeenCalledWith(anchor);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });

  it('loads runtime metadata from Rust in Tauri', async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    invokeMock.mockResolvedValueOnce({
      appName: 'ChisFlash Burner',
      appVersion: '1.5.0',
      identifier: 'com.tautcony.chisflash-burner',
      tauriVersion: '2.10.3',
      os: 'windows',
      arch: 'x86_64',
    });

    await expect(getNativeRuntimeMetadata()).resolves.toEqual({
      appName: 'ChisFlash Burner',
      appVersion: '1.5.0',
      identifier: 'com.tautcony.chisflash-burner',
      tauriVersion: '2.10.3',
      os: 'windows',
      arch: 'x86_64',
    });
  });

  it('normalizes Rust serial port descriptors', async () => {
    invokeMock.mockResolvedValueOnce([
      {
        path: 'COM3',
        manufacturer: 'STMicroelectronics',
        product: 'Beggar Socket',
        serialNumber: 'abc123',
        vendorId: '0483',
        productId: '0721',
      },
    ]);

    await expect(listNativeSerialPorts()).resolves.toEqual([
      {
        path: 'COM3',
        manufacturer: 'STMicroelectronics',
        product: 'Beggar Socket',
        serialNumber: 'abc123',
        vendorId: '0483',
        productId: '0721',
      },
    ]);
  });
});
