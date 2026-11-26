import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBreadcrumbFilter } from '@/utils/monitoring/sentry-loader';
import {
  captureRouteError,
  recordBreadcrumb,
  setDeviceContext,
  setEmulatorContext,
  setRomContext,
  setRouteTag,
} from '@/utils/monitoring/sentry-tracker';

const { addBreadcrumb, captureException, setContext, setTag } = vi.hoisted(() => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
  setContext: vi.fn(),
  setTag: vi.fn(),
}));

vi.mock('@sentry/vue', () => ({
  addBreadcrumb,
  setContext,
  setTag,
  startSpan: vi.fn(),
  captureException,
}));

describe('createBreadcrumbFilter', () => {
  it('drops debug-level console breadcrumbs and hex dump lines', () => {
    const filter = createBreadcrumbFilter(() => 1000);

    expect(filter({ category: 'console', level: 'debug', message: 'GBA emulator log: > at foo' })).toBeNull();
    expect(filter({ category: 'console', level: 'info', message: '[CartBurner][info][13:17:32] 已连接: 碳酸丐 [object Object]' })).toBeNull();
    expect(
      filter({
        category: 'console',
        level: 'info',
        message: '0000: FF FF FF FF FF FF FF FF FF FF FF FF FF FF FF FF | ████████████████',
      }),
    ).toBeNull();
    expect(filter({ category: 'ui.click', level: 'info', message: 'button.primary' })).toEqual({
      category: 'ui.click',
      level: 'info',
      message: 'button.primary',
    });
  });

  it('throttles repeated GBA emulator warnings within cooldown window', () => {
    let now = 1000;
    const filter = createBreadcrumbFilter(() => now);
    const warning = {
      category: 'console',
      level: 'warning' as const,
      message: 'GBA emulator warning: Read for write-only register: 0x20',
    };
    const otherWarning = {
      category: 'console',
      level: 'warning' as const,
      message: 'GBA emulator warning: Read for write-only register: 0x22',
    };

    expect(filter(warning)).toEqual(warning);
    now = 3000;
    expect(filter(warning)).toBeNull();
    expect(filter(otherWarning)).toEqual(otherWarning);
    now = 6500;
    expect(filter(warning)).toEqual(warning);
  });
});

describe('sentry-tracker context helpers', () => {
  beforeEach(() => {
    addBreadcrumb.mockReset();
    captureException.mockReset();
    setContext.mockReset();
    setTag.mockReset();
  });

  it('sets and clears device, rom, emulator, and route contexts', () => {
    setDeviceContext({ variant: 'chisflash', firmware: 'v2', label: '碳酸丐' });
    expect(setContext).toHaveBeenCalledWith('device', {
      variant: 'chisflash',
      firmware: 'v2',
      label: '碳酸丐',
    });
    expect(setTag).toHaveBeenCalledWith('device.variant', 'chisflash');
    expect(setTag).toHaveBeenCalledWith('device.firmware', 'v2');

    setRomContext({ name: 'test.gba', size: 2048 });
    expect(setContext).toHaveBeenCalledWith('rom', { name: 'test.gba', size: 2048 });
    expect(setTag).toHaveBeenCalledWith('rom.name', 'test.gba');

    setEmulatorContext({ core: 'binjgb', status: 'running', romName: 'test.gba' });
    expect(setContext).toHaveBeenCalledWith('emulator', {
      core: 'binjgb',
      status: 'running',
      romName: 'test.gba',
    });
    expect(setTag).toHaveBeenCalledWith('emulator.core', 'binjgb');

    setRouteTag('rom-tools');
    expect(setTag).toHaveBeenCalledWith('route.name', 'rom-tools');

    const routeErr = new Error('Unable to preload CSS');
    captureRouteError(routeErr, 'rom-tools');
    expect(captureException).toHaveBeenCalledWith(routeErr, {
      tags: { 'route.target': 'rom-tools' },
    });

    recordBreadcrumb('emulator', 'Emulator initialized', { romName: 'test.gba' });
    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: 'emulator',
      message: 'Emulator initialized',
      level: 'info',
      data: { romName: 'test.gba' },
    });

    setDeviceContext(null);
    setRomContext(null);
    setEmulatorContext(null);
    expect(setContext).toHaveBeenCalledWith('device', null);
    expect(setContext).toHaveBeenCalledWith('rom', null);
    expect(setContext).toHaveBeenCalledWith('emulator', null);
  });
});
