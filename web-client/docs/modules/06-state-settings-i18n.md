# 模块：State / Settings / i18n

`src/stores/recent-file-names-store.ts` 维护导出名称，`src/stores/rom-assembly-store.ts` 将组装结果一次性回流主页面。

`src/settings/advanced-settings.ts` 用 runtime schema 原子校验数值类型、finite integer 和范围，versioned localStorage 持久化，保留合法旧配置与存储 key；损坏配置保留原存储供诊断并使用安全默认值。`src/settings/debug-settings.ts` 控制模拟/调试行为。

`src/i18n/index.ts` 组织 `src/i18n/locales/` 的 en-US、ja-JP、ru-RU、zh-Hans、zh-Hant。显示文本和结构化错误分别承载：兼容 message 保留，stable code/cause 用于判断和诊断。

操作预算使用 `AdvancedSettings.operationBudgetEnabled`（默认 false）和启用时的 `AdvancedSettings.operationTimeout`。配置字段为 timeout.operationBudgetEnabled，旧 version 1/legacy 配置默认关闭，不会使已有长烧写被默认 30 秒打断。高级设置面板与五种语言提供显式开关。

包 timeout、进度显示等待时间和操作预算分开：budget 在 admission 快照后计时，包含 execute 内真实 worker 与命令 reset，在成功展示/文件导出对话框前清除 timer。owner 继续持有到整个 flow/onFinally 完成；超预算通过 AbortSignal.reason 的结构化 session timeout 提出停止，RAM 原子命令与底层驱动仍须真实等待。
