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
    return Sentry.startSpan({ name, op }, callback);
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

/**
 * 装饰器：用于自动跟踪方法性能
 */
export function TrackPerformance(operationName?: string) {
  return function <T extends Record<string, unknown>>(
    target: T,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value as (...args: unknown[]) => unknown;
    const targetConstructor = target.constructor as { name: string };
    const name = operationName || `${targetConstructor.name}.${propertyKey}`;

    descriptor.value = function (this: T, ...args: unknown[]) {
      const methodConstructor = originalMethod.constructor as { name: string };
      if (methodConstructor.name === 'AsyncFunction') {
        return PerformanceTracker.trackAsyncOperation(
          name,
          () => originalMethod.apply(this, args) as Promise<unknown>,
        );
      } else {
        return PerformanceTracker.trackSyncOperation(
          name,
          () => originalMethod.apply(this, args),
        );
      }
    };

    return descriptor;
  };
}
