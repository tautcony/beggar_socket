# 模块：Services / Adapters

## 目录
- `src/services/cartridge-adapter.ts`
- `src/services/gba-adapter.ts`
- `src/services/mbc5-adapter.ts`
- `src/services/mock-adapter.ts`
- `src/services/device-connection-manager.ts`
- `src/services/serial-service.ts`（legacy facade）

## 模块设计
- `cartridge-adapter.ts`: 适配器抽象基类（日志/进度/状态）
- `gba-adapter.ts`、`mbc5-adapter.ts`、`mock-adapter.ts`：
  - 实现硬件操作细节
  - 调用 `protocol/*` 完成实际命令收发
- `device-connection-manager.ts`：
  - 调用 `platform/serial` 网关处理连接、初始化、断开
- `serial-service.ts`：
  - 旧接口 facade，内部转接 `platform/serial`（兼容存量）

## 职责
- 将业务操作映射为协议命令调用。
- 处理速度/进度/日志等运行时细节。
- 连接管理统一走 `device-connection-manager`。

## 说明
- 该层当前是“过渡层”：同时承载适配与基础设施逻辑。
