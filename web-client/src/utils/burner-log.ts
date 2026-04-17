import type { BurnerLogMessage } from '@/types/burner-log';

export type BurnerLogInput = string | BurnerLogMessage;

export function formatBurnerLogMessage(message: BurnerLogMessage): string {
  if (message.error) {
    return `${message.message}: ${message.error}`;
  }
  return message.message;
}
