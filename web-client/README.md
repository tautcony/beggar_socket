# Beggar Socket Web Client

基于 Vue 3 + TypeScript + Vite 构建的 GBA/GBC 卡带烧录器 Web 客户端，支持通过 WebUSB API 直接与硬件设备通信。

## 🚀 快速开始

### 环境要求

- Node.js 22.0+
- npm 11.0+
- 支持 WebUSB 的现代浏览器

### 安装依赖

```bash
npm install
```

### 开发服务器

```bash
npm run dev
```

启动后访问 http://localhost:5173

### 构建生产版本

```bash
npm run build
```

### 预览生产构建

```bash
npm run preview
```

启动后访问 http://localhost:4173

## 🔧 开发脚本

| 命令 | 描述 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览生产构建 |
| `npm run lint` | 代码检查 |
| `npm run lint:fix` | 自动修复代码问题 |
| `npm run type-check` | TypeScript 类型检查 |

### 浏览器兼容性

| 浏览器 | 版本 | WebUSB 支持 |
|--------|------|-------------|
| Chrome | 61+ | ✅ |
| Edge | 79+ | ✅ |
| Firefox | - | ❌ |
| Safari | - | ❌ |

## 🌍 国际化

当前支持的语言：

- 🇨🇳 简体中文 (zh-CN)
- 🇺🇸 英语 (en-US)  
- 🇯🇵 日语 (ja-JP)

添加新语言：

1. 在 `src/i18n/locales/` 目录下创建对应的 JSON 文件
2. 在 `src/i18n/index.ts` 中注册新语言
3. 更新 `LanguageSwitcher.vue` 组件
