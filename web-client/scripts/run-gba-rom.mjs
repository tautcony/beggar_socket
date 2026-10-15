import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Command, Option } from 'commander';
import { Wrapper } from 'gbats';
import { Jimp } from 'jimp';
import { createServer } from 'vite';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const options = new Command()
  .description('Run a local GBA ROM with a software framebuffer and the application save bridge.')
  .requiredOption('--rom <path>', 'local ROM path (.gba or .rom)')
  .option('--sav <path>', 'optional raw SAV to import before the first frame')
  .addOption(new Option('--scenario <name>', 'input sequence').choices(['boot', 'goodboy', 'goodboy-reload']).default('boot'))
  .option('--frames <count>', 'frames for the boot scenario', '300')
  .option('--out <directory>', 'new output directory; an existing directory is rejected')
  .option('--without-arm-compat', 'diagnostic: reproduce upstream behavior without the application CPU fix')
  .parse()
  .opts();

const bootFrames = Number(options.frames);
if (!Number.isSafeInteger(bootFrames) || bootFrames < 1) {
  throw new Error('--frames must be a positive integer.');
}
if (options.scenario === 'goodboy-reload' && !options.sav) {
  throw new Error('The goodboy-reload scenario requires --sav.');
}

const romPath = resolve(options.rom);
const savePath = options.sav ? resolve(options.sav) : null;
const romBytes = await readFile(romPath);
const saveBytes = savePath ? await readFile(savePath) : null;
const outputDir = options.out
  ? resolve(options.out)
  : join(projectRoot, 'artifacts', `gba-rom-${new Date().toISOString().replaceAll(/[:.]/g, '-')}`);
await mkdir(dirname(outputDir), { recursive: true });
await mkdir(outputDir); // Never overwrite earlier results or input fixtures.

