import { describe, expect, it } from 'vitest';

describe('Jimp browser environment compatibility', () => {
  it('polyfills global Buffer on import when absent and generates resized indexed preview', async () => {
    const originalBufferDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Buffer');
    try {
      Reflect.deleteProperty(globalThis, 'Buffer');
      expect(typeof globalThis.Buffer).toBe('undefined');

      const { Jimp, ResizeStrategy, rgbaToInt } = await import('@/services/lk/jimp');
      expect(typeof globalThis.Buffer).toBe('function');

      const source = new Jimp({ width: 32, height: 24, color: rgbaToInt(255, 128, 64, 255) });
      const resized = source.clone();
      resized.resize({ w: 16, h: 12, mode: ResizeStrategy.HERMITE });
      expect(resized.width).toBe(16);
      expect(resized.height).toBe(12);

      const pngBuffer = await resized.getBuffer('image/png');
      expect(pngBuffer.length).toBeGreaterThan(0);

      const { generateIndexedPreviewImage } = await import('@/services/lk/imageUtils');
      const previewUrl = await generateIndexedPreviewImage(source);
      expect(previewUrl.startsWith('data:image/png;base64,')).toBe(true);
    } finally {
      if (originalBufferDescriptor) {
        Object.defineProperty(globalThis, 'Buffer', originalBufferDescriptor);
      }
    }
  });

  it('decodes PNG and JPEG buffers and resizes with HERMITE', async () => {
    const [{ default: jpeg }, { Jimp, ResizeStrategy, rgbaToInt }] = await Promise.all([
      import('@jimp/js-jpeg'),
      import('@/services/lk/jimp'),
    ]);

    const source = new Jimp({ width: 32, height: 24, color: rgbaToInt(200, 100, 50, 255) });
    const pngBuffer = await source.getBuffer('image/png');
    const jpegBuffer = jpeg().encode({
      width: 32,
      height: 24,
      data: Buffer.alloc(32 * 24 * 4, 200),
    });

    const decodedPng = await Jimp.fromBuffer(pngBuffer);
    const decodedJpeg = await Jimp.fromBuffer(jpegBuffer);
    decodedJpeg.resize({ w: 16, h: 12, mode: ResizeStrategy.HERMITE });

    expect(decodedPng.width).toBe(32);
    expect(decodedPng.height).toBe(24);
    expect(decodedJpeg.width).toBe(16);
    expect(decodedJpeg.height).toBe(12);
  });
});
