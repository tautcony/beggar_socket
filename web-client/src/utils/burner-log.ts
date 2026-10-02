import type { BurnerLogMessage } from '@/types/burner-log';
import { isCommandError, mapCommandError } from '@/types/command-error';

export type BurnerLogInput = string | BurnerLogMessage;

export function formatBurnerLogMessage(message: BurnerLogMessage): string {
  if (message.error) {
    return `${message.message}: ${message.error}`;
  }
  return message.message;
}

/**
 * 将 error 对象转换为结构化日志消息。
 * 如果 error 携带 `detail` 属性（如 ProtocolPacketReadError），
 * 则将 detail 拆分到 `details` 字段，message 和 error 保持独立。
 */
export function errorToBurnerLog(message: string, error: unknown): BurnerLogMessage {
  const diagnostic = mapCommandError('unknown', error, message);
  if (!(error instanceof Error)) {
    return { message, error: isCommandError(error) ? error.message : String(error), diagnostic };
  }

  const detail = 'detail' in error && typeof (error as Record<string, unknown>).detail === 'string'
    ? (error as Record<string, unknown>).detail as string
    : undefined;

  return detail
    ? { message, error: error.message, details: detail, diagnostic }
    : { message, error: error.message, diagnostic };
}