// Use Vite's existing TS loader without opening an HTTP listener or loading the
// app's Vite config. The probe exercises the actual application implementation.
const loader = await createServer({
  configFile: false,
  root: projectRoot,
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
});
let bridge;
let applyGbatsArmCompatibility;
try {
  bridge = await loader.ssrLoadModule('/src/components/emulator/gba-save-bridge.ts');
  ({ applyGbatsArmCompatibility } = await loader.ssrLoadModule('/src/components/emulator/gbats-arm-compat.ts'));
} finally {
  await loader.close();
}

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const report = {
  status: 'running',
  scenario: options.scenario,
  armCompatibility: !options.withoutArmCompat,
  rom: { path: romPath, bytes: romBytes.length, sha256: sha256(romBytes) },
  inputSave: saveBytes ? { path: savePath, bytes: saveBytes.length, sha256: sha256(saveBytes) } : null,
  frames: 0,
  renderedFrames: 0,
  checkpoints: 0,
  warnings: 0,
  warningSamples: [],
  errors: [],
  stages: [],
  importMatches: null,
  importPrefixMatches: null,
  importExactMatch: null,
};
let pixels;
let activeFrame = 0;
const canvas = {
  getContext: () => ({
    createImageData: (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
    putImageData: image => {
      pixels = image;
      report.renderedFrames += 1;
    },
  }),
};

function newCore(renderCanvas) {
  const wrapper = new Wrapper({ rom: Uint8Array.from(romBytes).buffer, canvas: renderCanvas, updateMethod: 'manual' });
  wrapper.emulator.pause();
  if (!options.withoutArmCompat) applyGbatsArmCompatibility(wrapper.emulator);
  return wrapper;
}

async function snapshot(name) {
  if (!pixels) return;
  const filename = `${name}.png`;
  const image = Jimp.fromBitmap({ data: Buffer.from(pixels.data), width: pixels.width, height: pixels.height });
  await image.write(join(outputDir, filename));
  report.stages.push({ name, frames: report.frames, screenshot: filename });
  console.log(JSON.stringify({ stage: name, frames: report.frames, checkpoints: report.checkpoints, warnings: report.warnings }));
}

let wrapper;
let dispose;
let latestCheckpoint;
let importedCapacity;
try {
  wrapper = newCore(canvas);
  const core = wrapper.emulator;
  report.privMask = core.cpu.PRIV_MASK;
  report.saveDescriptor = bridge.inspectGbaSave(core);
  core.setLogger((level, message) => {
    if (level > 0 && (level & core.LOG_ERROR) !== 0) {
      report.errors.push({ frame: activeFrame, message: String(message) });
    } else if (level > 0 && (level & core.LOG_WARN) !== 0) {
      report.warnings += 1;
      if (report.warningSamples.length < 20) report.warningSamples.push({ frame: activeFrame, message: String(message) });
    }
  });
  if (saveBytes) {
    const imported = bridge.importGbaSave(core, saveBytes);
    importedCapacity = imported.descriptor.capacity;
    const captured = bridge.captureGbaSave(core, importedCapacity);
    const comparedLength = saveBytes.length;
    report.importPrefixMatches = Buffer.from(captured.data.subarray(0, comparedLength))
      .equals(Buffer.from(saveBytes.subarray(0, comparedLength)));
    report.importMatches = report.importPrefixMatches;
    report.importExactMatch = Buffer.from(captured.data).equals(saveBytes);
    if (!report.importPrefixMatches) throw new Error('Imported SAV prefix does not match immediate capture.');
  }
  dispose = bridge.attachSettledSaveListener(core, () => true, () => importedCapacity, checkpoint => {
    latestCheckpoint = checkpoint;
    report.checkpoints += 1;
  }, error => { throw error; });

  const advance = count => {
    for (let i = 0; i < count; i += 1) {
      activeFrame = report.frames + 1;
      wrapper.frame();
      report.frames += 1;
      if (report.errors.length) throw new Error(report.errors.at(-1).message);
    }
  };
  const press = (key, duration, frames) => {
    wrapper.press(core.keypad[key], duration);
    advance(frames);
  };

  if (options.scenario === 'goodboy') {
    // Preserve the exact sequence used to reproduce the language-menu warning
    // and FIQ return crash, then continue through dialogue and into gameplay.
    advance(300);
    await snapshot('language');
    press('A', 6, 120);
    advance(600);
    press('START', 6, 120);
    for (let i = 0; i < 3; i += 1) press('A', 6, 120);
    advance(3000);
    await snapshot('dialogue');
    for (let i = 0; i < 80; i += 1) press('A', 6, 60);
    await snapshot('after-dialogue');
    for (let i = 0; i < 50; i += 1) {
      wrapper.press(core.keypad.RIGHT, 54);
      if (i % 4 === 0) wrapper.press(core.keypad.A, 6);
      advance(60);
    }
    await snapshot('moving-right');
  } else if (options.scenario === 'goodboy-reload') {
    advance(300);
    for (let i = 0; i < 50; i += 1) press('A', 6, 60);
  } else {
    advance(bootFrames);
  }
  await snapshot('final');

  if (report.saveDescriptor) {
    const exported = bridge.captureGbaSave(core, importedCapacity);
    await writeFile(join(outputDir, 'output.sav'), exported.data, { flag: 'wx' });
    report.outputSave = { file: 'output.sav', bytes: exported.data.length, sha256: sha256(exported.data) };
    const reload = newCore();
    try {
      const imported = bridge.importGbaSave(reload.emulator, exported.data);
      const recaptured = bridge.captureGbaSave(reload.emulator, imported.descriptor.capacity);
      report.exportReimportMatches = Buffer.from(recaptured.data).equals(Buffer.from(exported.data));
      if (!report.exportReimportMatches) throw new Error('Exported SAV does not match capture in a fresh core.');
    } finally {
      reload.emulator.pause();
    }
  }
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = { frame: activeFrame, message: String(error), stack: error?.stack };
  if (wrapper) {
    const cpu = wrapper.emulator.cpu;
    report.cpu = { mode: cpu.mode, spsr: cpu.spsr >>> 0, pc: cpu.gprs[cpu.PC] >>> 0, execMode: cpu.execMode };
  }
  await snapshot('failure');
  if (latestCheckpoint) {
    await writeFile(join(outputDir, 'last-checkpoint.sav'), latestCheckpoint.data, { flag: 'wx' });
    report.recoverySave = { file: 'last-checkpoint.sav', bytes: latestCheckpoint.data.length, sha256: sha256(latestCheckpoint.data) };
  }
} finally {
  dispose?.();
  wrapper?.emulator.pause();
  report.rom.unchanged = sha256(await readFile(romPath)) === report.rom.sha256;
  if (savePath) report.inputSave.unchanged = sha256(await readFile(savePath)) === report.inputSave.sha256;
  if (!report.rom.unchanged || report.inputSave?.unchanged === false) {
    report.status = 'failed';
    report.integrityError = 'An input file changed during the run.';
  }
  await writeFile(join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
}
console.log(JSON.stringify({ status: report.status, frames: report.frames, outputDir, failure: report.failure?.message }));
process.exitCode = report.status === 'passed' ? 0 : 1;
