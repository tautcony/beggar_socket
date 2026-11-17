import { type BurnerUseCase, BurnerUseCaseImpl } from './burner-use-case';

export interface CreateBurnerUseCaseOptions {
  translate: (key: string) => string;
  formatHex: (value: number, length?: number) => string;
}

export function createBurnerUseCase(options: CreateBurnerUseCaseOptions): BurnerUseCase {
  return new BurnerUseCaseImpl(options.translate, options.formatHex);
}
