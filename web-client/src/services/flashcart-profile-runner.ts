/**
 * Shared FlashcartProfile command resolution, LK_Device.py auto-probing,
 * and erase/write/reset execution for GBFlash adapters.
 * Derived from FlashGBX (GPL-3.0) LK_Device.py & Flashcart.py.
 */
import {
  FLASH_COMMAND_SET,
  FLASH_METHOD,
  FLASH_WE_PIN,
  FW_VER_THRESHOLDS,
  type GbflashCartMode,
  type GbflashCommandClient,
  throwIfAborted,
} from '@/protocol';
import type {
  FlashcartCommandArg,
  FlashcartCommandStep,
  FlashcartMatchResult,
  FlashcartMode,
  FlashcartProfile,
  FlashcartWaitForTuple,
  FlashcartWritePin,
} from '@/types/flashcart-profile';
import { parseCFI } from '@/utils/parsers/cfi-parser';

import { FlashcartProfileService } from './flashcart-profile-service';

export interface ProfileCommandContext {
  sa?: number;
  pa?: number;
  pd?: number;
  bs?: number;
}

export interface ProfileProbeOutcome {
  match: FlashcartMatchResult;
  observedId?: Uint8Array;
}

export function resolveProfileArg(
  arg: FlashcartCommandArg,
  ctx: ProfileCommandContext = {},
): number {
  if (typeof arg === 'number') {
    return arg;
  }
  if (arg === 'SA') {
    return ctx.sa ?? 0;
  }
  if (arg === 'PA') {
    return ctx.pa ?? 0;
  }
  if (arg === 'PD') {
    return ctx.pd ?? 0;
  }
  if (arg === 'BS') {
    return ctx.bs ?? 0;
  }
  if (typeof arg === 'string' && arg.startsWith('SA+')) {
    const offsetStr = arg.slice(3).trim();
    const offset = offsetStr.startsWith('0x') || offsetStr.startsWith('0X')
      ? Number.parseInt(offsetStr, 16)
      : Number.parseInt(offsetStr, 10);
    return (ctx.sa ?? 0) + (Number.isFinite(offset) ? offset : 0);
  }
  return 0;
}

export function resolveProfileCommands(
  steps: readonly FlashcartCommandStep[] | undefined,
  ctx: ProfileCommandContext = {},
): [number, number][] {
  if (!steps || steps.length === 0) {
    return [];
  }
  return steps.map(([addr, val]) => [
    resolveProfileArg(addr, ctx),
    resolveProfileArg(val, ctx),
  ]);
}

export function resolveProfileWePin(
  writePin: FlashcartWritePin | undefined,
  mode: GbflashCartMode,
): number {
  switch (writePin) {
    case 'AUDIO':
    case 'VIN':
      return FLASH_WE_PIN.AUDIO;
    case 'WR+RESET':
      return FLASH_WE_PIN.WR_RESET;
    case 'WR':
      return FLASH_WE_PIN.WR;
    default:
      return mode === 'DMG' ? FLASH_WE_PIN.WR : FLASH_WE_PIN.UNSET;
  }
}

export async function executeProfileSteps(
  client: GbflashCommandClient,
  mode: GbflashCartMode,
  steps: readonly FlashcartCommandStep[] | undefined,
  ctx: ProfileCommandContext = {},
): Promise<void> {
  const cmds = resolveProfileCommands(steps, ctx);
  if (cmds.length > 0) {
    await client.cartWriteFlash(mode, cmds, true);
  }
}

export async function resetProfileFlash(
  client: GbflashCommandClient,
  mode: GbflashCartMode,
  profile?: FlashcartProfile | null,
): Promise<void> {
  const resetCmds = resolveProfileCommands(profile?.commands.reset);
  if (resetCmds.length > 0) {
    await client.cartWriteFlash(mode, resetCmds, true);
  } else {
    await client.cartWrite(mode, 0x00, 0xF0, { flashcart: true });
  }
}

export async function unlockProfileFlash(
  client: GbflashCommandClient,
  mode: GbflashCartMode,
  profile?: FlashcartProfile | null,
): Promise<void> {
  if (profile?.commands.unlock_read?.length) {
    for (const [addr] of profile.commands.unlock_read) {
      await client.cartRead(mode, resolveProfileArg(addr));
    }
  }
  if (profile?.commands.unlock?.length) {
    await executeProfileSteps(client, mode, profile.commands.unlock);
  }
}

