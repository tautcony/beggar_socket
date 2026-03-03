# 模块：State / Settings / i18n

## State
- `src/stores/recent-file-names-store.ts`
- `src/stores/rom-assembly-store.ts`

## Settings
- `src/settings/advanced-settings.ts`: page size、timeout、localStorage
- `src/settings/debug-settings.ts`: mock 与调试行为

## i18n
- `src/i18n/index.ts`
- `src/i18n/locales/*.json`

## 职责
- 提供跨组件共享状态、运行参数和多语言文本。

## 模块设计补充
- `AdvancedSettings`: page size/timeout + localStorage 持久化。
- `DebugSettings`: mock 行为与调试开关。
- `i18n`: 本地语言包加载与 locale 选择逻辑。
