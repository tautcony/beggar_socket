import { CartridgeProtocolPortAdapter } from '../adapters/cartridge-protocol-port';
import { type BurnerUseCase, BurnerUseCaseImpl } from './burner-use-case';

export interface CreateBurnerUseCaseOptions {
  translate: (key: string) => string;
  formatHex: (value: number, length?: number) => string;
}

export function createBurnerUseCase(options: CreateBurnerUseCaseOptions): BurnerUseCase {
  const protocolPort = new CartridgeProtocolPortAdapter();
  return new BurnerUseCaseImpl(protocolPort, options.translate, options.formatHex);
}
