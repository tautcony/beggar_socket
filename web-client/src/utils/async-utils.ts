export function isPromise<T>(value: T | Promise<T>): value is Promise<T> {
  return value instanceof Promise || (typeof value === 'object' && value !== null && 'then' in value);
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function timeoutIn(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => { reject(new Error(message)); }, ms);
  });
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, message = '操作超时'): Promise<T> {
  return Promise.race([
    promise,
    timeoutIn(ms, message),
  ]);
}
