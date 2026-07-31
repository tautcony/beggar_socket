import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadBlob, readFileAsArrayBuffer } from '@/utils/file-io';

const OriginalFileReader = globalThis.FileReader;

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.FileReader = OriginalFileReader;
});

class MockFileReader {
  static nextResult: ArrayBuffer | null = new Uint8Array([1, 2, 3]).buffer;
  static nextError: Error | null = null;
  static abortInstances: MockFileReader[] = [];

  result: string | ArrayBuffer | null = null;
  error: DOMException | null = null;
  readyState: number = FileReader.EMPTY;
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
  onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
  onabort: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;

  readAsArrayBuffer() {
    this.readyState = FileReader.LOADING;
    queueMicrotask(() => {
      if (MockFileReader.nextError) {
        this.error = new DOMException(MockFileReader.nextError.message, 'NotReadableError');
        this.readyState = FileReader.DONE;
        this.onerror?.call(this as unknown as FileReader, new ProgressEvent('error') as ProgressEvent<FileReader>);
        return;
      }
      this.result = MockFileReader.nextResult;
      this.readyState = FileReader.DONE;
      this.onload?.call(this as unknown as FileReader, new ProgressEvent('load') as ProgressEvent<FileReader>);
    });
  }

  abort() {
    MockFileReader.abortInstances.push(this);
    this.readyState = FileReader.DONE;
    this.onabort?.call(this as unknown as FileReader, new ProgressEvent('abort') as ProgressEvent<FileReader>);
  }
}

describe('file-io utilities', () => {
  it('reads files as ArrayBuffer', async () => {
    MockFileReader.nextResult = new Uint8Array([4, 5, 6]).buffer;
    MockFileReader.nextError = null;
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

    await expect(readFileAsArrayBuffer(new File(['x'], 'demo.bin'))).resolves.toEqual(new Uint8Array([4, 5, 6]).buffer);
  });

  it('rejects when FileReader fails', async () => {
    MockFileReader.nextError = new Error('read failed');
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

    await expect(readFileAsArrayBuffer(new File(['x'], 'bad.bin'))).rejects.toMatchObject({
      name: 'NotReadableError',
      message: 'read failed',
    });
  });

  it('aborts an active read when the signal aborts', async () => {
    MockFileReader.nextError = null;
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;
    const controller = new AbortController();

    const read = readFileAsArrayBuffer(new File(['x'], 'cancel.bin'), controller.signal);
    controller.abort();

    await expect(read).rejects.toMatchObject({ name: 'AbortError' });
    expect(MockFileReader.abortInstances).toHaveLength(1);
  });

  it('revokes blob URLs even when click fails', () => {
    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    const anchor = document.createElement('a');
    const appendChild = vi.spyOn(document.body, 'appendChild');
    const removeChild = vi.spyOn(document.body, 'removeChild');

    vi.spyOn(URL, 'createObjectURL').mockImplementation(createObjectURL);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revokeObjectURL);
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    vi.spyOn(anchor, 'click').mockImplementation(() => {
      throw new Error('click failed');
    });

    expect(() => {
      downloadBlob(new Blob(['data']), 'dump.bin');
    }).toThrow('click failed');
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(removeChild).toHaveBeenCalledWith(anchor);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });
});
