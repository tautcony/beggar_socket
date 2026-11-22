/**
 * FlashGBX LK_Device command client, session-level mutex, and protocol helpers.
 * Derived from FlashGBX (GPL-3.0) LK_Device.py.
 */
import type { Transport } from '@/platform/serial';
import { crc32 } from '@/utils/crc-utils';

import {
  DEVICE_VAR,
  DMG_ACCESS_MODE,
  FLASH_WE_PIN,
  FLASHGBX_ACK_FLASH_CONTINUE,
  FLASHGBX_ACK_OK,
  FLASHGBX_CMD,
  FLASHGBX_CRC32_CHUNK_SIZE,
  type FlashgbxDeviceVarName,
  FW_VER_THRESHOLDS,
} from './constants';
import {
  computeFlashgbxBufferLimits,
  type FlashgbxBufferLimits,
  FlashgbxFramingLayer,
} from './framing';
import type { FlashgbxFirmwareInfo } from './handshake';

export type FlashgbxCartMode = 'DMG' | 'AGB';
export type FlashgbxVoltage = '3.3V' | '5V';

export interface FlashgbxCommandClientOptions {
  baudRate?: number;
  timeoutMs?: number;
}

export class FlashgbxProtocolError extends Error {
  constructor(message: string, readonly code: 'timeout' | 'bad_ack' | 'unsupported' | 'aborted' | 'io' = 'io') {
    super(message);
    this.name = 'FlashgbxProtocolError';
  }
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new FlashgbxProtocolError('Operation cancelled by user', 'aborted');
  }
}

/**
 * Session-level mutex serializing multi-step LK_Device transactions
 * (e.g., SET_VARIABLE -> command -> read/ack) on a single device transport.
 */
export class FlashgbxSessionMutex {
  private tail: Promise<void> = Promise.resolve();

  run<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    throwIfAborted(signal);
    const next = this.tail.then(async () => {
      throwIfAborted(signal);
      return fn();
    });
    this.tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}

function encodeUint32BE(value: number): [number, number, number, number] {
  const v = value >>> 0;
  return [(v >>> 24) & 0xFF, (v >>> 16) & 0xFF, (v >>> 8) & 0xFF, v & 0xFF];
}

function encodeUint16BE(value: number): [number, number] {
  const v = value & 0xFFFF;
  return [(v >>> 8) & 0xFF, v & 0xFF];
}

function decodeUint32BE(bytes: Uint8Array, offset = 0): number {
  return (
    ((bytes[offset] << 24)
      | (bytes[offset + 1] << 16)
      | (bytes[offset + 2] << 8)
      | bytes[offset + 3]) >>> 0
  );
}

function decodeUint16BE(bytes: Uint8Array, offset = 0): number {
  return ((bytes[offset] << 8) | bytes[offset + 1]) & 0xFFFF;
}

export class FlashgbxCommandClient {
  readonly framing: FlashgbxFramingLayer;
  readonly mutex = new FlashgbxSessionMutex();
  private readonly fwVars = new Map<FlashgbxDeviceVarName, number>();
  private mode: FlashgbxCartMode | null = null;
  private baudRate: number;
  private readonly timeoutMs: number;
  private limits: FlashgbxBufferLimits;

  constructor(
    readonly transport: Transport,
    readonly fwInfo: FlashgbxFirmwareInfo,
    options: FlashgbxCommandClientOptions = {},
  ) {
    this.baudRate = options.baudRate ?? 2_000_000;
    this.timeoutMs = options.timeoutMs ?? 1500;
    this.framing = new FlashgbxFramingLayer(transport);
    this.limits = computeFlashgbxBufferLimits(fwInfo, this.baudRate);
  }

  get bufferLimits(): FlashgbxBufferLimits {
    return this.limits;
  }

  get currentMode(): FlashgbxCartMode | null {
    return this.mode;
  }

  setBaudRate(baudRate: number): void {
    this.baudRate = baudRate;
    this.limits = computeFlashgbxBufferLimits(this.fwInfo, this.baudRate);
  }

  async resetChannel(): Promise<void> {
    await this.framing.resetBuffers();
  }

  private async writeRaw(bytes: Uint8Array | readonly number[]): Promise<void> {
    const payload = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    await this.framing.write(payload, this.timeoutMs);
  }

  private async readExact(length: number): Promise<Uint8Array> {
    const data = await this.framing.read(length, this.timeoutMs);
    if (data.length < length) {
      throw new FlashgbxProtocolError(`Expected ${length} bytes, got ${data.length}`, 'timeout');
    }
    return data;
  }

