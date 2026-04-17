# Phase 3 审查报告: 服务与应用编排层

> 日期: 2026-04-15
> 文件数: 7
> 发现: P0(1) / P1(3) / P2(2) / INFO(1)

## 已审查文件

- `services/device-connection-manager.ts` (显著重构)
- `services/serial-service.ts` (重构)
- `services/gba-adapter.ts` (扩展)
- `services/mbc5-adapter.ts` (显著扩展)
- `services/cartridge-adapter.ts` (变更)
- `features/burner/application/domain/error-mapping.ts` (扩展)
- `features/burner/application/domain/ports.ts` (变更)

## Findings

### [P0] MBC5 verifyROM 中 switchROMBank 缺少 mbcType 参数

- **位置**: `services/mbc5-adapter.ts` `verifyROM()` L1085
- **触发条件**: 对 MBC3/MBC1 类型卡带执行验证操作
- **影响**: `switchROMBank(bank)` 缺少第二个参数 `mbcType`，默认值为 `'MBC5'`。对于 MBC3 卡带，bank switching 使用了错误的寄存器地址：
  - MBC5 写入 `0x2100` (bank low) + `0x3000` (bank high)
  - MBC3 仅写入 `0x2100`
  这会导致 MBC3 卡带验证时 bank 切换错误，读出的数据与写入的不匹配 → **验证报告误判（false negative）**
- **修复方向**: 将 L1085 改为 `await this.switchROMBank(bank, mbcType);`
  ```typescript
  // L1085 当前代码
  await this.switchROMBank(bank);
  // 应改为
  await this.switchROMBank(bank, mbcType);
  ```

### [P1] SerialService.openPort() 资源泄漏 — 端口未关闭

- **位置**: `services/serial-service.ts` `openPort()` (L40-52)
- **触发条件**: `gateway.connect()` 成功但 `toLegacyDeviceInfo(handle)` 抛出异常
- **影响**: catch 块只关闭了 `handle.transport` 但没有关闭底层 `handle.port`（WebSerial 模式下 port 是独立的 SerialPort 对象）。WebSerial 端口句柄泄漏可导致浏览器 "Max ports exceeded" 错误
- **修复方向**: 在 catch 中同时关闭 port：
  ```typescript
  catch (e) {
    await handle.transport?.close?.().catch(() => {});
    if (handle.port && typeof handle.port.close === 'function') {
      await handle.port.close().catch(() => {});
    }
    throw e;
  }
  ```

### [P1] DeviceConnectionManager 类型断言不安全

- **位置**: `services/device-connection-manager.ts` `toDeviceInfo()` (L72-77)
- **触发条件**: `BurnerConnectionHandle.context` 结构与 `DeviceHandle` 不匹配
- **影响**: `ctx as DeviceHandle` 是不安全的类型断言。如果 handle.context 缺少 `transport` 属性或 transport 结构变更，运行时会在后续代码中崩溃（而非在断言点）
- **修复方向**: 使用类型守卫代替断言：
  ```typescript
  function isDeviceHandle(ctx: unknown): ctx is DeviceHandle {
    return ctx !== null && typeof ctx === 'object' 
      && 'platform' in ctx && 'transport' in ctx;
  }
  ```

### [P1] error-mapping.ts inferErrorCode 脆弱的字符串匹配

- **位置**: `features/burner/application/domain/error-mapping.ts` `inferErrorCode()` (L25-47)
- **触发条件**: 底层错误消息变化（Tauri plugin 版本升级、i18n 翻译变更）
- **影响**: 错误代码推断依赖 `message.includes('timeout')` 等字符串匹配，case-insensitive 处理正确（`.toLowerCase()`），但仍然脆弱：
  - "Connection timed out" 会匹配 `timeout`
  - 其他语言的超时消息不会匹配
  - Tauri 原生错误可能格式不同
- **修复方向**: 在传输层/协议层定义错误子类或 error.code，error-mapping 优先检查 code

### [P2] DeviceConnectionManager.connectWithSelectedPort 先 disconnect 再 connect 的窗口

- **位置**: `services/device-connection-manager.ts` `connectWithSelectedPort()` (L170-172)
- **触发条件**: `connectWithSelectedPort` 被调用时已有连接
- **影响**: 先 `await this.connectionUseCase.disconnect()` 后再 `prepareConnectionWithSelection()`，如果 disconnect 成功但 connect 失败，设备处于断开状态。这本身不是 bug（用户需要重新连接），但 disconnect 可能会丢失未保存的操作状态
- **修复方向**: 考虑在 connect 失败时恢复，或至少在文档中说明此行为

### [P2] cartridge-adapter.ts resetCommandBuffer 的双路径信号发送

- **位置**: `services/cartridge-adapter.ts` `resetCommandBuffer()` (L144-155)
- **触发条件**: transport 不存在但 port 存在
- **影响**: 代码有两条路径设置信号 — 通过 transport 或直接通过 port。降级到 port 时无类型保证 port 有 `setSignals` 方法（Tauri 模式下 `handle.port` 为 null）
- **修复方向**: 统一通过 transport 接口操作信号

### [INFO] DeviceConnectionManager 连接锁 — 改进

- **位置**: `services/device-connection-manager.ts` `requestDevice()` (L97-112)
- **影响**: 正面变化 — 新增 `isConnecting` 标志防止并发连接。但这是布尔互斥而非真正的 mutex，如果 `_requestDevice` 抛出异常后 finally 正确重置标志，当前实现可接受

## 漏检复盘

- **默认分支 / 未知输入**: 已检查 — `mapConnectionStageError` 中的 `codeMap` 覆盖了所有 lifecycleStage 枚举值
- **异步失败 / 前提失效**: 发现 P2-01 disconnect → reconnect 窗口
- **半完成状态 / 重建窗口**: `connectWithSelectedPort` 的 disconnect+connect 顺序已标记
- **渲染 / 导出 / 编码**: 本层无渲染点
- 本 phase 仍然证据不足的点: `gba-adapter.ts` 和 `mbc5-adapter.ts` 中上次审查的 P0（全片擦除无超时保护）是否已修复，需要检查完整的擦除逻辑

## 未覆盖区域

- `services/flash-chip.ts` — 未变更
- `services/tool-functions.ts` — 未变更
- `services/lk/` — 未变更
- `services/rtc/` — 未变更
