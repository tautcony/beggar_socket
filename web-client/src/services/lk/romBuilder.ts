// romBuilder.ts - ROM构建器主逻辑

import { AllocatedGame, BuildInput, BuildResult, cartridgeTypes, GameConfig, InputGame, PreparedGame } from './types';
import { arrayBufferToUint8Array, parsePath, sha1, uint8ArrayToArrayBuffer, updateSectorMap } from './utils';

// ---- Layout constants ----
/** Minimum ROM image size required by the menu firmware (4 MiB). */
const MIN_ROM_SIZE = 0x400000;
/** Write-buffer / block granularity used to derive sectors_per_block (512 KiB). */
const BLOCK_GRANULARITY = 0x80000;
/** Byte alignment boundary for the item-list area (256 KiB). */
const ITEM_LIST_ALIGNMENT = 0x40000;
/** Size of the status/config area written into the flash (4 KiB). */
const STATUS_AREA_SIZE = 0x1000;
/** Maximum number of UTF-16 code units stored in an item-list title. */
export const ITEM_TITLE_CODE_UNIT_LIMIT = 0x30;

interface BuildContext {
  log: string;
  logp: (...args: unknown[]) => void;
}

function createBuildContext(): BuildContext {
  const context: BuildContext = {
    log: '',
    logp: (...args) => {
      logp(...args);
      context.log += args.join(' ') + '\n';
    },
  };
  return context;
}

function createBuildGames(games: GameConfig[]): InputGame[] {
  return games.map(game => ({
    enabled: game.enabled,
    file: game.file,
    title: game.title,
    title_font: game.title_font,
    save_slot: game.save_slot,
    map_256m: game.map_256m,
    keys: game.keys ? [...game.keys] : undefined,
  }));
}

function truncateItemTitle(title: string): string {
  let truncated = title.slice(0, ITEM_TITLE_CODE_UNIT_LIMIT);
  const lastCodeUnit = truncated.charCodeAt(truncated.length - 1);
  if (lastCodeUnit >= 0xD800 && lastCodeUnit <= 0xDBFF) {
    truncated = truncated.slice(0, -1);
  }
  return truncated;
}

export function logp(...args: unknown[]): void {
  const s = args.join(' ');
  console.log(s);
}

// 编译准备与主流程拆分
export function prepareCompilation(cartridge_type: number) {
  if (cartridge_type < 0 || cartridge_type >= cartridgeTypes.length || !cartridgeTypes[cartridge_type]) {
    throw new Error(`Invalid cartridge type: ${cartridge_type}`);
  }
  const flash_size = cartridgeTypes[cartridge_type].flash_size;
  const sector_size = cartridgeTypes[cartridge_type].sector_size;
  const block_size = cartridgeTypes[cartridge_type].block_size;
  const sector_count = Math.floor(flash_size / sector_size);
  const block_count = Math.floor(flash_size / block_size);
  const sectors_per_block = BLOCK_GRANULARITY / sector_size;
  const compilation = new Uint8Array(flash_size);
  compilation.fill(0xFF);
  const sector_map = Array(sector_count).fill('.') as string[];
  return { flash_size, sector_size, block_size, sector_count, block_count, sectors_per_block, compilation, sector_map };
}

export function readMenuRom(menuRomData: ArrayBuffer, sector_size: number, compilation: Uint8Array): { menu_rom: Uint8Array, build_timestamp_offset: number } {
  const menuRom = arrayBufferToUint8Array(menuRomData);
  // 补齐到16字节对齐
  const paddingLength = (menuRom.length + 0x10 - (menuRom.length % 0x10)) - menuRom.length;
  const padded_step1 = new Uint8Array(menuRom.length + paddingLength);
  padded_step1.set(menuRom);
  padded_step1.fill(0xFF, menuRom.length);

  // 再添加0x20字节 - 模拟Buffer.concat([padded, Buffer.alloc(0x20, 0xFF)])
  const padded = new Uint8Array(padded_step1.length + 0x20);
  padded.set(padded_step1);
  padded.fill(0xFF, padded_step1.length);

  const build_timestamp_offset = padded.length - 0x20;
  const build_timestamp = new Date().toISOString();
  const encoder = new TextEncoder();
  const timestampBytes = encoder.encode(build_timestamp);

  // 模拟padded.write(build_timestamp, build_timestamp_offset, build_timestamp.length, 'ascii')
  const writeLength = Math.min(timestampBytes.length, 0x20);
  padded.set(timestampBytes.subarray(0, writeLength), build_timestamp_offset);

  // 模拟padded.copy(compilation, 0, 0, padded.length)
  compilation.set(padded, 0);

  return { menu_rom: padded, build_timestamp_offset };
}

