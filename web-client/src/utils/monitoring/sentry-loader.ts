import { browserTracingIntegration } from '@sentry/browser';
import * as Sentry from '@sentry/vue';
import type { App } from 'vue';

export interface SentryConfig {
  dsn?: string;
  environment?: string;
  release?: string;
  sampleRate?: number;
  tracesSampleRate?: number;
  enabled?: boolean;
}

const HEX_DUMP_LINE_RE = /^[0-9A-Fa-f]{4}:\s+(?:[0-9A-Fa-f]{2}\s+){1,16}\|/;
const CART_BURNER_CONSOLE_PREFIX = '[CartBurner]';
const EMU_WARNING_PREFIX = 'GBA emulator warning:';
const EMU_WARNING_COOLDOWN_MS = 5000;
const MAX_TRACKED_WARNINGS = 100;

/**
 * 创建面包屑过滤器，避免调试日志、十六进制转储和高频模拟器警告挤占有效操作轨迹
 */
export function createBreadcrumbFilter(now: () => number = () => Date.now()) {
  const lastWarningAt = new Map<string, number>();

  return (breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null => {
    if (breadcrumb.category !== 'console') {
      return breadcrumb;
    }

    if (breadcrumb.level === 'debug') {
      return null;
    }

    const message = breadcrumb.message ?? '';
    if (message.startsWith(CART_BURNER_CONSOLE_PREFIX) || HEX_DUMP_LINE_RE.test(message)) {
      return null;
    }

    if (message.startsWith(EMU_WARNING_PREFIX)) {
      const timestamp = now();
      const previous = lastWarningAt.get(message);
      if (previous !== undefined && timestamp - previous < EMU_WARNING_COOLDOWN_MS) {
        return null;
      }
      if (lastWarningAt.size >= MAX_TRACKED_WARNINGS) {
        const oldestKey = lastWarningAt.keys().next().value;
        if (oldestKey !== undefined) {
          lastWarningAt.delete(oldestKey);
        }
      }
      lastWarningAt.set(message, timestamp);
    }

    return breadcrumb;
  };
}

/**
 * 检查是否应该加载 Sentry
 */
function shouldLoadSentry(config: SentryConfig = {}): boolean {
  const dsn = config.dsn ?? import.meta.env.VITE_SENTRY_DSN as string;
  if (!dsn) {
    console.warn('Sentry DSN not configured. Skipping Sentry initialization.');
    return false;
  }

  const isEnabled = config.enabled ?? import.meta.env.VITE_SENTRY_ENABLED === 'true';

  if (!isEnabled) {
    console.log('Sentry is disabled via configuration.');
    return false;
  }

  return true;
}

/**
 * 加载并初始化 Sentry
 */
export function loadSentry(app: App, config: SentryConfig = {}) {
  if (!shouldLoadSentry(config)) {
    return;
  }

  try {
    const dsn = config.dsn ?? import.meta.env.VITE_SENTRY_DSN as string;
    const appVersion = import.meta.env.VITE_APP_VERSION as string || '1.0.0';
    const buildCommit = import.meta.env.VITE_BUILD_COMMIT;
    const release = config.release
      ?? (import.meta.env.VITE_SENTRY_RELEASE)
      ?? (buildCommit ? `${appVersion}+${buildCommit}` : appVersion);

    Sentry.init({
      app,
      dsn,
      environment: (config.environment ?? import.meta.env.VITE_SENTRY_ENVIRONMENT as string) || 'development',
      release,
      integrations: [
        browserTracingIntegration(),
        // Sentry.replayIntegration(),
        Sentry.feedbackIntegration({
          colorScheme: 'system',
        }),
      ],
      tracesSampleRate: config.tracesSampleRate ?? parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE as string || '0.1'),
      sampleRate: config.sampleRate ?? parseFloat(import.meta.env.VITE_SENTRY_SAMPLE_RATE as string || '1.0'),
      maxBreadcrumbs: 150,
      beforeBreadcrumb: createBreadcrumbFilter(),
      debug: false,
      // Sentry 11 replaces sendDefaultPii with category-specific collection.
      // Collect user/IP information and retain browser/device context via the
      // default integrations, with other data categories configured separately.
      dataCollection: {
        userInfo: true,
        cookies: false,
        httpHeaders: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
        httpBodies: [],
        urlQueryParams: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
        genAI: { inputs: false, outputs: false },
        databaseQueryData: false,
        queues: false,
        graphQL: { document: false, variables: false },
      },
      // replaysSessionSampleRate: parseFloat(import.meta.env.VITE_SENTRY_REPLAY_SAMPLE_RATE as string || '0.1'),
      // replaysOnErrorSampleRate: parseFloat(import.meta.env.VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE as string || '1.0'),
      beforeSend(event) {
        if (import.meta.env.DEV) {
          console.log('Sentry event (dev mode):', event);
          const isEnabled = config.enabled ?? import.meta.env.VITE_SENTRY_ENABLED === 'true';
          return isEnabled ? event : null;
        }
        return event;
      },
    });
  } catch (error) {
    console.error('Failed to load Sentry:', error);
  }
}
