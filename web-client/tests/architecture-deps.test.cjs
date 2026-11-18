const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');

const load = createRequire(__filename);
const script = path.resolve(__dirname, '../scripts/check-architecture-deps.cjs');
let root;

function fixture(files) {
  root = mkdtempSync(path.join(tmpdir(), 'architecture-deps-'));
  writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
    moduleResolution: 'bundler', module: 'esnext', paths: { '@/*': ['./src/*'], '#/*': ['./src/*'] },
  } }));
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(root, 'src', name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return load(script).analyzeProject(root);
}

afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); });

describe('architecture dependency gate', () => {
  it.each([
    "import { value } from '@/protocol';",
    "import { value } from '../protocol';",
    "import('#/protocol');",
    "import '../protocol/index.ts';",
    "export { value } from '../protocol';",
    "export * from '@/protocol';",
    "const protocol = require('../protocol');",
    "type Protocol = import('../protocol').Value;",
  ])('blocks syntax: %s', (source) => {
    const result = fixture({ 'components/Bad.ts': source, 'protocol/index.ts': 'export const value = 1; export type Value = number;' });
    expect(result.violations).toHaveLength(1);
    expect(result.edges[0].target).toBe('protocol/index.ts');
    expect(result.edges[0].line).toBe(1);
  });

  it('ignores fake imports in comments, strings and Vue templates', () => {
    const result = fixture({ 'components/Good.vue': `<template><div>from '@/protocol'</div></template>
<script setup lang="ts">
// import bad from '@/protocol';
const text = "from '@/protocol'";
</script>` });
    expect(result.edges).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('parses both Vue scripts and tracks original locations', () => {
    const result = fixture({ 'components/Bad.vue': `<script lang="ts">import '@/protocol';</script>
<script setup lang="ts">import('../protocol');</script>
<template><div /></template>`, 'protocol/index.ts': 'export {};' });
    expect(result.violations).toHaveLength(2);
    expect(result.edges.map(edge => edge.line)).toEqual([1, 2]);
  });

  it('resolves explicit extensions, custom aliases and Vue modules', () => {
    const result = fixture({ 'app.ts': "import '#/components/Good.vue'; import './helper.js';", 'helper.ts': 'export {};', 'components/Good.vue': '<template><div /></template>' });
    expect(result.edges.map(edge => edge.target)).toEqual(['components/Good.vue', 'helper.ts']);
    expect(result.errors).toEqual([]);
  });

  it('allows public protocol entrypoints and composition factories', () => {
    const result = fixture({ 'services/good.ts': "import '../protocol';", 'protocol/index.ts': 'export {};', 'platform/serial/factory.ts': "import './tauri/transport';", 'platform/serial/tauri/transport.ts': 'export {};' });
    expect(result.violations).toEqual([]);
  });

  it.each([
    ['utils/bad.ts', 'services/helper.ts'],
    ['types/bad.ts', 'services/helper.ts'],
    ['views/Bad.ts', 'protocol/index.ts'],
    ['components/operaiton/Bad.ts', 'platform/serial/factory.ts'],
    ['components/operaiton/Bad.ts', 'services/helper.ts'],
    ['components/operaiton/Bad.ts', 'features/burner/application/helper.ts'],
    ['protocol/bad.ts', 'platform/serial/tauri/transport.ts'],
    ['protocol/bad.ts', 'platform/serial/web/transport.ts'],
    ['protocol/bad.ts', 'platform/serial/transports.ts'],
    ['protocol/bad.ts', 'services/serial-service.ts'],
    ['services/bad.ts', 'protocol/internal.ts'],
    ['features/burner/application/bad.ts', 'platform/serial/types.ts'],
    ['features/burner/application/bad.ts', 'services/helper.ts'],
  ])('preserves the boundary %s -> %s for type edges', (source, target) => {
    const specifier = `@/${target.replace(/\.ts$/, '')}`;
    const result = fixture({ [source]: `import type { Value } from '${specifier}';`, [target]: 'export type Value = number;' });
    expect(result.violations).toHaveLength(1);
    expect(result.edges[0].kind).toBe('type');
    expect(result.cycles).toEqual([]);
  });

  it('enforces the current Tauri ESLint zone and permits the factory', async () => {
    const { ESLint } = await import('eslint');
    const eslint = new ESLint({ cwd: path.resolve(__dirname, '..') });
    const forbidden = await eslint.lintText("import { TauriDeviceGateway } from '@/platform/serial/tauri/device-gateway';\n", {
      filePath: 'src/protocol/index.ts',
    });
    expect(forbidden[0].messages.some(message => message.ruleId === 'import-x/no-restricted-paths')).toBe(true);
    const legal = await eslint.lintText("import { TauriDeviceGateway } from '@/platform/serial/tauri/device-gateway';\n", { filePath: 'src/platform/serial/factory.ts' });
    expect(legal[0].messages.some(message => message.ruleId === 'import-x/no-restricted-paths')).toBe(false);
  }, 20000);

  it.each(["import type { Value } from './a';", "import { type Value } from './a';", "export type { Value } from './a';", "export { type Value } from './a';", "type Value = import('./a').Value;"])(
    'excludes type-only return edges: %s', (source) => {
      const result = fixture({ 'a.ts': "import './b'; export type Value = number;", 'b.ts': source });
      expect(result.cycles).toEqual([]);
      expect(result.edges.find(edge => edge.source === 'b.ts').kind).toBe('type');
    },
  );

  it('reports a traversable multi-node runtime cycle with locations', () => {
    const result = fixture({ 'a.ts': "import './b';", 'b.ts': "export * from './c';", 'c.ts': "import('./a');" });
    expect(result.cycles).toHaveLength(1);
    expect(result.cycles[0].map(edge => edge.source)).toEqual(['a.ts', 'b.ts', 'c.ts']);
    expect(result.cycles[0].at(-1).target).toBe('a.ts');
    const cli = spawnSync(process.execPath, [script, '--root', root], { encoding: 'utf8' });
    expect(cli.status).toBe(1);
    expect(cli.stderr).toContain('a.ts:1');
    expect(cli.stderr).toContain('Runtime dependency cycles');
  });

  it('detects self cycles and distinct cyclic components', () => {
    const result = fixture({ 'a.ts': "import './a';", 'b.ts': "import './c';", 'c.ts': "import './b';" });
    expect(result.cycles).toHaveLength(2);
  });

  it('handles mixed value/type imports and runtime reexports', () => {
    const result = fixture({ 'a.ts': "import { type Value, value } from './b';", 'b.ts': "export * from './a'; export const value = 1; export type Value = number;" });
    expect(result.cycles).toHaveLength(1);
  });

  it('scans external Vue script sources and declaration edges', () => {
    const result = fixture({ 'components/Bad.vue': '<script src="../protocol/index.ts" lang="ts"></script><template><div /></template>', 'protocol/index.ts': 'export {};', 'a.ts': "import './b';", 'b.d.ts': "import './a';" });
    expect(result.violations).toHaveLength(1);
    expect(result.edges.find(edge => edge.source === 'b.d.ts').kind).toBe('type');
    expect(result.cycles).toEqual([]);
  });

  it('fails unresolved internal imports but ignores packages and assets', () => {
    const result = fixture({ 'app.ts': "import '@/missing'; import './missing'; import 'vue'; import './style.css';" });
    expect(result.errors).toHaveLength(2);
    expect(result.errors.every(error => error.reason.includes('Unresolved'))).toBe(true);
  });

  it('preserves leading hash aliases while removing query and fragment suffixes', () => {
    const result = fixture({ 'components/Bad.ts': "import '#/protocol?raw'; import '#/protocol#fragment';", 'protocol/index.ts': 'export {};' });
    expect(result.violations).toHaveLength(2);
    expect(result.errors).toEqual([]);
  });

  it.each([
    { compilerOptions: { moduleResolution: 'made-up' } },
    { extends: './missing-config.json' },
  ])('fails closed on invalid tsconfig: %j', (config) => {
    fixture({ 'app.ts': 'export {};' });
    writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify(config));
    expect(() => load(script).analyzeProject(root)).toThrow();
    const cli = spawnSync(process.execPath, [script, '--root', root], { encoding: 'utf8' });
    expect(cli.status).toBe(1);
    expect(cli.stderr).toContain('Architecture dependency check failed');
  });

  it('reports parse failures and succeeds with a clean CLI fixture', () => {
    const result = fixture({ 'bad.ts': 'import { from;' });
    expect(result.errors.length).toBeGreaterThan(0);
    writeFileSync(path.join(root, 'src/bad.ts'), 'export {};');
    const cli = spawnSync(process.execPath, [script, '--root', root], { encoding: 'utf8' });
    expect(cli.status).toBe(0);
    expect(cli.stdout).toContain('No architecture dependency violations');
  });
});
