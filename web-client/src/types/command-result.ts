import type { CommandError } from './command-error';

export interface CommandResult {
  success: boolean;
  message: string;
  data?: Uint8Array;
  error?: CommandError;
}
