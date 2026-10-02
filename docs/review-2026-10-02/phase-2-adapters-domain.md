# Phase 2：卡带适配器、协议、RTC 与 ROM 构建

> 基线：GitHub 同步后的 HEAD `756179a`，2026-10-02。仅阅读当前工作树，不读取或恢复 stash；不修改生产代码。
> 结论：确认缺陷 P1 × 4、P2 × 2；结构债 × 3；待验证 × 2。确认指可由代码路径证明，未声称已在真实硬件复现。

## 范围与现有有效设计

覆盖 `web-client/src/services/{cartridge-adapter,gba-adapter,mbc5-adapter,platform-ops}.ts`、`services/rtc/`、`services/lk/`、`protocol/beggar_socket/`、`utils/parsers/{rom-parser,cfi-parser,constants}.ts`，以及相关 adapter、simulated runtime、LK 和 parser 测试。重点检查地址窗口、包长、失败后状态、错误传播、构建状态所有权。未验证物理电压时序或所有芯片命令手册。

现有 `FlashCommandSet` 保留 GBA/GBC 的 unlock 地址与字节编码差异，是合理的共享边界。MBC1/2/3/5 bank 切换、GBA ROM/SRAM/FLASH bank、5V 控制、扇区重写恢复本来就有硬件差异，不应按相似代码行数直接合并。ROM write 已夹紧扇区和 bank 余量（GBA `gba-adapter.ts:585`、MBC `mbc5-adapter.ts:855`），应把这一已存在的不变量扩展到其他传输路径。

## 已确认缺陷

### AD-01 [P1] 读取与部分 RAM 写入的块长没有限制在当前 bank 窗口内

- 位置：`web-client/src/services/mbc5-adapter.ts:1057`、`:1252`、`:1456`、`:1593`；`web-client/src/services/gba-adapter.ts:781`、`:981`、`:1398`；基类 `cartridge-adapter.ts:413` 同样存在。
- 触发：MBC ROM 在 `baseAddress=0x3ff0` 读取超过 16 字节，或 RAM 在 `baseAddress=0x1ff0` 读取/写入超过 16 字节；块长仅取 `min(pageSize, remaining)`，bank 只在块开始时切换。默认 4 KiB page 也能触发，无须调整高级配置。GBA 大容量 ROM 跨 32 MiB 窗口有同类条件。
- 影响：一个命令越过当前映射窗口，后半段不再对应预期逻辑地址；可得到错误 dump/错误 verify，MBC RAM write 可越出存档窗口。具体超出窗口后的总线读写表现取决于硬件，但命令本身违反映射边界。
- 额外已确认路径：GBA RAM `gba-adapter.ts:1384` 用 `read === 0x10000` 换 bank，而模拟设备 page 被 `cartridge-adapter.ts:295` 提升至 `0xfffd`。128 KiB 读取的 offset 依次为 0、65533、131066，从不等于 65536，漏掉 bank 1 切换。模拟 MBC 读取实现 `platform/serial/simulated/runtime.ts:542` 直接从线性 memory slice 取数据，会掩盖跨窗口错误。
- 修复：独立纯函数规划 transfer chunk，输出 logical address、bank、cart address、当前窗口剩余字节；read/verify/RAM write 都按该余量夹紧。GBA RAM 换 bank 按地址推导及 bank 变化判断。
- 验收：有不同内容的相邻 bank，覆盖窗口前 16 字节开始、整窗口、两窗口、零长度、非对齐 baseAddress；断言每条命令未越窗口且最终数据正确。模拟测试除线性数据检查外增加真实窗口约束。

### AD-02 [P1] 模拟大块写入超出协议的 16 位包长字段

- 位置：`web-client/src/services/cartridge-adapter.ts:38`、`:295`；`protocol/beggar_socket/payload-builder.ts:83`；`protocol/beggar_socket/protocol.ts:179`、`:296`。
- 触发：模拟 GBA RAM write 使用 65533 字节 chunk；包包含 size(2)+command(1)+address(4)+data(65533)+trailer(2)，实际长度 65542。builder 将长度截断至两字节，声明长度变成 6。FRAM 命令另有 latency 字段，边界更小。
- 影响：生成不符合线协议的帧；当前 simulated transport `platform/serial/simulated/transport.ts:27` 直接分派完整数组，没有校验包头，可能成功并给出错误的兼容性信心。真实设备默认 page <=4096，未据此宣称正常真实设备路径必然失败。
- 修复：按命令开销定义 request data 上限、response data 上限；builder 对 totalSize 超过 0xffff 明确抛错；模拟提速不能突破协议/bank 限制，可调整每命令成本模型。
- 验收：每种 write 命令最大合法长度及 +1，断言包头长度等于实际长度；模拟器拒绝不一致包长；128 KiB SRAM/FRAM 操作走完整协议成功。

