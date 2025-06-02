import * as Sentry from '@sentry/vue';
import { browserTracingIntegration } from '@sentry/browser';
import type { App } from 'vue';

export interface SentryConfig {
  dsn?: string;
  environment?: string;
  release?: string;
  sampleRate?: number;
  tracesSampleRate?: number;
  enabled?: boolean;
}

export function initSentry(app: App, config: SentryConfig = {}) {
  const dsn = config.dsn || import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.warn('Sentry DSN not configured. Skipping Sentry initialization.');
    return;
  }

  // 检查是否启用Sentry
  const isEnabled = config.enabled !== undefined
    ? config.enabled
    : import.meta.env.VITE_SENTRY_ENABLED === 'true';

  if (!isEnabled) {
    console.log('Sentry is disabled via configuration.');
    return;
  }

  Sentry.init({
    app,
    dsn,
    environment: config.environment || import.meta.env.VITE_SENTRY_ENVIRONMENT || 'development',
    release: config.release || import.meta.env.VITE_APP_VERSION || '1.0.0',
    integrations: [
      browserTracingIntegration(),
    ],
    // 性能监控采样率
    tracesSampleRate: config.tracesSampleRate || parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    // 错误采样率
    sampleRate: config.sampleRate || parseFloat(import.meta.env.VITE_SENTRY_SAMPLE_RATE || '1.0'),
    debug: false,
    beforeSend(event) {
      // 在开发环境中，根据配置决定是否发送事件
      if (import.meta.env.DEV) {
        console.log('Sentry event (dev mode):', event);
        // 如果开发环境下明确启用了Sentry，则发送事件
        return isEnabled ? event : null;
      }
      return event;
    },
  });
}

// 性能监控工具函数
export class PerformanceTracker {
  /**
   * 跟踪异步操作的性能
   */
  static async trackAsyncOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    tags?: Record<string, string>,
    data?: Record<string, string | number | boolean>
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
      async (span) => {
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
      }
    );
  }

  /**
   * 跟踪同步操作的性能
   */
  static trackSyncOperation<T>(
    operationName: string,
    operation: () => T,
    tags?: Record<string, string>,
    data?: Record<string, string | number | boolean>
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
      (span) => {
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
      }
    );
  }

  /**
   * 跟踪带进度的操作（如文件读写）
   */
  static async trackProgressOperation<T>(
    operationName: string,
    operation: (updateProgress: (progress: number) => void) => Promise<T>,
    tags?: Record<string, string>,
    data?: Record<string, string | number | boolean>
  ): Promise<T> {
    return Sentry.startSpan(
      {
        name: operationName,
        op: 'progress_operation',
        attributes: {
          ...tags,
          ...data,
        },
      },
      async (span) => {
        let lastProgress = 0;
        const updateProgress = (progress: number) => {
          span.setAttributes({ progress });
          if (progress - lastProgress >= 10) { // 每10%记录一次
            Sentry.addBreadcrumb({
              message: `${operationName} progress: ${progress}%`,
              level: 'info',
              data: { progress },
            });
            lastProgress = Math.floor(progress / 10) * 10;
          }
        };

        try {
          const result = await operation(updateProgress);
          span.setStatus({ code: 1 }); // OK status
          span.setAttributes({ finalProgress: 100 });
          return result;
        } catch (error) {
          span.setStatus({ code: 2, message: String(error) }); // ERROR status
          Sentry.captureException(error, {
            tags: {
              operation: operationName,
              progress: lastProgress,
              ...tags,
            },
            extra: data,
          });
          throw error;
        }
      }
    );
  }

  /**
   * 记录用户操作事件
   */
  static trackUserEvent(
    eventName: string,
    category: string,
    data?: Record<string, string | number | boolean>
  ) {
    Sentry.addBreadcrumb({
      message: eventName,
      category,
      level: 'info',
      data,
    });

    // 记录自定义事件用于性能分析
    Sentry.setTag('last_user_action', eventName);
    Sentry.setContext('user_event', {
      name: eventName,
      category,
      timestamp: Date.now(),
      ...data,
    });
  }

  /**
   * 设置用户上下文
   */
  static setUserContext(userId?: string, additional?: Record<string, string | number | boolean>) {
    Sentry.setUser({
      id: userId || 'anonymous',
      ...additional,
    });
  }

  /**
   * 设置设备信息上下文
   */
  static setDeviceContext(deviceInfo: Record<string, string | number | boolean>) {
    Sentry.setContext('device', deviceInfo);
  }
}
