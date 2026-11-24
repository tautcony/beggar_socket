import {
  loadFlashcartProfilesByMode,
  loadFlashcartProfilesByType,
  modeToFlashcartType,
} from '@/data/flashcart-profiles';
import type {
  FlashcartCapabilityRequirements,
  FlashcartIdSetEntry,
  FlashcartMatchResult,
  FlashcartMode,
  FlashcartProbeObservation,
  FlashcartProfile,
  FlashcartProfileSummary,
  FlashcartType,
  FlashcartValidationResult,
} from '@/types/flashcart-profile';
import type { CFIInfo, SectorBlock } from '@/utils/parsers/cfi-parser';

function arraysEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function buildSectorBlocks(profile: FlashcartProfile): SectorBlock[] {
  const { sector_size: sectorSize, flash_size: flashSize } = profile;
  if (Array.isArray(sectorSize)) {
    const blocks: SectorBlock[] = [];
    let cursor = 0;
    for (const [size, count] of sectorSize) {
      const totalSize = size * count;
      blocks.push({
        sectorSize: size,
        sectorCount: count,
        totalSize,
        startAddress: cursor,
        endAddress: cursor + totalSize - 1,
      });
      cursor += totalSize;
    }
    return blocks;
  }
  if (typeof sectorSize === 'number' && sectorSize > 0) {
    const totalSize = typeof flashSize === 'number' && flashSize > 0
      ? Math.ceil(flashSize / sectorSize) * sectorSize
      : sectorSize;
    const sectorCount = Math.max(1, Math.ceil(totalSize / sectorSize));
    return [{
      sectorSize,
      sectorCount,
      totalSize: sectorSize * sectorCount,
      startAddress: 0,
      endAddress: sectorSize * sectorCount - 1,
    }];
  }
  return [];
}

function isObservationMap(
  value: FlashcartProbeObservation | ReadonlyMap<number | null, FlashcartProbeObservation>,
): value is ReadonlyMap<number | null, FlashcartProbeObservation> {
  return value instanceof Map;
}

export class FlashcartProfileService {
  static async loadByMode(mode: FlashcartMode): Promise<readonly FlashcartProfile[]> {
    return loadFlashcartProfilesByMode(mode);
  }

  static async loadByType(type: FlashcartType): Promise<readonly FlashcartProfile[]> {
    return loadFlashcartProfilesByType(type);
  }

  static filterByMode(
    profiles: readonly FlashcartProfile[],
    mode: FlashcartMode,
  ): FlashcartProfile[] {
    const expectedType = modeToFlashcartType(mode);
    return profiles.filter(profile => profile.type === expectedType);
  }

  static getFlashIdSets(profile: FlashcartProfile): FlashcartIdSetEntry[][] {
    const result: FlashcartIdSetEntry[][] = [];
    for (const entry of profile.flash_ids ?? []) {
      if (entry.length > 1 && Array.isArray(entry[1])) {
        const group: FlashcartIdSetEntry[] = [];
        for (let i = 0; i < entry.length; i += 2) {
          group.push({
            offset: entry[i] as number,
            bytes: entry[i + 1] as readonly number[],
          });
        }
        result.push(group);
      } else {
        result.push([{
          offset: null,
          bytes: entry as readonly number[],
        }]);
      }
    }
    return result;
  }

  static extractFlashIdBytes(
    buffer: Uint8Array | readonly number[],
    length: number,
    profile: FlashcartProfile,
  ): number[] {
    if (length <= 0) {
      return [];
    }
    const offsets = profile.flash_id_offsets
      ? profile.flash_id_offsets.slice(0, length)
      : Array.from({ length }, (_, index) => index);

    if (offsets.length !== length) {
      return [];
    }
    const extracted: number[] = [];
    for (const offset of offsets) {
      if (!Number.isInteger(offset) || offset < 0 || offset >= buffer.length) {
        return [];
      }
      extracted.push(buffer[offset]);
    }
    return extracted;
  }

  static matchesObservation(
    profile: FlashcartProfile,
    observation:
      | FlashcartProbeObservation
      | ReadonlyMap<number | null, FlashcartProbeObservation>,
    options: { allowManualSelect?: boolean } = {},
  ): boolean {
    if (!options.allowManualSelect && profile.manual_select === true) {
      return false;
    }
    const idSets = FlashcartProfileService.getFlashIdSets(profile);
    if (idSets.length === 0) {
      return false;
    }

    const resolveObservation = (offset: number | null): FlashcartProbeObservation | undefined => {
      if (isObservationMap(observation)) {
        return observation.get(offset);
      }
      return offset === null ? observation : undefined;
    };

    for (const group of idSets) {
      let allMatched = true;
      for (const { offset, bytes: expected } of group) {
        if (expected.length === 0) {
          allMatched = false;
          break;
        }
        const obs = resolveObservation(offset);
        if (!obs) {
          allMatched = false;
          break;
        }
        const idBytes = FlashcartProfileService.extractFlashIdBytes(obs.id, expected.length, profile);
        const romBytes = FlashcartProfileService.extractFlashIdBytes(obs.rom, expected.length, profile);
        if (
          idBytes.length !== expected.length
          || romBytes.length !== expected.length
          || !arraysEqual(idBytes, expected)
          || arraysEqual(idBytes, romBytes)
        ) {
          allMatched = false;
          break;
        }
      }
      if (allMatched) {
        return true;
      }
    }
    return false;
  }

