# Web Client 代码审查汇总报告

> 审查完成时间：2026-03-16  
> 覆盖 Phase：0–9（共 10 个）  
> 最后更新：2026-03-16（本轮修复后）

## 统计（修复后）

| 严重度 | 原始 | 已修复 | 剩余 |
|--------|------|--------|------|
| 🔴 P0  | 5    | 2      | **3**（含 1 项已知延期）|
| 🟡 P1  | 22   | 5      | **17** |
| 🟢 P2  | 35   | 1      | **34** |
| ℹ️ INFO | 21   | —      | 21   |

---

## 本轮已修复

| Commit | 问题 | 文件 |
|--------|------|------|
| `0b314cd` | P0: CSP 未配置；P0: macOS 重开窗口后 stale mainWindow<br>P1: serial-write 错误吞没；P1: IPC 输入无验证<br>P1: 生产环境 DevTools 可见；P2: menu template[4] 越界 | `electron/main.js` `electron/ipc-handlers.js` |
| `d34821e` | P0: `addRomData` buffer 溢出；cartridge_type 越界 | `src/services/lk/romBuilder.ts` |
| `d81bfca` | P1: `rom_get_id` / `gbc_rom_get_id` 读取失败时 Flash 未 reset | `src/protocol/beggar_socket/protocol.ts` |
| `959761f` | P1: 并发连接无保护（`ConnectionOrchestrationUseCase` + `DeviceConnectionManager`） | `src/features/burner/application/connection-use-case.ts` `src/services/device-connection-manager.ts` |

---

## 高优先级问题（P0）

| 状态 | 问题 | 报告 |
|------|------|------|
| ✅ 已修复 | `electron/main.js` — 未配置 Content-Security-Policy | [Phase 8](./phase-8-electron.md) |
| ✅ 已修复 | `electron/main.js` + `electron/ipc-handlers.js` — stale mainWindow | [Phase 8](./phase-8-electron.md) |
| ✅ 已修复 | `services/lk/romBuilder.ts` — addRomData buffer 溢出 | [Phase 4](./phase-4-services.md) |
| 🔵 已知延期 | `protocol/beggar_socket/payload-builder.ts` — CRC 占位字节（固件当前未启用 CRC 校验） | [Phase 2](./phase-2-protocol.md) |
| ✅ 已修复 | `settings/debug-settings.ts` — `createMockSerialPort` setInterval 永不清除；`DebugSettings.init()` 移至 `main.ts` | [Phase 6](./phase-6-stores-settings-composables.md) |

---

## 各 Phase 汇总

| Phase | 模块 | P0 | P1 | P2 | INFO | 报告链接 |
|-------|------|----|----|----|----|----------|
| 0 | 基线准备 | - | - | - | - | [phase-0](./phase-0-baseline.md) |
| 1 | platform/serial | 0 | 3 | 5 | 2 | [phase-1](./phase-1-platform-serial.md) |
| 2 | protocol | 1 | 2 | 3 | 2 | [phase-2](./phase-2-protocol.md) |
| 3 | features/burner | 0 | 2 | 3 | 1 | [phase-3](./phase-3-features-burner.md) |
| 4 | services | 1 | 3 | 5 | 2 | [phase-4](./phase-4-services.md) |
| 5 | utils | 0 | 3 | 4 | 3 | [phase-5](./phase-5-utils.md) |
| 6 | stores/settings/composables | 1 | 5 | 7 | 5 | [phase-6](./phase-6-stores-settings-composables.md) |
| 7 | views/components | 0 | 2 | 10 | 5 | [phase-7](./phase-7-views-components.md) |
| 8 | electron | 2 | 4 | 4 | 4 | [phase-8](./phase-8-electron.md) |
| 9 | cross-cutting | 0 | 3 | 2 | 2 | [phase-9](./phase-9-crosscutting.md) |

---

## 待修复清单（按优先级分组）

> 同一组内的问题应在同一次 commit 中修复。

---

### ✅ Group A — debug-settings：setInterval 泄漏及相关问题（已修复）
**优先级**：P0 + P2 × 2  
**文件**：`src/settings/debug-settings.ts`

| 优先级 | 问题 |
|--------|------|
| P0 | `createMockSerialPort()` 中 `setInterval` 永不清除——每次调用泄漏一个定时器 |
| P2 | `createMockSerialPort()` 使用 `as SerialPort` 类型断言，mock 缺少接口属性时编译不报错 |
| P2 | `DebugSettings.init()` 在模块顶层执行副作用，阻碍 tree-shaking 且在测试环境访问 localStorage |

---

### ✅ Group B — protocol：GBC 擦除无超时/无完成检测（已修复）
**优先级**：P1 + P2 × 2  
**文件**：`src/protocol/beggar_socket/protocol.ts`

| 优先级 | 问题 |
|--------|------|
| P1 | `rom_erase_sector()` 对 `sectorAddress` 先 `& ~1` 对齐再右移，与固件掩码逻辑一致 |
| P2 | `gbc_rom_erase_sector()` 添加 15s 超时，超时后抛出错误 |
| P2 | `gbc_rom_erase_chip()` 添加完成轮询（120s 超时），确保擦除结束后才返回 |

