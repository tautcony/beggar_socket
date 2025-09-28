#!/usr/bin/env node

// cli.ts - 命令行接口，用于构建ROM

import { Command } from 'commander';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { basename, dirname, extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

import { buildRom } from './romBuilder.js';
import { BuildInput, BuildOptions, FullConfig, GameConfig } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface BuildCommandOptions {
  config?: string;
  bg?: string;
  output?: string;
  split?: boolean;
  noWait?: boolean;
  noLog?: boolean;
}

const program = new Command();

program
  .name('lk-rom-builder')
  .description('LK MultiMenu ROM Builder CLI')
  .version('1.0.0');

program
  .command('build')
  .description('Build a multi-game ROM')
  .option('--config <file>', 'Configuration file (JSON)', 'config.json')
  .option('--bg <file>', 'Background image file')
  .option('--output <file>', 'Output ROM file', 'LK_MULTIMENU_<CODE>.gba')
  .option('--split', 'Split output into multiple files')
  .option('--no-wait', 'Don\'t wait for user input when finished')
  .option('--no-log', 'Don\'t write a log file')
  .action(async (options: BuildCommandOptions) => {
    try {
      console.log('LK MultiMenu ROM Builder CLI');
      console.log('==============================\n');

      const configPath = resolve(options.config ?? 'config.json');
      const configDir = dirname(configPath);

      // Check if menu ROM exists
      const menuRomPath = resolve('lk_multimenu.gba');
      if (!existsSync(menuRomPath)) {
        console.error('Error: The Menu ROM is missing.');
        console.error('Please put it in the same directory that you are running this tool from.');
        console.error('Expected file name: "lk_multimenu.gba"');
        if (!options.noWait) {
          console.log('\nPress ENTER to exit.');
          process.stdin.resume();
          process.stdin.setEncoding('utf8');
          process.stdin.on('data', () => process.exit(1));
          return;
        }
        process.exit(1);
      }

      // Check if output file is not lk_multimenu.gba
      if (options.output === 'lk_multimenu.gba') {
        console.error('Error: The file must not be named "lk_multimenu.gba"');
        if (!options.noWait) {
          console.log('\nPress ENTER to exit.');
          process.stdin.resume();
          process.stdin.setEncoding('utf8');
          process.stdin.on('data', () => process.exit(1));
          return;
        }
        process.exit(1);
      }

      let config: FullConfig;

      // If config doesn't exist, create it from roms directory
      if (!existsSync(configPath)) {
        console.log(`Configuration file (${configPath}) not found. Creating from roms/ directory...`);

        const romsDir = resolve(configDir, 'roms');
        if (!existsSync(romsDir)) {
          console.error('Error: No configuration file found and "roms" directory does not exist.');
          if (!options.noWait) {
            console.log('\nPress ENTER to exit.');
            process.stdin.resume();
            process.stdin.setEncoding('utf8');
            process.stdin.on('data', () => process.exit(1));
            return;
          }
          process.exit(1);
        }

        const romFiles = getRomFiles(romsDir);
        if (romFiles.length === 0) {
          console.error('Error: No usable ROM files were found in the "roms" folder.');
          if (!options.noWait) {
            console.log('\nPress ENTER to exit.');
            process.stdin.resume();
            process.stdin.setEncoding('utf8');
            process.stdin.on('data', () => process.exit(1));
            return;
          }
          process.exit(1);
        }

        const games: GameConfig[] = [];
        let saveSlot = 1;

        for (const romFile of romFiles) {
          const game: GameConfig = {
            enabled: true,
            file: basename(romFile),
            title: basename(romFile, extname(romFile)),
            title_font: 1,
            save_slot: saveSlot,
          };

          games.push(game);
          saveSlot++;
        }

        config = {
          cartridge: {
            type: 1, // MSP55LV100S
            battery_present: false,
            min_rom_size: 0x400000,
          },
          games,
        };

        writeFileSync(configPath, JSON.stringify(config, null, 4));
        console.log(`A new configuration file (${basename(configPath)}) was created based on the files inside the "roms" folder.`);
        console.log('Please edit the file to your liking in a text editor, then run this tool again.');

        if (!options.noWait) {
          console.log('\nPress ENTER to exit.');
          process.stdin.resume();
          process.stdin.setEncoding('utf8');
          process.stdin.on('data', () => process.exit(1));
          return;
        }
        process.exit(0);
      }

      // Read existing config
      console.log(`Reading config from: ${configPath}`);
      const configData = readFileSync(configPath, 'utf-8');
      config = JSON.parse(configData) as FullConfig;

      // Recalculate ROM sizes based on actual files
      for (const game of config.games) {
        if (!game.enabled) continue;
        const romPath = resolve(configDir, 'roms', game.file);
        if (existsSync(romPath)) {
          try {
            const buffer = readFileSync(romPath);
            let size = buffer.length;

            // If size is not a power of 2, round up to next power of 2
            if ((size & (size - 1)) !== 0) {
              let x = 0x80000;
              while (x < size) x *= 2;
              size = x;
            }

            // Check for batteryless mod or minimum size
            if (size < 0x400000) {
              const batterylessText = 'Batteryless mod by Lesserkuma';
              const bufferStr = buffer.toString('latin1');
              if (bufferStr.includes(batterylessText)) {
                size = Math.max(0x400000, config.cartridge.min_rom_size || 0x400000);
              } else {
                size = Math.max(size, config.cartridge.min_rom_size || 0x400000);
              }
            }

            game.size = size;
          } catch (error) {
            // Keep existing size or set default
            game.size = game.size ?? 0x400000;
          }
        }
      }

      // Read menu ROM
      console.log(`Reading menu ROM from: ${menuRomPath}`);
      const menuRomBuffer = readFileSync(menuRomPath);
      const menuRom = menuRomBuffer.buffer.slice(menuRomBuffer.byteOffset, menuRomBuffer.byteOffset + menuRomBuffer.byteLength);

      // Read ROM files from roms directory
      const romsDir = resolve(configDir, 'roms');
      console.log(`Reading ROM files from: ${romsDir}`);
      const romFiles = new Map<string, ArrayBuffer>();
      if (existsSync(romsDir)) {
        readFilesRecursively(romsDir, romFiles, ['.gba', '.gbc', '.gb']);
      }

      // Read save files (auto-detect from ROM names)
      const saveFiles = new Map<string, ArrayBuffer>();
      if (existsSync(romsDir)) {
        readFilesRecursively(romsDir, saveFiles, ['.sav']);
      }

      // Read background image
      let bgImage: ArrayBuffer | undefined;
      if (options.bg) {
        const bgImagePath = resolve(options.bg);
        console.log(`Reading background image from: ${bgImagePath}`);
        const bgImageBuffer = readFileSync(bgImagePath);
        bgImage = bgImageBuffer.buffer.slice(bgImageBuffer.byteOffset, bgImageBuffer.byteOffset + bgImageBuffer.byteLength);
      } else if (existsSync('bg.png')) {
        console.log('Reading background image from: bg.png');
        const bgImageBuffer = readFileSync('bg.png');
        bgImage = bgImageBuffer.buffer.slice(bgImageBuffer.byteOffset, bgImageBuffer.byteOffset + bgImageBuffer.byteLength);
      }

      // Build options
      const buildOptions: BuildOptions = {
        split: options.split ?? false,
        noLog: options.noLog ?? false,
        bgImage,
        output: options.output ?? 'LK_MULTIMENU_<CODE>.gba',
      };

      // Build input
      const buildInput: BuildInput = {
        config,
        menuRom,
        romFiles,
        saveFiles,
        options: buildOptions,
      };

      console.log('\nBuilding ROM...');
      const result = await buildRom(buildInput);

      // Write output file
      const outputPath = resolve(buildOptions.output.replace('<CODE>', result.code));
      console.log(`Writing output ROM to: ${outputPath}`);
      writeFileSync(outputPath, Buffer.from(result.rom));

      console.log('\nBuild completed successfully!');
      console.log(`ROM Code: ${result.code}`);
      console.log(`Output Size: ${(result.rom.byteLength / 1024 / 1024).toFixed(2)} MB`);

      if (!buildOptions.noLog) {
        console.log('\nBuild Log:');
        console.log('----------');
        console.log(result.log);
      }

      if (!options.noWait) {
        console.log('\nPress ENTER to exit.');
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', () => process.exit(0));
      }

    } catch (error) {
      console.error('Error:', (error as Error).message);
      if (!options.noWait) {
        console.log('\nPress ENTER to exit.');
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', () => process.exit(1));
      }
      process.exit(1);
    }
  });

program
  .command('init-config')
  .description('Create a sample configuration file')
  .requiredOption('-o, --output <file>', 'Output configuration file')
  .action((options: { output: string }) => {
    const sampleConfig: FullConfig = {
      cartridge: {
        type: 1, // MSP55LV100S
        battery_present: true,
        min_rom_size: 0x400000,
      },
      games: [
        {
          enabled: true,
          file: 'game1.gba',
          title: 'Sample Game 1',
          title_font: 1,
          save_slot: 1,
        },
        {
          enabled: true,
          file: 'game2.gba',
          title: 'Sample Game 2',
          title_font: 1,
          save_slot: 2,
        },
      ],
    };

    const outputPath = resolve(options.output);
    writeFileSync(outputPath, JSON.stringify(sampleConfig, null, 2));
    console.log(`Sample configuration written to: ${outputPath}`);
  });

program.parse();

// Helper functions
function getRomFiles(dir: string): string[] {
  const files: string[] = [];
  const items = readdirSync(dir);

  for (const item of items) {
    const itemPath = join(dir, item);
    const stat = statSync(itemPath);

    if (stat.isDirectory()) {
      files.push(...getRomFiles(itemPath));
    } else if (['.gba', '.gbc', '.gb'].includes(extname(item).toLowerCase())) {
      files.push(itemPath);
    }
  }

  return files.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

function readFilesRecursively(dir: string, fileMap: Map<string, ArrayBuffer>, extensions: string[]) {
  const files = readdirSync(dir);

  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      readFilesRecursively(filePath, fileMap, extensions);
    } else if (extensions.some(ext => file.toLowerCase().endsWith(ext))) {
      const relativePath = filePath.replace(dir + '/', '');
      const buffer = readFileSync(filePath);
      fileMap.set(relativePath, buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    }
  }
}