### AD-03 [P1] MBC3 设置时间失败后可能留下 Halt 和寄存器选择状态

- 位置：`web-client/src/services/rtc/mbc3-rtc.ts:59`、`:178`、`:180`、`:190`；read 路径 `:221` 到 `:248`。
- 触发：`stopTimer()` 将 DH 写为 0x40 后，第一次写秒/分等寄存器发生传输异常，尚未写入新的 DH。catch 仅打印并抛出，不恢复计时器。成功 readTime 也保留 RAM enable、RTC register 选择和 latch 状态。
- 影响：设备命令已部分执行但函数失败，RTC 可能持续停止；后续直接存档访问需要重新配置映射。这里报告确定的 cleanup 缺失，不将失败时“回滚时间”当成硬件可保证行为。
- 修复：显式记录已修改硬件状态，在 finally 尝试解除 Halt/恢复选定 RAM bank、关闭 RAM access，并保留原始失败和 cleanup 失败；先确认希望恢复原始 Halt 还是启动计时，不能一律写 0 清除用户原状态。
- 验收：在每个寄存器 write/read 注入失败，检查可恢复时的状态和不可恢复时的可见错误；健康读写保持现有操作语义。真实 MBC3 做失败后继续计时与随后存档读写验证。

### AD-04 [P1] RTC 的“写后验证”没有判断写入是否成功

- 位置：`web-client/src/services/rtc/gba-rtc.ts:103` 到 `:123`、`:196`；`services/rtc/mbc3-rtc.ts:81` 到 `:106`、`:189`。
- 触发：硬件 ACK 正常但 RTC 拒绝写入，或读回旧值/非法日期。两个 verifyWrittenTime 都只读取、console.log、delay，既没有期望参数，也没有比较或失败判定；MBC3 非法日期分支仍正常返回。
- 影响：setTime 成功返回，但时间没有按要求设置；界面无法知道失败。每次还有约 5 秒等待却没有形成有效保障。
- 修复：传入目标原始寄存器/时间数据，容许写入和验证期间的正常秒增量，明确 verify 失败结果。将读回协议与验证规则分开，保留不同 RTC 编码。
- 验收：正常推进、秒/日期进位、旧值、非法 BCD、NACK 和 read timeout；旧值必须报告失败，正常进位不能误报。

### AD-05 [P2] MBC3 的 unknown 输入可以绕过数值边界检查

- 位置：`web-client/src/services/rtc/base-rtc.ts:89`；`services/rtc/mbc3-rtc.ts:134` 到 `:155`；`services/rtc/index.ts:51`。
- 触发：setTime 收到 `{}`、带 NaN/undefined/小数的字段，或 RTCManager 的联合类型传错 RTC 数据。`as MBC3RTCData` 不产生运行时校验，`undefined < 1` 与 `undefined > max` 均为 false，后续 Uint8Array 将非法值变为 0/截断。
- 影响：非法输入通过校验并发生硬件写入；当前 UI 正常数字路径不等于任意调用必然触发。
- 修复：在任何硬件访问前检查对象、全部字段 finite integer、范围；使用 `RTCDriver<TData>` 或按 RTCType 判别的输入 API，避免统一 unknown 抹掉形状。
- 验收：缺字段、NaN、Infinity、小数、错误 RTC 形状一律拒绝且没有发送命令；正常输入保持编码。

### AD-06 [P2] LK 构建日志为模块全局状态，两个并发构建会串日志

- 位置：`web-client/src/services/lk/romBuilder.ts:18`、`:43`、`:358`、`:372`、`:415`、`:417`。
- 触发：同一模块中 `Promise.all([buildRom(a), buildRom(b)])`，两次都重置全局 log，然后在动态 import、图片处理、SHA-1 await 处交错写日志。
- 影响：ROM buffer 是各调用局部变量，不据此宣称 ROM 数据互相污染；返回 log 会缺失自身内容或混入另一调用内容。当前 `useMultiMenuState.ts:58` 禁止单页面重复 build，降低实际 UI 触发率，但服务导出本身不满足可重入契约。
- 修复：建立每次调用局部 BuildContext/logger，由构建阶段接收；避免把串行 UI 锁当作服务状态所有权。
- 验收：并发构建不同标题/输出尺寸，日志各自独立；重复构建仍不修改输入 config（现有 LK 测试已覆盖后者）。

## 结构债与改进边界

### AD-D01 基类模板和子类实现并存，共享逻辑没有形成单一执行入口

