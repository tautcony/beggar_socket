# 模块：关键数据流

## 1. 应用启动与初始化

```mermaid
sequenceDiagram
  participant Main as src/main.ts
  participant Settings as AdvancedSettings
  participant Sentry as loadSentry
  participant App as Vue App
  participant Router as router
  participant I18N as i18n

  Main->>Settings: loadSettings()
  Main->>App: createApp(App.vue)
  Main->>Sentry: loadSentry(app, { enabled: PROD || SENTRY_ENABLED })
  Main->>App: app.use(pinia).use(i18n).use(router)
  Main->>App: mount('#app')
  App->>Router: route resolve -> HomeView
```

## 2. 设备连接流（Web/Electron 统一入口）

```mermaid
sequenceDiagram
  participant UI as DeviceConnect.vue
  participant Mgr as DeviceConnectionManager
  participant Gateway as DeviceGateway
  participant Transport as Transport

  UI->>Mgr: requestDevice(filter)
  Mgr->>Gateway: select()/list()
  Gateway->>Gateway: connect(selection)
  Gateway-->>Mgr: DeviceHandle
  Mgr->>Gateway: init(handle) (DTR/RTS)
  Mgr-->>UI: DeviceInfo(legacy + transport)
  UI-->>HomeView: emit device-ready

  Note over Gateway: Web: navigator.serial\nElectron: electronAPI.serial IPC
```

## 3. 烧录操作主链路（以写 ROM 为例）

```mermaid
sequenceDiagram
  participant View as CartBurner.vue
  participant Flow as runBurnerFlow
  participant Facade as BurnerFacade/BurnerUseCase
  participant Adapter as GBAAdapter/MBC5Adapter
  participant Proto as protocol.ts
  participant PA as ProtocolAdapter
  participant T as Transport
  participant Device as Hardware

  View->>Flow: executeOperation(cancellable)
  Flow->>Facade: writeRom(...)
  Facade->>Adapter: writeROM(data, options, signal)
  Adapter->>Proto: rom_program/gbc_rom_program...
  Proto->>PA: sendPackage/getPackage/getResult
  PA->>T: send/read/setSignals
  T->>Device: serial bytes
  Device-->>T: response bytes
  T-->>PA: data/ack
  PA-->>Proto: result
  Proto-->>Adapter: success/error
  Adapter-->>Flow: CommandResult + progress callback
  Flow-->>View: syncSessionState()
```

## 4. 进度与日志回传流

```mermaid
flowchart LR
  Adapter[Adapter operation loop] --> Reporter[ProgressReporter]
  Reporter --> CB[progress callback]
  CB --> Session[BurnerSession.updateProgress]
  Session --> View[CartBurner syncSessionState]
  View --> Modal[ProgressDisplayModal]

  Adapter --> LogFn[log callback]
  LogFn --> Session
  Session --> LogViewer
```

## 5. ROM 组装结果回流主页面

```mermaid
sequenceDiagram
  participant Assembly as RomAssemblyView
  participant Store as rom-assembly-store
  participant Home as HomeView/CartBurner

  Assembly->>Store: setResult(assembledRom, romType)
  Assembly->>Home: router.back()
  Home->>Store: consumeResult()
  Store-->>Home: rom + type (then clear)
  Home->>CartBurner: 注入待烧录数据/模式
```

## 6. 控制线初始化与命令缓冲复位

```mermaid
sequenceDiagram
  participant UI as DeviceConnect/HomeView
  participant Mgr as DeviceConnectionManager
  participant Gateway as DeviceGateway.init
  participant T as Transport.setSignals
  participant USB as USB CDC Control
  participant MCU as uart_setControlLine

  UI->>Mgr: initializeDevice(device)
  Mgr->>Gateway: init(handle)
  Gateway->>T: setSignals(DTR=false, RTS=false)
  Gateway->>T: setSignals(DTR=true, RTS=true)
  T->>USB: CDC_SET_CONTROL_LINE_STATE
  USB->>MCU: uart_setControlLine(rts,dtr)
  MCU->>MCU: cmdBuf_p=0, busy=0, 清空 cmd/respon buffer
```

## 7. 协议请求执行（以 ROM_READ 0xF6 为例）

```mermaid
sequenceDiagram
  participant WC as web-client protocol.ts
  participant PA as ProtocolAdapter
  participant TR as Transport
  participant CDC as USB CDC receive callback
  participant UART as uart_cmdRecv/uart_cmdHandler
  participant CART as cart_romRead
  participant TX as CDC_Transmit_FS

  WC->>PA: sendPackage([size|cmd|payload|crc])
  PA->>TR: send(bytes)
  TR->>CDC: 分批到达 USB OUT
  CDC->>UART: uart_cmdRecv(buf,len) 累积到 cmdBuf
  UART->>UART: cmdBuf_p >= cmdSize 时解析 cmdCode
  UART->>CART: romRead(baseAddress>>1, wordCount)
  CART-->>UART: data
  UART->>TX: uart_responData(2B crc + payload)
  TX-->>TR: USB IN 分批返回
  TR-->>PA: read(2 + size)
  PA-->>WC: payload(去掉前2B crc)
```

## 8. 横切能力说明

| 能力 | 位置 | 说明 |
|------|------|------|
| 错误监控 | `src/utils/monitoring/sentry-loader.ts` | 生产环境或 `VITE_SENTRY_ENABLED=true` 时启用，捕获未处理异常，通过 `@sentry/vue` 上报 |
| 错误追踪 | `src/utils/monitoring/sentry-tracker.ts` | 手动上报接口，适配器/用例层可调用 |
| 进度计算 | `src/utils/progress/` | `ProgressReporter`、`ProgressBuilder`、`SpeedCalculator` 计算烧录速度与进度百分比 |
| 日志查看 | `src/utils/log-viewer.ts` | 统一日志格式化，`LogViewer.vue` 消费 |
| ROM 解析 | `src/utils/parsers/rom-parser.ts` | 解析 GBA/GBC ROM 头信息 |
| Flash 解析 | `src/utils/parsers/cfi-parser.ts` | 解析 CFI 查询结果，获取 Sector 分布 |
| 地址工具 | `src/utils/address-utils.ts` | 地址偏移计算 |
| CRC 工具 | `src/utils/crc-utils.ts` | CRC16 计算 |
| 压缩工具 | `src/utils/compression-utils.ts` | ROM 数据压缩/解压 |
| 端口过滤 | `src/utils/port-filter.ts` | `PortFilters.device(0x0483, 0x0721)` 过滤 STM32 设备 |
| 格式化 | `src/utils/formatter-utils.ts` | `formatHex()` 等十六进制格式化 |
| ROM 编辑 | `src/utils/rom/rom-editor.ts` | ROM 内容修改、补丁写入 |
| ROM 组装 | `src/utils/rom/rom-assembly-utils.ts` | 多 ROM 合并组装 |
| 错误类型 | `src/utils/errors/` | `NotImplementedError`、`PortSelectionRequiredError` |
