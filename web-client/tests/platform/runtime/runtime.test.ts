import { beforeEach, describe, expect, it } from 'vitest';

import { getRuntimeKind, isTauriRuntime, isWebRuntime } from '@/platform/runtime';

describe('platform runtime', () => {
  beforeEach(() => {
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it('reports web runtime by default', () => {
    expect(getRuntimeKind()).toBe('web');
    expect(isWebRuntime()).toBe(true);
    expect(isTauriRuntime()).toBe(false);
  });

  it('reports tauri runtime when Tauri internals are present', () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};

    expect(getRuntimeKind()).toBe('tauri');
    expect(isWebRuntime()).toBe(false);
    expect(isTauriRuntime()).toBe(true);
  });
});
