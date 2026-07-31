import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FileDropZone from '@/components/common/FileDropZone.vue';

const { readFileMock, showToastMock } = vi.hoisted(() => ({
  readFileMock: vi.fn(),
  showToastMock: vi.fn(),
}));

vi.mock('@/utils/file-io', () => ({
  downloadBlob: vi.fn(),
  readFileAsArrayBuffer: readFileMock,
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast: showToastMock }),
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => `${key}:${JSON.stringify(params ?? {})}`,
  }),
}));

function mountDropZone(multiple = false, fileData: Uint8Array | null = null) {
  return mount(FileDropZone, {
    props: {
      acceptTypes: '.bin',
      acceptHint: '.bin',
      mainText: 'Select',
      fileTitle: 'Binary',
      fileData,
      fileName: fileData ? 'existing.bin' : '',
      multiple,
    },
  });
}

async function selectFiles(wrapper: ReturnType<typeof mountDropZone>, files: File[]) {
  const input = wrapper.get('input[type="file"]');
  Object.defineProperty(input.element, 'files', { configurable: true, value: files });
  await input.trigger('change');
  await flushPromises();
}

describe('FileDropZone read failures', () => {
  beforeEach(() => {
    readFileMock.mockReset();
    showToastMock.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('reports a single-file failure without replacing the existing file', async () => {
    const error = new DOMException('unreadable', 'NotReadableError');
    readFileMock.mockRejectedValue(error);
    const wrapper = mountDropZone(false, new Uint8Array([9]));

    await selectFiles(wrapper, [new File(['bad'], 'bad.bin')]);

    expect(wrapper.emitted('file-selected')).toBeUndefined();
    expect(wrapper.emitted('file-error')).toEqual([[{
      fileName: 'bad.bin',
      error,
    }]]);
    expect(showToastMock).toHaveBeenCalledWith(
      'ui.file.readFailed:{"name":"bad.bin"}',
      'error',
    );
  });

  it('reports an aborted file read to the user', async () => {
    const abortError = new DOMException('aborted', 'AbortError');
    readFileMock.mockRejectedValue(abortError);
    const wrapper = mountDropZone();

    await selectFiles(wrapper, [new File(['cancelled'], 'cancelled.bin')]);

    expect(wrapper.emitted('file-error')?.[0]?.[0]).toEqual({
      fileName: 'cancelled.bin',
      error: abortError,
    });
    expect(showToastMock).toHaveBeenCalledWith(
      'ui.file.readFailed:{"name":"cancelled.bin"}',
      'error',
    );
  });

  it('emits successful files and one aggregate toast for partial multi-file failure', async () => {
    const goodData = new Uint8Array([1, 2]).buffer;
    readFileMock.mockImplementation((file: File) => file.name === 'good.bin'
      ? Promise.resolve(goodData)
      : Promise.reject(new Error('read failed')));
    const wrapper = mountDropZone(true);

    await selectFiles(wrapper, [
      new File(['good'], 'good.bin'),
      new File(['bad'], 'bad.bin'),
    ]);

    expect(wrapper.emitted('file-selected')?.[0]?.[0]).toEqual([{
      name: 'good.bin',
      data: new Uint8Array([1, 2]),
      size: 2,
    }]);
    expect(wrapper.emitted('file-error')?.[0]?.[0]).toMatchObject({ fileName: 'bad.bin' });
    expect(showToastMock).toHaveBeenCalledOnce();
    expect(showToastMock).toHaveBeenCalledWith(
      'ui.file.readFailedCount:{"count":1}',
      'error',
    );
  });
});
