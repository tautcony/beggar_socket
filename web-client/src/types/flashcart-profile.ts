import type { CFIInfo } from '@/utils/parsers/cfi-parser';

export type FlashcartType = 'AGB' | 'DMG';

export type FlashcartMode = 'GBA' | 'MBC5';

export type FlashcartWritePin = 'WR' | 'AUDIO' | 'VIN' | 'WR+RESET' | '';

export type FlashcartPlaceholder = 'SA' | 'PA' | 'PD' | 'BS' | 'WR' | 'ID' | `SA+${string}`;

export type FlashcartCommandArg = number | FlashcartPlaceholder | null;

export type FlashcartCommandStep =
  | readonly [FlashcartCommandArg, FlashcartCommandArg]
  | readonly [FlashcartCommandArg, FlashcartCommandArg, FlashcartCommandArg];

export type FlashcartWaitForTuple = readonly [
  number | FlashcartPlaceholder | null,
  number | FlashcartPlaceholder | null,
  number | null,
];

export interface FlashcartCommands {
  reset?: readonly FlashcartCommandStep[];
  read_identifier?: readonly FlashcartCommandStep[];
  read_cfi?: readonly FlashcartCommandStep[];
  single_write?: readonly FlashcartCommandStep[];
  single_write_wait_for?: readonly FlashcartWaitForTuple[];
  buffer_write?: readonly FlashcartCommandStep[];
  buffer_write_wait_for?: readonly FlashcartWaitForTuple[];
  sector_erase?: readonly FlashcartCommandStep[];
  sector_erase_wait_for?: readonly FlashcartWaitForTuple[];
  chip_erase?: readonly FlashcartCommandStep[];
  chip_erase_wait_for?: readonly FlashcartWaitForTuple[];
  unlock?: readonly FlashcartCommandStep[];
  unlock_read?: readonly FlashcartCommandStep[];
  read_status_register?: readonly FlashcartCommandStep[];
  fast_write?: readonly FlashcartCommandStep[];
  fast_write_wait_for?: readonly FlashcartWaitForTuple[];
  bank_switch?: readonly FlashcartCommandStep[];
  page_write?: readonly FlashcartCommandStep[];
  page_write_wait_for?: readonly FlashcartWaitForTuple[];
  read_hidden_sector?: readonly FlashcartCommandStep[];
  _chip_erase?: readonly FlashcartCommandStep[];
}

export type FlashcartFlatFlashId = readonly number[];
export type FlashcartNestedFlashId = readonly (number | readonly number[])[];
export type FlashcartFlashIdEntry = FlashcartFlatFlashId | FlashcartNestedFlashId;

export type FlashcartSectorSize = number | readonly (readonly [number, number])[];

export interface FlashcartGeometryException {
  expectedFlashSize: number;
  actualSectorTotal: number;
  note: string;
}

export interface FlashcartProfile {
  id: string;
  sourceFile: string;
  type: FlashcartType;
  names: readonly string[];
  voltage: number;
  command_set: string;
  commands: FlashcartCommands;
  flash_ids?: readonly FlashcartFlashIdEntry[];
  _flash_ids?: readonly FlashcartFlashIdEntry[];
  flash_ids_banks?: readonly FlashcartFlatFlashId[];
  flash_id_offsets?: readonly number[];
  flash_size?: number;
  sector_size?: FlashcartSectorSize;
  sector_size_from_cfi?: boolean;
  write_pin?: FlashcartWritePin;
  buffer_size?: number;
  chip_erase_timeout?: number;
  start_addr?: number;
  first_bank?: number;
  mbc?: number | 'manual';
  voltage_variants?: boolean;
  reset_every?: number;
  flash_commands_on_bank_1?: boolean;
  enable_pullup_wr?: boolean;
  enable_pullups?: boolean;
  wait_read_status_register?: boolean;
  flash_bank_size?: number;
  flash_bank_select_type?: number;
  status_register_mask?: number;
  status_register_value?: number;
  read_identifier_at?: number;
  set_irq_high?: boolean;
  set_audio_high?: boolean;
  'dmg-mbc5-32m-flash'?: boolean;
  'dmg-mmsa-jpn'?: boolean;
  m29w640?: boolean;
  rtc?: boolean;
  rumble?: boolean;
  double_die?: boolean;
  manual_select?: boolean;
  '3d_memory'?: boolean;
  power_cycle?: boolean;
  sintax?: boolean;
  vast_fame?: boolean;
  audio_gates_flash_write?: boolean;
  unlock_before_rom_dump?: boolean;
  hidden_sector_size?: number;
  pulse_reset_after_write?: boolean;
  geometryException?: FlashcartGeometryException;
}

export interface FlashcartCollisionEntry {
  type: FlashcartType;
  flashIdKey: string;
  sourceFiles: readonly string[];
  profileIds: readonly string[];
}

export interface FlashcartGeometryExceptionSnapshot {
  sourceFile: string;
  expectedFlashSize: number;
  actualSectorTotal: number;
  note: string;
}

export interface FlashcartIdSetEntry {
  offset: number | null;
  bytes: readonly number[];
}

export interface FlashcartProbeObservation {
  rom: Uint8Array | readonly number[];
  id: Uint8Array | readonly number[];
}

export type FlashcartMatchResult =
  | { status: 'unique'; profile: FlashcartProfile }
  | { status: 'ambiguous'; candidates: FlashcartProfile[] }
  | { status: 'none' };

export interface FlashcartCapabilityRequirements {
  audioWePin: boolean;
  cartPowerControl?: boolean;
  supportedVoltages?: readonly number[];
}

export type FlashcartValidationResult =
  | { valid: true }
  | { valid: false; errorCode: 'unsupported' | 'voltage_mismatch'; reason: string };

export type FlashcartProfileSummary = Pick<
  FlashcartProfile,
  'id' | 'sourceFile' | 'type' | 'names' | 'voltage' | 'flash_size' | 'write_pin' | 'command_set'
>;

export type FlashcartSynthesizedCfiResult = CFIInfo;