  private async waitForAck(acceptFlashContinue = false): Promise<number> {
    const resp = await this.readExact(1);
    const ack = resp[0];
    if (ack === FLASHGBX_ACK_OK || (acceptFlashContinue && ack === FLASHGBX_ACK_FLASH_CONTINUE)) {
      return ack;
    }
    throw new FlashgbxProtocolError(`Unexpected FlashGBX ACK: 0x${ack.toString(16)}`, 'bad_ack');
  }

  private async writeCommand(bytes: Uint8Array | readonly number[], waitAck: boolean, acceptFlashContinue = false): Promise<number | undefined> {
    await this.writeRaw(bytes);
    if (waitAck) {
      return this.waitForAck(acceptFlashContinue);
    }
    return undefined;
  }

  // --- Variable commands ---

  async getVariable(name: FlashgbxDeviceVarName): Promise<number> {
    if (this.fwInfo.fwVer < FW_VER_THRESHOLDS.GET_VARIABLE) {
      return 0;
    }
    const [bits, key] = DEVICE_VAR[name];
    const size = bits / 8;
    await this.writeRaw([FLASHGBX_CMD.GET_VARIABLE, size, ...encodeUint32BE(key)]);
    const resp = await this.readExact(4);
    return decodeUint32BE(resp);
  }

  async setVariable(name: FlashgbxDeviceVarName, value: number): Promise<void> {
    this.fwVars.set(name, value >>> 0);
    const [bits, key] = DEVICE_VAR[name];
    const size = bits / 8;
    const payload = [
      FLASHGBX_CMD.SET_VARIABLE,
      size,
      ...encodeUint32BE(key),
      ...encodeUint32BE(value),
    ];
    await this.writeCommand(payload, this.fwInfo.fwVer >= FW_VER_THRESHOLDS.COMMAND_ACK, true);
  }

  getCachedVariable(name: FlashgbxDeviceVarName): number | undefined {
    return this.fwVars.get(name);
  }

