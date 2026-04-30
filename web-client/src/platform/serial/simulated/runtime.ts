import { GBACommand, GBCCommand } from '@/protocol/beggar_socket/command';
import {
  FLASH_CMD_AUTOSELECT,
  FLASH_CMD_CHIP_ERASE,
  FLASH_CMD_ERASE_SETUP,
  FLASH_CMD_RESET,
  FLASH_CMD_SECTOR_ERASE,
  FLASH_CMD_UNLOCK_1,
  FLASH_CMD_UNLOCK_2,
  GBA_FLASH_ADDR_1,
  GBA_FLASH_ADDR_2,
  GBA_RAM_FLASH_ADDR_1,
  GBA_RAM_FLASH_ADDR_2,
  GBC_FLASH_ADDR_1,
  GBC_FLASH_ADDR_2,
  PROTOCOL_ACK,
} from '@/protocol/beggar_socket/constants';
import { DebugSettings, type SimulatedMemorySlot } from '@/settings/debug-settings';
import type { SerialPortInfo } from '@/types/serial';
import { timeout } from '@/utils/async-utils';

export interface SimulatedDeviceState {
  closed: boolean;
  signals: {
    dataTerminalReady?: boolean;
    requestToSend?: boolean;
  };
  gba: SimulatedGbaState;
  gbc: SimulatedGbcState;
}

interface SimulatedGbaState {
  rom: Uint8Array;
  ram: Uint8Array;
  romControl: FlashControlState;
  ramControl: FlashControlState;
  activeSramBank: 0 | 1;
  activeFlashRamBank: 0 | 1;
  pendingRomBankRegister: number | null;
}

interface SimulatedGbcState {
  rom: Uint8Array;
  ram: Uint8Array;
  flashControl: FlashControlState;
  activeRomBank: number;
  activeRamBank: number;
  ramEnabled: boolean;
  powerMode: number;
}

interface FlashControlState {
  mode: 'normal' | 'cfi' | 'autoselect';
  recentWrites: FlashWrite[];
}

interface FlashWrite {
  address: number;
  value: number;
}

interface FlashProfile {
  cfi: Uint8Array;
  idImage: Uint8Array;
  eraseSectorSize: number;
}

interface CommandResult {
  response?: Uint8Array;
}

const DEFAULT_SIMULATED_PORT_INFO: SerialPortInfo = {
  path: 'simulated://beggar-socket',
  manufacturer: 'Beggar Socket',
  product: 'Simulated Device',
  vendorId: '0483',
  productId: '0721',
  serialNumber: 'simulated-debug',
};

const GBA_ROM_SIZE = 32 * 1024 * 1024;
const GBA_RAM_BANK_SIZE = 64 * 1024;
const GBC_ROM_SIZE = 8 * 1024 * 1024;
const GBC_RAM_BANK_SIZE = 8 * 1024;
const GBC_RAM_BANK_COUNT = 16;
const MAX_RECENT_FLASH_WRITES = 6;

const GBA_FLASH_ID = Uint8Array.from([0x01, 0x00, 0x7e, 0x22, 0x22, 0x22, 0x01, 0x22]);
const GBC_FLASH_ID = Uint8Array.from([0xc2, 0xc2, 0xc9, 0xc9]);

const GBA_FLASH_PROFILE = createFlashProfile({
  flashId: GBA_FLASH_ID,
  deviceSize: GBA_ROM_SIZE,
  bufferSize: 256,
  eraseSectorSize: 64 * 1024,
  eraseSectorCount: GBA_ROM_SIZE / (64 * 1024),
});

const GBC_FLASH_PROFILE = createFlashProfile({
  flashId: GBC_FLASH_ID,
  deviceSize: GBC_ROM_SIZE,
  bufferSize: 128,
  eraseSectorSize: 64 * 1024,
  eraseSectorCount: GBC_ROM_SIZE / (64 * 1024),
});

function createDeterministicData(size: number, seed: number): Uint8Array {
  const data = new Uint8Array(size);
  let value = seed >>> 0;

  for (let index = 0; index < size; index += 1) {
    value = (value * 1664525 + 1013904223) >>> 0;
    data[index] = value & 0xff;
  }

  return data;
}

