import { isSessionStageError, type SessionStageError } from '@/device-runtime/diagnostics';

/**
 * Awaits a promise that must reject and hands back the failure as a typed value.
 *
 * Tests assert on `stage`, `code` and `diagnostics`, so the rejection has to keep its type:
 * `promise.catch(reason => reason)` would return `any` and silently swallow assertion typos.
 */
export async function captureStageError(promise: Promise<unknown>): Promise<SessionStageError> {
  try {
    await promise;
  } catch (error) {
    if (!isSessionStageError(error)) {
      throw error;
    }
    return error;
  }
  throw new Error('Expected the operation to reject, but it resolved');
}