  async getVarState(): Promise<Uint8Array> {
    await this.writeRaw([FLASHGBX_CMD.GET_VAR_STATE]);
    if (this.transport.readAvailable) {
      const { data } = await this.transport.readAvailable(250);
      return data;
    }
    const chunks: Uint8Array[] = [];
    while (true) {
      const part = await this.framing.read(64, 100);
      if (part.length > 0) {
        chunks.push(part);
      }
      if (part.length < 64) {
        break;
      }
    }
    const total = chunks.reduce((acc, c) => acc + c.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    return out;
  }

  async setVarState(state: Uint8Array): Promise<void> {
    await this.writeRaw([FLASHGBX_CMD.SET_VAR_STATE]);
    await this.writeRaw(state);
    if (this.fwInfo.fwVer >= FW_VER_THRESHOLDS.PING) {
      await this.waitForAck(true);
    }
  }

  // --- Diagnostics & switches ---

  async ping(challenge = 0x5A): Promise<boolean> {
    if (this.fwInfo.fwVer < FW_VER_THRESHOLDS.PING) {
      return false;
    }
    const byte = challenge & 0xFF;
    await this.writeRaw([FLASHGBX_CMD.PING, byte]);
    const resp = await this.readExact(1);
    return resp[0] === ((~byte) & 0xFF);
  }

  async getSwitchState(): Promise<{ presence: boolean; mode: 'DMG' | 'AGB' } | null> {
    if (this.fwInfo.fwVer < FW_VER_THRESHOLDS.GET_SWITCH_STATE) {
      return null;
    }
    await this.writeRaw([FLASHGBX_CMD.GET_SWITCH_STATE]);
    const state = (await this.readExact(1))[0];
    return {
      presence: Boolean(state & 0x01),
      mode: ((state >> 1) & 0x01) === 1 ? 'DMG' : 'AGB',
    };
  }

  // --- Mode, voltage, power ---

  async setVoltage(voltage: FlashgbxVoltage): Promise<void> {
    const cmd = voltage === '5V' ? FLASHGBX_CMD.SET_VOLTAGE_5V : FLASHGBX_CMD.SET_VOLTAGE_3_3V;
    await this.writeCommand([cmd], this.fwInfo.fwVer >= FW_VER_THRESHOLDS.COMMAND_ACK, true);
  }

  async queryCartPower(): Promise<boolean> {
    if (!this.fwInfo.cartPowerCtrl) {
      return true;
    }
    await this.writeRaw([FLASHGBX_CMD.QUERY_CART_PWR]);
    const resp = await this.readExact(1);
    return resp[0] === 1;
  }

  async cartPowerOff(): Promise<void> {
    if (this.fwInfo.cartPowerCtrl) {
      await this.writeCommand([FLASHGBX_CMD.CART_PWR_OFF], this.fwInfo.fwVer >= FW_VER_THRESHOLDS.COMMAND_ACK, true);
    } else {
      await this.writeCommand([FLASHGBX_CMD.SET_ADDR_AS_INPUTS], this.fwInfo.fwVer >= FW_VER_THRESHOLDS.COMMAND_ACK, true);
    }
  }

  async cartPowerOn(mode: FlashgbxCartMode): Promise<void> {
    if (!this.fwInfo.cartPowerCtrl) {
      if (mode === 'AGB') {
        await this.agbBootupSequence();
      }
      return;
    }

    let alreadyPowered = false;
    if (this.fwInfo.fwVer >= FW_VER_THRESHOLDS.COMMAND_ACK) {
      alreadyPowered = await this.queryCartPower();
    }

    if (!alreadyPowered) {
      const modeCmd = mode === 'DMG' ? FLASHGBX_CMD.SET_MODE_DMG : FLASHGBX_CMD.SET_MODE_AGB;
      await this.writeCommand([modeCmd], this.fwInfo.fwVer >= FW_VER_THRESHOLDS.COMMAND_ACK, true);
      await this.writeCommand([FLASHGBX_CMD.CART_PWR_ON], this.fwInfo.fwVer >= FW_VER_THRESHOLDS.COMMAND_ACK, true);
      if (this.fwInfo.fwVer >= FW_VER_THRESHOLDS.COMMAND_ACK) {
        await this.queryCartPower();
      }
      if (mode === 'DMG') {
        await this.dmgMbcReset();
      } else {
        await this.agbBootupSequence();
      }
    }
  }

  async setPin(pinMask: number, high: boolean): Promise<void> {
    if (this.fwInfo.fwVer < FW_VER_THRESHOLDS.SET_PIN) {
      return;
    }
    await this.writeCommand(
      [FLASHGBX_CMD.SET_PIN, ...encodeUint32BE(pinMask), high ? 1 : 0],
      true,
      true,
    );
  }

  async syncModeOnly(mode: FlashgbxCartMode): Promise<void> {
    const modeCmd = mode === 'DMG' ? FLASHGBX_CMD.SET_MODE_DMG : FLASHGBX_CMD.SET_MODE_AGB;
    await this.writeCommand([modeCmd], this.fwInfo.fwVer >= FW_VER_THRESHOLDS.COMMAND_ACK, true);
    await this.setVariable('CART_MODE', mode === 'DMG' ? 1 : 2);
    this.mode = mode;
  }

  async setMode(mode: FlashgbxCartMode, voltage?: FlashgbxVoltage): Promise<void> {
    if (mode === 'DMG') {
      await this.writeCommand([FLASHGBX_CMD.SET_MODE_DMG], this.fwInfo.fwVer >= FW_VER_THRESHOLDS.COMMAND_ACK, true);
      await this.setVoltage(voltage ?? '5V');
      await this.setVariable('DMG_READ_METHOD', 1);
      await this.setVariable('CART_MODE', 1);
      this.mode = 'DMG';
    } else {
      await this.writeCommand([FLASHGBX_CMD.SET_MODE_AGB], this.fwInfo.fwVer >= FW_VER_THRESHOLDS.COMMAND_ACK, true);
      await this.setVoltage(voltage ?? '3.3V');
      await this.setVariable('AGB_READ_METHOD', 0);
      await this.setVariable('CART_MODE', 2);
      if (this.fwInfo.fwVer >= FW_VER_THRESHOLDS.COMMAND_ACK) {
        await this.setVariable('AGB_IRQ_ENABLED', 0);
      }
      this.mode = 'AGB';
    }
    await this.setVariable('ADDRESS', 0);
    if (this.fwInfo.cartPowerCtrl) {
      await this.cartPowerOn(mode);
    } else if (this.fwInfo.fwVer >= FW_VER_THRESHOLDS.SET_PIN) {
      // PIN_AUDIO = 1 << 4 (0x10)
      await this.setPin(1 << 4, mode === 'DMG');
      if (mode === 'AGB') {
        await this.agbBootupSequence();
      }
    } else if (mode === 'AGB') {
      await this.agbBootupSequence();
    }
  }

  // --- Auto power-off watchdog ---

  async setAutoPowerOff(ms: number): Promise<void> {
    if (!this.fwInfo.cartPowerCtrl || this.fwInfo.fwVer < FW_VER_THRESHOLDS.AUTO_POWEROFF) {
      return;
    }
    const clamped = ms >>> 0;
    await this.setVariable('AUTO_POWEROFF_ENABLED', clamped !== 0 ? 1 : 0);
    await this.setVariable('AUTO_POWEROFF_TIME', clamped);
  }

  async enterAutoPowerOffKeepAlive(keepAliveMs = 600_000): Promise<number | null> {
    if (!this.fwInfo.cartPowerCtrl || this.fwInfo.fwVer < FW_VER_THRESHOLDS.AUTO_POWEROFF) {
      return null;
    }
    const enabled = await this.getVariable('AUTO_POWEROFF_ENABLED');
    if (enabled !== 1) {
      return null;
    }
    const previous = await this.getVariable('AUTO_POWEROFF_TIME');
    await this.setVariable('AUTO_POWEROFF_TIME', keepAliveMs);
    return previous;
  }

  async leaveAutoPowerOffKeepAlive(previousMs: number | null): Promise<void> {
    if (previousMs === null || !this.fwInfo.cartPowerCtrl || this.fwInfo.fwVer < FW_VER_THRESHOLDS.AUTO_POWEROFF) {
      return;
    }
    await this.setVariable('AUTO_POWEROFF_TIME', previousMs);
  }

  // --- MBC / Bootup / RTC ---

  async dmgMbcReset(): Promise<void> {
    await this.writeCommand([FLASHGBX_CMD.DMG_MBC_RESET], true, true);
  }

  async dmgSetBankChangeCmd(commands: readonly { address?: number; value?: number }[]): Promise<void> {
    if (this.fwInfo.fwVer < FW_VER_THRESHOLDS.CART_WRITE_FLASH_CMD) {
      return;
    }
    if (commands.length === 0) {
      await this.writeCommand([FLASHGBX_CMD.DMG_SET_BANK_CHANGE_CMD, 0], true, true);
      return;
    }
    const buf: number[] = [FLASHGBX_CMD.DMG_SET_BANK_CHANGE_CMD, commands.length];
    for (const cmd of commands) {
      if (cmd.address !== undefined) {
        buf.push(...encodeUint32BE(cmd.address), 0);
      } else {
        buf.push(...encodeUint32BE(cmd.value ?? 0), 1);
      }
    }
    await this.writeCommand(buf, true, true);
  }

  async agbBootupSequence(): Promise<void> {
    await this.writeCommand([FLASHGBX_CMD.AGB_BOOTUP_SEQUENCE], this.fwInfo.fwVer >= FW_VER_THRESHOLDS.COMMAND_ACK, true);
  }

  async agbReadGpioRtc(): Promise<Uint8Array | null> {
    if (this.fwInfo.fwVer < FW_VER_THRESHOLDS.AGB_READ_GPIO_RTC) {
      return null;
    }
    await this.writeRaw([FLASHGBX_CMD.AGB_READ_GPIO_RTC]);
    return this.readExact(8);
  }

  // --- Cartridge Read/Write primitives ---

  async readRom(
    mode: FlashgbxCartMode,
    address: number,
    length: number,
    options: { maxLength?: number; skipInit?: boolean; signal?: AbortSignal; onChunk?: (chunk: Uint8Array) => void } = {},
  ): Promise<Uint8Array> {
    const maxLen = Math.min(options.maxLength ?? this.limits.maxRead, this.limits.maxRead);
    const out = new Uint8Array(length);
    let offset = 0;
    let previousSize = options.skipInit ? maxLen : Math.min(length, maxLen);

    if (!options.skipInit && length > 0) {
      await this.setVariable('TRANSFER_SIZE', previousSize);
      if (mode === 'DMG') {
        await this.setVariable('ADDRESS', address);
        await this.setVariable('DMG_ACCESS_MODE', DMG_ACCESS_MODE.ROM_READ);
      } else {
        await this.setVariable('ADDRESS', address >>> 1);
      }
    }

    const cmd = mode === 'DMG' ? FLASHGBX_CMD.DMG_CART_READ : FLASHGBX_CMD.AGB_CART_READ;
    while (offset < length) {
      throwIfAborted(options.signal);
      const readLen = Math.min(length - offset, maxLen);
      if (readLen !== previousSize) {
        await this.setVariable('TRANSFER_SIZE', readLen);
        previousSize = readLen;
      }
      await this.writeRaw([cmd]);
      const chunk = await this.readExact(readLen);
      out.set(chunk, offset);
      offset += chunk.length;
      options.onChunk?.(chunk);
    }

    if (length > 0 && previousSize !== maxLen) {
      await this.setVariable('TRANSFER_SIZE', maxLen);
    }
    return out;
  }

  async readRam(
    mode: FlashgbxCartMode,
    address: number,
    length: number,
    options: { command?: readonly number[] | number; maxLength?: number; signal?: AbortSignal; onChunk?: (chunk: Uint8Array) => void } = {},
  ): Promise<Uint8Array> {
    const maxLen = Math.min(options.maxLength ?? this.limits.maxRead, this.limits.maxRead);
    const out = new Uint8Array(length);
    if (length === 0) {
      return out;
    }

    let previousSize = Math.min(length, maxLen);
    await this.setVariable('TRANSFER_SIZE', previousSize);

    let cmdBytes: readonly number[];
    if (mode === 'DMG') {
      await this.setVariable('ADDRESS', 0xA000 + address);
      await this.setVariable('DMG_ACCESS_MODE', DMG_ACCESS_MODE.RAM_READ);
      await this.setVariable('DMG_READ_CS_PULSE', 1);
      cmdBytes = options.command === undefined
        ? [FLASHGBX_CMD.DMG_CART_READ]
        : (typeof options.command === 'number' ? [options.command] : options.command);
    } else {
      await this.setVariable('ADDRESS', address);
      cmdBytes = options.command === undefined
        ? [FLASHGBX_CMD.AGB_CART_READ_SRAM]
        : (typeof options.command === 'number' ? [options.command] : options.command);
    }

    try {
      let offset = 0;
      while (offset < length) {
        throwIfAborted(options.signal);
        const readLen = Math.min(length - offset, maxLen);
        if (readLen !== previousSize) {
          await this.setVariable('TRANSFER_SIZE', readLen);
          previousSize = readLen;
        }
        await this.writeRaw(cmdBytes);
        const chunk = await this.readExact(readLen);
        out.set(chunk, offset);
        offset += chunk.length;
        options.onChunk?.(chunk);
      }
      if (previousSize !== maxLen) {
        await this.setVariable('TRANSFER_SIZE', maxLen);
      }
    } finally {
      if (mode === 'DMG') {
        await this.setVariable('DMG_READ_CS_PULSE', 0).catch(() => undefined);
      }
    }
    return out;
  }

  async writeRam(
    mode: FlashgbxCartMode,
    address: number,
    data: Uint8Array,
    options: { command?: readonly number[] | number; maxLength?: number; signal?: AbortSignal; onChunk?: (written: number) => void } = {},
  ): Promise<void> {
    if (data.length === 0) {
      return;
    }
    const maxLen = Math.min(options.maxLength ?? this.limits.maxWrite, this.limits.maxWrite);
    let chunkSize = Math.min(data.length, maxLen);
    await this.setVariable('TRANSFER_SIZE', chunkSize);

    let cmdBytes: readonly number[];
    if (mode === 'DMG') {
      await this.setVariable('ADDRESS', 0xA000 + address);
      await this.setVariable('DMG_ACCESS_MODE', DMG_ACCESS_MODE.RAM_WRITE);
      await this.setVariable('DMG_WRITE_CS_PULSE', 1);
      cmdBytes = options.command === undefined
        ? [FLASHGBX_CMD.DMG_CART_WRITE_SRAM]
        : (typeof options.command === 'number' ? [options.command] : options.command);
    } else {
      await this.setVariable('ADDRESS', address);
      cmdBytes = options.command === undefined
        ? [FLASHGBX_CMD.AGB_CART_WRITE_SRAM]
        : (typeof options.command === 'number' ? [options.command] : options.command);
    }

    try {
      for (let offset = 0; offset < data.length; offset += maxLen) {
        throwIfAborted(options.signal);
        const chunk = data.subarray(offset, Math.min(offset + maxLen, data.length));
        if (chunk.length !== chunkSize) {
          chunkSize = chunk.length;
          await this.setVariable('TRANSFER_SIZE', chunkSize);
        }
        await this.writeRaw(cmdBytes);
        await this.writeCommand(chunk, true, true);
        options.onChunk?.(chunk.length);
      }
    } finally {
      if (mode === 'DMG') {
        await this.setVariable('ADDRESS', 0).catch(() => undefined);
        await this.setVariable('DMG_WRITE_CS_PULSE', 0).catch(() => undefined);
      }
    }
  }

  async cartRead(mode: FlashgbxCartMode, address: number, agbSaveFlash = false): Promise<number> {
    if (mode === 'DMG') {
      const raw = address < 0xA000
        ? await this.readRom('DMG', address, 1)
        : await this.readRam('DMG', address - 0xA000, 1);
      return raw[0];
    }
    if (agbSaveFlash) {
      const raw = await this.readRam('AGB', address, 1, { command: FLASHGBX_CMD.AGB_CART_READ_SRAM });
      return raw[0];
    }
    const raw = await this.readRom('AGB', address, 2);
    return decodeUint16BE(raw);
  }

  async cartWrite(
    mode: FlashgbxCartMode,
    address: number,
    value: number,
    options: { flashcart?: boolean; sram?: boolean } = {},
  ): Promise<void> {
    const flashcart = Boolean(options.flashcart);
    const sram = Boolean(options.sram);

    if (mode === 'DMG') {
      if (sram) {
        await this.setVariable('DMG_WRITE_CS_PULSE', 1);
        await this.setVariable('ADDRESS', address);
        await this.setVariable('TRANSFER_SIZE', 1);
        await this.writeRaw([FLASHGBX_CMD.DMG_CART_WRITE_SRAM]);
        await this.writeCommand([value & 0xFF], true, true);
        await this.setVariable('DMG_WRITE_CS_PULSE', 0);
        return;
      }
      const cmd = flashcart ? FLASHGBX_CMD.DMG_FLASH_WRITE_BYTE : FLASHGBX_CMD.DMG_CART_WRITE;
      await this.writeCommand(
        [cmd, ...encodeUint32BE(address), value & 0xFF],
        this.fwInfo.fwVer >= FW_VER_THRESHOLDS.COMMAND_ACK,
        true,
      );
      return;
    }

    if (sram) {
      await this.setVariable('TRANSFER_SIZE', 1);
      await this.setVariable('ADDRESS', address);
      await this.writeRaw([FLASHGBX_CMD.AGB_CART_WRITE_SRAM]);
      await this.writeCommand([value & 0xFF], true, true);
      return;
    }

    const cmd = flashcart ? FLASHGBX_CMD.AGB_FLASH_WRITE_SHORT : FLASHGBX_CMD.AGB_CART_WRITE;
    await this.writeCommand(
      [cmd, ...encodeUint32BE(address >>> 1), ...encodeUint16BE(value)],
      this.fwInfo.fwVer >= FW_VER_THRESHOLDS.COMMAND_ACK,
      true,
    );
  }

  async cartWriteFlash(
    mode: FlashgbxCartMode,
    commands: readonly (readonly [number, number])[],
    flashcart = false,
  ): Promise<void> {
    if (this.fwInfo.fwVer < FW_VER_THRESHOLDS.CART_WRITE_FLASH_CMD && !(mode === 'AGB' && !flashcart)) {
      for (const [addr, val] of commands) {
        await this.cartWrite(mode, addr, val, { flashcart });
      }
      return;
    }

    const buf: number[] = [FLASHGBX_CMD.CART_WRITE_FLASH_CMD];
    if (this.fwInfo.fwVer >= FW_VER_THRESHOLDS.CART_WRITE_FLASH_CMD) {
      buf.push(flashcart ? 1 : 0);
    }
    buf.push(commands.length & 0xFF);

    for (const [addr, val] of commands) {
      const encodedAddr = mode === 'AGB' && flashcart ? addr >>> 1 : addr;
      buf.push(...encodeUint32BE(encodedAddr));
      if (this.fwInfo.fwVer < FW_VER_THRESHOLDS.CART_WRITE_FLASH_CMD) {
        buf.push(val & 0xFF);
      } else {
        buf.push(...encodeUint16BE(val));
      }
    }

    await this.writeCommand(buf, true, false);
  }

  async setFlashCmd(
    mode: FlashgbxCartMode,
    flashCommandSet: number,
    flashMethod: number,
    wePin: number,
    commands: readonly (readonly [number, number])[],
  ): Promise<void> {
    const buf: number[] = [
      FLASHGBX_CMD.SET_FLASH_CMD,
      flashCommandSet & 0xFF,
      flashMethod & 0xFF,
      wePin & 0xFF,
    ];
    for (let i = 0; i < 6; i++) {
      if (i >= commands.length) {
        buf.push(0, 0, 0, 0, 0, 0);
      } else {
        const [rawAddr, val] = commands[i];
        const addr = mode === 'AGB' ? rawAddr >>> 1 : rawAddr;
        buf.push(...encodeUint32BE(addr), ...encodeUint16BE(val));
      }
    }
    await this.writeCommand(buf, this.fwInfo.fwVer >= FW_VER_THRESHOLDS.COMMAND_ACK, true);
    if (this.fwInfo.fwVer >= FW_VER_THRESHOLDS.CART_WRITE_FLASH_CMD) {
      await this.setVariable('FLASH_COMMANDS_BANK_1', 0);
      await this.dmgSetBankChangeCmd([]);
    }
    if (this.fwInfo.fwVer >= FW_VER_THRESHOLDS.COMMAND_ACK) {
      await this.setVariable('STATUS_REGISTER_MASK', 0x80);
      await this.setVariable('STATUS_REGISTER_VALUE', 0x80);
    }
    if (wePin !== FLASH_WE_PIN.UNSET) {
      await this.setVariable('FLASH_WE_PIN', wePin);
    }
  }

  async writeFlashRom(
    mode: FlashgbxCartMode,
    startAddress: number,
    data: Uint8Array,
    flashBufferSize = 0,
    options: { maxLength?: number; skipInit?: boolean; signal?: AbortSignal; onChunk?: (written: number, skipped: boolean) => void } = {},
  ): Promise<void> {
    if (data.length === 0) {
      return;
    }
    const maxLen = Math.min(options.maxLength ?? this.limits.maxWrite, this.limits.maxWrite);
    const chunkLen = Math.min(data.length, maxLen);
    const numOfChunks = flashBufferSize > 0 ? Math.ceil(flashBufferSize / chunkLen) : 1;

    let skipInit = Boolean(options.skipInit);
    if (!skipInit) {
      await this.setVariable('TRANSFER_SIZE', chunkLen);
      if (flashBufferSize > 0) {
        await this.setVariable('BUFFER_SIZE', flashBufferSize);
      }
    }

    let address = startAddress;
    let lastAck = 0;
    let skipWrite = false;
    let offset = 0;

    while (offset < data.length) {
      throwIfAborted(options.signal);

      // Buffer-aligned all-0xFF skip when chunkLen < flashBufferSize (e.g. 0x80 chunks for 0x200 buffer)
      if (
        flashBufferSize > 0
        && chunkLen < flashBufferSize
        && offset % flashBufferSize === 0
        && offset + flashBufferSize <= data.length
      ) {
        let blockFF = true;
        for (let j = 0; j < flashBufferSize; j++) {
          if (data[offset + j] !== 0xFF) {
            blockFF = false;
            break;
          }
        }
        if (blockFF) {
          skipInit = false;
          skipWrite = true;
          lastAck = 0;
          address += flashBufferSize;
          offset += flashBufferSize;
          options.onChunk?.(flashBufferSize, true);
          continue;
        }
      }

      const chunk = data.subarray(offset, Math.min(offset + chunkLen, data.length));
      if (chunk.length !== chunkLen) {
        await this.setVariable('TRANSFER_SIZE', chunk.length);
        skipInit = false;
      }

      const isAllFF = (numOfChunks === 1 || flashBufferSize === 0) && chunk.every(b => b === 0xFF);
      if (isAllFF) {
        skipInit = false;
        skipWrite = true;
        lastAck = 0;
      } else {
        skipWrite = false;
      }

      if (!skipWrite) {
        if (!skipInit) {
          await this.setVariable('ADDRESS', mode === 'AGB' ? address >>> 1 : address);
          skipInit = true;
        }
        let ack: number | undefined;
        let payload: Uint8Array;
        if (lastAck !== FLASHGBX_ACK_FLASH_CONTINUE) {
          payload = new Uint8Array(1 + chunk.length);
          payload[0] = FLASHGBX_CMD.FLASH_PROGRAM;
          payload.set(chunk, 1);
        } else {
          payload = chunk;
        }

        if (!this.fwInfo.isCdc) {
          const SUBWRITE_SIZE = 0x20;
          for (let sub = 0; sub < payload.length; sub += SUBWRITE_SIZE) {
            const subchunk = payload.subarray(sub, Math.min(sub + SUBWRITE_SIZE, payload.length));
            await this.framing.write(subchunk, this.timeoutMs);
            if (sub + SUBWRITE_SIZE < payload.length) {
              const gapStart = performance.now();
              while (performance.now() - gapStart < 0.5) {
                // 0.5ms pacing between 32B CH340 FIFO sub-writes (avoids browser 4ms setTimeout clamp)
              }
            }
          }
          ack = await this.waitForAck(true);
        } else {
          ack = (await this.writeCommand(payload, true, true)) ?? undefined;
        }
        lastAck = typeof ack === 'number' ? ack : FLASHGBX_ACK_OK;
      }

      address += chunk.length;
      offset += chunk.length;
      options.onChunk?.(chunk.length, skipWrite);
    }
  }

  // --- CRC32 ---

  async calcCrc32(
    mode: FlashgbxCartMode,
    address: number,
    length: number,
    options: { signal?: AbortSignal; onChunk?: (chunkLen: number) => void } = {},
  ): Promise<{ supported: boolean; chunkCrcs: number[] }> {
    if (this.fwInfo.fwVer < FW_VER_THRESHOLDS.CALC_CRC32) {
      return { supported: false, chunkCrcs: [] };
    }

    const chunkCrcs: number[] = [];
    let left = length;
    let chunkPos = 0;

    while (left > 0) {
      throwIfAborted(options.signal);
      const chunkLen = Math.min(left, FLASHGBX_CRC32_CHUNK_SIZE);
      const targetAddr = address + chunkPos;
      await this.setVariable('ADDRESS', mode === 'AGB' ? targetAddr >>> 1 : targetAddr);
      await this.writeRaw([FLASHGBX_CMD.CALC_CRC32, ...encodeUint32BE(chunkLen)]);
      const resp = await this.readExact(4);
      chunkCrcs.push(decodeUint32BE(resp));
      left -= chunkLen;
      chunkPos += chunkLen;
      options.onChunk?.(chunkLen);
    }

    return { supported: true, chunkCrcs };
  }

  async verifyRomCrc32(
    mode: FlashgbxCartMode,
    address: number,
    expectedData: Uint8Array,
    options: { signal?: AbortSignal; onChunk?: (chunkLen: number) => void } = {},
  ): Promise<{
    matched: boolean;
    usedHardwareCrc: boolean;
    mismatchOffset?: number;
    expected?: number;
    actual?: number;
    expectedByte?: number;
    actualByte?: number;
  }> {
    if (this.fwInfo.fwVer >= FW_VER_THRESHOLDS.CALC_CRC32) {
      let pos = 0;
      while (pos < expectedData.length) {
        throwIfAborted(options.signal);
        const chunkLen = Math.min(expectedData.length - pos, FLASHGBX_CRC32_CHUNK_SIZE);
        const { chunkCrcs } = await this.calcCrc32(mode, address + pos, chunkLen, {
          signal: options.signal,
        });
        const actual = chunkCrcs[0];
        const expectedSlice = expectedData.subarray(pos, pos + chunkLen);
        const expected = crc32(expectedSlice) >>> 0;
        if (expected !== actual) {
          const readBack = await this.readRom(mode, address + pos, chunkLen, {
            signal: options.signal,
          });
          let byteIdx = 0;
          for (let i = 0; i < expectedSlice.length && i < readBack.length; i++) {
            if (expectedSlice[i] !== readBack[i]) {
              byteIdx = i;
              break;
            }
          }
          return {
            matched: false,
            usedHardwareCrc: true,
            mismatchOffset: pos + byteIdx,
            expected,
            actual,
            expectedByte: expectedSlice[byteIdx],
            actualByte: readBack[byteIdx],
          };
        }
        options.onChunk?.(chunkLen);
        pos += chunkLen;
      }
      return { matched: true, usedHardwareCrc: true };
    }

    const readBack = await this.readRom(mode, address, expectedData.length, {
      signal: options.signal,
      onChunk: chunk => options.onChunk?.(chunk.length),
    });
    const expected = crc32(expectedData) >>> 0;
    const actual = crc32(readBack) >>> 0;
    if (expected === actual) {
      return { matched: true, usedHardwareCrc: false, expected, actual };
    }
    let byteIdx = 0;
    for (let i = 0; i < expectedData.length && i < readBack.length; i++) {
      if (expectedData[i] !== readBack[i]) {
        byteIdx = i;
        break;
      }
    }
    return {
      matched: false,
      usedHardwareCrc: false,
      mismatchOffset: byteIdx,
      expected,
      actual,
      expectedByte: expectedData[byteIdx],
      actualByte: readBack[byteIdx],
    };
  }
}