`cartridge-adapter.ts:370`/`:472` 提供 readROM/getCartInfo 模板；GBA `gba-adapter.ts:712`/`:1530`、MBC `mbc5-adapter.ts:981`/`:1739` 全部覆盖。PlatformOps 多个方法只为基类模板存在，子类实际绕过模板直接调用协议；基类与子类均维护同类重试、进度、地址计算。这是可维护性债，不是因为继承本身就有缺陷。

先提取经过测试的 chunk planner、重试状态恢复、progress/reporting 组合件；硬件策略继续显式提供 bank、字节地址/word 地址转换、电压和时序。逐个迁移 read/verify，保留外部 CartridgeAdapter API，再决定删除无调用模板或收敛到模板。禁止一次合并 GBA/MBC 的 erase/write/RAM 全部流程。

### AD-D02 底层把可判别错误转为翻译字符串后，领域层无法恢复原因

例如 `gba-adapter.ts` read catch 返回通用 readFailed；`features/burner/adapters/cartridge-protocol-port.ts:61` 再 `new Error(result.message)`。protocol 已提供 PACKET_TIMEOUT/LENGTH_MISMATCH/TRANSPORT_FAILURE，但这些原因可能在 service 边界丢失，影响上层重连或恢复判断。

先为 CommandResult 加可选结构化错误/cause（兼容已有 message），沿调用链保留 code、operation、address、cleanupError；UI 层做翻译。不要立即迁移所有返回类型。

### AD-D03 LK 的输入配置和编译中间态使用同一可变 GameConfig

`services/lk/types.ts:26` 到 `:46` 把 enabled/file/title 与 size/sector_offset/block_count/missing 混合。`romBuilder.ts:20` 已复制用户字段，修复过连续构建污染，值得保留；但各导出阶段仍靠可选字段和默认 0 来掩盖是否完成前一步。

拆分 InputGame、PreparedGame、AllocatedGame，局部 BuildContext 持有布局与日志，二进制 item encoder 只接收 AllocatedGame。初期保持输出字节一致（时间戳固定后对比），同时维护当前失败语义；容量布局校验应在写 compilation 前完成。

## 待验证 / 观测缺口

1. CFI 已有 magic 和最短 0x79 字节校验，但 `utils/parsers/cfi-parser.ts:409` 到 `:435` 没限制指数、零 sectorSize、region 总量与 deviceSize 一致性。暂列待验证：确认异常设备响应是否能流入烧录，以及是否存在必须兼容的非标准 CFI。不要未经芯片 fixture 验证就加强为一刀切拒绝。
2. LK `romBuilder.ts:227` 只用 slice.every 检查空闲，没有证明 slice 长度等于所需 sector_count；虽 `:234` 对实际 ROM 字节越界会抛错，但填充后的逻辑 ROM size 可大于原文件。另 item list `:388` 仅预留一个 sector，而 `:413` 按全部 item bytes 写入。需构造容量尾部和大列表案例确定现有菜单接受范围，再决定错误还是显式限制；不把理论超大列表报告成日常必现损坏。

## 保持功能的分批方案

| 批次 | 内容 | 变更边界 | 验收 |
| --- | --- | --- | --- |
| A | AD-01、AD-02 | 新增纯地址/长度规划；服务接口不变；模拟协议约束补齐 | 非对齐窗口、跨 bank、128 KiB RAM、请求/响应长度边界；现有 adapter/simulated 测试全部通过 |
| B | AD-03、AD-04、AD-05 | RTC 状态保护、输入校验、实际写后比对；不合并不同 RTC 硬件协议 | 每步失败注入、cleanup 二次失败、正常秒进位；GBA/MBC3 实卡验证 |
| C | AD-06、AD-D03 | LK 局部 context 与阶段类型，固定时间戳的 fixture golden bytes | 顺序/并发输入独立、现有菜单 ROM+save 能启动和访问；容量不足显式失败 |
| D | AD-D01、AD-D02 | 每次只迁移一种 read/verify/retry 边界，再移除未使用模板 | 字节命令 transcript、progress 事件、error code、取消与失败恢复一致；不改变 bank/电压/时序 |

本 phase 未新增或修改测试，也未执行真实硬件验证。审查时 `web-client/node_modules/.bin/vitest.cmd` 不存在；完整测试和编译结果由 baseline/测试 phase 统一记录。现有模拟 adapter end-to-end 只使用 GBA 512 字节、MBC 384 字节（`tests/platform/serial/simulated-burner-runtime.test.ts:62`、`:94`），不足以证明窗口和最大包长正确。RTC 路径未找到专门测试文件。
