export interface ReadTimeoutMetrics {
  timeout: number;
  readId: number;
  expectedLength: number;
  receivedLength: number;
  diagnostics: string;
}

export function createReadTimeoutError(metrics: ReadTimeoutMetrics): Error {
  const { timeout, readId, expectedLength, receivedLength, diagnostics } = metrics;
  return new Error(
    `Read package timeout in ${timeout}ms `
    + `(read#${readId}, expected=${expectedLength}B, received=${receivedLength}B, ${diagnostics})`,
  );
}
