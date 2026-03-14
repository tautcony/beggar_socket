# 模块：State / Settings / i18n

## State
- `src/stores/recent-file-names-store.ts`
- `src/stores/rom-assembly-store.ts`

## Settings
- `src/settings/advanced-settings.ts`: page size、timeout、localStorage
- `src/settings/debug-settings.ts`: mock 与调试行为

## i18n
- `src/i18n/index.ts`
- `src/i18n/locales/en-US.json`
- `src/i18n/locales/ja-JP.json`
- `src/i18n/locales/ru-RU.json`
- `src/i18n/locales/zh-Hans.json`
- `src/i18n/locales/zh-Hant.json`

当前支持 5 种语言：英语（en-US）、日语（ja-JP）、俄语（ru-RU）、简体中文（zh-Hans）、繁体中文（zh-Hant）。

## 职责
- 提供跨组件共享状态、运行参数和多语言文本。

## 模块设计补充
- `AdvancedSettings`: page size/timeout + localStorage 持久化。
- `DebugSettings`: mock 行为与调试开关。
- `i18n`: 本地语言包加载与 locale 选择逻辑。