function waitMs(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  if (!signal) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  return new Promise((resolve, reject) => {
    let onAbort: () => void = () => undefined;
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Operation cancelled by user'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export async function waitForProfileFlash(
  client: GbflashCommandClient,
  mode: GbflashCartMode,
  defaultAddress: number,
  waitFor: readonly FlashcartWaitForTuple[] | undefined,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<void> {
  const activeTuple = waitFor?.find(
    ([addr, mask, expected]) => addr !== null && mask !== null && expected !== null,
  );
  const pollAddress = activeTuple
    ? resolveProfileArg(activeTuple[0], { sa: defaultAddress })
    : defaultAddress;
  const mask = activeTuple && typeof activeTuple[1] === 'number' ? activeTuple[1] : null;
  const expected = activeTuple && typeof activeTuple[2] === 'number' ? activeTuple[2] : null;
  const readyWord = mode === 'AGB' ? 0xFFFF : 0xFF;

  const deadline = Date.now() + timeoutMs;
  throwIfAborted(signal);
  let prev = await client.cartRead(mode, pollAddress);
  while (Date.now() < deadline) {
    throwIfAborted(signal);
    if (mask !== null && expected !== null) {
      if ((prev & mask) === (expected & mask)) {
        return;
      }
    } else if (prev === readyWord) {
      return;
    }
    await waitMs(10, signal).catch(() => {
      throwIfAborted(signal);
    });
    throwIfAborted(signal);
    const curr = await client.cartRead(mode, pollAddress);
    if (mask === null && curr === prev && curr === readyWord) {
      return;
    }
    prev = curr;
  }
  throw new Error(`${mode} flash operation timeout at 0x${pollAddress.toString(16)}`);
}

function resolveProfileCommandSet(commandSet?: string): number {
  const normalized = commandSet?.toUpperCase();
  if (normalized === 'AMD') {
    return FLASH_COMMAND_SET.AMD;
  }
  if (normalized === 'INTEL' || normalized === 'SHARP') {
    return FLASH_COMMAND_SET.INTEL;
  }
  return FLASH_COMMAND_SET.NONE;
}

export async function configureProfileWriteCommand(
  client: GbflashCommandClient,
  mode: GbflashCartMode,
  profile: FlashcartProfile,
): Promise<number> {
  const commandSet = resolveProfileCommandSet(profile.command_set);
  const wePin = resolveProfileWePin(profile.write_pin, mode);
  const flashBufferSize = profile.commands.buffer_write?.length && profile.buffer_size
    ? profile.buffer_size
    : 0;

  if (flashBufferSize > 0 && profile.commands.buffer_write?.length) {
    await client.setFlashCmd(
      mode,
      commandSet,
      FLASH_METHOD.BUFFERED,
      wePin,
      resolveProfileCommands(profile.commands.buffer_write),
    );
  } else if (profile.commands.single_write?.length) {
    await client.setFlashCmd(
      mode,
      commandSet,
      FLASH_METHOD.UNBUFFERED,
      wePin,
      resolveProfileCommands(profile.commands.single_write),
    );
  } else {
    const fallbackCmds: [number, number][] = mode === 'AGB'
      ? [[0xAAA, 0xAA], [0x555, 0x55], [0xAAA, 0xA0]]
      : [[0x555, 0xAA], [0x2AA, 0x55], [0x555, 0xA0]];
    await client.setFlashCmd(mode, commandSet, FLASH_METHOD.UNBUFFERED, wePin, fallbackCmds);
  }

  if (client.fwInfo.fwVer >= 5) {
    await client.setVariable('FLASH_DOUBLE_DIE', profile.double_die ? 1 : 0);
  }
  await client.setVariable('FLASH_PULSE_RESET', profile.pulse_reset_after_write ? 1 : 0);
  if (client.fwInfo.fwVer >= FW_VER_THRESHOLDS.COMMAND_ACK) {
    if (profile.status_register_mask !== undefined) {
      await client.setVariable('STATUS_REGISTER_MASK', profile.status_register_mask);
    }
    if (profile.status_register_value !== undefined) {
      await client.setVariable('STATUS_REGISTER_VALUE', profile.status_register_value);
    }
    await client.setVariable('AGB_IRQ_ENABLED', profile.set_irq_high ? 1 : 0);
  }
  if (client.fwInfo.fwVer >= FW_VER_THRESHOLDS.DMG_AUDIO_ENABLED) {
    await client.setVariable('DMG_AUDIO_ENABLED', profile.set_audio_high ? 1 : 0);
  }

  return flashBufferSize;
}

function getRequiredIdLength(profile: FlashcartProfile): number {
  const sets = FlashcartProfileService.getFlashIdSets(profile);
  const maxIdLen = sets.reduce(
    (max, group) => Math.max(max, ...group.map(entry => entry.bytes.length)),
    0,
  );
  const maxOffset = profile.flash_id_offsets?.length
    ? Math.max(...profile.flash_id_offsets) + 1
    : 0;
  return Math.max(8, maxIdLen, maxOffset);
}

function isSpecialCaseProfile(profile: FlashcartProfile, mode: GbflashCartMode): boolean {
  if (profile.m29w640) {
    return true;
  }
  if (mode === 'DMG') {
    return (
      profile.command_set === 'BLAZE_XPLODER'
      || profile.command_set === 'DATEL_ORBITV2'
      || profile.command_set === 'GBMEMORY'
      || Boolean(profile['dmg-mbc5-32m-flash'])
      || profile.command_set === 'BUNG_16M'
    );
  }
  return profile.command_set === 'GBAMP';
}

async function trySpecialCaseProbe(
  client: GbflashCommandClient,
  mode: GbflashCartMode,
  profile: FlashcartProfile,
): Promise<Uint8Array | null> {
  if (profile.m29w640 && profile.commands.read_identifier?.length) {
    try {
      await resetProfileFlash(client, mode, profile);
      const baseline = await client.readRom(mode, 0, 8, { maxLength: 8 });
      await executeProfileSteps(client, mode, profile.commands.read_identifier);
      const id = await client.readRom(mode, 0, 8, { maxLength: 8 });
      await resetProfileFlash(client, mode, profile);
      if (FlashcartProfileService.matchesObservation(profile, { rom: baseline, id })) {
        if (profile.commands.read_cfi?.length) {
          await executeProfileSteps(client, mode, profile.commands.read_cfi);
          const cfiRaw = await client.readRom(mode, 0, 0x400, { maxLength: 0x400 });
          await resetProfileFlash(client, mode, profile);
          const cfi = parseCFI(cfiRaw);
          if (!cfi || cfi.deviceSize !== 0x800000) {
            return null;
          }
        }
        return id;
      }
    } finally {
      await resetProfileFlash(client, mode, profile).catch(() => undefined);
    }
    return null;
  }

  if (mode === 'DMG' && profile.command_set === 'BLAZE_XPLODER' && profile.commands.read_identifier?.length) {
    try {
      await client.cartRead('DMG', 0x102);
      await client.cartWrite('DMG', 6, 1);
      await resetProfileFlash(client, 'DMG', profile);
      await client.cartWrite('DMG', 6, 0);
      const baseline = await client.readRom('DMG', 0x4000, 8, { maxLength: 8 });
      await client.cartWrite('DMG', 6, 1);
      await executeProfileSteps(client, 'DMG', profile.commands.read_identifier);
      const id = await client.readRom('DMG', 0x4000, 8, { maxLength: 8 });
      if (FlashcartProfileService.matchesObservation(profile, { rom: baseline, id })) {
        return id;
      }
    } finally {
      await resetProfileFlash(client, 'DMG', profile).catch(() => undefined);
    }
    return null;
  }

  if (mode === 'DMG' && profile.command_set === 'DATEL_ORBITV2' && profile.commands.read_identifier?.length) {
    const addr = profile.read_identifier_at ?? 0;
    try {
      const baseline = await client.readRom('DMG', addr, 10, { maxLength: 10 });
      await unlockProfileFlash(client, 'DMG', profile);
      await executeProfileSteps(client, 'DMG', profile.commands.read_identifier);
      const id = await client.readRom('DMG', addr, 10, { maxLength: 10 });
      if (FlashcartProfileService.matchesObservation(profile, { rom: baseline, id })) {
        return id;
      }
    } finally {
      await resetProfileFlash(client, 'DMG', profile).catch(() => undefined);
    }
    return null;
  }

  if (mode === 'DMG' && profile.command_set === 'GBMEMORY' && profile.commands.read_identifier?.length) {
    try {
      const baseline = await client.readRom('DMG', 0, 8, { maxLength: 8 });
      await unlockProfileFlash(client, 'DMG', profile);
      await executeProfileSteps(client, 'DMG', profile.commands.read_identifier);
      const id = await client.readRom('DMG', 0, 8, { maxLength: 8 });
      if (FlashcartProfileService.matchesObservation(profile, { rom: baseline, id })) {
        return id;
      }
    } finally {
      await resetProfileFlash(client, 'DMG', profile).catch(() => undefined);
    }
    return null;
  }

  if (mode === 'DMG' && profile['dmg-mbc5-32m-flash'] && client.fwInfo.audioWePin && profile.commands.read_identifier?.length) {
    const usesAudioHigh = profile.set_audio_high === true && client.fwInfo.fwVer >= FW_VER_THRESHOLDS.DMG_AUDIO_ENABLED;
    try {
      if (usesAudioHigh) {
        await client.setVariable('FLASH_WE_PIN', FLASH_WE_PIN.WR);
        await client.setVariable('DMG_AUDIO_ENABLED', 1);
      } else {
        await client.setVariable('FLASH_WE_PIN', FLASH_WE_PIN.AUDIO);
      }
      const len = getRequiredIdLength(profile);
      const addr = profile.read_identifier_at ?? 0;
      const baseline = await client.readRom('DMG', addr, len, { maxLength: len });
      await executeProfileSteps(client, 'DMG', profile.commands.read_identifier);
      const id = await client.readRom('DMG', addr, len, { maxLength: len });
      if (FlashcartProfileService.matchesObservation(profile, { rom: baseline, id })) {
        return id;
      }
    } finally {
      if (usesAudioHigh) {
        await client.setVariable('DMG_AUDIO_ENABLED', 0).catch(() => undefined);
      }
      await resetProfileFlash(client, 'DMG', profile).catch(() => undefined);
      await client.cartWriteFlash('DMG', [[0, 0xFF], [0, 0xF0]], true).catch(() => undefined);
      await client.setVariable('FLASH_WE_PIN', FLASH_WE_PIN.WR).catch(() => undefined);
    }
    return null;
  }

  if (mode === 'AGB' && profile.command_set === 'GBAMP' && profile.commands.read_identifier?.length) {
    try {
      const b1 = await client.readRom('AGB', 0x1E8F << 1, 2, { maxLength: 2 });
      const b2 = await client.readRom('AGB', 0x168F << 1, 2, { maxLength: 2 });
      const baseline = new Uint8Array([b1[0], b1[1], b2[0], b2[1]]);
      await unlockProfileFlash(client, 'AGB', profile);
      await executeProfileSteps(client, 'AGB', profile.commands.read_identifier);
      const i1 = await client.readRom('AGB', 0x1E8F << 1, 2, { maxLength: 2 });
      const i2 = await client.readRom('AGB', 0x168F << 1, 2, { maxLength: 2 });
      const id = new Uint8Array([i1[0], i1[1], i2[0], i2[1]]);
      if (FlashcartProfileService.matchesObservation(profile, { rom: baseline, id })) {
        return id;
      }
    } finally {
      await resetProfileFlash(client, 'AGB', profile).catch(() => undefined);
    }
    return null;
  }

  if (mode === 'DMG' && profile.command_set === 'BUNG_16M' && client.fwInfo.audioWePin) {
    try {
      await client.setVariable('FLASH_WE_PIN', FLASH_WE_PIN.AUDIO);
      const baseline = await client.readRom('DMG', 0, 4, { maxLength: 4 });
      await client.cartWrite('DMG', 0x2000, 0x02, { flashcart: false });
      await client.cartWrite('DMG', 0x6AAA, 0xAA, { flashcart: true });
      await client.cartWrite('DMG', 0x2000, 0x01, { flashcart: false });
      await client.cartWrite('DMG', 0x5554, 0x55, { flashcart: true });
      await client.cartWrite('DMG', 0x2000, 0x02, { flashcart: false });
      await client.cartWrite('DMG', 0x6AAA, 0x90, { flashcart: true });
      const id = await client.readRom('DMG', 0, 4, { maxLength: 4 });
      if (FlashcartProfileService.matchesObservation(profile, { rom: baseline, id })) {
        return id;
      }
    } finally {
      await client.cartWrite('DMG', 0x2000, 0x02, { flashcart: false }).catch(() => undefined);
      await client.cartWrite('DMG', 0x6AAA, 0xAA, { flashcart: true }).catch(() => undefined);
      await client.cartWrite('DMG', 0x2000, 0x01, { flashcart: false }).catch(() => undefined);
      await client.cartWrite('DMG', 0x5554, 0x55, { flashcart: true }).catch(() => undefined);
      await client.cartWrite('DMG', 0x2000, 0x02, { flashcart: false }).catch(() => undefined);
      await client.cartWrite('DMG', 0x6AAA, 0xF0, { flashcart: true }).catch(() => undefined);
      await client.cartWrite('DMG', 0x2000, 0x00, { flashcart: false }).catch(() => undefined);
      await client.cartWriteFlash('DMG', [[0, 0xFF], [0, 0xF0]], true).catch(() => undefined);
      await client.setVariable('FLASH_WE_PIN', FLASH_WE_PIN.WR).catch(() => undefined);
    }
    return null;
  }

  return null;
}

/**
 * Probes flashcart profiles in LK_Device.py order:
 * 1. Read baseline ROM header
 * 2. Sort m29w640 first, skip manual_select / missing command_set
 * 3. Run special-case early-exit probes
 * 4. Pre-reset/unlock remaining profiles, group read_identifier commands
 * 5. Probe grouped commands across we_pins with reset in finally after every probe
 */
export async function probeFlashcartProfiles(
  client: GbflashCommandClient,
  mode: GbflashCartMode,
  flashcartMode: FlashcartMode,
): Promise<ProfileProbeOutcome> {
  const allProfiles = await FlashcartProfileService.loadByMode(flashcartMode);
  const candidates = allProfiles
    .filter(p => Boolean(p.command_set) && p.manual_select !== true)
    .slice()
    .sort((a, b) => Number(!a.m29w640) - Number(!b.m29w640));

  // Step 1: baseline read (matches LK_Device.py:2552)
  await client.readRom(mode, 0, 8, { maxLength: 8 });

  // Step 2-3: Special-case early-exit probes
  const specialMatches: FlashcartProfile[] = [];
  let specialObservedId: Uint8Array | undefined;
  const remaining: FlashcartProfile[] = [];

  for (const profile of candidates) {
    if (isSpecialCaseProfile(profile, mode)) {
      const matchedId = await trySpecialCaseProbe(client, mode, profile);
      if (matchedId) {
        specialMatches.push(profile);
        specialObservedId = matchedId;
        break;
      }
      continue;
    }
    remaining.push(profile);
  }

  if (specialMatches.length === 1) {
    return {
      match: { status: 'unique', profile: specialMatches[0] },
      observedId: specialObservedId,
    };
  }

  // Step 4: Pre-probe reset/unlock sequences & group read_identifier commands
  const resetSeen = new Set<string>();
  const resetSequences: (readonly FlashcartCommandStep[])[] = [];
  interface CommandGroup {
    firstAddr: number;
    readIdentifier: readonly FlashcartCommandStep[];
    resetSteps: readonly FlashcartCommandStep[] | undefined;
    address: number;
    length: number;
    profiles: FlashcartProfile[];
  }
  const groups = new Map<string, CommandGroup>();

  for (const profile of remaining) {
    for (const key of ['reset', 'unlock'] as const) {
      const seq = profile.commands[key];
      if (seq?.length) {
        const sig = JSON.stringify(seq);
        if (!resetSeen.has(sig)) {
          resetSeen.add(sig);
          resetSequences.push(seq);
        }
      }
    }

    const readId = profile.commands.read_identifier;
    if (!readId?.length) {
      continue;
    }
    const firstAddr = resolveProfileArg(readId[0][0]);
    if (mode === 'DMG' && firstAddr > 0x7000) {
      continue;
    }
    const address = profile.read_identifier_at ?? 0;
    const groupKey = `${JSON.stringify(readId)}@${address}`;
    let group = groups.get(groupKey);
    if (!group) {
      group = {
        firstAddr,
        readIdentifier: readId,
        resetSteps: profile.commands.reset,
        address,
        length: 8,
        profiles: [],
      };
      groups.set(groupKey, group);
    }
    group.profiles.push(profile);
    group.length = Math.max(group.length, getRequiredIdLength(profile));
  }

  for (const seq of resetSequences) {
    await executeProfileSteps(client, mode, seq);
  }

  const sortedGroups = Array.from(groups.values()).sort((a, b) => a.firstAddr - b.firstAddr);
  const wePins: ('WR' | 'AUDIO' | null)[] = mode === 'DMG'
    ? (client.fwInfo.audioWePin ? ['WR', 'AUDIO'] : ['WR'])
    : [null];

  const matchedProfiles = new Map<string, FlashcartProfile>();
  let firstObservedId: Uint8Array | undefined;
  let lastProbeId: Uint8Array | undefined;

  // Step 5: Generic grouped Flash ID probe
  for (const we of wePins) {
    if (mode === 'DMG' && we !== null) {
      await client.setVariable('FLASH_WE_PIN', we === 'AUDIO' ? FLASH_WE_PIN.AUDIO : FLASH_WE_PIN.WR);
    }
    for (const group of sortedGroups) {
      const readLen = mode === 'AGB' && group.length % 2 !== 0 ? group.length + 1 : group.length;
      let baseline: Uint8Array = new Uint8Array(0);
      let idBytes: Uint8Array = new Uint8Array(0);
      try {
        await executeProfileSteps(client, mode, group.resetSteps);
        baseline = await client.readRom(mode, group.address, readLen, { maxLength: readLen });
        await executeProfileSteps(client, mode, group.readIdentifier);
        idBytes = await client.readRom(mode, group.address, readLen, { maxLength: readLen });
      } finally {
        await executeProfileSteps(client, mode, group.resetSteps);
      }

      if (idBytes.length > 0 && !idBytes.every((b, idx) => b === baseline[idx])) {
        lastProbeId ??= idBytes;
      }

      for (const profile of group.profiles) {
        if (mode === 'DMG' && we !== null) {
          const profilePin = profile.write_pin ?? 'WR';
          if (profilePin !== we) {
            continue;
          }
        }
        if (FlashcartProfileService.matchesObservation(profile, { rom: baseline, id: idBytes })) {
          matchedProfiles.set(profile.id, profile);
          firstObservedId ??= idBytes;
        }
      }
    }
  }

  await client.cartWriteFlash(mode, [[0, 0xFF], [0, 0xF0]], true);
  if (mode === 'DMG') {
    await client.setVariable('FLASH_WE_PIN', FLASH_WE_PIN.WR).catch(() => undefined);
  }

  let uniqueMatches = Array.from(matchedProfiles.values());
  if (uniqueMatches.length > 1) {
    // Disambiguate multiple Flash ID matches using CFI device_size (matches LK_Device.py:2812-2817)
    const distinctSizes = new Set(uniqueMatches.map(p => p.flash_size).filter((s): s is number => typeof s === 'number' && s > 0));
    if (distinctSizes.size > 1) {
      const cfiTried = new Set<string>();
      for (const profile of uniqueMatches) {
        const readCfi = profile.commands.read_cfi?.length
          ? profile.commands.read_cfi
          : [[mode === 'DMG' ? 0xAA : 0xAA, 0x98] as FlashcartCommandStep];
        const wePin = mode === 'DMG' ? resolveProfileWePin(profile.write_pin, mode) : FLASH_WE_PIN.UNSET;
        const addr = profile.read_identifier_at ?? 0;
        const sig = `${wePin}:${addr}:${JSON.stringify(readCfi)}`;
        if (cfiTried.has(sig)) {
          continue;
        }
        cfiTried.add(sig);
        try {
          if (mode === 'DMG') {
            await client.setVariable('FLASH_WE_PIN', wePin);
          }
          await resetProfileFlash(client, mode, profile);
          await executeProfileSteps(client, mode, readCfi);
          const cfiRaw = await client.readRom(mode, addr, 0x100, { maxLength: 0x100 });
          const cfi = parseCFI(cfiRaw);
          if (cfi && cfi.deviceSize > 0) {
            const sized = uniqueMatches.filter(p => p.flash_size === cfi.deviceSize);
            if (sized.length > 0) {
              uniqueMatches = sized;
            }
            break;
          }
        } finally {
          await resetProfileFlash(client, mode, profile).catch(() => undefined);
          if (mode === 'DMG') {
            await client.setVariable('FLASH_WE_PIN', FLASH_WE_PIN.WR).catch(() => undefined);
          }
        }
      }
    }
  }
  if (uniqueMatches.length === 0) {
    return { match: { status: 'none' }, observedId: lastProbeId };
  }
  if (uniqueMatches.length === 1) {
    return { match: { status: 'unique', profile: uniqueMatches[0] }, observedId: firstObservedId };
  }
  return { match: { status: 'ambiguous', candidates: uniqueMatches }, observedId: firstObservedId };
}