function createCfiImage(params: {
  deviceSize: number;
  bufferSize: number;
  eraseSectorSize: number;
  eraseSectorCount: number;
}): Uint8Array {
  const image = new Uint8Array(0x100);
  image[0x20] = 0x51;
  image[0x22] = 0x52;
  image[0x24] = 0x59;
  image[0x2a] = 0x40;
  image[0x2c] = 0x00;
  image[0x36] = 0x27;
  image[0x38] = 0x36;
  image[0x3e] = 0x06;
  image[0x40] = 0x05;
  image[0x42] = 0x08;
  image[0x44] = 0x0a;
  image[0x46] = 0x02;
  image[0x48] = 0x02;
  image[0x4a] = 0x02;
  image[0x4c] = 0x02;
  image[0x4e] = Math.round(Math.log2(params.deviceSize));

  const bufferExponent = Math.round(Math.log2(params.bufferSize));
  image[0x54] = bufferExponent & 0xff;
  image[0x56] = (bufferExponent >> 8) & 0xff;
  image[0x58] = 1;

  const sectorCountMinusOne = params.eraseSectorCount - 1;
  const sectorSizeUnits = params.eraseSectorSize / 256;
  image[0x5a] = sectorCountMinusOne & 0xff;
  image[0x5c] = (sectorCountMinusOne >> 8) & 0xff;
  image[0x5e] = sectorSizeUnits & 0xff;
  image[0x60] = (sectorSizeUnits >> 8) & 0xff;

  image[0x80] = 0x50;
  image[0x82] = 0x52;
  image[0x84] = 0x49;

  return image;
}

function createFlashIdImage(flashId: Uint8Array): Uint8Array {
  const image = new Uint8Array(0x100);
  image.set(flashId.subarray(0, Math.min(4, flashId.length)), 0);

  if (flashId.length > 4) {
    image.set(flashId.subarray(4, 8), 0x1c);
  }

  return image;
}

function createFlashProfile(params: {
  flashId: Uint8Array;
  deviceSize: number;
  bufferSize: number;
  eraseSectorSize: number;
  eraseSectorCount: number;
}): FlashProfile {
  return {
    cfi: createCfiImage(params),
    idImage: createFlashIdImage(params.flashId),
    eraseSectorSize: params.eraseSectorSize,
  };
}

function createConfiguredMemory(slot: SimulatedMemorySlot, seed: number): Uint8Array {
  const definition = DebugSettings.getSimulatedMemoryDefinition(slot);
  const configured = DebugSettings.getSimulatedMemoryImage(slot);

  if (!configured) {
    return createDeterministicData(definition.capacity, seed);
  }

  const memory = new Uint8Array(definition.capacity);
  memory.fill(definition.defaultFillByte);
  memory.set(configured.data.subarray(0, definition.capacity), 0);
  return memory;
}

function cloneSerialPortInfo(portInfo: SerialPortInfo): SerialPortInfo {
  return { ...portInfo };
}

function createFlashControlState(): FlashControlState {
  return {
    mode: 'normal',
    recentWrites: [],
  };
}

function readUInt16(payload: Uint8Array, offset: number): number {
  return (payload[offset] ?? 0) | ((payload[offset + 1] ?? 0) << 8);
}

function readUInt32(payload: Uint8Array, offset: number): number {
  return (payload[offset] ?? 0)
    | ((payload[offset + 1] ?? 0) << 8)
    | ((payload[offset + 2] ?? 0) << 16)
    | ((payload[offset + 3] ?? 0) << 24);
}

function makeAckResponse(): Uint8Array {
  return Uint8Array.from([PROTOCOL_ACK]);
}

function makePayloadResponse(data: Uint8Array): Uint8Array {
  const response = new Uint8Array(data.byteLength + 2);
  response.set(data, 2);
  return response;
}

function clampSlice(source: Uint8Array, start: number, length: number): Uint8Array {
  const safeStart = Math.max(0, start);
  const end = Math.min(source.byteLength, safeStart + length);
  const result = new Uint8Array(length);
  if (safeStart < source.byteLength && end > safeStart) {
    result.set(source.subarray(safeStart, end));
  }
  return result;
}

function pushRecentWrite(control: FlashControlState, address: number, value: number): void {
  control.recentWrites.push({ address, value });
  if (control.recentWrites.length > MAX_RECENT_FLASH_WRITES) {
    control.recentWrites.shift();
  }
}