// ROM与存档导入、ROM数据写入
function prepareGames(
  games: InputGame[],
  sector_size: number,
  min_rom_size: number,
  battery_present: boolean,
  compilation: Uint8Array,
  sector_map: string[],
  save_data_sector_offset: number,
  romFiles: Map<string, ArrayBuffer>,
  saveFiles: Map<string, ArrayBuffer>,
): { games: PreparedGame[], saves_read: number[], save_end_offset: number, roms_keys: number[] } {
  const preparedGames: PreparedGame[] = [];
  const saves_read: number[] = [];
  let roms_keys: number[] = [0];
  let index = 0;
  for (const inputGame of games) {
    if (!inputGame.enabled) continue;
    const romData = romFiles.get(inputGame.file);
    if (!romData) {
      continue;
    }
    let size = romData.byteLength;
    if ((size & (size - 1)) !== 0) {
      let x = 0x80000;
      while (x < size) x *= 2;
      size = x;
    }
    if (size < MIN_ROM_SIZE) {
      const buffer = arrayBufferToUint8Array(romData);
      const batterylessText = 'Batteryless mod by Lesserkuma';
      const encoder = new TextEncoder();
      const searchBytes = encoder.encode(batterylessText);
      let found = false;
      for (let i = 0; i <= buffer.length - searchBytes.length; i++) {
        if (buffer.subarray(i, i + searchBytes.length).every((b, j) => b === searchBytes[j])) {
          found = true;
          break;
        }
      }
      if (found) {
        size = Math.max(MIN_ROM_SIZE, min_rom_size);
      } else {
        size = Math.max(size, min_rom_size);
      }
    }
    const game: PreparedGame = {
      ...inputGame,
      index,
      size,
      title_font: (inputGame.title_font ?? 1) - 1,
      sector_count: Math.floor(size / sector_size),
      keysValue: 0,
      save_type: 0,
    };
    // Hidden ROMs
    let keys = 0;
    if (game.keys) {
      for (const key of game.keys) {
        switch (key.toUpperCase()) {
          case 'A': keys |= (1 << 0); break;
          case 'B': keys |= (1 << 1); break;
          case 'SELECT': keys |= (1 << 2); break;
          case 'START': keys |= (1 << 3); break;
          case 'RIGHT': keys |= (1 << 4); break;
          case 'LEFT': keys |= (1 << 5); break;
          case 'UP': keys |= (1 << 6); break;
          case 'DOWN': keys |= (1 << 7); break;
          case 'R': keys |= (1 << 8); break;
          case 'L': keys |= (1 << 9); break;
        }
      }
    }
    game.keysValue = keys;
    if (keys > 0) {
      roms_keys.push(keys);
      roms_keys = Array.from(new Set(roms_keys));
    }
    if (battery_present && game.save_slot !== null) {
      game.save_type = 2;
      game.save_slot--;
      const save_slot = game.save_slot;
      const offset = save_data_sector_offset + save_slot;
      updateSectorMap(sector_map, offset, 1, 's');
      if (!saves_read.includes(save_slot)) {
        const saveFileName = parsePath(game.file).name + '.sav';
        let saveData = saveFiles.get(saveFileName);
        // 如果没找到精确匹配，尝试查找任何匹配的存档文件
        if (!saveData) {
          for (const [fileName, data] of saveFiles.entries()) {
            // Use case-insensitive exact base-name comparison to avoid accidentally
            // associating a save file whose name merely contains the game name as a substring.
            if (parsePath(fileName).name.toLowerCase() === parsePath(game.file).name.toLowerCase()) {
              saveData = data;
              break;
            }
          }
        }
        const save_buffer = new Uint8Array(sector_size);
        // 存档数据默认应该是0x00填充，不需要额外初始化
        if (saveData) {
          const saveArray = arrayBufferToUint8Array(saveData);
          const copyLength = Math.min(saveArray.length, sector_size);
          save_buffer.set(saveArray.subarray(0, copyLength));
          saves_read.push(save_slot);
        }
        compilation.set(save_buffer, offset * sector_size);
      }
    } else {
      game.save_type = 0;
      game.save_slot = 0;
    }
    preparedGames.push(game);
    index++;
  }
  const save_end_offset = saves_read.length > 0 ? sector_map.join('').lastIndexOf('S') + 1 : save_data_sector_offset;
  return { games: preparedGames, saves_read, save_end_offset, roms_keys };
}

