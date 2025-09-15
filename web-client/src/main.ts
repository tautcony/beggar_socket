import '@/style.css';

import { createPinia } from 'pinia';
import { createApp } from 'vue';

import App from '@/App.vue';
import i18n from '@/i18n';
import router from '@/router';
import { AdvancedSettings } from '@/settings/advanced-settings';
import { loadSentry } from '@/utils/monitoring/sentry-loader';

AdvancedSettings.loadSettings();

const app = createApp(App);
const pinia = createPinia();

loadSentry(app, { enabled: import.meta.env.VITE_SENTRY_ENABLED === 'true' || import.meta.env.PROD });
app.use(pinia).use(i18n).use(router).mount('#app');