function resetFlashControl(control: FlashControlState): void {
  control.mode = 'normal';
  control.recentWrites = [];
}

function endsWithPattern(recentWrites: FlashWrite[], pattern: FlashWrite[]): boolean {
  if (recentWrites.length < pattern.length) {
    return false;
  }

  const offset = recentWrites.length - pattern.length;
  return pattern.every((entry, index) => {
    const actual = recentWrites[offset + index];
    return actual.address === entry.address && actual.value === entry.value;
  });
}

function eraseRange(memory: Uint8Array, start: number, size: number): void {
  const safeStart = Math.max(0, start);
  const safeEnd = Math.min(memory.byteLength, safeStart + size);
  memory.fill(0xff, safeStart, safeEnd);
}

function writeClamped(memory: Uint8Array, offset: number, data: Uint8Array): void {
  if (offset >= memory.byteLength) {
    return;
  }

  memory.set(data.subarray(0, memory.byteLength - offset), offset);
}

function readFlashView(
  memory: Uint8Array,
  control: FlashControlState,
  profile: FlashProfile,
  address: number,
  length: number,
): Uint8Array {
  switch (control.mode) {
    case 'cfi':
      return clampSlice(profile.cfi, address, length);
    case 'autoselect':
      return clampSlice(profile.idImage, address, length);
    case 'normal':
    default:
      return clampSlice(memory, address, length);
  }
}

function currentGbaRamOffset(state: SimulatedGbaState, address: number): number {
  return (state.activeSramBank * GBA_RAM_BANK_SIZE) + address;
}

function currentGbaFlashRamOffset(state: SimulatedGbaState, address: number): number {
  return (state.activeFlashRamBank * GBA_RAM_BANK_SIZE) + address;
}

function currentGbcRamOffset(state: SimulatedGbcState, address: number): number {
  return (state.activeRamBank * GBC_RAM_BANK_SIZE) + (address - 0xa000);
}

function currentGbcRomOffset(state: SimulatedGbcState, address: number): number {
  if (address < 0x4000) {
    return address;
  }

  const bank = Math.max(0, state.activeRomBank);
  return (bank * 0x4000) + (address - 0x4000);
}

function handleFlashControlWrite(params: {
  control: FlashControlState;
  memory: Uint8Array;
  profile: FlashProfile;
  address: number;
  value: number;
  cfiEntryAddress: number;
  unlock1Address: number;
  unlock2Address: number;
  targetAddressTransform?: (address: number) => number;
  onBankSwitch?: (bank: number) => void;
}): boolean {
  const {
    control,
    memory,
    profile,
    address,
    value,
    cfiEntryAddress,
    unlock1Address,
    unlock2Address,
    targetAddressTransform = rawAddress => rawAddress,
    onBankSwitch,
  } = params;

  if (value === 0x98 && address === cfiEntryAddress) {
    control.mode = 'cfi';
    control.recentWrites = [];
    return true;
  }

  if (value === FLASH_CMD_RESET && address === 0x00) {
    resetFlashControl(control);
    return true;
  }

  pushRecentWrite(control, address, value);

  if (endsWithPattern(control.recentWrites, [
    { address: unlock1Address, value: FLASH_CMD_UNLOCK_1 },
    { address: unlock2Address, value: FLASH_CMD_UNLOCK_2 },
    { address: unlock1Address, value: FLASH_CMD_AUTOSELECT },
  ])) {
    control.mode = 'autoselect';
    control.recentWrites = [];
    return true;
  }

  if (endsWithPattern(control.recentWrites, [
    { address: unlock1Address, value: FLASH_CMD_UNLOCK_1 },
    { address: unlock2Address, value: FLASH_CMD_UNLOCK_2 },
    { address: unlock1Address, value: 0xb0 },
  ])) {
    return true;
  }

  if (onBankSwitch && endsWithPattern(control.recentWrites, [
    { address: unlock1Address, value: FLASH_CMD_UNLOCK_1 },
    { address: unlock2Address, value: FLASH_CMD_UNLOCK_2 },
    { address: unlock1Address, value: 0xb0 },
    { address: 0x0000, value },
  ])) {
    onBankSwitch(value & 0x01);
    control.recentWrites = [];
    return true;
  }

  if (control.recentWrites.length >= 6) {
    const recent = control.recentWrites.slice(-6);
    const matchesCommonPrefix = endsWithPattern(recent, [
      { address: unlock1Address, value: FLASH_CMD_UNLOCK_1 },
      { address: unlock2Address, value: FLASH_CMD_UNLOCK_2 },
      { address: unlock1Address, value: FLASH_CMD_ERASE_SETUP },
      { address: unlock1Address, value: FLASH_CMD_UNLOCK_1 },
      { address: unlock2Address, value: FLASH_CMD_UNLOCK_2 },
      recent[5],
    ]);

    if (matchesCommonPrefix && recent[5]?.value === FLASH_CMD_SECTOR_ERASE) {
      const targetAddress = targetAddressTransform(recent[5].address);
      const sectorStart = Math.floor(targetAddress / profile.eraseSectorSize) * profile.eraseSectorSize;
      eraseRange(memory, sectorStart, profile.eraseSectorSize);
      resetFlashControl(control);
      return true;
    }

    if (matchesCommonPrefix && recent[5]?.value === FLASH_CMD_CHIP_ERASE && recent[5].address === unlock1Address) {
      eraseRange(memory, 0, memory.byteLength);
      resetFlashControl(control);
      return true;
    }
  }

  return false;
}

