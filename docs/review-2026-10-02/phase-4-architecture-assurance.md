# Phase 4：架构、配置与保障体系

## AR-01 [P1 / 保障缺口] CI 打包不执行测试与 lint

- 位置：`.github/workflows/build-webclient.yml`、`build-tauri.yml`。
- Web 流水线仅 main push，执行 check:deps/build；Tauri 有 PR 构建但没有 lint/test/native 单测。现有回归测试不能自动阻止行为回归进入 main。
- 改善：独立 PR quality job 运行 clean install、lint、type-check、check:deps、test:run；native check/test 分离于打包；质量通过后才打包/发布。固定 Node/npm 基线，不使用 npm@latest。
- 验收：故意制造 failing fixture 的 PR 必须失败；分支保护要求该 job，后者属于仓库管理设置，实施时另行确认管理权限。

## AR-02 [P2 / 结构债] 操作所有权分散于 UI、session 与工具窗口

- 位置：`components/CartBurner.vue:392` 起各 ROM/RAM handler；`components/modal/CartridgeToolsModal.vue:193`；`components/common/AppMenu.vue:157`。
- CartBurner 负责数据填充、地址解析、上下文快照、reset、用例调用、结果展示、导出；RTC/PPB 工具窗口使用独立 busy，直接调用 services。
- 后果：每个入口自行确保“同一设备只有一个完整操作”，规则难以验证，LC-01 只是其中一种表现。单包互斥不能保护跨包 bank/flash 指令序列。
- 改善：已有 use case 扩展为统一操作入口与独占 owner；UI 保留交互和展示；工具操作适配进入同一生命周期。不要新增一套平行 facade。
- 验收：页面与工具入口共享 operation token；编排单测无 Vue 依赖；UI 测试只验证参数快照、按钮、展示与导出。

## AR-03 [P2 / 结构债] 多层转发和结果包装丢失领域信息

- 位置：`features/burner/application/burner-use-case.ts`；`features/burner/adapters/cartridge-protocol-port.ts:78`；`application/domain/result.ts`。
- 调用经过 facade → use case → port adapter → session adapter → cartridge adapter；错误经 CommandResult → Error(message) → DomainResult → CommandResult 重复映射，调用端主要只得到 success/message。
- 改善：保留隔离硬件的 port 边界，但明确每层责任；逐步收敛纯转发 facade，错误采用稳定 code/stage/cause/retryability，UI 最后翻译。保留旧签名适配入口直到全部调用者迁移。
- 验收：timeout/cancel/validation/device disconnect 与 flash failure 类型稳定，无字符串 includes 作为核心分类依据；所有旧 UI message 与结果形状兼容。

## AR-04 [P2 / 确认] 设置校验未检查有限数与输入 schema

- 位置：`settings/advanced-settings.ts:91`、`:189`、`:218`、`:257`。
- validateValue 的 min/max 比较无法拦截 NaN；JSON.parse 仅作类型断言，setSettings 在进入校验前没有确认值为 number；字符串等值会产生隐式转换。
- 影响：NaN/page size/timeout 可进入全局配置，使分块或计时失去预期语义；各 UI 的独立校验不能保护持久化和程序调用入口。
- 改善：保留 descriptor，引入类型化 key 和单一 runtime schema（有限数、整数、枚举、范围）；按版本迁移旧设置，保持存储 key 和兼容默认值。只共享存取/迁移，不把所有 store 合并。
- 验收：损坏 JSON、null、字符串、NaN/Infinity、fractional sizes、旧默认版本、存储失败；合法现有配置 round-trip 不变。

## AR-05 [P2 / 确认] 文档、门禁与实现存在漂移

- 位置：`web-client/docs/modules/00-overview.md`、`07-electron-runtime.md`；`web-client/docs/review-2026-07-31/fix-checklist.md`；`scripts/check-architecture-deps.cjs:32`；`eslint.config.js`。
- 当前仍说明 Electron/serial-service；清单未更新已修复项。依赖脚本只读取 `from '@/...'`，忽略 relative import、动态 import、side-effect import；ESLint 仍有 electron 限制，脚本已经是 tauri。
- 改善：按当前 Web/Tauri/模拟运行时更新文档与历史状态；依赖分析用 TS AST/module resolution，集中定义约束，检测相对路径和循环；composition root 可以依赖实现，避免不必要禁令。
- 验收：同一违规分别通过 alias/relative/dynamic import 均被发现；合法 factory 不误报；不要用当前脚本绿灯替代行为验收。

## AR-06 [INFO / 性能验证缺口] 大包与模拟器警告需要有功能证据的优化

- production build 的 Ionic chunk ~1.26 MB、Jimp ~718 KB；gbats 引入 fs externalization，Jimp eval 警告。
- 建议先量化首屏下载/交互、图像处理耗时与峰值内存；再评估按功能延迟加载、Web Worker 和二进制 IPC，保持字节输出一致。
- 不仅凭 chunk 大小换库或拆模块；没有模拟器真机浏览器 smoke，不能因 build 成功声称音频/控制/ROM 启动正常。

## AR-07 [P2 / 本机复现，平台范围待验证] MCU PowerShell 构建参数传递失败

- 执行现有 `mcu/cmake-build.ps1 build Debug`，CMake configure 成功，但 Ninja 拒绝包含 `$BuildType` 的 rule 名。
- `mcu/chis_flash_burner/build/Debug/CMakeCache.txt` 实际记录 `CMAKE_BUILD_TYPE:STRING=$BuildType`；脚本 `mcu/cmake-build.ps1:108` 将变量放入未整体引用的 native 参数。
- 改善：在实施阶段修复并验证参数实际值，使用正确引用的参数数组；同样检查 Debug/Release 路径与工具链传递。当前证据不能据此宣称 Linux CI 或固件源码编译失败。
- 验收：Windows PowerShell/pwsh 与现有 Linux 工作流构建 Debug/Release，cache 值、产物及优化选项正确。本轮不改脚本或绕过失败作“通过”记录。

## AR-08 [P2 / 保障缺口] LK 回归测试在最新环境稳定超时

- `tests/lk-rom-builder.test.ts:38` 的重复构建测试显式 15 秒限制，包含两个 8 MiB 输出及大型 TypedArray 深比较。
- 全量与单独重跑均超时（单独测试 23.77 秒）。尚未证实耗时集中于构建还是深比较，不将超时报为 ROM 输出不一致。
- 改善：分段记录 build/compare 耗时，字节一致性使用线性字节比较，保留首次差异定位；拆分输入不变性与输出 determinism 验证，保持覆盖能力。必要时按测量结果调整该慢测试预算，不全局放宽所有测试超时。
- 验收：在 CI 基线 Node 版本重复运行该测试稳定通过；人为修改输出一个字节仍能使测试失败。

## 已有保护及保留方向

- 文件读取 helper、latest-wins token、默认资源 abort/disposed、多菜单组件拆分已有实现。
- PlatformOps/FlashCommandSet 和端口边界值得保留。GBA 地址单位、MBC bank、MBC3 RTC、FRAM 时序属于真实差异，不应仅为减少行数合并。
- 不优先处理目录拼写、统一 getter 样式等低收益事项；后续随相关模块修改处理。

## 验证限制

此 phase 静态覆盖视图/配置/CI/模块文档与主要入口；不包含完整浏览器 E2E、所有样式/本地化逐键审计、模拟器运行验收与图像算法全样本比较。
