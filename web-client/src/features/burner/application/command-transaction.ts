/** Complete real cleanup before returning, without replacing the operation's result or cause. */
export async function runWithCommandBufferReset<TAdapter, TResult>(
  adapter: TAdapter,
  operation: () => Promise<TResult>,
  reset: (adapter: TAdapter) => Promise<void>,
  onResetError: (error: unknown) => void,
): Promise<TResult> {
  try {
    return await operation();
  } finally {
    try {
      await reset(adapter);
    } catch (error) {
      // Diagnostic presentation must not mask a failed command or a successful result.
      try { onResetError(error); } catch { /* Preserve the primary operation outcome. */ }
    }
  }
}
