/**
 * Lifecycle-stage errors and diagnostic helpers shared by the drivers and the session
 * establishment transaction.
 *
 * A stage error carries the failure stage the UI classifies on (`probe`, `resolve`,
 * `initialize`, `disconnect`) plus the normalized `DeviceDiagnostic` entries that were
 * produced before it failed. Callers never parse log text to find the reason.
 */
import type { DeviceDiagnostic } from '@/device/session';
import { displayTextToString } from '@/device/display';

/** Session establishment stages; `selection` fails before a transport is opened. */
export type SessionFailureStage = 'selection' | 'probe' | 'resolve' | 'initialize' | 'disconnect';

export interface SessionStageErrorOptions {
  readonly code: string;
  readonly diagnostics?: readonly DeviceDiagnostic[];
  readonly cause?: unknown;
}

export class SessionStageError extends Error {
  readonly stage: SessionFailureStage;
  readonly code: string;
  readonly diagnostics: readonly DeviceDiagnostic[];
  readonly cause?: unknown;

  constructor(stage: SessionFailureStage, message: string, options: SessionStageErrorOptions) {
    super(message);
    this.name = 'SessionStageError';
    this.stage = stage;
    this.code = options.code;
    this.diagnostics = options.diagnostics ?? [];
    this.cause = options.cause;
  }
}

export function isSessionStageError(error: unknown): error is SessionStageError {
  return error instanceof SessionStageError;
}

/** Builds a diagnostic; `message` stays a plain string so logs never need i18n. */
export function createDiagnostic(
  code: string,
  severity: DeviceDiagnostic['severity'],
  message: string,
  stage: DeviceDiagnostic['stage'],
): DeviceDiagnostic {
  return { code, severity, message, stage };
}

export function diagnosticToString(diagnostic: DeviceDiagnostic): string {
  return displayTextToString(diagnostic.message);
}