function handleGbaRomDirectWrite(state: SimulatedDeviceState, address: number, data: Uint8Array): void {
  const commandValue = data[0] ?? 0;

  if (handleFlashControlWrite({
    control: state.gba.romControl,
    memory: state.gba.rom,
    profile: GBA_FLASH_PROFILE,
    address,
    value: commandValue,
    cfiEntryAddress: 0x55,
    unlock1Address: GBA_FLASH_ADDR_1,
    unlock2Address: GBA_FLASH_ADDR_2,
    targetAddressTransform: rawAddress => rawAddress << 1,
  })) {
    return;
  }

  if (address === 0x800000) {
    state.gba.activeSramBank = commandValue === 0 ? 0 : 1;
    return;
  }

  writeClamped(state.gba.rom, address, data);
}

function handleGbaRamDirectWrite(state: SimulatedDeviceState, address: number, data: Uint8Array): void {
  const commandValue = data[0] ?? 0;

  if (address === 0x02) {
    state.gba.pendingRomBankRegister = commandValue;
    return;
  }

  if (address === 0x03 && commandValue === 0x40) {
    state.gba.pendingRomBankRegister = null;
    return;
  }

  if (handleFlashControlWrite({
    control: state.gba.ramControl,
    memory: state.gba.ram,
    profile: {
      ...GBA_FLASH_PROFILE,
      eraseSectorSize: GBA_RAM_BANK_SIZE,
    },
    address,
    value: commandValue,
    cfiEntryAddress: 0x55,
    unlock1Address: GBA_RAM_FLASH_ADDR_1,
    unlock2Address: GBA_RAM_FLASH_ADDR_2,
    onBankSwitch: bank => {
      state.gba.activeFlashRamBank = bank === 0 ? 0 : 1;
    },
  })) {
    return;
  }

  const offset = currentGbaRamOffset(state.gba, address);
  writeClamped(state.gba.ram, offset, data);
}

function handleGbcDirectWrite(state: SimulatedDeviceState, address: number, data: Uint8Array): void {
  const commandValue = data[0] ?? 0;

  if (handleFlashControlWrite({
    control: state.gbc.flashControl,
    memory: state.gbc.rom,
    profile: GBC_FLASH_PROFILE,
    address,
    value: commandValue,
    cfiEntryAddress: 0xaa,
    unlock1Address: GBC_FLASH_ADDR_1,
    unlock2Address: GBC_FLASH_ADDR_2,
  })) {
    return;
  }

  if (address < 0x2000) {
    state.gbc.ramEnabled = commandValue === 0x0a;
    return;
  }

  if (address >= 0x2000 && address < 0x3000) {
    const highBit = state.gbc.activeRomBank & 0x100;
    state.gbc.activeRomBank = highBit | commandValue;
    return;
  }

  if (address >= 0x3000 && address < 0x4000) {
    const lowBits = state.gbc.activeRomBank & 0xff;
    state.gbc.activeRomBank = lowBits | ((commandValue & 0x01) << 8);
    return;
  }

  if (address >= 0x4000 && address < 0x6000) {
    state.gbc.activeRamBank = commandValue & 0x0f;
    return;
  }

  if (address >= 0xa000 && address < 0xc000 && state.gbc.ramEnabled) {
    const offset = currentGbcRamOffset(state.gbc, address);
    writeClamped(state.gbc.ram, offset, data);
    return;
  }

  const offset = currentGbcRomOffset(state.gbc, address);
  writeClamped(state.gbc.rom, offset, data);
}

