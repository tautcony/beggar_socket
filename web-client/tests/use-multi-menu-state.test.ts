import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick } from 'vue';

import { type MultiMenuState, useMultiMenuState } from '@/composables/useMultiMenuState';

const { generatePreviewMock, jimpFromBufferMock, readFileMock, showToastMock } = vi.hoisted(() => ({
  generatePreviewMock: vi.fn(() => Promise.resolve('preview:data')),
  jimpFromBufferMock: vi.fn(() => Promise.resolve({ width: 240, height: 160 })),
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
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/stores/rom-assembly-store', () => ({
  useRomAssemblyResultStore: () => ({ setResult: vi.fn() }),
}));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function responseWith(data: ArrayBuffer): Response {
  return {
    ok: true,
    status: 200,
    blob: () => Promise.resolve({ arrayBuffer: () => Promise.resolve(data) } as Blob),
  } as Response;
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await nextTick();
}

function mountState() {
  let state!: MultiMenuState;
  const wrapper = mount(defineComponent({
    setup() {
      state = useMultiMenuState();
      return {};
    },
    template: '<div />',
  }));
  return { state, wrapper };
}

describe('useMultiMenuState async ownership', () => {
  beforeEach(async () => {
    readFileMock.mockReset();
    showToastMock.mockReset();
    jimpFromBufferMock.mockClear();
    generatePreviewMock.mockClear();
    const [{ Jimp }, imageUtils] = await Promise.all([
      import('jimp'),
      import('@/services/lk/imageUtils'),
    ]);
    vi.spyOn(Jimp, 'fromBuffer').mockImplementation(jimpFromBufferMock as unknown as typeof Jimp.fromBuffer);
    vi.spyOn(imageUtils, 'generateIndexedPreviewImage').mockImplementation(generatePreviewMock);
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 404 })));
  });

  it('does not let a delayed default menu ROM overwrite a user selection', async () => {
    const defaultResponse = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn((url: string) => url.endsWith('.gba')
      ? defaultResponse.promise
      : Promise.resolve({ ok: false, status: 404 } as Response)));
    const customData = new Uint8Array([2]).buffer;
    readFileMock.mockResolvedValue(customData);
    const { state, wrapper } = mountState();
    await settle();
    showToastMock.mockClear();

    await state.processMenuRomFile(new File(['custom'], 'custom.gba'));
    const toastCountAfterCustomSelection = showToastMock.mock.calls.length;
    defaultResponse.resolve(responseWith(new Uint8Array([1]).buffer));
    await settle();

    expect(state.menuRomFileName.value).toBe('custom.gba');
    expect(state.menuRomData.value).toBe(customData);
    expect(showToastMock).toHaveBeenCalledTimes(toastCountAfterCustomSelection);
    wrapper.unmount();
  });

  it('keeps the latest menu ROM when reads finish out of order', async () => {
    const first = deferred<ArrayBuffer>();
    const second = deferred<ArrayBuffer>();
    readFileMock.mockImplementation((file: File) => file.name === 'first.gba' ? first.promise : second.promise);
    const { state, wrapper } = mountState();
    await settle();

    const firstRead = state.processMenuRomFile(new File(['first'], 'first.gba'));
    const secondRead = state.processMenuRomFile(new File(['second'], 'second.gba'));
    const secondData = new Uint8Array([2]).buffer;
    second.resolve(secondData);
    await secondRead;
    first.resolve(new Uint8Array([1]).buffer);
    await firstRead;

    expect(state.menuRomFileName.value).toBe('second.gba');
    expect(state.menuRomData.value).toBe(secondData);
    wrapper.unmount();
  });

  it('does not let a delayed default background overwrite a user selection', async () => {
    const defaultResponse = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn((url: string) => url === 'bg.png'
      ? defaultResponse.promise
      : Promise.resolve({ ok: false, status: 404 } as Response)));
    const customData = new Uint8Array([2]).buffer;
    readFileMock.mockResolvedValue(customData);
    const { state, wrapper } = mountState();
    await settle();
    showToastMock.mockClear();

    await state.processBgImageFile(new File(['custom'], 'custom.png'));
    const toastCountAfterCustomSelection = showToastMock.mock.calls.length;
    defaultResponse.resolve(responseWith(new Uint8Array([1]).buffer));
    await settle();

    expect(state.bgImageFileName.value).toBe('custom.png');
    expect(state.bgImageData.value).toBe(customData);
    expect(showToastMock).toHaveBeenCalledTimes(toastCountAfterCustomSelection);
    wrapper.unmount();
  });

  it('keeps background data, metadata, and preview from the latest selection', async () => {
    const first = deferred<ArrayBuffer>();
    const second = deferred<ArrayBuffer>();
    readFileMock.mockImplementation((file: File) => file.name === 'first.png' ? first.promise : second.promise);
    const { state, wrapper } = mountState();
    await settle();

    const firstRead = state.processBgImageFile(new File(['first'], 'first.png'));
    const secondRead = state.processBgImageFile(new File(['second'], 'second.png'));
    const secondData = new Uint8Array([2]).buffer;
    second.resolve(secondData);
    await secondRead;
    first.resolve(new Uint8Array([1]).buffer);
    await firstRead;

    expect(state.bgImageFileName.value).toBe('second.png');
    expect(state.bgImageData.value).toBe(secondData);
    expect(state.bgImageDimensions.value).toEqual({ width: 240, height: 160 });
    expect(state.processedBgImagePreviewUrl.value).toBe('preview:data');
    wrapper.unmount();
  });

  it('does not enqueue the same game ROM twice while its read is pending', async () => {
    const gameRead = deferred<ArrayBuffer>();
    readFileMock.mockReturnValue(gameRead.promise);
    const { state, wrapper } = mountState();
    await settle();
    const file = new File(['game'], 'game.gba');

    const firstRead = state.processGameRomFile(file);
    const duplicateRead = state.processGameRomFile(file);
    gameRead.resolve(new Uint8Array([1]).buffer);
    await Promise.all([firstRead, duplicateRead]);

    expect(readFileMock).toHaveBeenCalledOnce();
    expect(state.gameRomItems.value).toHaveLength(1);
    expect(state.gameRomItems.value[0]?.fileName).toBe('game.gba');
    wrapper.unmount();
  });

  it('does not commit default background processing that finishes after unmount', async () => {
    const imageProcessing = deferred<{ width: number; height: number }>();
    jimpFromBufferMock.mockReturnValue(imageProcessing.promise);
    vi.stubGlobal('fetch', vi.fn((url: string) => url === 'bg.png'
      ? Promise.resolve(responseWith(new Uint8Array([1]).buffer))
      : Promise.resolve({ ok: false, status: 404 } as Response)));
    const { state, wrapper } = mountState();
    await vi.waitFor(() => {
      expect(jimpFromBufferMock).toHaveBeenCalledOnce();
    });
    showToastMock.mockClear();

    wrapper.unmount();
    imageProcessing.resolve({ width: 240, height: 160 });
    await settle();

    expect(state.bgImageData.value).toBeNull();
    expect(state.bgImageFileName.value).toBe('');
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it('does not update state or show a toast when a default request finishes after unmount', async () => {
    const defaultResponse = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn((url: string) => url.endsWith('.gba')
      ? defaultResponse.promise
      : Promise.resolve({ ok: false, status: 404 } as Response)));
    const { state, wrapper } = mountState();
    await settle();
    showToastMock.mockClear();

    wrapper.unmount();
    defaultResponse.resolve(responseWith(new Uint8Array([1]).buffer));
    await settle();

    expect(state.menuRomData.value).toBeNull();
    expect(state.menuRomFileName.value).toBe('');
    expect(showToastMock).not.toHaveBeenCalled();
  });
});
