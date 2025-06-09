export { CartridgeAdapter, type LogCallback, type ProgressCallback, type TranslateFunction } from './cartridge-adapter';
export { GBAAdapter } from './gba-adapter';
export { MBC5Adapter } from './mbc5-adapter';
export { MockAdapter } from './mock-adapter';

import { CartridgeAdapter } from './cartridge-adapter';
import { GBAAdapter } from './gba-adapter';
import { MBC5Adapter } from './mbc5-adapter';
import { MockAdapter } from './mock-adapter';

export default {
  CartridgeAdapter,
  GBAAdapter,
  MBC5Adapter,
  MockAdapter,
};
