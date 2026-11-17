import { addCollection } from '@iconify/vue';
import pixelarticons from '@iconify-json/pixelarticons/icons.json';

// 离线注册像素图标集，确保无网络环境（含 Tauri 桌面端与单元测试）可直接渲染
addCollection(pixelarticons);
