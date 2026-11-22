import { CartridgeAdapter } from './cartridge-adapter';
import { FlashgbxGbaAdapter } from './flashgbx-gba-adapter';
import { FlashgbxMbcAdapter } from './flashgbx-mbc-adapter';
import { GBAAdapter } from './gba-adapter';
import { MBC5Adapter } from './mbc5-adapter';

export { CartridgeAdapter, type LogCallback, type ProgressCallback, type TranslateFunction } from './cartridge-adapter';
export { FlashgbxBaseAdapter } from './flashgbx-base-adapter';
export { FlashgbxGbaAdapter } from './flashgbx-gba-adapter';
export { FlashgbxMbcAdapter } from './flashgbx-mbc-adapter';
export { GBAAdapter } from './gba-adapter';
export { MBC5Adapter } from './mbc5-adapter';

export default {
  CartridgeAdapter,
  FlashgbxGbaAdapter,
  FlashgbxMbcAdapter,
  GBAAdapter,
  MBC5Adapter,
};