---

### ✅ Group C — transport 层：超时残留与 pump 恢复（已修复）
**优先级**：P1 × 2 + P2 × 3  
**文件**：`src/platform/serial/transports.ts`、`src/platform/serial/electron/device-gateway.ts`

| 优先级 | 问题 |
|--------|------|
| P1 | `WebSerialTransport.send()` 超时时通过 `onTimeout` 调用 `writer.abort()` 取消幽灵写入 |
| P1 | `ensurePumpStarted()` 在 pump 因错误退出后检查 `streamError`，直接抛出而不是尝试在已损坏的流上重启 |
| P2 | `ConnectionTransport.read()` 新增 `overflow` 缓冲区，多余字节保留给下次读取而不丢弃 |
| P2 | `ElectronDeviceGateway.removeDataListener` 等验证 callback 参数匹配后才删除 |
| P2 | `WebSerialTransport.close()` lock 顺序问题——当前实现已通过 try-catch 处理，不再单独修复 |

---

### ✅ Group D — device-gateway：init() 信号序列（已修复）
**优先级**：P1  
**文件**：`src/platform/serial/web/device-gateway.ts`、`src/platform/serial/electron/device-gateway.ts`

| 优先级 | 问题 |
|--------|------|
| P1 | `init()` 序列改为先 false → 再 true，最终电平为活跃状态，与文档一致 |

---

### 🟡 Group E — parser 输入校验
**优先级**：P1 × 2  
**文件**：`src/utils/parsers/cfi-parser.ts`、`src/utils/parsers/rom-parser.ts`

| 优先级 | 问题 |
|--------|------|
| P1 | `cfi-parser.ts` — `priAddress`（由设备数据计算）越界后访问 `workBuffer[priAddress + ...]` 返回 `undefined`，导致 NaN 传播到扇区擦除地址 |
| P1 | `rom-parser.ts` — 缺少最小长度前置检查（GBA < 0xC0 / GB < 0x150），小文件返回含乱码的 `RomInfo` 且 `isValid` 为 true |

---

### 🟡 Group F — AdvancedSettings：初始值与批量保存
**优先级**：P1 × 2  
**文件**：`src/settings/advanced-settings.ts`

| 优先级 | 问题 |
|--------|------|
| P1 | `_operationTimeout` 字段初始值 `100000`，但 `resetToDefaults()` 重置为 `30000`——初次加载与重置后行为不一致 |
| P1 | `setSettings()` 设置 12 个属性时每个 setter 各触发一次 `localStorage.setItem`，应批量保存 |

---

### 🟡 Group G — composable / store 生命周期清理
**优先级**：P1 × 2 + P2 × 3  
**文件**：`src/composables/cartburner/useCartBurnerSessionState.ts`、`src/stores/rom-assembly-store.ts`、`src/components/CartBurner.vue`、`src/views/GBAMultiMenuView.vue`、`src/components/common/AppMenu.vue`

| 优先级 | 问题 |
|--------|------|
| P1 | `useCartBurnerSessionState` — `BurnerSession` 无 `onScopeDispose` cleanup，操作中导航离开时 `AbortController` 不触发 |
| P1 | `romAssemblyResult` store — 最大 32 MiB `Uint8Array` 无自动释放，路由跳转未消费时永久占用内存 |
| P2 | `CartBurner.vue` — 无 `onUnmounted` 钩子，适配器引用未在卸载时置空 |
| P2 | `GBAMultiMenuView.vue` — 3 个 fire-and-forget 异步调用无取消机制，导航离开后仍修改响应式状态 |
| P2 | `AppMenu.vue` — `clickTimer` setTimeout 未在 unmount 时 clearTimeout |


---

### 🟡 Group I — services 层：进度报告与外部内容安全
**优先级**：P1 × 2 + P2 × 3  
**文件**：`src/services/gba-adapter.ts`、`src/services/mbc5-adapter.ts`、`src/services/system-notice-service.ts`、`src/services/flash-chip.ts`、`src/services/lk/romBuilder.ts`

| 优先级 | 问题 |
|--------|------|
| P1 | `eraseSectors()` 失败时 `currentSectorProgress[]` 不重置，下次操作前 UI 扇区可视化状态残留 |
| P1 | `fetchSystemNoticeMarkdown()` 直接返回原始外部 Markdown，服务层未 sanitize，依赖消费方保证安全 |
| P2 | `flash-chip.ts` — `shouldUseLargeRomPage()` 仅识别 `S29GL256N`，其余支持芯片未覆盖 |
| P2 | `romBuilder.ts` — 存档模糊匹配使用 `includes()`，可能错误关联同名前缀的存档文件 |
| P2 | `romBuilder.ts` — 大量魔法数字未命名为常量（`0x40000`、`0x1000`、`0x400000` 等） |

---

### 🟡 Group J — useEnvironment 重构
**优先级**：P1 + P2  
**文件**：`src/composables/useEnvironment.ts`

