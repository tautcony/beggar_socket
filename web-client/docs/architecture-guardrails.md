# Architecture Guardrails (Phase 0)

## 目的
- 在重构期间阻止新增跨层穿透依赖。
- 对历史遗留点先做基线豁免，后续在 Phase 1~3 逐步清零。

## 当前已启用规则

### ESLint 规则
- 文件：`eslint.config.js`
- 规则：`import/no-restricted-paths`
- 约束：
1. 禁止 `components/views -> protocol`
2. 禁止 `types/utils -> services`

### 基线豁免（临时）
- 当前为 `0` 项（已清空）。

说明：以上豁免仅用于兼容现状，后续重构完成后应删除。

## 依赖检查脚本
- 脚本：`scripts/check-architecture-deps.cjs`
- 命令：`npm run check:deps`
- 能力：
1. 输出 top-level 依赖矩阵（如 `components -> utils`）
2. 检测并报错新增违规依赖（不在基线豁免内）

## 建议接入
1. 本地开发：提交前执行 `npm run check:deps`
2. CI：在 lint 阶段后追加 `npm run check:deps`

## 后续动作
1. 在 Phase 1 先迁移 `CartBurner.vue`，移除对应豁免。
2. 在 Phase 2 处理 `types/utils -> services` 倒挂，清理剩余豁免。
