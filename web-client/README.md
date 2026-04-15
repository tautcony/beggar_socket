# Beggar Socket Web Client

基于 Vue 3 + TypeScript + Vite 构建的 GBA/GBC 卡带烧录器前端，支持浏览器中的 Web Serial 和桌面端的 Tauri 串口运行时。

## 🚀 快速开始

### 环境要求

- Node.js 22.0+
- npm 11.0+
- Rust 工具链（`rustup`, `cargo`，用于 Tauri 桌面开发与打包）
- 支持 WebSerial 的现代浏览器（仅浏览器模式需要）

### 安装依赖

```bash
npm install
```

### 开发服务器

```bash
npm run dev
```

启动后访问 http://localhost:5173

### Tauri 桌面开发

```bash
npm run tauri:dev
```

这会启动 Vite dev server，并由 Tauri 加载 `http://localhost:5173`。
如果提示找不到 `cargo`，请先安装 Rust 工具链，或在当前 shell 执行 `source "$HOME/.cargo/env"` 后重试。

### 构建生产版本

```bash
npm run build
```

### 构建桌面应用

```bash
npm run tauri:build
```

同样依赖本机可用的 Rust 工具链；脚本会优先尝试自动补充 `~/.cargo/bin` 到 `PATH`。

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
| `npm run tauri:dev` | 启动 Tauri 桌面开发模式 |
| `npm run tauri:build` | 构建 Tauri 桌面应用 |
| `npm run lint` | 代码检查 |
| `npm run lint:fix` | 自动修复代码问题 |
| `npm run type-check` | TypeScript 类型检查 |

### 浏览器兼容性

| 浏览器 | 版本 | WebSerial 支持 |
|--------|------|-------------|
| Chrome | 89+ | ✅ |
| Edge | 89+ | ✅ |
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