/** Compatibility adapter for callers using the exported mutable phase helper. */
export function importSaveDataAndAddRom(
  games: GameConfig[], sector_size: number, min_rom_size: number, battery_present: boolean,
  compilation: Uint8Array, sector_map: string[], save_data_sector_offset: number,
  romFiles: Map<string, ArrayBuffer>, saveFiles: Map<string, ArrayBuffer>,
): { games: GameConfig[], saves_read: number[], save_end_offset: number, roms_keys: number[] } {
  const result = prepareGames(createBuildGames(games), sector_size, min_rom_size, battery_present, compilation, sector_map, save_data_sector_offset, romFiles, saveFiles);
  let preparedIndex = 0;
  for (const game of games) {
    if (!game.enabled) continue;
    if (!romFiles.has(game.file)) game.missing = true;
    else Object.assign(game, result.games[preparedIndex++]);
  }
  return { ...result, games: games.filter(game => !game.missing) };
}

// ROM数据分配与写入
async function allocateRomData(
  games: PreparedGame[],
  compilation: Uint8Array,
  sector_map: string[],
  sector_size: number,
  block_size: number,
  save_end_offset: number,
  boot_logo_found: boolean,
  romFiles: Map<string, ArrayBuffer>,
  writeLog: (...args: unknown[]) => void,
): Promise<{ games: AllocatedGame[], logoFound: boolean }> {
  const allocatedGames: AllocatedGame[] = [];
  let logoFound = boot_logo_found;
  // 按ROM大小降序排序
  games.sort((a, b) => b.size - a.size);
  for (const game of games) {
    let found = false;
    for (let i = save_end_offset; i < sector_map.length; i++) {
      let sector_count_map = game.sector_count;
      if (game.map_256m) {
        sector_count_map = Math.floor((32 * 1024 * 1024) / sector_size);
      }
      if (sector_count_map > 0 && i % sector_count_map === 0) {
        const canFit = sector_map.slice(i, i + game.sector_count).every(s => s === '.');
        if (canFit) {
          updateSectorMap(sector_map, i, game.sector_count, 'r');
          const romData = romFiles.get(game.file);
          if (romData) {
            const rom = arrayBufferToUint8Array(romData);
            const writeOffset = i * sector_size;
            if (writeOffset + rom.length > compilation.length) {
              throw new Error(`ROM "${game.file}" exceeds flash size (offset: ${writeOffset}, size: ${rom.length}, capacity: ${compilation.length})`);
            }
            // 写入ROM数据
            compilation.set(rom, writeOffset);
            allocatedGames.push({
              ...game,
              sector_offset: i,
              block_offset: Math.floor(i * sector_size / block_size),
              block_count: Math.floor((sector_count_map * sector_size) / block_size),
            });
            found = true;
            // boot logo - 直接比较SHA1哈希
            const logoData = rom.subarray(4, 0xA0);
            const logoHash = await sha1(uint8ArrayToArrayBuffer(logoData));
            const logoRef = new Uint8Array([0x17, 0xDA, 0xA0, 0xFE, 0xC0, 0x2F, 0xC3, 0x3C, 0x0F, 0x6A, 0xBB, 0x54, 0x9A, 0x8B, 0x80, 0xB6, 0x61, 0x3B, 0x48, 0xEE]);
            const logoRefHash = await sha1(uint8ArrayToArrayBuffer(logoRef));
            if (!logoFound && logoHash === logoRefHash) {
              compilation.set(rom.subarray(4, 0xA0), 4);
              logoFound = true;
            }
          }
          break;
        }
      }
    }
    if (!found) {
      writeLog(`"${game.title}" couldn't be added because it exceeds the available cartridge space.`);
    }
  }
  return { games: allocatedGames, logoFound };
}

