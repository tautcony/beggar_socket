// GBA Multi Game Menu – ROM Builder (TypeScript)
// Author: Lesserkuma (github.com/lesserkuma) TypeScript port

import * as crypto from 'crypto';
import * as fs from 'fs';
import { intToRGBA, Jimp } from 'jimp';
import * as path from 'path';
import * as process from 'process';

// 配置与常量
export const appVersion = '1.1';
export const defaultFile = 'LK_MULTIMENU_<CODE>.gba';

export interface CartridgeType {
  name: string;
  flash_size: number;
  sector_size: number;
  block_size: number;
}

export const cartridgeTypes: CartridgeType[] = [
  { name: 'MSP55LV100S', flash_size: 0x4000000, sector_size: 0x20000, block_size: 0x80000 },
  { name: '6600M0U0BE', flash_size: 0x10000000, sector_size: 0x40000, block_size: 0x80000 },
  { name: 'MSP54LV100', flash_size: 0x8000000, sector_size: 0x20000, block_size: 0x80000 },
  { name: 'F0095H0', flash_size: 0x20000000, sector_size: 0x40000, block_size: 0x80000 },
];

// 工具函数
export function formatFileSize(size: number): string {
  if (size === 1) return `${size} Byte`;
  if (size < 1024) return `${size} Bytes`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

export let log = '';

export function logp(...args: unknown[]): void {
  const s = args.join(' ');
  console.log(s);
  log += s + '\n';
}

export function updateSectorMap(sector_map: string[], start: number, length: number, c: string): void {
  sector_map.fill(c, start + 1, start + length);
  sector_map[start] = c.toUpperCase();
}

// 参数解析与配置读取
export interface GameConfig {
  enabled: boolean;
  file: string;
  title: string;
  title_font: number;
  save_slot: number;
  map_256m?: boolean;
  keys?: string[];
  index?: number;
  size?: number;
  sector_count?: number;
  save_type?: number;
  block_offset?: number;
  block_count?: number;
  sector_offset?: number;
  save_slot_index?: number;
  missing?: boolean;
  keysValue?: number;
}

export interface CartridgeConfig {
  type: number;
  battery_present: boolean;
  min_rom_size: number;
}

export interface FullConfig {
  cartridge: CartridgeConfig;
  games: GameConfig[];
}

export interface ArgsConfig {
  split: boolean;
  noWait: boolean;
  noLog: boolean;
  config: string;
  bg?: string;
  output: string;
}

export function parseArgs(): ArgsConfig {
  // 简化版参数解析
  const args = process.argv.slice(2);
  const result: ArgsConfig = {
    split: false,
    noWait: false,
    noLog: false,
    config: 'config.json',
    bg: undefined,
    output: defaultFile,
  };
  args.forEach((arg, i) => {
    if (arg === '--split') result.split = true;
    if (arg === '--no-wait') result.noWait = true;
    if (arg === '--no-log') result.noLog = true;
    if (arg === '--config' && args[i + 1]) result.config = args[i + 1];
    if (arg === '--bg' && args[i + 1]) result.bg = args[i + 1];
    if (arg === '--output' && args[i + 1]) result.output = args[i + 1];
  });
  return result;
}

export function readConfigOrCreate(args: ArgsConfig): { games: GameConfig[], cartridge_type: number, battery_present: boolean, min_rom_size: number } {
  let games: GameConfig[] = [];
  let cartridge_type = 1;
  let battery_present = false;
  let min_rom_size = 0x400000;
  if (!fs.existsSync(args.config)) {
    const files = fs.readdirSync('roms').filter(f => f.endsWith('.gba')).sort((a, b) => a.localeCompare(b));
    let save_slot = 1;
    for (const file of files) {
      const d: GameConfig = {
        enabled: true,
        file,
        title: path.parse(file).name,
        title_font: 1,
        save_slot,
      };
      const buffer = fs.readFileSync(path.join('roms', file));
      const code = buffer.subarray(0xAC, 0xB0);
      if (code.subarray(0, 3).toString() === 'BPG' || code.subarray(0, 3).toString() === 'BPR') {
        d.map_256m = true;
      }
      games.push(d);
      save_slot++;
    }
    const obj: FullConfig = {
      cartridge: {
        type: cartridge_type + 1,
        battery_present,
        min_rom_size,
      },
      games,
    };
    if (games.length === 0) {
      logp('Error: No usable ROM files were found in the “roms” folder.');
      process.exit(1);
    } else {
      fs.writeFileSync(args.config, JSON.stringify(obj, null, 2), { encoding: 'utf-8' });
      logp(`A new configuration file (${args.config}) was created. Please edit and rerun.`);
      process.exit(0);
    }
  } else {
    try {
      // 读取并去除 UTF-8 BOM（SIG）
      const raw = fs.readFileSync(args.config, 'utf-8');
      const content = raw.replace(/^\uFEFF/, '');
      const j = JSON.parse(content) as FullConfig;
      games = j.games;
      cartridge_type = j.cartridge.type - 1;
      battery_present = j.cartridge.battery_present;
      min_rom_size = j.cartridge.min_rom_size || 0x400000;
    } catch (e) {
      logp(`Error: The configuration file (${args.config}) is malformed.`);
      process.exit(1);
    }
  }
  return { games, cartridge_type, battery_present, min_rom_size };
}

// 编译准备与主流程拆分
export function prepareCompilation(cartridge_type: number) {
  const flash_size = cartridgeTypes[cartridge_type].flash_size;
  const sector_size = cartridgeTypes[cartridge_type].sector_size;
  const block_size = cartridgeTypes[cartridge_type].block_size;
  const sector_count = Math.floor(flash_size / sector_size);
  const block_count = Math.floor(flash_size / block_size);
  const sectors_per_block = 0x80000 / sector_size;
  const compilation = Buffer.alloc(flash_size, 0xFF);
  const sector_map = Array(sector_count).fill('.') as string[];
  return { flash_size, sector_size, block_size, sector_count, block_count, sectors_per_block, compilation, sector_map };
}

export function readMenuRom(menuPath: string, sector_size: number, compilation: Buffer): { menu_rom: Buffer, build_timestamp_offset: number } {
  const menu_rom = fs.readFileSync(menuPath);
  // 补齐到16字节对齐
  let padded = Buffer.concat([menu_rom, Buffer.alloc((menu_rom.length + 0x10 - (menu_rom.length % 0x10)) - menu_rom.length, 0xFF)]);
  padded = Buffer.concat([padded, Buffer.alloc(0x20, 0xFF)]);
  const build_timestamp_offset = padded.length - 0x20;
  const build_timestamp = new Date().toISOString();
  padded.write(build_timestamp, build_timestamp_offset, build_timestamp.length, 'ascii');
  padded.copy(compilation, 0, 0, padded.length);
  return { menu_rom: padded, build_timestamp_offset };
}

// 背景图片处理（Jimp实现，自动索引色并写入ROM）
export async function updateBackgroundImage(menu_rom: Buffer, args: ArgsConfig): Promise<void> {
  const bgPath = args.bg ?? 'bg.png';
  if (!fs.existsSync(bgPath)) return;
  try {

    const img = await Jimp.read(bgPath) ;
    // 转为8位索引色
    // img.colorType(1); // 强制索引色
    // 获取调色板（Jimp不直接暴露，需遍历像素）
    const paletteSet = new Set<string>();

    for (let y = 0; y < img.bitmap.height; y++) {

      for (let x = 0; x < img.bitmap.width; x++) {

        const hex = intToRGBA(img.getPixelColor(x, y));

        paletteSet.add(`${hex.r},${hex.g},${hex.b}`);
      }
    }
    const paletteArr = Array.from(paletteSet).map(str => {
      const [r, g, b] = str.split(',').map(Number);
      return { r, g, b };
    });
    // GBA RGB555格式转换
    const palette_rgb555 = paletteArr.map(color => {
      return ((color.b >> 3) << 10) | ((color.g >> 3) << 5) | (color.r >> 3);
    });
    // 位图数据

    const raw_bitmap = Buffer.from(img.bitmap.data);
    // 调色板数据
    const raw_palette = Buffer.alloc(0x200);
    palette_rgb555.forEach((color, i) => {
      raw_palette.writeUInt16LE(color, i * 2);
    });
    // 定位ROM背景区
    const marker = Buffer.from('RTFN\xFF\xFE', 'ascii');
    const menu_rom_bg_offset = menu_rom.indexOf(marker) - 0x9800;
    if (menu_rom_bg_offset < 0) throw new Error('Background marker not found');
    raw_bitmap.copy(menu_rom, menu_rom_bg_offset, 0, Math.min(raw_bitmap.length, 0x9600));
    raw_palette.copy(menu_rom, menu_rom_bg_offset + 0x9600, 0, 0x200);
    logp('Background image updated successfully');
  } catch (e: unknown) {
    logp('Error: Couldn’t update background image. ' + (e as Error).message);
  }
}

// ROM与存档导入、ROM数据写入
export function importSaveDataAndAddRom(games: GameConfig[], sector_size: number, min_rom_size: number, battery_present: boolean, compilation: Buffer, sector_map: string[], save_data_sector_offset: number): { games: GameConfig[], saves_read: number[], save_end_offset: number, roms_keys: number[] } {
  const saves_read: number[] = [];
  let roms_keys: number[] = [0];
  let index = 0;
  for (const game of games) {
    if (!game.enabled) continue;
    const romPath = path.join('roms', game.file);
    if (!fs.existsSync(romPath)) {
      game.missing = true;
      continue;
    }
    let size = fs.statSync(romPath).size;
    if ((size & (size - 1)) !== 0) {
      let x = 0x80000;
      while (x < size) x *= 2;
      size = x;
    }
    if (size < 0x400000) {
      const buffer = fs.readFileSync(romPath);
      if (buffer.includes(Buffer.from('Batteryless mod by Lesserkuma'))) {
        size = Math.max(0x400000, min_rom_size);
      } else {
        size = Math.max(size, min_rom_size);
      }
    }
    game.index = index;
    game.size = size;
    game.title_font = (game.title_font ?? 1) - 1;
    game.sector_count = Math.floor(size / sector_size);
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
    // 修正类型：keys 作为 number 另存
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
        const save_data_file = path.join('roms', path.parse(game.file).name + '.sav');
        let save_data = Buffer.alloc(sector_size, 0);
        if (fs.existsSync(save_data_file)) {
          save_data = fs.readFileSync(save_data_file);
          if (save_data.length < sector_size) {
            save_data = Buffer.concat([save_data, Buffer.alloc(sector_size - save_data.length, 0)]);
          }
          if (save_data.length > sector_size) {
            save_data = save_data.subarray(0, sector_size);
          }
          saves_read.push(save_slot);
        }
        save_data.copy(compilation, offset * sector_size, 0, sector_size);
      }
    } else {
      game.save_type = 0;
      game.save_slot = 0;
    }
    index++;
  }
  const save_end_offset = saves_read.length > 0 ? sector_map.join('').lastIndexOf('S') + 1 : save_data_sector_offset;
  return { games: games.filter(g => !g.missing), saves_read, save_end_offset, roms_keys };
}

