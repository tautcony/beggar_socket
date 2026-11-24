import { CartridgeAdapter } from './cartridge-adapter';
import { GbflashGbaAdapter } from './gbflash-gba-adapter';
import { GbflashMbcAdapter } from './gbflash-mbc-adapter';
import { GBAAdapter } from './gba-adapter';
import { MBC5Adapter } from './mbc5-adapter';

export { CartridgeAdapter, type LogCallback, type ProgressCallback, type TranslateFunction } from './cartridge-adapter';
export { GbflashBaseAdapter } from './gbflash-base-adapter';
export { GbflashGbaAdapter } from './gbflash-gba-adapter';
export { GbflashMbcAdapter } from './gbflash-mbc-adapter';
export { GBAAdapter } from './gba-adapter';
export { MBC5Adapter } from './mbc5-adapter';

export default {
  CartridgeAdapter,
  GbflashGbaAdapter,
  GbflashMbcAdapter,
  GBAAdapter,
  MBC5Adapter,
};