function readGbaRom(state: SimulatedDeviceState, address: number, size: number): Uint8Array {
  return readFlashView(state.gba.rom, state.gba.romControl, GBA_FLASH_PROFILE, address, size);
}

function readGbaRam(state: SimulatedDeviceState, address: number, size: number, flashMode = false): Uint8Array {
  if (flashMode) {
    const offset = currentGbaFlashRamOffset(state.gba, address);
    return readFlashView(state.gba.ram, state.gba.ramControl, {
      ...GBA_FLASH_PROFILE,
      eraseSectorSize: GBA_RAM_BANK_SIZE,
    }, offset, size);
  }

  const offset = currentGbaRamOffset(state.gba, address);
  return clampSlice(state.gba.ram, offset, size);
}

function readGbcMemory(state: SimulatedDeviceState, address: number, size: number): Uint8Array {
  if (address >= 0xa000 && address < 0xc000) {
    if (!state.gbc.ramEnabled) {
      return new Uint8Array(size).fill(0xff);
    }

    const offset = currentGbcRamOffset(state.gbc, address);
    return clampSlice(state.gbc.ram, offset, size);
  }

  const offset = currentGbcRomOffset(state.gbc, address);
  return readFlashView(state.gbc.rom, state.gbc.flashControl, GBC_FLASH_PROFILE, offset, size);
}

function ensureSessionOpen(state: SimulatedDeviceState): void {
  if (state.closed) {
    throw new Error('Simulated transport is closed');
  }
}

export function getSimulatedPortInfo(): SerialPortInfo {
  return cloneSerialPortInfo(DEFAULT_SIMULATED_PORT_INFO);
}

export function createSimulatedDeviceState(): SimulatedDeviceState {
  return {
    closed: false,
    signals: {
      dataTerminalReady: false,
      requestToSend: false,
    },
    gba: {
      rom: createConfiguredMemory('gbaRom', 0x51a7c3),
      ram: createConfiguredMemory('gbaRam', 0xa55a12),
      romControl: createFlashControlState(),
      ramControl: createFlashControlState(),
      activeSramBank: 0,
      activeFlashRamBank: 0,
      pendingRomBankRegister: null,
    },
    gbc: {
      rom: createConfiguredMemory('gbcRom', 0x0bc512),
      ram: createConfiguredMemory('gbcRam', 0x12cafe),
      flashControl: createFlashControlState(),
      activeRomBank: 1,
      activeRamBank: 0,
      ramEnabled: false,
      powerMode: 0,
    },
  };
}

export async function applySimulatedTransportDelay(): Promise<void> {
  const delayMs = Math.max(0, DebugSettings.simulatedDelay);
  if (delayMs > 0) {
    await timeout(delayMs);
  }
}

function calculateThroughputDelay(byteLength: number, bytesPerSecond: number): number {
  if (byteLength <= 0 || bytesPerSecond <= 0) {
    return 0;
  }

  return Math.ceil((byteLength / bytesPerSecond) * 1000);
}

export async function applySimulatedTransferDelay(kind: 'read' | 'write', byteLength: number): Promise<void> {
  const baseDelay = Math.max(0, DebugSettings.simulatedDelay);
  const bytesPerSecond = kind === 'read'
    ? DebugSettings.simulatedReadSpeed
    : DebugSettings.simulatedWriteSpeed;
  const totalDelay = baseDelay + calculateThroughputDelay(byteLength, bytesPerSecond);

  if (totalDelay > 0) {
    await timeout(totalDelay);
  }
}

export function maybeThrowSimulatedTransportError(stage: 'send' | 'read'): void {
  if (DebugSettings.shouldSimulateError()) {
    throw new Error(`Simulated transport ${stage} failure`);
  }
}

