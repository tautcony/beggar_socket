export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  message: string,
  options?: { onTimeout?: () => void },
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          options?.onTimeout?.();
          reject(new Error(message));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/**
 * Creates a Promise that resolves after a specified duration.
 *
 * @param ms - The amount of time (in milliseconds) to wait before the Promise resolves.
 * @returns A Promise that resolves after the specified duration.
 *
 * @example
 * //Wait for 1 second (1000 ms)
 * await timeout(1000);
 */
export const timeout = <T>(ms: number) => new Promise<T>(r => setTimeout(r, ms));
