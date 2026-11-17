# web-client 工作流、边界与验证

范围：当前 `web-client/` 的Web Serial/Tauri调用链、卡带adapter、协议封装和测试。以下改进均由客户端实施；RC31仅作为已有协议和兼容条件的参考。本次没有修改业务代码。

## 1. 现有调用链与可复用行为

UI `CartBurner.vue:502` 获取ROM、CFI、大小、基址和配置，调用burner facade；`BurnerUseCaseImpl`检查session，经 `CartridgeProtocolPortAdapter` 交给 `GBAAdapter` / `MBC5Adapter`，再通过 `protocol/beggar_socket/` 和transport发送命令。源码入口：

- `features/burner/application/burner-use-case.ts:114`
- `features/burner/adapters/cartridge-protocol-port.ts:10`
- `services/gba-adapter.ts:385,819`
- `services/mbc5-adapter.ts:661,1103`
- `protocol/beggar_socket/protocol.ts:76`

保留写前擦除、分块编程、读回逐字节校验和有限重试。Web Serial与Tauri的 `sendAndReceive` 都串行化请求；同设备不要并发调用命令。Tauri及Rust读取会累计到请求长度或超时，见 `platform/serial/tauri/tauri-serial-transport.ts:46`、`src-tauri/src/native_platform.rs:116`。

## 2. 写前输入契约和完成量

**确定的API缺陷：** GBA/MBC5以 `options.size ?? fileData.byteLength` 作为total，实际subarray可能更短，循环仍按计划chunkSize增加written。

反例：data为4B，size为8B，页大小至少8B。实际program payload只有4B，但written可以增加8B并进入success。对应GBA位置 `gba-adapter.ts:402,515,521,544,552,597`，MBC5对应位置 `mbc5-adapter.ts:690,800,828,883`。更长目标还可能遇到空chunk后break而进入成功出口。

当前UI会先用 `0xFF` pad到selected size，再传 `alignedRomData`（`CartBurner.vue:525`），所以这不是默认UI必现故障；公开adapter/use-case调用仍可达。

保留的修正：

- 在首次erase前检查base/size是有效有限整数，size为正，输入覆盖承诺的写入区间，`base+size<=deviceSize`。
- 区分允许截取文件前缀与输入不足，不把两者隐式混为一类。
- ROM地址与payload长度符合操作粒度；协议字段不发生溢出/截断。
- 只按实际完成字节计数；循环结束核对承诺范围，空chunk不得直接走success。

验收：4B/8B API反例在任何erase/program之前失败；正常UI padding、合法前缀写、设备末尾、非法数值和零长度各有明确结果。

## 3. 真实扇区几何与局部更新

CFI parser给region绝对地址（`utils/parsers/cfi-parser.ts:420`），`calcSectorUsage`却从base重新铺设首region几何（`utils/sector-utils.ts:4`）。

两个反例：

1. 64KiB扇区，从0x8000写64KiB，实际涉及两个物理扇区，现元数据可能只有一个假扇区。
2. 芯片前段为小boot sectors、后段为大sector，UI选择非零且对齐base后，现算法仍从首region大小开始生成元数据，可能重复命中同一真实扇区或遗漏应擦范围。此例依具体CFI布局触发，非零base可由UI选择。

修正为按 `[base,base+size)` 与真实region求交，再枚举物理扇区；检查可用容量时也扣除base，不只比较全芯片总容量与size。

完整扇区擦除会清掉输入覆盖范围外的字节。现阶段先定义并检查允许的扇区覆盖范围；若需要任意局部更新，使用现有读/擦/写命令读出整扇区、合并目标数据后回写，并让恢复重试复用同一份完整扇区数据。没有局部更新需求时，不必为本轮修复扩展该工作流。

验收：异构region fixture、region交界两侧、`[S-2,S+2)`跨界、非零base、设备末尾；断言真实erase地址和最终模拟存储内容。

## 4. 恢复重放

GBA `gba-adapter.ts:436`、MBC5 `mbc5-adapter.ts:726` 在program失败后稳定命令通道、尝试reset flash、重擦当前扇区并从扇区起点重放，次数有限。方向可保留，但恢复依赖真实扇区地址与覆盖该扇区的数据策略。

客户端改进集中在：恢复使用正确物理几何；明确已完成量和重试耗时；在次数耗尽或重放未完成时返回失败；避免将不确定的ACK结果解释为已验证的数据成功。

现有测试已覆盖部分失败与擦除重放顺序（`tests/services/adapters/gba-adapter.test.ts:172`、`mbc5-adapter.test.ts:119`）。新增验证应使用带存储副作用的mock，在失败前真实改变模拟数据，再检查最终读回，而非只抛异常或断言调用次数。应覆盖部分执行后超时、完整执行但ACK丢失、重试耗尽和取消，不将软件mock通过外推为实机恢复保证。

## 5. 校验镜像、范围与bank分块

### 写入和校验必须使用约定一致的镜像

UI写入pad后的镜像（`CartBurner.vue:527`），verify使用原始文件（`:653`）。GBA/MBC5又将校验长度取为配置、设备容量与文件长度的最小值（`gba-adapter.ts:850`、`mbc5-adapter.ts:1138`）。因此成功可能只证明共同前缀匹配，未检查实际写入的padding区域。

完整校验复用相同base、size与补齐镜像；允许前缀校验时明确actual verified range和截断状态。不要把有意的部分校验一概视为错误，也不要用普通success暗示已验证整个selected size。

验收：短文件配较大selected size、padding区域注入差异、配置超过容量、明确前缀校验；完整校验应发现padding差异，部分校验应准确报告范围。

### bank边界

