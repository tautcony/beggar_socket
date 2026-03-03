# 模块：Protocol（beggar_socket）

## 目录
- `src/protocol/beggar_socket/protocol.ts`
- `src/protocol/beggar_socket/protocol-adapter.ts`
- `src/protocol/beggar_socket/payload-builder.ts`
- `src/protocol/beggar_socket/protocol-utils.ts`
- `src/protocol/beggar_socket/command.ts`
- `README.md`（协议说明）
- `mcu/chis_flash_burner/Core/Src/uart.c`（固件命令解析）
- `mcu/chis_flash_burner/USB_DEVICE/App/usbd_cdc_if.c`（CDC 控制线与收包入口）

## 模块设计
- `protocol.ts`: 命令函数（`rom_read/rom_program/gbc_*`）
- `payload-builder.ts`: 命令 payload 构建与 CRC
- `protocol-adapter.ts`: 基于 `Transport` 的发送/接收封装
- `protocol-utils.ts`: endian、flash 映射、统一收发入口
- `command.ts`: 协议命令枚举

## 职责
- 定义命令语义与封包格式。
- 基于 `Transport` 执行收发与 ACK 校验。
- 聚焦协议语义与包格式；不直接依赖 UI。

## 边界
- 不直接依赖 UI。
- 不直接依赖 `services/serial-service`。

## 线级协议（与 MCU 实现对齐）

### 传输与基础约定
- 物理链路为 USB CDC 虚拟串口（README 标注 `VID=0x0483`, `PID=0x0721`）。
- 全部字段使用小端序（little-endian）。
- host 侧通过 DTR/RTS 控制线初始化设备；MCU 在 DTR/RTS 上升沿清空命令缓冲并退出 busy。
- CRC 字段在当前固件中未参与校验（发送端可填 0）。

### 请求包格式
- 统一格式：`[cmdSize:2][cmdCode:1][payload:N][crc16:2]`
- `cmdSize` 含整包长度（2+1+payload+2）。
- 固件缓冲区大小：`cmdBuf[5500]`，超出将被丢弃。
- USB 分包接收时，固件会累计到 `cmdBuf`；仅在 `cmdBuf_p >= cmdSize` 后开始执行。

### 响应包格式
- ACK 类命令：单字节 `0xAA`（失败时可能不是 `0xAA`）。
- 读类命令：`[crc16:2][payload:N]`，当前 crc 字段不参与验证。
- 固件发送会按 `512B` 分批推送，host 需按目标长度持续读取。

### 命令执行行为
- `uart_cmdHandler()` 以 `cmdCode` `switch` 分发。
- 未知命令会清空缓冲并返回空响应（不返回 ACK）。
- 擦写轮询超时为 `10s`（`OPERATION_TIMEOUT=10000`）。

## 命令矩阵（当前固件）

### GBA
- `0xF0` `READ_ID`：返回 `2B crc + 8B id`
- `0xF1` `ERASE_CHIP`：返回 `ACK`
- `0xF2` `BLOCK_ERASE`：返回 `ACK`（当前固件占位）
- `0xF3` `SECTOR_ERASE`：请求含 `address(4B)`，返回 `ACK`
- `0xF4` `PROGRAM`：请求含 `address(4B)+bufferSize(2B)+data`，返回 `ACK`
- `0xF5` `DIRECT_WRITE`：请求含 `address(4B)+data`，返回 `ACK`
- `0xF6` `READ`：请求含 `address(4B)+size(2B)`，返回 `2B crc + data`
- `0xF7` `RAM_WRITE`：请求含 `address(4B)+data`，返回 `ACK`
- `0xF8` `RAM_READ`：请求含 `address(4B)+size(2B)`，返回 `2B crc + data`
- `0xF9` `RAM_WRITE_TO_FLASH`：请求含 `address(4B)+data`，返回 `ACK`
- `0xE7` `FRAM_WRITE`：请求含 `address(4B)+latency(1B)+data`，返回 `ACK`
- `0xE8` `FRAM_READ`：请求含 `address(4B)+size(2B)+latency(1B)`，返回 `2B crc + data`

### GBC
- `0xFA` `DIRECT_WRITE`：请求含 `address(4B)+data`，返回 `ACK`
- `0xFB` `READ`：请求含 `address(4B)+size(2B)`，返回 `2B crc + data`
- `0xFC` `ROM_PROGRAM`：请求含 `address(4B)+bufferSize(2B)+data`，返回 `ACK`
- `0xEA` `FRAM_WRITE`：请求含 `address(4B)+latency(1B)+data`，返回 `ACK`
- `0xEB` `FRAM_READ`：请求含 `address(4B)+size(2B)+latency(1B)`，返回 `2B crc + data`

## 与 web-client 代码的对齐点
- `PayloadBuilder.build(false)` 默认不计算 CRC，与固件“CRC 忽略”一致。
- `ProtocolAdapter.getResult()` 以单字节 `0xAA` 作为成功条件。
- `rom_read/ram_read/gbc_read` 等读取 `2 + size` 字节并丢弃前 2 字节 CRC。
- `DeviceGateway.init()` 先拉低后拉高 DTR/RTS，触发固件缓冲重置。

## 已知兼容性注意项
- `command.ts` 中定义了 `GBCCommand.CART_POWER(0xA0)` 与 `CART_PHI_DIV(0xA1)`；
  当前 `uart_cmdHandler()` 未处理这两个命令，发送后会走 unknown 分支。
- 分包读取存在粘包/拆包场景，调用方必须按协议期望长度读取完整响应。
