import type { Transport } from '@/platform/serial';
import { timeout } from '@/utils/async-utils';
import { packageTimeouts } from '@/utils/io-timeouts';

import {
  BOOST_ACK_OK,
  BOOST_MAX_CRC_CHUNK,
  BOOST_MAX_READ_CHUNK,
  BOOST_MAX_WRITE_CHUNK,
  BOOST_PROBE_ACK,
  BOOST_PROBE_REQUEST,
  BOOST_PROBE_TIMEOUT_MS,
  BoostCommand,
  type BoostMode,
} from './boost-constants';

export interface BoostProbeResult {
  supported: boolean;
  banner?: string;
}

export interface BoostWriteUnit {
  address: number;
  value: number;
}

function be16(value: number): [number, number] {
  return [(value >>> 8) & 0xff, value & 0xff];
}

function be32(value: number): [number, number, number, number] {
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ];
}

const activeBoostTransports = new WeakSet<Transport>();

export function isBoostModeActive(transport: Transport): boolean {
  return activeBoostTransports.has(transport);
}

export function markBoostModeInactive(transport: Transport): void {
  activeBoostTransports.delete(transport);
}

async function sendAndExpectBoostAck(
  transport: Transport,
  payload: Uint8Array,
  sendTimeoutMs?: number,
  readTimeoutMs?: number,
): Promise<void> {
  // The running operation's snapshot, not the persisted settings: an edit made while a
  // transfer runs must not change the deadline of the command already in flight.
  const fallback = packageTimeouts(transport);
  const response = await transport.sendAndReceive(
    payload,
    1,
    sendTimeoutMs ?? fallback.send,
    readTimeoutMs ?? fallback.receive,
  );
  const status = response.data?.[0];
  if (status !== BOOST_ACK_OK) {
    throw new Error(`Beggar Boost command 0x${payload[0].toString(16)} failed (status=0x${(status ?? 0).toString(16)})`);
  }
}

/**
 * 探测设备是否运行 ChisFlash-Beggar-Boost 固件并支持扩展指令。
 */
export async function boost_probe(
  transport: Transport,
  timeoutMs = BOOST_PROBE_TIMEOUT_MS,
): Promise<BoostProbeResult> {
  try {
    await transport.flushInput?.();
    await transport.send(BOOST_PROBE_REQUEST, timeoutMs);
    const first = await transport.read(1, timeoutMs);
    if (!first.data || first.data.byteLength === 0 || first.data[0] !== BOOST_PROBE_ACK) {
      return { supported: false };
    }

    const bytes: number[] = [];
    for (let i = 0; i < 63; i += 1) {
      try {
        const next = await transport.read(1, 50);
        if (!next.data || next.data.byteLength === 0) break;
        const ch = next.data[0];
        if (ch === 0x0a) break;
        if (ch !== 0x0d) bytes.push(ch);
      } catch {
        break;
      }
    }

    const banner = new TextDecoder().decode(Uint8Array.from(bytes)).trim();
    const supported = banner.length > 0;
    if (supported) {
      activeBoostTransports.add(transport);
    }
    return {
      supported,
      banner,
    };
  } catch {
    return { supported: false };
  }
}

/**
 * 通过 DTR/RTS 信号脉冲退出 Boost 扩展会话并清理串口残留字节，恢复默认串口协议。
 */
export async function boost_reset_to_default(transport: Transport): Promise<void> {
  try {
    await transport.flushInput?.();
    await transport.setSignals({ dataTerminalReady: false, requestToSend: false });
    await timeout(20);
    await transport.setSignals({ dataTerminalReady: true, requestToSend: true });
    await timeout(20);
    await transport.setSignals({ dataTerminalReady: false, requestToSend: false });
    await timeout(150);
    if (transport.drainInput) {
      await transport.drainInput();
    } else {
      await transport.flushInput?.();
    }
  } finally {
    activeBoostTransports.delete(transport);
  }
}

export async function ensureDefaultProtocol(transport: Transport): Promise<void> {
  if (activeBoostTransports.has(transport)) {
    await boost_reset_to_default(transport);
  }
}

export async function boost_set_mode(transport: Transport, mode: BoostMode): Promise<void> {
  const cmd = mode === 'agb' ? BoostCommand.MODE_AGB : BoostCommand.MODE_DMG;
  await sendAndExpectBoostAck(transport, new Uint8Array([cmd]));
}