export function setSimulatedSignals(state: SimulatedDeviceState, signals: SerialOutputSignals): void {
  state.signals = {
    ...state.signals,
    ...signals,
  };
}

export function closeSimulatedDeviceState(state: SimulatedDeviceState): void {
  state.closed = true;
}

export function executeSimulatedCommand(state: SimulatedDeviceState, payload: Uint8Array): CommandResult {
  ensureSessionOpen(state);

  const command = payload[2] as GBACommand | GBCCommand | undefined;
  if (command === undefined) {
    throw new Error('Invalid simulated command payload');
  }

  switch (command) {
    case GBACommand.ERASE_CHIP:
      eraseRange(state.gba.rom, 0, state.gba.rom.byteLength);
      resetFlashControl(state.gba.romControl);
      return { response: makeAckResponse() };

    case GBACommand.PROGRAM: {
      const address = readUInt32(payload, 3);
      const data = payload.subarray(9);
      writeClamped(state.gba.rom, address, data);
      return { response: makeAckResponse() };
    }

    case GBACommand.DIRECT_WRITE: {
      const address = readUInt32(payload, 3);
      const data = payload.subarray(7);
      handleGbaRomDirectWrite(state, address, data);
      return { response: makeAckResponse() };
    }

    case GBACommand.READ: {
      const address = readUInt32(payload, 3);
      const size = readUInt16(payload, 7);
      return { response: makePayloadResponse(readGbaRom(state, address, size)) };
    }

    case GBACommand.RAM_WRITE: {
      const address = readUInt32(payload, 3);
      const data = payload.subarray(7);
      handleGbaRamDirectWrite(state, address, data);
      return { response: makeAckResponse() };
    }

    case GBACommand.RAM_READ: {
      const address = readUInt32(payload, 3);
      const size = readUInt16(payload, 7);
      return { response: makePayloadResponse(readGbaRam(state, address, size)) };
    }

    case GBACommand.RAM_WRITE_TO_FLASH: {
      const address = readUInt32(payload, 3);
      const data = payload.subarray(7);
      const offset = currentGbaFlashRamOffset(state.gba, address);
      writeClamped(state.gba.ram, offset, data);
      return { response: makeAckResponse() };
    }

    case GBACommand.FRAM_WRITE: {
      const address = readUInt32(payload, 3);
      const data = payload.subarray(8);
      const offset = currentGbaRamOffset(state.gba, address);
      state.gba.ram.set(data, Math.min(offset, state.gba.ram.byteLength));
      return { response: makeAckResponse() };
    }

    case GBACommand.FRAM_READ: {
      const address = readUInt32(payload, 3);
      const size = readUInt16(payload, 7);
      return { response: makePayloadResponse(readGbaRam(state, address, size)) };
    }

    case GBCCommand.CART_POWER:
      state.gbc.powerMode = payload[3] ?? 0;
      return {};

    case GBCCommand.CART_PHI_DIV:
      return {};

    case GBCCommand.DIRECT_WRITE: {
      const address = readUInt32(payload, 3);
      const data = payload.subarray(7);
      handleGbcDirectWrite(state, address, data);
      return { response: makeAckResponse() };
    }

    case GBCCommand.READ: {
      const address = readUInt32(payload, 3);
      const size = readUInt16(payload, 7);
      return { response: makePayloadResponse(readGbcMemory(state, address, size)) };
    }

    case GBCCommand.ROM_PROGRAM: {
      const address = readUInt32(payload, 3);
      const data = payload.subarray(9);
      const romOffset = currentGbcRomOffset(state.gbc, address);
      writeClamped(state.gbc.rom, romOffset, data);
      return { response: makeAckResponse() };
    }

    case GBCCommand.FRAM_WRITE: {
      const address = readUInt32(payload, 3);
      const data = payload.subarray(8);
      if (address >= 0xa000 && address < 0xc000) {
        const offset = currentGbcRamOffset(state.gbc, address);
        writeClamped(state.gbc.ram, offset, data);
      }
      return { response: makeAckResponse() };
    }

    case GBCCommand.FRAM_READ: {
      const address = readUInt32(payload, 3);
      const size = readUInt16(payload, 7);
      return { response: makePayloadResponse(readGbcMemory(state, address, size)) };
    }

    default:
      throw new Error(`Unsupported simulated command: 0x${command.toString(16)}`);
  }
}
