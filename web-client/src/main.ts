import '@/styles/index.scss';

import { createPinia } from 'pinia';
import { createApp } from 'vue';

import App from '@/App.vue';
import { initFont } from '@/composables/useFont';
import { initTheme } from '@/composables/useTheme';
import i18n from '@/i18n';
import router from '@/router';
import { AdvancedSettings } from '@/settings/advanced-settings';
import { DebugSettings } from '@/settings/debug-settings';
import { loadSentry } from '@/utils/monitoring/sentry-loader';

initTheme();
initFont();
AdvancedSettings.loadSettings();
DebugSettings.init();

const PRELOAD_RELOAD_KEY = 'chisflash:vite-preload-reload-at';
const PRELOAD_RELOAD_COOLDOWN_MS = 10_000;

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  try {
    const now = Date.now();
    const lastReload = Number(sessionStorage.getItem(PRELOAD_RELOAD_KEY) ?? '0');
    if (now - lastReload < PRELOAD_RELOAD_COOLDOWN_MS) {
      return;
    }
    sessionStorage.setItem(PRELOAD_RELOAD_KEY, String(now));
  } catch {
    // Ignore storage access failures in restricted environments.
  }
  window.location.reload();
});

const app = createApp(App);
const pinia = createPinia();

loadSentry(app, { enabled: import.meta.env.VITE_SENTRY_ENABLED === 'true' || import.meta.env.PROD });
app.use(pinia).use(i18n).use(router).mount('#app');
