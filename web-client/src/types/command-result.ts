export interface CommandResult {
  success: boolean;
  message: string;
  data?: Uint8Array;
  errorCode?: string;
  errorStage?: string;
  details?: unknown;
}
