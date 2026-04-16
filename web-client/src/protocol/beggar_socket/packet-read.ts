import { formatHex } from '@/utils/formatter-utils';

import { getPackage, sendAndReceivePackage, type ProtocolTransportInput } from './protocol-utils';

export type ProtocolPacketReadErrorCode = 'PACKET_TIMEOUT' | 'LENGTH_MISMATCH' | 'TRANSPORT_FAILURE';
type PacketReadFailureReason = 'timeout' | 'transport' | 'length';

interface ErrorWithCode {
  code: string;
}

function hasErrorCode(error: unknown): error is ErrorWithCode {
  return Boolean(error && typeof error === 'object' && 'code' in error && typeof error.code === 'string');
}

export class ProtocolPacketReadError extends Error {
  readonly code: ProtocolPacketReadErrorCode;
  readonly detail: string;
  readonly cause?: unknown;

  constructor(code: ProtocolPacketReadErrorCode, message: string, detail: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'ProtocolPacketReadError';
    this.code = code;
    this.detail = detail;
    this.cause = options?.cause;
  }
}

function getFailureReason(error: unknown): PacketReadFailureReason {
  if (hasErrorCode(error)) {
    if (error.code === 'PACKET_TIMEOUT') return 'timeout';
    if (error.code === 'LENGTH_MISMATCH') return 'length';
    if (error.code === 'TRANSPORT_FAILURE') return 'transport';
  }
  if (!(error instanceof Error)) return 'transport';
  if (error.message.toLowerCase().includes('timeout')) return 'timeout';
  if (error.message.toLowerCase().includes('expected size')) return 'length';
  if (error.message.toLowerCase().includes('incomplete package read')) return 'length';
  return 'transport';
}

function getFailureDetail(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  return error.message;
}

function readPayloadData(response: { data: Uint8Array }, expectedLength: number): Uint8Array {
  const actualLength = response.data?.byteLength ?? 0;
  if (!response.data || actualLength < expectedLength) {
    throw new Error(`Expected size: ${expectedLength}, Actual size: ${actualLength}`);
  }

  return response.data.slice(2);
}

async function executeProtocolPayloadRead(
  readPacket: () => Promise<{ data: Uint8Array }>,
  commandName: string,
  size: number,
  baseAddress: number,
): Promise<Uint8Array> {
  const expectedLength = size + 2;

  try {
    const response = await readPacket();
    return readPayloadData(response, expectedLength);
  } catch (error) {
    const reason = getFailureReason(error);
    const detail = getFailureDetail(error);
    const prefix = `${commandName} failed (Address: ${formatHex(baseAddress, 4)})`;
    if (reason === 'timeout') {
      throw new ProtocolPacketReadError(
        'PACKET_TIMEOUT',
        `${prefix}, Reason: packet read timeout, Detail: ${detail}`,
        detail,
        { cause: error },
      );
    }
    if (reason === 'length') {
      throw new ProtocolPacketReadError(
        'LENGTH_MISMATCH',
        `${prefix}, Reason: invalid packet length, Detail: ${detail}`,
        detail,
        { cause: error },
      );
    }
    throw new ProtocolPacketReadError(
      'TRANSPORT_FAILURE',
      `${prefix}, Reason: packet read transport error, Detail: ${detail}`,
      detail,
      { cause: error },
    );
  }
}

export async function readProtocolPayload(
  input: ProtocolTransportInput,
  commandName: string,
  size: number,
  baseAddress: number,
  timeoutMs?: number,
): Promise<Uint8Array> {
  return executeProtocolPayloadRead(
    () => getPackage(input, size + 2, timeoutMs),
    commandName,
    size,
    baseAddress,
  );
}

export async function sendAndReadProtocolPayload(
  input: ProtocolTransportInput,
  payload: Uint8Array,
  commandName: string,
  size: number,
  baseAddress: number,
  sendTimeoutMs?: number,
  readTimeoutMs?: number,
): Promise<Uint8Array> {
  return executeProtocolPayloadRead(
    () => sendAndReceivePackage(input, payload, size + 2, sendTimeoutMs, readTimeoutMs),
    commandName,
    size,
    baseAddress,
  );
}
