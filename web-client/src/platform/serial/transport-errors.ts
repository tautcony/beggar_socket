export interface ReadTimeoutMetrics {
  timeout: number;
  readId: number;
  expectedLength: number;
  receivedLength: number;
  diagnostics: string;
}

export function createReadTimeoutError(metrics: ReadTimeoutMetrics): Error {
  const { timeout, readId, expectedLength, receivedLength, diagnostics } = metrics;
  return Object.assign(new Error(
    `Read package timeout in ${timeout}ms `
    + `(read#${readId}, expected=${expectedLength}B, received=${receivedLength}B, ${diagnostics})`,
  ), { code: 'TRANSPORT_TIMEOUT' as const });
}