export async function boost_enter_mode(transport: Transport, mode: BoostMode): Promise<BoostProbeResult> {
  if (activeBoostTransports.has(transport)) {
    await boost_set_mode(transport, mode);
    return { supported: true };
  }
  const probe = await boost_probe(transport, BOOST_PROBE_TIMEOUT_MS);
  if (!probe.supported) {
    throw new Error('Device did not respond to Beggar Boost handshake');
  }
  await boost_set_mode(transport, mode);
  return probe;
}

export async function boost_set_variable(
  transport: Transport,
  size: 1 | 2 | 4,
  key: number,
  value: number,
): Promise<void> {
  const payload = new Uint8Array([
    BoostCommand.SET_VARIABLE,
    size,
    ...be32(key),
    ...be32(value >>> 0),
  ]);
  await sendAndExpectBoostAck(transport, payload);
}

function toBusAddress(mode: BoostMode, byteAddress: number): number {
  return mode === 'agb' ? (byteAddress >>> 1) : (byteAddress >>> 0);
}

/**
 * 固件端硬件 CRC32 计算（0xd5），单次最大支持 128 KiB (0x20000)。
 */
export async function boost_crc_rom(
  transport: Transport,
  mode: BoostMode,
  byteAddress: number,
  lengthBytes: number,
): Promise<number> {
  if (lengthBytes <= 0 || lengthBytes > BOOST_MAX_CRC_CHUNK) {
    throw new RangeError(`Beggar Boost CRC length ${lengthBytes} out of range (1..${BOOST_MAX_CRC_CHUNK})`);
  }

  await boost_set_variable(transport, 4, 0, toBusAddress(mode, byteAddress));
  const payload = new Uint8Array([BoostCommand.CRC_ROM, ...be32(lengthBytes)]);
  const fallback = packageTimeouts(transport);
  const timeoutMs = Math.max(fallback.receive, 5000);
  const response = await transport.sendAndReceive(
    payload,
    4,
    fallback.send,
    timeoutMs,
  );
  if (!response.data || response.data.byteLength < 4) {
    throw new Error(`Beggar Boost CRC32 read failed: expected 4 bytes, got ${response.data?.byteLength ?? 0}`);
  }

  return (
    ((response.data[0] << 24)
      | (response.data[1] << 16)
      | (response.data[2] << 8)
      | response.data[3]) >>> 0
  );
}

/**
 * Boost 扩展流式 ROM 读取（0xc1 AGB / 0xb1 DMG），单次最大 8192 字节。
 */
export async function boost_read_rom(
  transport: Transport,
  mode: BoostMode,
  size: number,
  byteAddress = 0,
): Promise<Uint8Array> {
  if (size <= 0 || size > BOOST_MAX_READ_CHUNK) {
    throw new RangeError(`Beggar Boost ROM read size ${size} out of range (1..${BOOST_MAX_READ_CHUNK})`);
  }

  await boost_set_variable(transport, 4, 0, toBusAddress(mode, byteAddress));
  await boost_set_variable(transport, 2, 0, size);

  const cmd = mode === 'agb' ? BoostCommand.READ_AGB_ROM : BoostCommand.READ_DMG_ROM;
  const timeouts = packageTimeouts(transport);
  const response = await transport.sendAndReceive(
    new Uint8Array([cmd]),
    size,
    timeouts.send,
    timeouts.receive,
  );
  if (!response.data || response.data.byteLength < size) {
    throw new Error(`Beggar Boost ROM read failed: expected ${size} bytes, got ${response.data?.byteLength ?? 0}`);
  }
  return response.data.slice(0, size);
}

/**
 * Boost 扩展批量单元写（0xd4），用于发送地址/数值寄存器写入序列。
 */
export async function boost_write_units(
  transport: Transport,
  rom: boolean,
  writes: readonly BoostWriteUnit[],
): Promise<void> {
  if (writes.length === 0) return;
  for (let offset = 0; offset < writes.length; offset += 255) {
    const batch = writes.slice(offset, offset + 255);
    const payload = new Uint8Array(3 + batch.length * 6);
    payload[0] = BoostCommand.WRITE_UNITS;
    payload[1] = rom ? 1 : 0;
    payload[2] = batch.length;
    batch.forEach((unit, idx) => {
      const base = 3 + idx * 6;
      const [a0, a1, a2, a3] = be32(unit.address >>> 0);
      const [v0, v1] = be16(unit.value & 0xffff);
      payload[base] = a0;
      payload[base + 1] = a1;
      payload[base + 2] = a2;
      payload[base + 3] = a3;
      payload[base + 4] = v0;
      payload[base + 5] = v1;
    });
    await sendAndExpectBoostAck(transport, payload);
  }
}

