import { CartridgeProtocolPortAdapter } from '../adapters/cartridge-protocol-port';

import { BurnerFacadeImpl, BurnerUseCaseImpl, type BurnerFacade } from './burner-use-case';

export interface CreateBurnerFacadeOptions {
  translate: (key: string) => string;
  formatHex: (value: number, length?: number) => string;
}

export function createBurnerFacade(options: CreateBurnerFacadeOptions): BurnerFacade {
  const protocolPort = new CartridgeProtocolPortAdapter();
  const useCase = new BurnerUseCaseImpl(protocolPort, options.translate, options.formatHex);
  return new BurnerFacadeImpl(useCase);
}