// ROM数据分配与写入
export function addRomData(games: GameConfig[], compilation: Buffer, sector_map: string[], sector_size: number, block_size: number, save_end_offset: number, boot_logo_found: boolean): boolean {
  let logoFound = boot_logo_found;
  // 按ROM大小降序排序
  games.sort((a, b) => (b.size ?? 0) - (a.size ?? 0));
  for (const game of games) {
    let found = false;
    for (let i = save_end_offset; i < sector_map.length; i++) {
      let sector_count_map = game.sector_count ?? 0;
      if (game.map_256m) {
        sector_count_map = Math.floor((32 * 1024 * 1024) / sector_size);
      }
      if (sector_count_map > 0 && i % sector_count_map === 0) {
        const canFit = sector_map.slice(i, i + (game.sector_count ?? 0)).every(s => s === '.');
        if (canFit) {
          updateSectorMap(sector_map, i, game.sector_count ?? 0, 'r');
          const rom = fs.readFileSync(path.join('roms', game.file));
          rom.copy(compilation, i * sector_size, 0, rom.length);
          game.sector_offset = i;
          game.block_offset = Math.floor((game.sector_offset ?? 0) * sector_size / block_size);
          game.block_count = Math.floor((sector_count_map * sector_size) / block_size);
          found = true;
          // boot logo
          const logoHash = crypto.createHash('sha1').update(rom.subarray(0x04, 0xA0)).digest();
          const logoRef = Buffer.from([0x17, 0xDA, 0xA0, 0xFE, 0xC0, 0x2F, 0xC3, 0x3C, 0x0F, 0x6A, 0xBB, 0x54, 0x9A, 0x8B, 0x80, 0xB6, 0x61, 0x3B, 0x48, 0xEE]);
          if (!logoFound && logoHash.equals(logoRef)) {
            rom.copy(compilation, 0x04, 0x04, 0xA0);
            logoFound = true;
          }
          break;
        }
      }
    }
    if (!found) {
      logp(`“${game.title}” couldn’t be added because it exceeds the available cartridge space.`);
    }
  }
  return logoFound;
}

