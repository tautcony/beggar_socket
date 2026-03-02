import { Command, GBACommand, GBCCommand } from '@/protocol/beggar_socket/command';
import { createCommandPayload } from '@/protocol/beggar_socket/payload-builder';
import { getPackage, sendPackage } from '@/protocol/beggar_socket/protocol-utils';
import type { DeviceInfo } from '@/types/device-info';

export type DebugCommandType = 'GBA' | 'GBC';

export interface ExecuteDebugCommandInput {
  device: DeviceInfo;
  command: number;
  address?: number | null;
  length?: number | null;
  data?: Uint8Array | null;
  receiveLength: number;
  timeoutMs?: number;
}

export interface ExecuteDebugCommandResult {
  requestData: Uint8Array;
  responseData: Uint8Array;
}

export function getAvailableDebugCommands(type: DebugCommandType | ''): Record<string, number> {
  const commands: Record<string, number> = {};

  if (type === 'GBA') {
    Object.keys(GBACommand).forEach(key => {
      if (isNaN(Number(key))) {
        commands[key] = GBACommand[key as keyof typeof GBACommand] as number;
      }
    });
  } else if (type === 'GBC') {
    Object.keys(GBCCommand).forEach(key => {
      if (isNaN(Number(key))) {
        commands[key] = GBCCommand[key as keyof typeof GBCCommand] as number;
      }
    });
  }

  return commands;
}

export function isDuplicatedDebugCommandName(key: string): boolean {
  const gbaKeys = Object.keys(GBACommand).filter(k => isNaN(Number(k)));
  const gbcKeys = Object.keys(GBCCommand).filter(k => isNaN(Number(k)));
  const allKeys = [...gbaKeys, ...gbcKeys];
  return allKeys.filter(k => k === key).length > 1;
}

export async function executeDebugCommand(input: ExecuteDebugCommandInput): Promise<ExecuteDebugCommandResult> {
  const payloadBuilder = createCommandPayload(input.command as Command);

  if (input.address !== null && input.address !== undefined) {
    payloadBuilder.addAddress(input.address);
  }

  if (input.length !== null && input.length !== undefined) {
    payloadBuilder.addLittleEndian(input.length, 4);
  }

  if (input.data && input.data.length > 0) {
    payloadBuilder.addBytes(input.data);
  }

  const payload = payloadBuilder.build();
  await sendPackage(input.device, payload);
  const result = await getPackage(input.device, input.receiveLength, input.timeoutMs);

  if (!result.data) {
    throw new Error('No response data');
  }

  return {
    requestData: payload,
    responseData: result.data,
  };
}
