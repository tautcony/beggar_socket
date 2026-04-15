import { accessSync, constants, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { spawn } from 'node:child_process';

function canExecute(filePath) {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveCargoBinDir() {
  const candidates = [
    process.env.CARGO_HOME ? join(process.env.CARGO_HOME, 'bin') : null,
    join(homedir(), '.cargo', 'bin'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }

    const cargoBinary = join(candidate, process.platform === 'win32' ? 'cargo.exe' : 'cargo');
    if (canExecute(cargoBinary)) {
      return candidate;
    }
  }

  return null;
}

const [, , command, ...forwardedArgs] = process.argv;

if (!command || (command !== 'dev' && command !== 'build')) {
  console.error('Usage: node scripts/run-tauri.mjs <dev|build> [...args]');
  process.exit(1);
}

const env = { ...process.env };
const cargoBinDir = resolveCargoBinDir();

if (cargoBinDir) {
  const pathEntries = (env.PATH ?? '').split(delimiter).filter(Boolean);
  if (!pathEntries.includes(cargoBinDir)) {
    env.PATH = [cargoBinDir, ...pathEntries].join(delimiter);
  }
}

const cargoBinaryName = process.platform === 'win32' ? 'cargo.exe' : 'cargo';
const hasCargoOnPath = (env.PATH ?? '')
  .split(delimiter)
  .filter(Boolean)
  .some(entry => canExecute(join(entry, cargoBinaryName)));

if (!hasCargoOnPath) {
  console.error([
    'Rust toolchain not found.',
    'Install rustup/cargo first, or make sure cargo is available on PATH.',
    'If rustup is already installed, try running: source "$HOME/.cargo/env"',
  ].join('\n'));
  process.exit(1);
}

const isWindows = process.platform === 'win32';
const tauriProcess = spawn(
  isWindows ? 'tauri.cmd' : 'tauri',
  [command, ...forwardedArgs],
  {
    env,
    stdio: 'inherit',
    // Windows npm bin shims are .cmd files and must be launched through a shell.
    shell: isWindows,
  },
);

tauriProcess.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

tauriProcess.on('error', (error) => {
  console.error(`Failed to start Tauri CLI: ${error.message}`);
  process.exit(1);
});