// item list 生成
export function generateItemList(games: GameConfig[], roms_keys: number[], battery_present: boolean, block_size: number, sector_size: number, save_data_sector_offset: number): Buffer {
  let item_list = Buffer.alloc(0);
  // 按 index 排序
  games = games.filter(g => g.sector_offset !== undefined).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  for (const key of roms_keys) {
    let c = 0;
    for (const game of games) {
      if (game.keysValue !== key) continue;
      let title = game.title;
      if (title.length > 0x30) title = title.slice(0, 0x2F) + '…';
      // 生成 item list 二进制结构
      const buf = Buffer.alloc(0x30 * 2 + 16); // 预分配足够空间
      buf.writeUInt8(game.title_font ?? 0, 0);
      buf.writeUInt8(game.title.length, 1);
      buf.writeUInt16LE(game.block_offset ?? 0, 2);
      buf.writeUInt16LE(game.block_count ?? 0, 4);
      buf.writeUInt8(game.save_type ?? 0, 6);
      buf.writeUInt8(game.save_slot ?? 0, 7);
      buf.writeUInt16LE(game.keysValue ?? 0, 8);
      buf.fill(0, 10, 16);
      buf.write(title, 16, 0x30, 'utf16le');
      item_list = Buffer.concat([item_list, buf]);
      c++;
    }
  }
  return item_list;
}