/**
 * Boost 扩展原生 GBA RTC 读取（0xca），返回 8 字节状态与时间数据。
 */
export async function boost_gba_rtc_read(transport: Transport): Promise<Uint8Array> {
  const rtcTimeouts = packageTimeouts(transport);
  const response = await transport.sendAndReceive(
    new Uint8Array([BoostCommand.READ_AGB_RTC]),
    8,
    rtcTimeouts.send,
    rtcTimeouts.receive,
  );
  if (!response.data || response.data.byteLength < 8) {
    throw new Error(`Beggar Boost GBA RTC read failed: expected 8 bytes, got ${response.data?.byteLength ?? 0}`);
  }
  return response.data.slice(0, 8);
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function writeTimeoutMs(transport: Transport, byteLength: number): number {
  return packageTimeouts(transport).receive + byteLength * 2;
}

/**
 * Boost 扩展 GBA RAM 读取（0xc3），单次最大 8192 字节。
 */
export async function boost_read_ram(
  transport: Transport,
  size: number,
  byteAddress = 0,
): Promise<Uint8Array> {
  if (size <= 0 || size > BOOST_MAX_READ_CHUNK) {
    throw new RangeError(`Beggar Boost RAM read size ${size} out of range (1..${BOOST_MAX_READ_CHUNK})`);
  }

  await boost_set_variable(transport, 4, 0, byteAddress >>> 0);
  await boost_set_variable(transport, 2, 0, size);

  const ramTimeouts = packageTimeouts(transport);
  const response = await transport.sendAndReceive(
    new Uint8Array([BoostCommand.READ_AGB_RAM]),
    size,
    ramTimeouts.send,
    ramTimeouts.receive,
  );
  if (!response.data || response.data.byteLength < size) {
    throw new Error(`Beggar Boost RAM read failed: expected ${size} bytes, got ${response.data?.byteLength ?? 0}`);
  }
  return response.data.slice(0, size);
}

/**
 * Boost 扩展 GBA RAM 写入（0xc4），单次最大 4096 字节。
 */
export async function boost_write_ram(
  transport: Transport,
  data: Uint8Array,
  byteAddress = 0,
): Promise<void> {
  if (data.byteLength === 0) return;
  if (data.byteLength > BOOST_MAX_WRITE_CHUNK) {
    throw new RangeError(`Beggar Boost RAM write size ${data.byteLength} exceeds ${BOOST_MAX_WRITE_CHUNK}`);
  }

  await boost_set_variable(transport, 4, 0, byteAddress >>> 0);
  await boost_set_variable(transport, 2, 0, data.byteLength);

  const payload = concatBytes(new Uint8Array([BoostCommand.WRITE_AGB_RAM]), data);
  const timeoutMs = writeTimeoutMs(transport, data.byteLength);
  await sendAndExpectBoostAck(transport, payload, timeoutMs, timeoutMs);
}

/**
 * Boost 扩展 DMG 区域写入（0xb3），用于写入 GBC SRAM 区域。
 */
export async function boost_write_dmg_range(
  transport: Transport,
  data: Uint8Array,
  byteAddress = 0,
): Promise<void> {
  if (data.byteLength === 0) return;
  if (data.byteLength > BOOST_MAX_WRITE_CHUNK) {
    throw new RangeError(`Beggar Boost DMG write size ${data.byteLength} exceeds ${BOOST_MAX_WRITE_CHUNK}`);
  }

  await boost_set_variable(transport, 4, 0, byteAddress >>> 0);
  await boost_set_variable(transport, 2, 0, data.byteLength);

  const payload = concatBytes(new Uint8Array([BoostCommand.WRITE_DMG_RANGE]), data);
  const timeoutMs = writeTimeoutMs(transport, data.byteLength);
  await sendAndExpectBoostAck(transport, payload, timeoutMs, timeoutMs);
}

/**
 * Boost 扩展 GBA Flash 存档编程（0xc7），type=1 为逐字节写，type=2 为 128B 页写。
 */
export async function boost_program_save(
  transport: Transport,
  saveType: 1 | 2,
  byteAddress: number,
  data: Uint8Array,
): Promise<void> {
  if (data.byteLength === 0) return;
  if (data.byteLength > BOOST_MAX_WRITE_CHUNK) {
    throw new RangeError(`boost_program_save size ${data.byteLength} exceeds ${BOOST_MAX_WRITE_CHUNK}`);
  }
  const addrValue = saveType === 2 ? Math.floor(byteAddress / 128) : (byteAddress >>> 0);
  await boost_set_variable(transport, 4, 0, addrValue);
  await boost_set_variable(transport, 2, 0, data.byteLength);

  const payload = concatBytes(new Uint8Array([0xc7, saveType]), data);
  const timeoutMs = writeTimeoutMs(transport, data.byteLength);
  await sendAndExpectBoostAck(transport, payload, timeoutMs, timeoutMs);
}

/**
 * 配置 Boost 扩展 Flash 编程参数（0xa7，40 字节大端命令帧）。
 */
export async function boost_configure_flash(
  transport: Transport,
  options: {
    chipType: 1 | 2;
    method: 1 | 2;
    mapping?: number;
    commands: readonly BoostWriteUnit[];
  },
): Promise<void> {
  const payload = new Uint8Array(40);
  payload[0] = 0xa7;
  payload[1] = options.chipType;
  payload[2] = options.method;
  payload[3] = options.mapping ?? 0;
  for (let i = 0; i < 6; i += 1) {
    const cmd = options.commands[i];
    if (!cmd) continue;
    const base = 4 + i * 6;
    const [a0, a1, a2, a3] = be32(cmd.address >>> 0);
    const [v0, v1] = be16(cmd.value & 0xffff);
    payload[base] = a0;
    payload[base + 1] = a1;
    payload[base + 2] = a2;
    payload[base + 3] = a3;
    payload[base + 4] = v0;
    payload[base + 5] = v1;
  }
  await sendAndExpectBoostAck(transport, payload);
}

/**
 * 配置标准 AMD Flash 编程参数（单字/字节或缓冲页写）。
 */
export async function boost_configure_amd_flash(
  transport: Transport,
  options: {
    unlockAddr1: number;
    unlockAddr2: number;
    buffered: boolean;
    swapD0D1?: boolean;
  },
): Promise<void> {
  const unlock1 = options.swapD0D1 ? 0xa9 : 0xaa;
  const unlock2 = options.swapD0D1 ? 0x56 : 0x55;
  if (options.buffered) {
    const cmd25 = options.swapD0D1 ? 0x26 : 0x25;
    const cmd29 = options.swapD0D1 ? 0x2a : 0x29;
    await boost_configure_flash(transport, {
      chipType: 1,
      method: 2,
      commands: [
        { address: options.unlockAddr1, value: unlock1 },
        { address: options.unlockAddr2, value: unlock2 },
        { address: options.unlockAddr1, value: cmd25 },
        { address: 0, value: 0 },
        { address: 0, value: 0 },
        { address: 0, value: cmd29 },
      ],
    });
    return;
  }

  await boost_configure_flash(transport, {
    chipType: 1,
    method: 1,
    commands: [
      { address: options.unlockAddr1, value: unlock1 },
      { address: options.unlockAddr2, value: unlock2 },
      { address: options.unlockAddr1, value: 0xa0 },
    ],
  });
}

/**
 * 使用 Boost 扩展 0xd3 进行 Flash 编程（内部自动完成页写、轮询与固件端汇编回读校验）。
 */
export async function boost_program_flash(
  transport: Transport,
  mode: BoostMode,
  byteAddress: number,
  bufferSize: number,
  data: Uint8Array,
): Promise<void> {
  if (data.byteLength === 0) return;
  if (data.byteLength > BOOST_MAX_WRITE_CHUNK) {
    throw new RangeError(`Beggar Boost Flash program size ${data.byteLength} exceeds ${BOOST_MAX_WRITE_CHUNK}`);
  }

  await boost_set_variable(transport, 4, 0, toBusAddress(mode, byteAddress));
  await boost_set_variable(transport, 2, 0, data.byteLength);
  await boost_set_variable(transport, 2, 1, bufferSize);

  const payload = concatBytes(new Uint8Array([BoostCommand.PROGRAM_FLASH]), data);
  const timeoutMs = writeTimeoutMs(transport, data.byteLength);
  await sendAndExpectBoostAck(transport, payload, timeoutMs, timeoutMs);
}
