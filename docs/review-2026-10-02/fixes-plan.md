# 保持现有功能的实施方案

基线：`756179a`。这里只制定方案，不实施重构。所有阶段保留对外入口，先提供替换实现和证据，再移除旧路径。

## 功能与兼容约束

- 保留 Web、Tauri、模拟运行时；保留旧 C# 客户端可使用的合法协议帧。
- 保留 GBA ROM/存档、GB/GBC MBC bank、SRAM/FRAM/FLASH、RTC、PPB、multi-cart scan、LK 构建与 ROM assembly、文件导入导出、进度/日志/取消。
- 不改变 opcode、小端字段、地址单位、CRC 占位、健康响应和 ACK 形状；当前 firmware profile/capability 差异显式保留。CRC 不能因重构突然启用。
- 保留配置 storage key 和有效旧值，设置迁移必须有版本策略；不把显式用户 page size 当作旧默认值无条件重写。
- 不按行数衡量架构效果，不一次统一整个适配器或固件，不把用户 stash 恢复进实施基线。

## Batch 0：可重复的行为基线和质量门禁（小～中）

目标：AR-01/07/08；为后续风险修复提供可证伪的验收。

1. 固定 Node/npm 与 clean-install 流程，解决 LK 慢测试：记录构建和比较耗时，用保留字节语义的线性比较替代大数组通用深比较；不能简单删测试或全局扩大 timeout。
2. 修正 PowerShell MCU 参数传递，验证 Debug/Release cache、产物与优化；不借此更换 MCU 构建系统。
3. 在 PR 加 lint、type-check、check:deps、test:run；native check/test 与打包分开。质量 job 名称稳定，便于设置 required checks。
4. 建立协议 golden vectors、合法输出样本和硬件验收清单。记录支持 profile、opcode、frame 开销、最大 payload、bank、地址单位与结果格式。

涉及：workflows、package/runtime 配置、LK 测试、mcu/cmake-build.ps1、协议测试 fixture。

验收：最新 clean clone 可重复检查；故意破坏输出一个字节/失败测试时门禁失败；正常构建输出不因该批次改变。MCU Build Debug/Release 均通过后才接受构建脚本修改。

## Batch 1：协议输入与模拟真实性（中，高收益）

目标：FW-01/03/04、AD-02；优先修复越界与不推进路径。

1. STM32/STC 分别在总线访问前做 opcode 语义校验：完整头、总长、payload、readSize、偶数字长度、合法 bufferWriteBytes；非法帧无总线副作用。
2. 明确收到不足帧头/完整帧/未知命令时的端点与缓冲处理；先保持现有合法分片时序。
3. PayloadBuilder 断言总长合法；每种命令用各自开销计算可用数据上限。
4. 模拟器校验 frame header 和真实 bank 窗口；提速改成本模型，不能扩大为违反协议的请求。

涉及：固件 uart 收包/分派、payload-builder/protocol、simulated runtime/transport。

验收：长度边界与每个分片位置重放；非法帧零总线访问；合法请求 bytes/响应与旧样本一致；STM32/STC 读 ID、ROM、存档真机回归。不得直接开放 STC 注释掉的命令。

## Batch 2：设备操作所有权和失败恢复（中～大，分小步）

目标：LC-01/02/03/04/06、FW-02/05/06/07，连同 writer recovery 残留假设。

1. 先修复连接查询失败不清空资源、关闭失败可重试、指定端口重连整体入队、迟到 open 回收；给每种路径失败注入测试。
2. 在现有 BurnerSession/use case 上引入操作 id，拒绝重复提交。取消只标 cancelling，底层任务退出、复位完成才恢复 idle。
3. 进度回调、finally 和 context 引用绑定 operation id 与 connection generation；过期任务不能改新状态。
4. 页面 ROM/RAM、RTC/PPB 工具、断连使用同一设备级 operation owner；不能只在每个组件中加独立 busy。
5. 原生串口任务保留资源所有权至真实结束；短 global lock 查找会话、per-session I/O/取消通道。Tauri 与 Web 的恢复/清理失败可观察。
6. 固件等待返回完成/超时/取消/断连结果，统一结束路径，失败不得继续下一字节并发成功 ACK。STC 逐一消除 IRQ 屏蔽区域的无界等待。
7. 旧 C# 先抽串口事务，deadline + cancellation + exact read；发送异常不得吞掉；退出完成后再关闭端口。

验收：延迟响应、半帧、取消后立即新操作、旧 finally 迟到、断连、cleanup 再失败、open 迟到；单设备完整事务不交错，所有路径有界恢复或报告不可恢复错误。禁止用 Promise.race 提前解锁冒充取消实现。

## Batch 3：地址规则与 RTC 契约（中）

目标：AD-01/03/04/05、LC-05/07、AR-04。

