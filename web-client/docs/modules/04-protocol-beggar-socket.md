# 模块：Protocol（beggar_socket）

`src/protocol/beggar_socket/protocol.ts` 定义 ROM/RAM/FRAM 等命令；`src/protocol/beggar_socket/command.ts` 定义命令号；`src/protocol/beggar_socket/payload-builder.ts` 构造帧；`src/protocol/beggar_socket/protocol-utils.ts` 对 Transport 执行收发。

请求帧为 `[totalSize:u16 little-endian][command:u8][payload][crc16:u16]`，totalSize 包含整包且不得超过 65535。CRC 禁用时 trailer 为零，启用时计算实际 CRC。命令自身字段开销会进一步限制 data 长度；模拟器校验声明长度和实际帧一致，并排除 CRC trailer 参与数据写入。

ACK 成功值为 0xAA。数据响应包含 2-byte CRC 前缀及精确目标 payload；`src/protocol/beggar_socket/packet-read.ts` 分类超时、短包和传输失败，ACK 错误保留原始字节与稳定 code。协议只负责线级语义，不负责 UI 状态或整个卡带事务独占。

host 总长校验不能替代固件 cmdBuf 容量和命令参数校验。固件接收边界、轮询 timeout/ACK 等发现仍在本轮 Web Client 范围之外，见[当前状态](../../../docs/review-2026-10-02/current-finding-status.md)。
