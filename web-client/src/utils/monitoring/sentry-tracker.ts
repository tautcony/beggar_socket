import * as Sentry from '@sentry/vue';

/**
 * 性能监控工具函数
 */
export class PerformanceTracker {
  /**
   * 跟踪异步操作的性能
   */
  static async trackAsyncOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    tags?: Record<string, string>,
    data?: Record<string, string | number | boolean>,
  ): Promise<T> {

    return Sentry.startSpan(
      {
        name: operationName,
        op: 'async_operation',
        attributes: {
          ...tags,
          ...data,
        },
      },
      async (span: Sentry.Span) => {
        try {
          const result = await operation();
          span.setStatus({ code: 1 }); // OK status
          return result;
        } catch (error) {
          span.setStatus({ code: 2, message: String(error) }); // ERROR status
          Sentry.captureException(error, {
            tags: {
              operation: operationName,
              ...tags,
            },
            extra: data,
          });
          throw error;
        }
      },
    );
  }

  /**
   * 跟踪同步操作的性能
   */
  static trackSyncOperation<T>(
    operationName: string,
    operation: () => T,
    tags?: Record<string, string>,
    data?: Record<string, string | number | boolean>,
  ): T {
    return Sentry.startSpan(
      {
        name: operationName,
        op: 'sync_operation',
        attributes: {
          ...tags,
          ...data,
        },
      },
      (span: Sentry.Span) => {
        try {
          const result = operation();
          span.setStatus({ code: 1 }); // OK status
          return result;
        } catch (error) {
          span.setStatus({ code: 2, message: String(error) }); // ERROR status
          Sentry.captureException(error, {
            tags: {
              operation: operationName,
              ...tags,
            },
            extra: data,
          });
          throw error;
        }
      },
    );
  }

  /**
   * 手动创建事务
   */
  static createTransaction(name: string, op: string, callback: (span: Sentry.Span) => void) {
    Sentry.startSpan({ name, op }, callback);
  }

  /**
   * 添加性能标记
   */
  static mark(name: string) {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(name);
    }
  }

  /**
   * 测量两个标记之间的时间
   */
  static measure(name: string, startMark: string, endMark?: string) {
    if (typeof performance !== 'undefined' && performance.measure) {
      try {
        if (endMark) {
          performance.measure(name, startMark, endMark);
        } else {
          performance.measure(name, startMark);
        }

        const measure = performance.getEntriesByName(name, 'measure')[0];
        if (measure) {
          console.log(`Performance measure "${name}": ${measure.duration}ms`);
          return measure.duration;
        }
      } catch (error) {
        console.warn('Performance measurement failed:', error);
      }
    }
    return 0;
  }
}

export interface DeviceMonitoringContext {
  variant: string;
  firmware: string;
  label?: string;
  firmwareVersion?: string;
  baudRate?: number;
  source?: string;
  diagnostics?: string[];
}

export interface RomMonitoringContext {
  name: string;
  size: number;
}

export interface EmulatorMonitoringContext {
  core?: 'gbats' | 'binjgb';
  status: 'initializing' | 'running' | 'paused' | 'crashed';
  romName?: string;
  romSize?: number;
  saveType?: string | null;
  crashCount?: number;
  lastError?: string;
  snapshot?: Record<string, unknown>;
}

/**
 * 记录结构化操作面包屑，便于在 Sentry 中还原关键业务动作与参数
 */
export function recordBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'info',
): void {
  Sentry.addBreadcrumb({
    category,
    message,
    level,
    data,
  });
}

/**
 * 更新当前已连接设备的 Sentry 上下文与标签
 */
export function setDeviceContext(device: DeviceMonitoringContext | null): void {
  if (!device) {
    Sentry.setContext('device', null);
    Sentry.setTag('device.variant', undefined);
    Sentry.setTag('device.firmware', undefined);
    return;
  }
  Sentry.setContext('device', { ...device });
  Sentry.setTag('device.variant', device.variant);
  Sentry.setTag('device.firmware', device.firmware);
}

/**
 * 更新当前选中 ROM 的 Sentry 上下文与标签
 */
export function setRomContext(rom: RomMonitoringContext | null): void {
  if (!rom) {
    Sentry.setContext('rom', null);
    Sentry.setTag('rom.name', undefined);
    return;
  }
  Sentry.setContext('rom', { ...rom });
  Sentry.setTag('rom.name', rom.name);
}

/**
 * 更新 GBA/GBC 模拟器的 Sentry 运行状态上下文
 */
export function setEmulatorContext(emulator: EmulatorMonitoringContext | null): void {
  Sentry.setContext('emulator', emulator ? { ...emulator } : null);
  Sentry.setTag('emulator.core', emulator?.core);
}

/**
 * 更新当前路由上下文标签
 */
export function setRouteTag(routeName: string): void {
  Sentry.setTag('route.name', routeName);
}

/**
 * 上报路由跳转或资源预加载异常
 */
export function captureRouteError(error: unknown, targetRoute?: string): void {
  Sentry.captureException(error, {
    tags: targetRoute ? { 'route.target': targetRoute } : undefined,
  });
}
