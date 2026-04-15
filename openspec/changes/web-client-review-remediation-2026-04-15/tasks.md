## 1. Scope Selection

- [ ] 1.1 确认本次实施范围是否至少包含 `A1-A4`
- [ ] 1.2 确认是否纳入 `B1-B6` 的实现层稳健性补丁
- [ ] 1.3 确认是否纳入 `C1-C4` 的协议/错误模型技术债

## 2. Batch A: 发布前候选修复

- [x] 2.1 `A1` 修复 `services/mbc5-adapter.ts` 的 `verifyROM()` bank switching，传递 `mbcType`
- [x] 2.2 为 `A1` 增加 MBC3/MBC1 验证回归覆盖，防止错误按 MBC5 规则切 bank
- [ ] 2.3 `A2` 为 `platform/serial/mutex.ts` 增加幂等 release 防护
- [ ] 2.4 为 `A2` 增加双重 release 不破坏队列的单元测试
- [x] 2.5 `A3` 保留 `WebSerialTransport` 的 writer 缓存策略，并为超时后的 abort/释放/重建增加串行恢复状态
- [x] 2.6 为 `A3` 增加 send 超时后再次 send、close、重连时不会复用 stale writer 的回归测试
- [x] 2.7 `A4` 在 Web/Tauri gateway disconnect 中保证 close 失败后仍完成句柄清理
- [x] 2.8 为 `A4` 增加 disconnect close failure 后可重连的测试

## 3. Batch B: 本迭代候选修复

- [ ] 3.1 `B1` 在 `SerialService.openPort()` 的异常路径中同时关闭 `handle.transport` 与 `handle.port`
- [ ] 3.2 `B2` 为 `TauriDeviceGateway.connect()` 增加 `open()` 超时保护
- [ ] 3.3 `B3` 在 `TauriDeviceGateway.init()` 失败时回滚 DTR/RTS 到安全基线
- [ ] 3.4 `B4` 为 `useCartBurnerFileState` 增加空数组保护和 Blob URL 清理保障
- [ ] 3.5 `B5` 为 `DeviceConnect.vue` 增加统一的连接操作互斥，阻止双击并发
- [ ] 3.6 `B6` 在 `DeviceConnectionManager` 中用类型守卫替代不安全断言，并补失败映射测试

## 4. Batch C: 技术债候选

- [ ] 4.1 `C1` 为 packet read / connection mapping 引入稳定 error code 或 error type，替代字符串匹配链
- [ ] 4.2 `C1` 保持旧消息文本兼容，避免 UI 展示回归
- [ ] 4.3 `C2` 将协议层 request/response 调用迁移到原子 `sendAndReceive()`
- [ ] 4.4 为 `C2` 增加并发触发下不会错配响应的回归测试
- [ ] 4.5 `C3` 统一超时工具到共享模块，删除重复实现
- [ ] 4.6 `C4` 为 WebSerial close/pump 等待增加超时兜底，避免关闭挂起

## 5. Verification

- [ ] 5.1 运行 transport/gateway 相关单元测试
- [ ] 5.2 运行 protocol/service 层回归测试
- [ ] 5.3 手工验证 MBC3 verify、USB 拔出后 disconnect、send 超时后重试、端口二次连接
