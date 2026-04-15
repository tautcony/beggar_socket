import { formatHex } from '@/utils/formatter-utils';

import { getPackage, type ProtocolTransportInput } from './protocol-utils';

type PacketReadFailureReason = 'timeout' | 'transport' | 'length';

function getFailureReason(error: unknown): PacketReadFailureReason {
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

export async function readProtocolPayload(
  input: ProtocolTransportInput,
  commandName: string,
  size: number,
  baseAddress: number,
  timeoutMs?: number,
): Promise<Uint8Array> {
  const expectedLength = size + 2;

  try {
    const response = await getPackage(input, expectedLength, timeoutMs);
    const actualLength = response.data?.byteLength ?? 0;
    if (!response.data || actualLength < expectedLength) {
      throw new Error(`Expected size: ${expectedLength}, Actual size: ${actualLength}`);
    }
    return response.data.slice(2);
  } catch (error) {
    const reason = getFailureReason(error);
    const detail = getFailureDetail(error);
    const prefix = `${commandName} failed (Address: ${formatHex(baseAddress, 4)})`;
    if (reason === 'timeout') {
      throw new Error(`${prefix}, Reason: packet read timeout, Detail: ${detail}`);
    }
    if (reason === 'length') {
      throw new Error(`${prefix}, Reason: invalid packet length, Detail: ${detail}`);
    }
    throw new Error(`${prefix}, Reason: packet read transport error, Detail: ${detail}`);
  }
}