1. 纯 chunk planner 统一逻辑地址 → bank/cart address/window remaining，read/verify/RAM write 先迁移；write 的既有扇区/bank 夹紧作为基线。
2. GBA RAM 按当前地址/实际 bank 推导换 bank，不依赖累计计数恰好相等。
3. RTC 有限整数校验、写入前保存可恢复状态，finally 恢复 Halt/bank/access，目标时间与读回结果按秒增量/进位容差比较；保留 RTC 编码差异。
4. 设置复用已有 descriptor 做 runtime schema、整数和有限数校验；查询错误与配置错误不能改设备状态。
5. 明确 idle timeout/total deadline/operation budget；默认慢设备兼容策略先通过测量确定，operation budget 接入真实取消恢复后才启用。

验收：bank 尾前 16 字节、跨 2 个 bank、不同相邻内容、128 KiB 存档、非对齐地址；每条命令不越窗口。RTC 每步故障、日期/秒进位、旧值、非法数据；合法配置往返不变。真机测试覆盖支持的 GBA/MBC/FRAM/RTC。

## Batch 4：抽象收敛与 UI 编排迁移（中～大，拆为独立 change）

目标：AD-D01/02/03/06、AR-02/03。

建议目标结构：

```text
Vue presentation / composable projection
  → existing burner use cases + operation owner
  → cartridge capability ports
  → GBA/MBC strategies + shared chunk/retry/progress rules
  → existing protocol codec + transaction transport
  → Web / Tauri / simulated backends
```

1. 先确认每个基类模板的实际调用者；逐个迁移 read、verify 的共享规则，删除重复的无调用模板。write/erase 后置，硬件策略显式提供能力和窗口。
2. 先扩展兼容 CommandResult 的可选 error 信息，再沿端口保留错误。只保留有职责的包装层，不新增另一套 Result/facade。
3. CartBurner 把 padding、option/context 快照、reset 和结果流程迁到已有用例；Vue 只负责交互、展示、文件保存适配。每次迁移一种操作。
4. LK 分 InputGame/PreparedGame/AllocatedGame，日志和 layout 属于局部 BuildContext；并发调用不共享 log。二进制 encoder 只接收已完成布局的结构。

验收：固定 timestamp 的 golden ROM/save bytes、协议 transcript、bank/时序、进度事件、错误与取消状态匹配；已确认 bug 场景允许预先定义的行为差异，合法路径不能出现无解释差异。减少层数/代码量不是验收标准。

## Batch 5：文档、门禁完整性和性能（小～中，后置）

目标：AR-05/06 及 CFI/LK 容量疑点。

- 更新模块文档为 Web/Tauri/模拟、同步历史 finding 状态与实际提交；保留历史报告不改写历史结论。
- 依赖分析使用 AST/resolution，alias/relative/dynamic import 和循环都可检查，规则集中定义；composition root 是明确例外。
- CFI geometry 用真实芯片 fixture 评估指数/sector/total 校验；LK 容量尾部、大列表与布局不变量补 fixture，再决定何时拒绝。
- 量化首屏与图像处理后优化懒加载/Worker/二进制 IPC；保留输出、模拟器控制和音频行为。没有测量不换库。

## 回归矩阵

| 功能 | 无硬件门禁 | 实机验收 |
| --- | --- | --- |
| 连接/断开/取消 | late result、generation、busy token、cleanup failure | Web/Tauri × STM32/STC，慢打开、拔插、半帧、取消后下一任务 |
| ROM 擦写/读取/verify | golden 帧、ACK failure、bank/sector edges、重试 | GBA/支持的 MBC、不同 flash，完整 dump/verify |
| SRAM/FRAM/FLASH 存档 | 64/128 KiB、bank 尾、长度/延迟 | 实卡备份、写入、读回，保存原始数据可恢复 |
| RTC/PPB | 每步失败、状态恢复、值比较 | GBA/MBC3 计时连续性、随后存档访问；PPB 支持设备 |
| LK/ROM assembly | 固定输入输出字节、输入不变、并发日志、容量边界 | 菜单启动、ROM 选择、存档槽、背景显示 |
| UI/导入导出/模拟器 | file latest-wins、消息/进度、导出取消 | 支持浏览器/Tauri smoke、ROM 启动、控制/音频 |

每个实施批次应运行相关 focused tests；最后运行 lint/type-check/test:run/check:deps/build，涉及 native/固件再追加实际构建与对应实机矩阵。避免无意义重复全量测试。

## 交付和回退

- 每个 change/提交只改变一个行为边界；记录基线与允许的行为差异。
- 使用既有 OpenSpec workflow，一次不把全部 6 批装入巨型 change；当前没有创建实施 change。
- 高风险批次保留旧固件/客户端产物与 hash；迁移期兼容入口可回退，不同时改变协议版本、存储格式和硬件时序。
- 完成条件：相关失效路径测试通过、正常 golden bytes 不变、实机矩阵有记录、文档和配置兼容；仅 build 或模拟器测试绿灯不足以宣布完全不破坏功能。