  static matchFlashId(
    profiles: readonly FlashcartProfile[],
    observation:
      | FlashcartProbeObservation
      | ReadonlyMap<number | null, FlashcartProbeObservation>,
    options: { deviceSize?: number } = {},
  ): FlashcartMatchResult {
    let candidates = profiles.filter(profile =>
      FlashcartProfileService.matchesObservation(profile, observation),
    );
    if (candidates.length > 1 && options.deviceSize && options.deviceSize > 0) {
      const sized = candidates.filter(profile => profile.flash_size === options.deviceSize);
      if (sized.length > 0) {
        candidates = sized;
      }
    }
    if (candidates.length === 0) {
      return { status: 'none' };
    }
    if (candidates.length === 1) {
      return { status: 'unique', profile: candidates[0] };
    }
    return { status: 'ambiguous', candidates };
  }

  static synthesizeCfiInfo(
    profile: FlashcartProfile,
    observedFlashId?: Uint8Array | readonly number[],
  ): CFIInfo {
    const eraseSectorBlocks = buildSectorBlocks(profile);
    const blockTotal = eraseSectorBlocks.reduce((sum, block) => sum + block.totalSize, 0);
    const deviceSize = profile.flash_size ?? blockTotal;
    const rawId = observedFlashId ?? FlashcartProfileService.getFlashIdSets(profile)[0]?.[0]?.bytes ?? [];
    const flashId = rawId instanceof Uint8Array ? rawId : Uint8Array.from(rawId);
    const isIntel = profile.command_set.toUpperCase() === 'INTEL'
      || profile.commands.read_identifier?.[0]?.[1] === 0x90;
    const singleWrite = Boolean(profile.commands.single_write?.length);
    const bufferWrite = Boolean(profile.commands.buffer_write?.length && profile.buffer_size);
    const sectorErase = Boolean(profile.commands.sector_erase?.length);
    const chipErase = Boolean(profile.commands.chip_erase?.length);
    const vddMin = profile.voltage === 5 ? 4.5 : 2.7;
    const vddMax = profile.voltage === 5 ? 5.5 : 3.6;
    const sizeMiB = deviceSize > 0 ? `${(deviceSize / (1024 * 1024)).toFixed(2)} MiB` : 'Unknown size';

    return {
      flashId,
      magic: '',
      dataSwap: null,
      cfiDetected: false,
      isSwapD0D1: false,
      isIntel,
      vddMin,
      vddMax,
      singleWrite,
      bufferWrite,
      bufferSize: profile.buffer_size,
      sectorErase,
      chipErase,
      tbBootSector: false,
      tbBootSectorRaw: 0,
      deviceSize,
      eraseSectorRegions: eraseSectorBlocks.length,
      eraseSectorBlocks,
      reverseSectorRegion: false,
      info: `${profile.names[0]} (${profile.command_set}, ${profile.voltage}V, ${sizeMiB})`,
    };
  }

  static validateCapabilities(
    profile: FlashcartProfile,
    capabilities: FlashcartCapabilityRequirements,
  ): FlashcartValidationResult {
    const writePin = profile.write_pin ?? 'WR';
    if ((writePin === 'AUDIO' || writePin === 'VIN') && !capabilities.audioWePin) {
      return {
        valid: false,
        errorCode: 'unsupported',
        reason: `Profile "${profile.names[0]}" requires write_pin="${writePin}", which is not supported by the connected device (audioWePin=false).`,
      };
    }

    if (capabilities.supportedVoltages && !capabilities.supportedVoltages.includes(profile.voltage)) {
      return {
        valid: false,
        errorCode: 'voltage_mismatch',
        reason: `Profile "${profile.names[0]}" requires ${profile.voltage}V, but device supports [${capabilities.supportedVoltages.join(', ')}]V.`,
      };
    }

    if (!capabilities.supportedVoltages && profile.voltage === 5 && capabilities.cartPowerControl === false) {
      return {
        valid: false,
        errorCode: 'voltage_mismatch',
        reason: `Profile "${profile.names[0]}" requires 5V, but the connected device cannot control cartridge power.`,
      };
    }

    return { valid: true };
  }

  static toSummary(profile: FlashcartProfile): FlashcartProfileSummary {
    return {
      id: profile.id,
      sourceFile: profile.sourceFile,
      type: profile.type,
      names: profile.names,
      voltage: profile.voltage,
      flash_size: profile.flash_size,
      write_pin: profile.write_pin,
      command_set: profile.command_set,
    };
  }
}
