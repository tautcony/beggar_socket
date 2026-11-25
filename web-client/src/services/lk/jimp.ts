import './buffer-polyfill';

import { createJimp } from '@jimp/core';
import jpeg from '@jimp/js-jpeg';
import png from '@jimp/js-png';
import * as resize from '@jimp/plugin-resize';

export const Jimp = createJimp({
  formats: [jpeg, png],
  plugins: [resize.methods],
});

export { ResizeStrategy } from '@jimp/plugin-resize';
export { rgbaToInt } from '@jimp/utils';
