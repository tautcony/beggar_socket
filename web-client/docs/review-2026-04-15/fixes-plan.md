# 修复计划

## 批次划分

### Batch A — 立即修复 (P0 + 关键 P1)

影响正确性和数据完整性的问题，建议在下一次发布前修复。

#### A1. MBC5 verifyROM bank switching 修复
- **目标问题**: [P0] switchROMBank 缺少 mbcType 参数
- **涉及文件**: `services/mbc5-adapter.ts` L1085
- **修复**: `await this.switchROMBank(bank);` → `await this.switchROMBank(bank, mbcType);`
- **复杂度**: 极低（1 行改动）
- **验证方式**: 使用 MBC3 卡带执行 verifyROM，确认不报 false negative

#### A2. Mutex 双重释放防护
- **目标问题**: [P0] Mutex 双重释放导致队列错乱
- **涉及文件**: `platform/serial/mutex.ts`
- **修复**: 在 release 闭包中添加 `released` 标志位
- **复杂度**: 低
- **验证方式**: 添加单元测试验证双重 release 忽略/告警行为
- **建议顺序**: 先于 A3（A3 依赖 mutex 正确性）

#### A3. WebSerialTransport.send() writer 管理
- **目标问题**: [P0] send() 超时恢复路径 writer 竞态
- **涉及文件**: `platform/serial/transports.ts` L70-85
- **修复方案**:
  1. 在 `send()` 中添加 try-finally 确保超时后 writer 状态一致
  2. onTimeout 中不直接 abort+null，而是标记待清理状态
- **复杂度**: 中
- **验证方式**: 模拟 send 超时场景（降低超时时间），确认后续 send 不挂起

#### A4. disconnect 异常保护
- **目标问题**: [P1] close/disconnect 异常不捕获导致状态残留
- **涉及文件**: `platform/serial/tauri/device-gateway.ts`, `platform/serial/web/device-gateway.ts`
- **修复**: disconnect 中 transport.close() 用 try-catch 包裹
- **复杂度**: 低
- **验证方式**: 拔除 USB 后点击断开，确认不崩溃且状态正确重置

---

### Batch B — 本迭代修复 (P1)

可靠性和健壮性改进。

#### B1. SerialService.openPort() 端口泄漏
- **目标问题**: [P1] catch 中只关闭 transport 未关闭 port
- **涉及文件**: `services/serial-service.ts` L40-52
- **修复**: catch 中同时关闭 `handle.port`
- **复杂度**: 低
- **验证方式**: 在 toLegacyDeviceInfo 抛异常时确认端口被释放

#### B2. TauriDeviceGateway.connect() 超时
- **目标问题**: [P1] tauriPort.open() 无超时
- **涉及文件**: `platform/serial/tauri/device-gateway.ts` L153
- **修复**: 添加 `withTimeout(tauriPort.open(), 5000, '...')`
- **复杂度**: 低
- **验证方式**: 连接不存在的端口，确认 5 秒后超时

#### B3. TauriDeviceGateway.init() 信号回滚
- **目标问题**: [P1] init 半完成时硬件信号未复位
- **涉及文件**: `platform/serial/tauri/device-gateway.ts` L185-207
- **修复**: catch 块中尝试复位信号到安全状态
- **复杂度**: 低
- **验证方式**: init 异常后重新连接，确认设备响应正常

#### B4. useCartBurnerFileState 健壮性
- **目标问题**: [P1] saveAsFile Blob URL 泄漏 + onRomFileSelected 空数组
- **涉及文件**: `composables/cartburner/useCartBurnerFileState.ts`
- **修复**: try-finally 包裹 blob 操作 + 空数组检查
- **复杂度**: 低
- **验证方式**: 单元测试覆盖空数组输入和异常路径

#### B5. DeviceConnect.vue 连接竞态
- **目标问题**: [P1] 快速双击导致重复连接
- **涉及文件**: `components/DeviceConnect.vue`
- **修复**: 添加 `isProcessing` ref 锁
- **复杂度**: 低
- **验证方式**: 快速点击连接按钮，确认只发起一次连接

#### B6. DeviceConnectionManager 类型安全
- **目标问题**: [P1] `ctx as DeviceHandle` 不安全断言
- **涉及文件**: `services/device-connection-manager.ts` L72-77
- **修复**: 添加运行时类型守卫
- **复杂度**: 低
- **验证方式**: 类型测试

---

### Batch C — 技术债 (P2 + 架构改善)

需要更大范围重构的改进。

#### C1. 统一错误类型层次
- **目标问题**: 错误分类链全程依赖字符串匹配
- **涉及文件**: `packet-read.ts`, `error-mapping.ts`, `device-connection-manager.ts`
- **方案**: 定义 TransportError → ProtocolError → BurnerDomainError 类型链
- **复杂度**: 高（跨多层文件）
- **验证方式**: 单元测试验证各层错误正确传播和分类

#### C2. 协议层迁移至 sendAndReceive
- **目标问题**: protocol.ts 未使用原子操作
- **涉及文件**: `protocol/beggar_socket/protocol.ts` (17 处)
- **方案**: 将 sendPackage+getResult/readProtocolPayload 替换为 sendAndReceive
- **复杂度**: 中（改动点多但模式统一）
- **验证方式**: 现有测试 + 协议层集成测试

#### C3. withTimeout 抽取为共享工具
- **目标问题**: `transports.ts` 和 `tauri-serial-transport.ts` 重复定义
- **方案**: 提取到 `utils/async-utils.ts`
- **复杂度**: 低
- **验证方式**: 编译通过 + 现有测试

#### C4. WebSerialTransport close 流程加超时兜底
- **目标问题**: pump 可能在 close 时阻塞
- **涉及文件**: `platform/serial/transports.ts`
- **方案**: pumpPromise await 加 race timeout
- **复杂度**: 低
- **验证方式**: 拔除 USB 后关闭端口，确认不挂起

---

## 建议修复顺序

```
A1 (MBC5 验证修复，1行) 
→ A2 (Mutex 防护) 
→ A3 (Writer 管理) 
→ A4 (Disconnect 保护)
→ B1-B6 (并行修复)
→ C1-C4 (技术债迭代)
```
