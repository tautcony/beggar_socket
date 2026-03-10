## Why

当前参数控制平面虽然已经能修改 `pending_config`，但配置还不能正式应用到 `current_config`，也没有真正驱动 `CURRENT.SAV` 的读取分支逻辑。这会让主机看到“配置已改”的表象，却得不到“配置已生效”和“不同 RAM 类型读取行为已受控”的结果。

## What Changes

- 新增显式配置应用能力，把已接受的 pending 配置推进到 current 配置。
- 让 ROM 导出窗口配置在应用后真正影响 `/ROM/CURRENT.GBA` 的读取行为。
- 让 RAM 类型选择在应用后真正影响 `/RAM/CURRENT.SAV` 的读取路径，而不是只停留在状态展示层。
- 为 `SRAM`、`FRAM`、`FLASH` 三类 RAM 类型建立分支化的读取服务边界。
- 在状态文件中明确反映“可应用 / 已应用 / 仍待应用”的状态变化。

## Capabilities

### New Capabilities
- `config-apply-lifecycle`: 定义如何把 `pending_config` 正式应用到 `current_config`，以及应用前后的状态可见性。
- `ram-type-aware-save-read`: 定义 `SRAM`、`FRAM`、`FLASH` 三类 RAM 类型在存档读取路径上的分支行为。

### Modified Capabilities
- `parameter-file-control-plane`: 现有参数文件不仅要支持修改 pending，还要支持与 apply 生命周期协同。
- `session-config-state-management`: 现有 session state 要补充 apply 后的 current/pending 收敛语义。
- `fat16-read-only-virtual-disk`: 现有虚拟 FAT16 文件视图要反映“配置已应用后影响实际导出/读取行为”。

## Impact

- `cart_service.c` 需要增加配置应用入口与 RAM 类型感知的读取分支。
- `virtual_disk.c` 需要把控制文件写入与实际应用动作连接起来。
- OpenSpec 主 specs 中与参数控制平面、session state、FAT16 文件视图相关的行为定义会继续扩展。
