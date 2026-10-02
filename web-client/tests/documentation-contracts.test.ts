import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(clientRoot, '..');
const modulesRoot = path.join(clientRoot, 'docs/modules');
const moduleFiles = readdirSync(modulesRoot).filter(file => file.endsWith('.md'));
const evidenceFiles = [
  path.join(clientRoot, 'docs/review-2026-07-31/fix-checklist.md'),
  path.join(repoRoot, 'docs/review-2026-10-02/current-finding-status.md'),
];
const documents = [...moduleFiles.map(file => path.join(modulesRoot, file)), ...evidenceFiles];

interface WorkflowStep {
  run?: string;
  uses?: string;
  with?: Record<string, string>;
}
interface QualityWorkflow {
  jobs: Record<'quality' | 'native', { steps: WorkflowStep[] }>;
}

function repositoryReferences(markdown: string): string[] {
  return [...markdown.matchAll(/`((?:src\/|src-tauri\/|scripts\/|tests\/|\.github\/)[^`]+)`/g)]
    .map(match => match[1]);
}

function brokenLinks(markdown: string, directory: string): string[] {
  return [...markdown.matchAll(/\]\(([^)]+)\)/g)]
    .map(match => match[1].split('#')[0])
    .filter(link => link && !/^https?:\/\//.test(link))
    .filter(link => !existsSync(path.resolve(directory, link)));
}

describe('current architecture documentation contracts', () => {
  it.each(documents)('resolves source, test and workflow references in %s', file => {
    const references = repositoryReferences(readFileSync(file, 'utf8'));
    for (const reference of references) {
      const root = reference.startsWith('.github/') ? repoRoot : clientRoot;
      expect(existsSync(path.join(root, reference)), `${file}: ${reference}`).toBe(true);
    }
  });

  it.each(documents)('resolves local navigation in %s', file => {
    expect(brokenLinks(readFileSync(file, 'utf8'), path.dirname(file))).toEqual([]);
  });

  it('indexes every module and preserves the historic runtime redirect', () => {
    const index = readFileSync(path.join(modulesRoot, 'README.md'), 'utf8');
    for (const file of moduleFiles.filter(moduleFile => moduleFile !== 'README.md')) {
      expect(index, `Unindexed module: ${file}`).toContain(`(${file})`);
    }
    const redirect = readFileSync(path.join(modulesRoot, '07-electron-runtime.md'), 'utf8');
    expect(redirect).toContain('(07-tauri-runtime.md)');
    expect(repositoryReferences(redirect)).toEqual([]);
  });

  it('documents actual ownership and composition entrypoints', () => {
    const allModules = moduleFiles.map(file => readFileSync(path.join(modulesRoot, file), 'utf8')).join('\n');
    for (const entrypoint of [
      'src/features/burner/application/device-operation-owner.ts',
      'src/features/burner/application/command-preparation.ts',
      'src/features/burner/application/command-transaction.ts',
      'src/platform/serial/factory.ts',
      'src/platform/serial/tauri/tauri-serial-transport.ts',
      'src/platform/serial/simulated/runtime.ts',
      'src-tauri/src/native_platform.rs',
      'scripts/check-architecture-deps.cjs',
    ]) {
      expect(repositoryReferences(allModules)).toContain(entrypoint);
      expect(existsSync(path.join(clientRoot, entrypoint))).toBe(true);
    }
  });

  it('keeps documented npm quality commands executable and required in CI', () => {
    const overview = readFileSync(path.join(modulesRoot, '00-overview.md'), 'utf8');
    const commands = [...overview.matchAll(/`npm run ([\w:-]+)`/g)].map(match => `npm run ${match[1]}`);
    const packageJson = JSON.parse(readFileSync(path.join(clientRoot, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    const workflow = parse(readFileSync(path.join(repoRoot, '.github/workflows/check-webclient.yml'), 'utf8')) as QualityWorkflow;
    const qualityRuns = workflow.jobs.quality.steps.map((step: { run?: string }) => step.run);
    expect(commands.length).toBeGreaterThan(0);
    for (const command of commands) {
      expect(packageJson.scripts[command.slice('npm run '.length)]).toBeTypeOf('string');
      expect(qualityRuns).toContain(command);
    }
    const runtime = workflow.jobs.quality.steps.find((step: { uses?: string }) => step.uses?.startsWith('actions/setup-node@'));
    expect(overview).toContain(`Node ${runtime?.with?.['node-version']}`);
    const npmInstall = qualityRuns.find((run?: string) => run?.startsWith('npm install -g npm@'));
    expect(npmInstall).toBeDefined();
    expect(overview).toContain(`npm ${npmInstall?.slice('npm install -g npm@'.length)}`);
    const nativeRuns = workflow.jobs.native.steps.map((step: { run?: string }) => step.run);
    const runtimeDoc = readFileSync(path.join(modulesRoot, '07-tauri-runtime.md'), 'utf8');
    for (const command of ['cargo check --locked', 'cargo test --locked']) {
      expect(runtimeDoc).toContain(`\`${command}\``);
      expect(nativeRuns).toContain(command);
    }
  });

  it('detects a broken local link and extracts removed source references', () => {
    expect(brokenLinks('[runtime](removed-runtime.md)', modulesRoot)).toEqual(['removed-runtime.md']);
    expect(repositoryReferences('`src/removed.ts` and `npm run lint`')).toEqual(['src/removed.ts']);
    expect(existsSync(path.join(clientRoot, 'src/removed.ts'))).toBe(false);
  });
});