function requireNumber(game: GameConfig, field: keyof GameConfig): number {
  const value = game[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Game "${game.file}" is missing required ${field} metadata`);
  }
  return value;
}

export async function addRomData(
  games: GameConfig[], compilation: Uint8Array, sector_map: string[], sector_size: number,
  block_size: number, save_end_offset: number, boot_logo_found: boolean, romFiles: Map<string, ArrayBuffer>,
): Promise<boolean> {
  const prepared = games.filter(game => game.enabled && !game.missing).map((game): PreparedGame => ({
    ...game,
    index: requireNumber(game, 'index'),
    size: requireNumber(game, 'size'),
    sector_count: requireNumber(game, 'sector_count'),
    save_type: requireNumber(game, 'save_type'),
    keysValue: requireNumber(game, 'keysValue'),
  }));
  const result = await allocateRomData(prepared, compilation, sector_map, sector_size, block_size, save_end_offset, boot_logo_found, romFiles, logp);
  // Match the original mutable helper's order and metadata, including duplicate files.
  const allocatedByIndex = new Map(result.games.map(game => [game.index, game]));
  games.sort((a, b) => (b.size ?? 0) - (a.size ?? 0));
  for (const game of games) {
    if (game.enabled && game.index !== undefined) {
      const allocated = allocatedByIndex.get(game.index);
      if (allocated) Object.assign(game, allocated);
    }
  }
  return result.logoFound;
}

// Public adapter preserves callers that provide only the serialized phase fields.
export function generateItemList(games: GameConfig[], roms_keys: number[], battery_present: boolean, block_size: number, sector_size: number, save_data_sector_offset: number): Uint8Array {
  const allocatedGames = games.filter(game => game.sector_offset !== undefined).map((game): AllocatedGame => {
    const block_offset = requireNumber(game, 'block_offset');
    const block_count = requireNumber(game, 'block_count');
    const size = game.size ?? block_count * block_size;
    return {
      ...game,
      index: requireNumber(game, 'index'),
      size,
      sector_count: game.sector_count ?? Math.floor(size / sector_size),
      keysValue: requireNumber(game, 'keysValue'),
      save_type: requireNumber(game, 'save_type'),
      sector_offset: requireNumber(game, 'sector_offset'),
      block_offset,
      block_count,
    };
  });
  return encodeItemList(allocatedGames, roms_keys);
}

// item list 生成
function encodeItemList(games: AllocatedGame[], roms_keys: number[]): Uint8Array {
  let item_list = new Uint8Array(0);
  // 按 index 排序
  games = [...games].sort((a, b) => a.index - b.index);
  for (const key of roms_keys) {
    let c = 0;
    for (const game of games) {
      if (game.keysValue !== key) continue;
      const title = truncateItemTitle(game.title);
      // 生成 item list 二进制结构
      const buf = new Uint8Array(0x30 * 2 + 16);
      const view = new DataView(buf.buffer);
      view.setUint8(0, game.title_font);
      view.setUint8(1, title.length);
      view.setUint16(2, game.block_offset, true);
      view.setUint16(4, game.block_count, true);
      view.setUint8(6, game.save_type);
      view.setUint8(7, game.save_slot);
      view.setUint16(8, game.keysValue, true);
      // 填充10-16字节为0
      for (let i = 10; i < 16; i++) {
        buf[i] = 0;
      }
      // 模拟Buffer.write() - 写入最多0x30个字符的UTF-16LE
      const titleBuffer = new Uint8Array(0x30 * 2);
      const maxChars = title.length;
      for (let i = 0; i < maxChars; i++) {
        const charCode = title.charCodeAt(i);
        titleBuffer[i * 2] = charCode & 0xFF; // 低字节
        titleBuffer[i * 2 + 1] = (charCode >> 8) & 0xFF; // 高字节
      }
      buf.set(titleBuffer, 16);
      item_list = new Uint8Array([...item_list, ...buf]);
      c++;
    }
  }
  return item_list;
}

// 编译ROM与写出
export async function writeCompilation(
  compilation: Uint8Array,
  sector_map: string[],
  sector_size: number,
  output_file: string,
  split: boolean,
  flash_size: number,
  status: Uint8Array,
  item_list: Uint8Array,
  status_offset: number,
  item_list_offset: number,
  menu_rom: Uint8Array,
  cartridge_type: number,
  battery_present: boolean,
  writeLog: (...args: unknown[]) => void = logp,
): Promise<{ rom: ArrayBuffer, code: string }> {
  const rom_size = sector_map.join('').replace(/\.+$/, '').length * sector_size;
  // 计算 ROM code - 使用实际的status和item_list数据
  const combined = new Uint8Array(status.length + item_list.length);
  combined.set(status);
  combined.set(item_list, status.length);
  const combinedBuffer = uint8ArrayToArrayBuffer(combined);
  const hash = await sha1(combinedBuffer);
  const rom_code = 'L' + hash.slice(0, 3).toUpperCase();
  // 写入ROM code
  const encoder = new TextEncoder();
  const codeBytes = encoder.encode(rom_code);
  compilation.set(codeBytes, 0xAC);
  // 校验和
  let checksum = 0;
  for (let i = 0xA0; i < 0xBD; i++) {
    checksum -= compilation[i];
  }
  checksum = (checksum - 0x19) & 0xFF;
  compilation[0xBD] = checksum;

  writeLog('');
  writeLog(`Menu ROM:        0x${(0).toString(16).padStart(8, '0').toUpperCase()}–0x${menu_rom.length.toString(16).padStart(8, '0').toUpperCase()}`);
  writeLog(`Game List:       0x${(item_list_offset * sector_size).toString(16).padStart(8, '0').toUpperCase()}–0x${(item_list_offset * sector_size + item_list.length).toString(16).padStart(8, '0').toUpperCase()}`);
  writeLog(`Status Area:     0x${(status_offset * sector_size).toString(16).padStart(8, '0').toUpperCase()}–0x${(status_offset * sector_size + STATUS_AREA_SIZE).toString(16).padStart(8, '0').toUpperCase()}`);
  writeLog('');
  writeLog(`Cartridge Type:  ${cartridge_type} (${cartridgeTypes[cartridge_type].name}) ${battery_present ? 'with battery' : 'without battery'}`);
  writeLog(`Output ROM Size: ${(rom_size / 1024 / 1024).toFixed(2)} MiB`);
  writeLog(`Output ROM Code: ${rom_code}`);

  // 替换输出文件名中的 <CODE> 占位符
  const outFile = output_file.replace('<CODE>', rom_code);
  // 返回ROM数据
  const rom = uint8ArrayToArrayBuffer(compilation.subarray(0, rom_size));
  return { rom, code: rom_code };
}

// 主构建函数
export async function buildRom(input: BuildInput): Promise<BuildResult> {
  const context = createBuildContext();
  const { config, menuRom, romFiles, saveFiles, options } = input;
  const { games, cartridge_type, battery_present, min_rom_size } = {
    games: createBuildGames(config.games),
    cartridge_type: config.cartridge.type,
    battery_present: config.cartridge.battery_present,
    min_rom_size: config.cartridge.min_rom_size || MIN_ROM_SIZE,
  };

  // 编译准备
  const { flash_size, sector_size, block_size, compilation, sector_map } = prepareCompilation(cartridge_type);
  // 读取Menu ROM
  const { menu_rom } = readMenuRom(menuRom, sector_size, compilation);
  // 更新背景（按需动态加载）
  const { updateBackgroundImage } = await import('./imageUtils');
  await updateBackgroundImage(menu_rom, options.bgImage);

  // 将更新后的 menu_rom 数据复制回 compilation
  if (options.bgImage) {
    compilation.set(menu_rom.subarray(0, Math.min(menu_rom.length, compilation.length)), 0);
  }

  // 初始化扇区映射
  const menuSectors = Math.ceil(menu_rom.length / sector_size);
  updateSectorMap(sector_map, 0, menuSectors, 'm');
  // item list 扇区偏移 - 对齐到0x40000边界
  let itemListByteOffset = menu_rom.length;
  itemListByteOffset = ITEM_LIST_ALIGNMENT - (itemListByteOffset % ITEM_LIST_ALIGNMENT) + itemListByteOffset;
  const item_list_sector = Math.ceil(itemListByteOffset / sector_size);
  updateSectorMap(sector_map, item_list_sector, 1, 'l');
  // status area
  const status_sector = item_list_sector + 1;
  updateSectorMap(sector_map, status_sector, 1, 'c');
  // 写入状态数据
  // status:
  // [0:4]: b"KUMA"
  // [4]: version code, currently unused
  // [5]: battery present, 0 for not present and 1 (or other) for present
  // [6:8]: last boot menu index, which store the game last booted
  // [9]: last boot save index, which store the save last used
  // [10]: last boot save type, which store the save type last used, currently if the battery present and use a save slot it's always SRAM_512K so don't use it to check if it's SRAM_1M or not
  // [11]: sram bank type, which store the sram bank type
  // [12:]: not used
  const statusData = new Uint8Array([0x4B, 0x55, 0x4D, 0x41, 0x00, 0x00, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]);
  if (battery_present) {
    statusData[5] = 0x01;
  }
  compilation.set(statusData, status_sector * sector_size);
  const save_data_sector = status_sector + 1;
  // 导入存档并添加ROM
  const { games: validGames, save_end_offset, roms_keys } = prepareGames(games, sector_size, min_rom_size, battery_present, compilation, sector_map, save_data_sector, romFiles, saveFiles);
  const { games: allocatedGames } = await allocateRomData(validGames, compilation, sector_map, sector_size, block_size, save_end_offset, true, romFiles, context.logp);
  // 生成item list
  const itemList = encodeItemList(allocatedGames, roms_keys);
  // 写入item list到扇区位置
  compilation.set(itemList, item_list_sector * sector_size);
  // 写出ROM
  const { rom, code } = await writeCompilation(compilation, sector_map, sector_size, options.output, options.split, flash_size, statusData, itemList, status_sector, item_list_sector, menu_rom, cartridge_type, battery_present, context.logp);

  return { rom, log: context.log, code };
}