GBA write chunk受bank剩余窗口限制（`gba-adapter.ts:512`），verify只取页大小与剩余总量（`:908`），随后按chunk首地址选bank（`:932`）。默认4096B页与UI的4MiB基址通常对齐；`advanced-settings.ts:107` 对非2幂页大小仅告警，因此pageSize=1000、base=28MiB、范围跨32MiB可以让一次读越过bank窗口。

统一读取、写入和校验的chunk规则：页大小、剩余范围、bank窗口，以及操作需要时的扇区边界取最小值。GB路径还需保持0x4000窗口与MBC选择一致。实际字段长度与总线粒度也应经过协议层检查。

验收：32MiB边界前后、GB 16KiB窗口、非2幂页大小、最后不足一页的块；每次请求不能跨当前bank窗口，数据连续无重叠或遗漏。

## 6. 协议封装、能力与取消

- F4/F6 ROM地址为byte，F5透传地址为word；`protocol.ts:122` 的擦除序列在调用F5前转换一次。测试实际payload以固定单位契约。
- `PayloadBuilder.build(false)` 已包含两字节CRC占位（`payload-builder.ts:81`）。保持现有legacy约定，不能把未计算CRC误当少两字节。
- 对既有命令增加客户端参数检查：固定/变长公式、profile可用上限、非空payload、ROM对齐及uint16长度字段范围。能力不明时不要把模拟器大块能力用于实物。
- CFI容量查询、MBC枚举和厂商ID不代表操作能力。先解析command set、核对实际方法，未支持路径在erase前拒绝；保留已有明确的型号特例。
- `BurnerSession`将AbortSignal传入adapter，但单次transport请求没有直接的AbortSignal参数。取消通常在命令结束或超时后的块边界生效。UI应显示“正在取消”，在途请求完成/收尾前保持操作互斥，不提前显示已安全停止，也不立即发下一条操作。

这些都是客户端行为改进，不要求更改设备命令或即时中断正在执行的卡带操作。

## 7. RC31 设备发现与已有协议适配

RC31兼容构建使用 `0483:5740`，产品默认preset只接受 `0483:0721` 或既有字符串（`utils/port-filter.ts:183`）。Web chooser和Tauri筛选使用该preset（`platform/serial/web/device-gateway.ts:27`、`tauri/device-gateway.ts:74`）。候选设备筛选可在客户端扩充，但不能据此声明完成支持。

profile只定义stm/stc/unknown；`device-connection-manager.ts:78` 会应用配置的profile，默认stm。接入应明确区分已有legacy与RC31 FlashGBX会话，并让能力来源可解释，不能靠PID或默认设置推断所有命令可用。

当前客户端没有FlashGBX host会话，因此不能直接使用C1/D5/CA；RC31同时保留legacy fallback。其首字节自动识别会与某些legacy帧长度碰撞：F4数据1000B总长1011，低字节F3触发另一个协议的关电分支；F4数据64B总长75，头部单独分包可能被当probe。细节见 [协议能力报告](02-cartridge-algorithms.md)。只把这些结论作为客户端互通条件：验证会话、所有实际帧形态和重连，暂不启用未确认路径。

可选客户端扩展是适配RC31已经提供的C1流读、D5 CRC32和CA RTC读取。每项需要独立协议封装与结果验证，先做只读互通，再谈吞吐；保留现有legacy设备的读回校验和RTC路径。

## 8. 性能与进度

现有写入已分别统计transfer/erase duration，`SpeedCalculator`平均速度含重试耗时（`utils/progress/speed-calculator.ts:30`）。保留该口径并明确总耗时、有效完成量、重试次数与等待时间，不把重复重放字节计成额外有效数据。

先量测现有路径，再检查重复读取/初始化、进度更新频率和合法chunk选择。只有在RC31已有协议互通成立后，才单独比较C1/D5/CA收益。不要用并行命令替代会话与bank管理，也不根据仿真吞吐宣称实机MB/s。

## 9. 已有测试记录与后续验收

前次分析在 `web-client/` 执行：

```text
npm run test:run -- tests/services/adapters/gba-adapter.test.ts tests/services/adapters/mbc5-adapter.test.ts tests/features/burner/application.test.ts tests/protocol/transport.test.ts tests/platform/serial/tauri-transport.test.ts tests/platform/serial/device-gateway.test.ts tests/platform/serial/simulated-transport.test.ts
```

结果：7个文件通过，67个测试通过。覆盖adapter恢复、应用层、协议传输、Tauri、gateway和simulator基础交互，均为无硬件测试。本次文档筛选未重跑这些测试。

后续客户端实施重点覆盖：

| 优先级 | 测试 | 期望 |
|---|---|---|
| P1 | 4B输入/8B size、越容量、非法地址和长度 | erase前拒绝，不发送破坏性命令 |
| P1 | 非零base、异构CFI region、部分扇区范围 | 正确物理地址与明确的数据保留策略 |
| P1 | 写入padding后在padding区注入差异 | 完整校验失败；部分校验准确报告范围 |
| P1 | 1000B页跨GBA 32MiB及GB窗口 | 每次请求都在当前bank内，最终数据连续 |
| P1 | 协议字段上限、奇数ROM payload、F5地址单位 | 请求不截断、不混淆地址单位 |
| P2 | 部分执行/丢ACK/耗尽重试 | 最终存储与结果一致，恢复次数有界 |
| P2 | 在途请求取消 | UI与session保持互斥，收尾后才允许下一操作 |
| P2 | RC31筛选、profile、已有协议会话 | 发现不等于支持；只启用验证通过的路径 |
| P2 | 同设备同数据的性能前后对照 | 分别给出总耗时、有效吞吐及重试，无仿真外推 |