// 编译ROM与写出
export function writeCompilation(compilation: Buffer, sector_map: string[], sector_size: number, output_file: string, split: boolean, flash_size: number, status: Buffer, item_list: Buffer, status_offset: number, item_list_offset: number, menu_rom: Buffer, cartridge_type: number, battery_present: boolean): void {
  const rom_size = sector_map.join('').replace(/\.+$/, '').length * sector_size;
  // 计算 ROM code - 使用实际的status和item_list数据
  const rom_code = 'L' + crypto.createHash('sha1').update(Buffer.concat([status, item_list])).digest('hex').slice(0, 3).toUpperCase();
  compilation.write(rom_code, 0xAC, 'ascii');
  // 校验和
  let checksum = 0;
  for (let i = 0xA0; i < 0xBD; i++) {
    checksum -= compilation[i];
  }
  checksum = (checksum - 0x19) & 0xFF;
  compilation[0xBD] = checksum;

  logp('');
  logp(`Menu ROM:        0x${(0).toString(16).padStart(8, '0').toUpperCase()}–0x${menu_rom.length.toString(16).padStart(8, '0').toUpperCase()}`);
  logp(`Game List:       0x${(item_list_offset * sector_size).toString(16).padStart(8, '0').toUpperCase()}–0x${(item_list_offset * sector_size + item_list.length).toString(16).padStart(8, '0').toUpperCase()}`);
  logp(`Status Area:     0x${(status_offset * sector_size).toString(16).padStart(8, '0').toUpperCase()}–0x${(status_offset * sector_size + 0x1000).toString(16).padStart(8, '0').toUpperCase()}`);
  logp('');
  logp(`Cartridge Type:  ${cartridge_type + 1} (${cartridgeTypes[cartridge_type].name}) ${battery_present ? 'with battery' : 'without battery'}`);
  logp(`Output ROM Size: ${(rom_size / 1024 / 1024).toFixed(2)} MiB`);
  logp(`Output ROM Code: ${rom_code}`);

  // 替换输出文件名中的 <CODE> 占位符
  const outFile = output_file.replace('<CODE>', rom_code);
  // 分割写出
  if (split) {
    for (let i = 0; i < Math.ceil(flash_size / 0x2000000); i++) {
      const pos = i * 0x2000000;
      let size = 0x2000000;
      if (pos > rom_size) break;
      if (pos + size > rom_size) size = rom_size - pos;
      const ext = path.extname(outFile);
      const base = outFile.slice(0, -ext.length);
      const output_file_part = `${base}_part${i}${ext}`;
      fs.writeFileSync(output_file_part, compilation.subarray(pos, pos + size));
    }
  } else {
    fs.writeFileSync(outFile, compilation.subarray(0, rom_size));
  }
}

