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
