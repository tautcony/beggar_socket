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
      onResetError(error);
    }
  }
}