// 写出日志
export function writeLog(logContent: string, args: ArgsConfig): void {
  logContent += `\nArgument List: ${process.argv.slice(2).join(' ')}\n`;
  logContent += '\n################################\n\n';
  fs.writeFileSync('log.txt', logContent, { encoding: 'utf-8' });
}

// 主流程入口
async function main() {
  const args = parseArgs();
  // 基本ROM文件检查
  const baseRom = 'lk_multimenu.gba';
  if (!fs.existsSync(baseRom)) {
    logp(`Error: The Menu ROM (${baseRom}) is missing.`);
    return;
  }
  // 配置读取
  const { games, cartridge_type, battery_present, min_rom_size } = readConfigOrCreate(args);
  // 编译准备
  const { flash_size, sector_size, block_size, compilation, sector_map } = prepareCompilation(cartridge_type);
  // 读取Menu ROM
  const { menu_rom } = readMenuRom(baseRom, sector_size, compilation);
  // 更新背景
  await updateBackgroundImage(menu_rom, args);
  // 初始化扇区映射
  const menuSectors = Math.ceil(menu_rom.length / sector_size);
  updateSectorMap(sector_map, 0, menuSectors, 'm');
  // item list 扇区偏移
  let itemListByteOffset = menu_rom.length;
  itemListByteOffset = 0x40000 - (itemListByteOffset % 0x40000) + itemListByteOffset;
  const item_list_sector = Math.ceil(itemListByteOffset / sector_size);
  updateSectorMap(sector_map, item_list_sector, 1, 'l');
  // status area
  const status_sector = item_list_sector + 1;
  updateSectorMap(sector_map, status_sector, 1, 'c');
  // 写入状态数据
  const statusData = Buffer.from(battery_present ? [0x4B, 0x55, 0x4D, 0x41, 0x00, 0x01, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0] : [0x4B, 0x55, 0x4D, 0x41, 0x00, 0x00, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]);
  statusData.copy(compilation, status_sector * sector_size);
  const save_data_sector = status_sector + 1;
  // 导入存档并添加ROM
  const { games: validGames, saves_read, save_end_offset, roms_keys } = importSaveDataAndAddRom(games, sector_size, min_rom_size, battery_present, compilation, sector_map, save_data_sector);
  const bootLogoFound = addRomData(validGames, compilation, sector_map, sector_size, block_size, save_end_offset, true);
  // 生成item list
  const itemList = generateItemList(validGames, roms_keys, battery_present, block_size, sector_size, save_data_sector);
  itemList.copy(compilation, item_list_sector * sector_size);
  // 写出ROM
  writeCompilation(compilation, sector_map, sector_size, args.output, args.split, flash_size, statusData, itemList, status_sector, item_list_sector, menu_rom, cartridge_type, battery_present);
  // 写出日志
  if (!args.noLog) writeLog(log, args);
}

main().catch((e: unknown) => { console.error(e); });
