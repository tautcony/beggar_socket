# 模块：Application（Burner）

应用入口 `src/features/burner/application/burner-use-case.ts` 保留 BurnerUseCase / BurnerFacade 兼容签名，通过 domain ports 调用能力。`src/features/burner/application/factory.ts` 和 adapters 是 composition root。

- `src/features/burner/application/command-preparation.ts`：admission 后快照 CFI/options，解析地址与大小；短 ROM 填 FF，长 ROM 不截断，RAM read 优先已加载数据长度。
- `src/features/burner/application/command-transaction.ts`：操作结束后 await reset 恰好一次；cleanup 失败单独诊断，不覆盖主结果/cause。
- `src/features/burner/application/burner-session.ts`：token、busy、abort、progress/log；取消不等于 worker 已结束。
- `src/features/burner/application/flow-template.ts`：统一 admission、worker、成功投影、异常与 finally；旧任务、取消和 disposed 状态禁止成功展示。
- `src/features/burner/application/device-operation-owner.ts`：同 transport 的完整事务独占；断连关闭 admission、请求取消并等待真实 worker/cleanup。
- `src/features/burner/application/connection-use-case.ts`：排队连接、断连、指定端口重连；枚举是查询，失败不丢失连接 handle，close 失败后不打开新端口。

`src/features/burner/application/domain/ports.ts` 定义连接/卡带契约；`src/features/burner/application/domain/result.ts` 保留领域结果与原 CommandResult。`src/types/command-error.ts` 的 stage/code/cause/cleanupError 沿服务、port、facade 到 UI diagnostic 传播，message/data 兼容旧调用。

应用层不依赖 Vue 或具体 platform/services 实现；`src/features/burner/adapters/cartridge-protocol-port.ts` 与 `src/features/burner/adapters/device-gateway-connection-port.ts` 负责边界转换。

runBurnerFlow 的可选 budgetMs 控制执行与命令 cleanup 的协作预算，预算触发 session.abortOperation(reason)；用户取消与超时有不同稳定原因。成功投影/文件对话框不计入预算，但仍属于 owner 持有的完整流程。
