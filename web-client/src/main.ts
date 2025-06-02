import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import i18n from './i18n';
import { AdvancedSettings } from './utils/AdvancedSettings';
import { initSentry } from './utils/sentry';

// 初始化高级设置
AdvancedSettings.loadSettings();

const app = createApp(App);

// 初始化Sentry（仅在生产环境或明确启用时）
initSentry(app, {
  enabled: import.meta.env.VITE_SENTRY_ENABLED === 'true' || import.meta.env.PROD,
});

app.use(i18n).mount('#app');