| 优先级 | 问题 |
|--------|------|
| P1 | `process.env.NODE_ENV` 非 Vite 标准写法，应改为 `import.meta.env.DEV` / `import.meta.env.PROD` |
| P2 | 静态类命名为 `useEnvironment`（暗示 composable）但无响应式，位于 `composables/` 目录不当；代码库中无消费者，可能为死代码 |

---

### 🟡 Group K — 死代码与未使用引用清理
**优先级**：P1 × 2 + P2 × 2  
**文件**：`src/views/SerialTestView.vue`、`src/views/HomeView.vue`、`src/components/MorseBorder.vue`、`src/components/common/FloatingLink.vue`

| 优先级 | 问题 |
|--------|------|
| P1 | `SerialTestView.vue` — 导入不存在的组件 `SerialTest.vue`，未注册路由，5 个符号全未使用（死代码） |
| P1 | `HomeView.vue` — `useRomAssemblyResultStore()` 实例化后零使用；`showSettings` ref 模板未引用 |
| P2 | `MorseBorder.vue` — 未使用的 `ref` 导入 |
| P2 | `FloatingLink.vue` — 导入 `useAttrs()` 但模板直接使用 `$attrs`，返回值未使用 |

---

### 🟢 Group L — UI 组件细节
**优先级**：P2 × 5  
**文件**：`src/components/DeviceConnect.vue`、`src/components/common/GlobalToast.vue`、`src/components/emulator/GBEmulator.vue`、`src/components/modal/FileNameSelectorModal.vue`、`src/composables/cartburner/useCartBurnerFileState.ts`

| 优先级 | 问题 |
|--------|------|
| P2 | `DeviceConnect.vue` — `deviceInfo` 声明为普通 `let` 而非 `ref()`，模板未直接展示时暂无问题，但不符合响应式惯例 |
| P2 | `GlobalToast.vue` — `onMounted` 设置 `window.showToast` 但 `onUnmounted` 未清除，卸载后外部调用引用失效闭包 |
| P2 | `GBEmulator.vue` — `cleanup()` 仅置 null 引用，无法释放底层 `AudioContext`，反复打开模拟器可触发浏览器 AudioContext 数量限制 |
| P2 | `FileNameSelectorModal.vue` — `DateTime.now()` 在 setup 固定，组件通过 `v-model` 复用时时间戳可能过期 |
| P2 | `saveAsFile()` — 创建的 `<a>` 元素未附加到 DOM，Safari/WebKit 可能无法触发下载 |

---

### 🟢 Group M — 其余 P2 杂项
**优先级**：P2  
**文件**：`src/stores/recent-file-names-store.ts`、`src/composables/useToast.ts`、`src/composables/cartburner/useCartBurnerFileState.ts`、`src/utils/markdown.ts`、`src/utils/progress/speed-calculator.ts`

| 优先级 | 问题 |
|--------|------|
| P2 | `recentFileNamesStore` — 无持久化，刷新后最近文件名列表丢失 |
| P2 | `useToast` — 通过无类型 `CustomEvent` 分发，listener 卸载不清理会导致重复回调 |
| P2 | `useCartBurnerFileState` — `parseInt(hexSize, 16)` 无 NaN 检查，非法输入产生乱码日志 |
| P2 | `markdown.ts` — `enhanceLinks` 在 `DOMPurify` 之后执行的安全依赖未在代码中注释说明 |
| P2 | `speed-calculator.ts` — 首次实例化与 `reset()` 后的 `startTime` 初始化行为不一致 |

---

## 跨模块系统性问题（状态更新）

### 1. Electron 与 WebSerial 错误传播不对等
- `serial-write` flush 后 resolve → ✅ **已修复**（Commit `0b314cd`）
- `serial-close` 回调忽略 error → 🔴 **待修复**（属 Phase 8 P2）
- `withTimeout` 超时后 writer 幽灵操作 → 🔴 **待修复**（Group C）

### 2. 设备连接生命周期缺乏统一状态机
- `DeviceConnectionManager` + `ConnectionOrchestrationUseCase` 无并发保护 → ✅ **已修复**（Commit `959761f`）
- `useCartBurnerSessionState` 无 cleanup → 🔴 **待修复**（Group G）
- `CartBurner.vue` 无 onUnmounted → 🔴 **待修复**（Group G）

### 3. 主链路原子性（擦除→编程→校验）
- Electron 写入错误吞没 → ✅ **已修复**（Commit `0b314cd`）
- Flash 模式未在 ID 读取失败后重置 → ✅ **已修复**（Commit `d81bfca`）
- GBC 擦除无超时/无完成检测 → 🔴 **待修复**（Group B）

### 4. 外部输入信任边界
- Electron IPC 参数未验证 → ✅ **已修复**（Commit `0b314cd`）
- ROM parser 缺乏最小长度检查 → 🔴 **待修复**（Group E）
- CFI parser 无边界检查 → 🔴 **待修复**（Group E）
- 设备返回 CRC 未校验 → 🔵 **已知延期**（PayloadBuilder CRC）

