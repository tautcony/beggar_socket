import '@/style.css';

import { createApp } from 'vue';

import App from '@/App.vue';
import i18n from '@/i18n';
import { AdvancedSettings } from '@/settings/advanced-settings';
import { initSentry } from '@/utils/sentry';

AdvancedSettings.loadSettings();

const app = createApp(App);

initSentry(app, {
  enabled: import.meta.env.VITE_SENTRY_ENABLED === 'true' || import.meta.env.PROD,
});

app.use(i18n).mount('#app');
