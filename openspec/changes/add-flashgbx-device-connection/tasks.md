## 1. Types, settings & transport

- [x] 1.1 扩展 `FirmwareProfileId`/`ConfigurableFirmwareProfileId`/`FirmwareCapabilities`（`nativeFlashgbxProtocol`、`audioWePin`），新增 `FLASHGBX_FIRMWARE_PROFILE` 模板；保持 `0483:5740` 识别为 `stc`；更新 `tests/utils/firmware-profile.test.ts`。
- [x] 1.2 `platform-packet-policy.ts` 增加 `flashgbx`（保守默认 `0x100`）；`advanced-settings.ts` 增加 `profile='flashgbx'`、`profileSizes.flashgbx`、`flashgbxBaudRate`，改造二元 `otherProfile`，含旧设置迁移测试。
- [x] 1.3 `DeviceSelection.baudRate?`；`DeviceHandle.skipSignalInit`；web/tauri/simulated gateway 的 `connect()`/`init()`、`openNativeSerialPort`、Rust `native_open_serial_port(baud_rate: Option<u32>)`（取值校验）；测试覆盖默认、显式、非法、跳过脉冲、重置按钮路径；`cargo test`。
- [x] 1.4 `Transport` 新增 `readAvailable`、`flushOutput`（三端实现，Rust 增加输出清理）；同步更新 `tauri-serial-gateway`/`device-transport-gateway` 主 spec 的 delta；测试。
- [x] 1.5 `PortFilters.presets.flashgbx()` 与 `tests/utils/port-filter.test.ts`。

## 2. Handshake & connection

- [x] 2.1 核对握手相关固件版本门槛（`LK_Device.py`）并写入 design。
- [x] 2.2 `protocol/flashgbx/constants.ts`、`handshake.ts`（GBFlash CH340/CDC 流程、`FlashgbxHandshakeError{stage}`、`fw_ver == 0` `unsupported`）；字节级回放测试。
- [x] 2.3 `DeviceConnectionManager`：透传过滤器给 `select()`；Web 回滚/重试保留 `webPort`；选择波特率（`auto` 默认 2M）；握手；生成运行时 profile；失败清理；断开序列（恢复 3.3V / `CART_PWR_OFF`）；测试。

## 3. UI & guard

- [x] 3.1 `AdvancedSettingsModal.vue`、`DeviceConnect.vue`、5 语言 i18n：`flashgbx` 选项、波特率、封包页签；展示设备名/固件/电源能力；更新组件与 `i18n.test.ts`。
- [x] 3.2 `CartBurner.vue` 注入受护栏的 `BurnerProtocolSession` 桩；禁用 `tool-functions.ts` 与调试弹窗对 `flashgbx` 的入口；测试断言无 DTR/RTS、无 ChisFlash 字节，`stm`/`stc` 无回归。
- [ ] 3.3 真机验收（GBFlash CH340 与 CDC）并记录；`npm test`、`npm run build`、`cargo test`。
