export type RuntimeKind = 'web' | 'tauri';

export function getRuntimeKind(): RuntimeKind {
  return isTauriRuntime() ? 'tauri' : 'web';
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function isWebRuntime(): boolean {
  return getRuntimeKind() === 'web';
}
