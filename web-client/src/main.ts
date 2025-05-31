import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import i18n from './i18n';
import { AdvancedSettings } from './utils/AdvancedSettings';

// 初始化高级设置
AdvancedSettings.loadSettings();

createApp(App).use(i18n).mount('#app');
