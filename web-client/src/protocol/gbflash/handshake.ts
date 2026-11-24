import type { Transport } from '@/platform/serial';
import type { SerialPortInfo } from '@/types/serial';

import {
  DEVICE_MIN_FW,
  GBFLASH_ACK_OK,
  GBFLASH_CMD,
  GBFLASH_USB_IDS,
  FW_VER_THRESHOLDS,
  HANDSHAKE_TIMEOUT_MS,
} from './constants';

export type GbflashDeviceFamily = 'gbflash';

export type GbflashHandshakeStage =
  | 'buffer_clear'
  | 'query_fw_info'
  | 'fw_info_header'
  | 'fw_info_extended'
  | 'unsupported';

export type GbflashHandshakeErrorCode =
  | 'unsupported'
  | 'timeout'
  | 'invalid_response';

export class GbflashHandshakeError extends Error {
  readonly stage: GbflashHandshakeStage;
  readonly code: GbflashHandshakeErrorCode;
  readonly family?: GbflashDeviceFamily;
  readonly cause?: unknown;

  constructor(
    stage: GbflashHandshakeStage,
    code: GbflashHandshakeErrorCode,
    message: string,
    options?: {
      family?: GbflashDeviceFamily;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = 'GbflashHandshakeError';
    this.stage = stage;
    this.code = code;
    this.family = options?.family;
    this.cause = options?.cause;
  }
}

export interface GbflashFirmwareInfo {
  family: GbflashDeviceFamily;
  cfwId: string;
  fwVer: number;
  pcbVer: number;
  fwTs: number;
  ofwVer: number | null;
  pcbName: string;
  cartPowerCtrl: boolean;
  cartPresenceSwitch: boolean;
  cartModeSwitch: boolean;
  bootloaderReset: boolean;
  hasDeviceSerial: boolean;
  unregistered: boolean;
  audioWePin: boolean;
  isCdc: boolean;
}

export interface GbflashHandshakeOptions {
  portInfo?: SerialPortInfo | null;
  baudRate?: number;
  timeoutMs?: number;
}

function normalizeHexId(value?: string): string {
  return value?.trim().toLowerCase().padStart(4, '0') ?? '';
}

function isSameUsbId(
  portInfo: SerialPortInfo | null | undefined,
  target: { vendorId: string; productId: string },
): boolean {
  if (!portInfo?.vendorId || !portInfo?.productId) {
    return false;
  }
  return (
    normalizeHexId(portInfo.vendorId) === target.vendorId
    && normalizeHexId(portInfo.productId) === target.productId
  );
}

async function clearBuffers(transport: Transport): Promise<void> {
  try {
    await transport.flushInput?.();
    await transport.flushOutput?.();
  } catch {
    // Best effort before handshake
  }
}

async function readExact(
  transport: Transport,
  length: number,
  timeoutMs: number,
  stage: GbflashHandshakeStage,
  family: GbflashDeviceFamily,
): Promise<Uint8Array> {
  if (length === 0) {
    return new Uint8Array(0);
  }
  try {
    const { data } = await transport.read(length, timeoutMs);
    if (data.length < length) {
      throw new GbflashHandshakeError(
        stage,
        data.length === 0 ? 'timeout' : 'invalid_response',
        `Expected ${length} bytes at ${stage}, got ${data.length}`,
        { family },
      );
    }
    return data.subarray(0, length);
  } catch (error) {
    if (error instanceof GbflashHandshakeError) {
      throw error;
    }
    throw new GbflashHandshakeError(
      stage,
      'timeout',
      `Read failed at ${stage}: ${error instanceof Error ? error.message : String(error)}`,
      { family, cause: error },
    );
  }
}

async function writeBytes(
  transport: Transport,
  bytes: readonly number[],
  timeoutMs: number,
  stage: GbflashHandshakeStage,
  family: GbflashDeviceFamily,
): Promise<void> {
  try {
    const ok = await transport.send(new Uint8Array(bytes), timeoutMs);
    if (!ok) {
      throw new GbflashHandshakeError(stage, 'timeout', `Failed to send command at ${stage}`, { family });
    }
  } catch (error) {
    if (error instanceof GbflashHandshakeError) {
      throw error;
    }
    throw new GbflashHandshakeError(
      stage,
      'timeout',
      `Send failed at ${stage}: ${error instanceof Error ? error.message : String(error)}`,
      { family, cause: error },
    );
  }
}

function decodePcbName(bytes: Uint8Array): string {
  try {
    const decoded = new TextDecoder('utf-8', { fatal: false })
      .decode(bytes)
      .replace(/\0/g, '')
      .trim();
    return decoded || 'Unnamed Device';
  } catch {
    return 'Unnamed Device';
  }
}

async function queryFirmwareInfo(
  transport: Transport,
  isCdc: boolean,
  timeoutMs: number,
): Promise<GbflashFirmwareInfo> {
  const family: GbflashDeviceFamily = 'gbflash';
  await writeBytes(transport, [GBFLASH_CMD.QUERY_FW_INFO], timeoutMs, 'query_fw_info', family);

  const sizeBytes = await readExact(transport, 1, timeoutMs, 'fw_info_header', family);
  const size = sizeBytes[0];
  if (size !== 8) {
    throw new GbflashHandshakeError(
      'fw_info_header',
      'invalid_response',
      `Invalid QUERY_FW_INFO size: expected 8, got ${size}`,
      { family },
    );
  }

  const info = await readExact(transport, 8, timeoutMs, 'fw_info_header', family);
  const cfwId = String.fromCharCode(info[0]);
  const fwVer = (info[1] << 8) | info[2];
  const pcbVer = info[3];
  const fwTs = ((info[4] << 24) | (info[5] << 16) | (info[6] << 8) | info[7]) >>> 0;

  if (cfwId !== 'L' || fwVer < DEVICE_MIN_FW) {
    throw new GbflashHandshakeError(
      'unsupported',
      'unsupported',
      `Unsupported firmware: cfwId=${cfwId}, fwVer=${fwVer}`,
      { family },
    );
  }

  let pcbName = 'GBFlash';
  let cartPowerCtrl = false;
  let cartPresenceSwitch = false;
  let cartModeSwitch = false;
  let bootloaderReset = false;
  let hasDeviceSerial = false;
  let unregistered = false;

  if (cfwId === 'L' && fwVer >= FW_VER_THRESHOLDS.EXTENDED_FW_INFO) {
    const nameLenBytes = await readExact(transport, 1, timeoutMs, 'fw_info_extended', family);
    const nameLen = nameLenBytes[0];
    if (nameLen > 0) {
      const nameBytes = await readExact(transport, nameLen, timeoutMs, 'fw_info_extended', family);
      pcbName = decodePcbName(nameBytes);
    }

    const flags1 = (await readExact(transport, 1, timeoutMs, 'fw_info_extended', family))[0];
    cartPowerCtrl = Boolean(flags1 & 0x01);
    cartPresenceSwitch = Boolean((flags1 >> 1) & 0x01);
    cartModeSwitch = Boolean((flags1 >> 2) & 0x01);

    const flags2 = (await readExact(transport, 1, timeoutMs, 'fw_info_extended', family))[0];
    bootloaderReset = Boolean(flags2 & 0x01);
    hasDeviceSerial = Boolean((flags2 >> 1) & 0x01);
    unregistered = Boolean((flags2 >> 7) & 0x01);
  }

  const audioWePin = !(pcbVer < 13 && cartPowerCtrl);

  return {
    family,
    cfwId,
    fwVer,
    pcbVer,
    fwTs,
    ofwVer: null,
    pcbName,
    cartPowerCtrl,
    cartPresenceSwitch,
    cartModeSwitch,
    bootloaderReset,
    hasDeviceSerial,
    unregistered,
    audioWePin,
    isCdc,
  };
}

export async function handshakeGbflash(
  transport: Transport,
  options: GbflashHandshakeOptions = {},
  isCdc = false,
): Promise<GbflashFirmwareInfo> {
  const timeoutMs = options.timeoutMs ?? HANDSHAKE_TIMEOUT_MS;
  await clearBuffers(transport);
  return queryFirmwareInfo(transport, isCdc, timeoutMs);
}

export async function performGbflashHandshake(
  transport: Transport,
  options: GbflashHandshakeOptions = {},
): Promise<GbflashFirmwareInfo> {
  const isCdc = isSameUsbId(options.portInfo, GBFLASH_USB_IDS.GBFLASH_CDC);
  return handshakeGbflash(transport, options, isCdc);
}

/** A single safety command that failed during teardown; the transport still closes. */
export interface GbflashTeardownFailure {
  readonly command: 'cart-power-off' | 'set-voltage-3v3';
  readonly error: unknown;
}

export interface GbflashTeardownResult {
  readonly failures: readonly GbflashTeardownFailure[];
}

async function sendSafetyCommand(
  transport: Transport,
  command: number,
  label: GbflashTeardownFailure['command'],
  ackExpected: boolean,
  timeoutMs: number,
  failures: GbflashTeardownFailure[],
): Promise<void> {
  try {
    const sent = await transport.send(new Uint8Array([command]), timeoutMs);
    if (!sent) {
      throw new Error(`GBFlash teardown command 0x${command.toString(16)} was not sent`);
    }
    if (ackExpected) {
      // A silent or negative ACK means the safety command may not have run; report it
      // instead of closing the port as if the sequence had succeeded.
      const response = await transport.read(1, timeoutMs);
      const ack = response.data[0];
      if (ack !== GBFLASH_ACK_OK) {
        throw new Error(
          `GBFlash teardown command 0x${command.toString(16)} was not acknowledged`
          + ` (got ${ack === undefined ? 'nothing' : `0x${ack.toString(16)}`})`,
        );
      }
    }
  } catch (error) {
    failures.push({ command: label, error });
  }
}

/**
 * Normative teardown: `CART_PWR_OFF` then `SET_VOLTAGE_3_3V` when the handshake
 * confirmed cartridge power control, `SET_VOLTAGE_3_3V` alone otherwise.
 *
 * A failing safety command never aborts the sequence; every failure is reported so the
 * caller can record a `disconnect` diagnostic and still close the port.
 */
export async function performGbflashTeardown(
  transport: Transport,
  fwInfo?: GbflashFirmwareInfo | null,
  timeoutMs = HANDSHAKE_TIMEOUT_MS,
): Promise<GbflashTeardownResult> {
  if (!fwInfo) {
    return { failures: [] };
  }

  const failures: GbflashTeardownFailure[] = [];
  const ackExpected = fwInfo.fwVer >= FW_VER_THRESHOLDS.COMMAND_ACK;
  if (fwInfo.cartPowerCtrl) {
    await sendSafetyCommand(transport, GBFLASH_CMD.CART_PWR_OFF, 'cart-power-off', ackExpected, timeoutMs, failures);
  }
  await sendSafetyCommand(transport, GBFLASH_CMD.SET_VOLTAGE_3_3V, 'set-voltage-3v3', ackExpected, timeoutMs, failures);
  return { failures };
}

export async function performGbflashDisconnect(
  transport: Transport,
  fwInfo?: GbflashFirmwareInfo | null,
  timeoutMs = HANDSHAKE_TIMEOUT_MS,
): Promise<void> {
  await performGbflashTeardown(transport, fwInfo, timeoutMs);
}
