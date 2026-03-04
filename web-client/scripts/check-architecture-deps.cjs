#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_ROOT = path.join(ROOT, 'src');
const TARGET_EXTS = new Set(['.ts', '.vue']);

const LEGACY_ALLOWLIST = new Set([]);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
      continue;
    }
    const ext = path.extname(entry.name);
    if (TARGET_EXTS.has(ext)) {
      files.push(full);
    }
  }
  return files;
}

function readImports(content) {
  const imports = [];
  const importRegex = /from\s+['"]@\/([^'"]+)['"]/g;
  let match = importRegex.exec(content);
  while (match) {
    imports.push(match[1]);
    match = importRegex.exec(content);
  }
  return imports;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function topLevel(relPath) {
  return relPath.split('/')[0] || '';
}

function checkViolation(sourceRel, importRel) {
  const sourceTop = topLevel(sourceRel);
  const importTop = topLevel(importRel);
  if (LEGACY_ALLOWLIST.has(sourceRel)) {
    return null;
  }

  if ((sourceTop === 'components' || sourceTop === 'views') && importTop === 'protocol') {
    return 'UI layer (components/views) must not directly import protocol layer';
  }

  if ((sourceTop === 'types' || sourceTop === 'utils') && importTop === 'services') {
    return 'types/utils layer must not directly import services layer';
  }

  if (sourceTop === 'protocol' && (importRel === 'services/serial-service' || importRel.startsWith('services/serial-service/'))) {
    return 'protocol layer must not directly import services/serial-service; use platform/serial transport contracts';
  }

  if (
    sourceTop === 'protocol'
    && (
      importRel.startsWith('platform/serial/electron')
      || importRel.startsWith('platform/serial/web')
      || importRel.startsWith('platform/serial/transports')
    )
  ) {
    return 'protocol layer must not import runtime-specific serial implementations; use platform/serial transport contracts';
  }

  if (
    (sourceTop === 'services' || sourceTop === 'features')
    && importRel.startsWith('protocol/')
    && importRel !== 'protocol'
  ) {
    return 'application/service layers must consume protocol via @/protocol entrypoint, not protocol internals';
  }

  if (
    sourceRel.startsWith('features/burner/application/')
    && (
      importRel.startsWith('platform/serial/')
      || importRel.startsWith('services/')
    )
  ) {
    return 'features/burner/application must depend on burner domain ports/adapters, not runtime serial/services implementations';
  }

  return null;
}

function main() {
  const files = walk(SRC_ROOT);
  const violations = [];
  const matrix = new Map();

  for (const filePath of files) {
    const rel = toPosix(path.relative(SRC_ROOT, filePath));
    const content = fs.readFileSync(filePath, 'utf8');
    const imports = readImports(content);

    for (const imp of imports) {
      const key = `${topLevel(rel)} -> ${topLevel(imp)}`;
      matrix.set(key, (matrix.get(key) || 0) + 1);

      const reason = checkViolation(rel, imp);
      if (reason) {
        violations.push({ source: rel, import: imp, reason });
      }
    }
  }

  console.log('Architecture dependency matrix (top-level):');
  const sorted = Array.from(matrix.entries()).sort((a, b) => b[1] - a[1]);
  for (const [edge, count] of sorted.slice(0, 30)) {
    console.log(`  ${String(count).padStart(3, ' ')}  ${edge}`);
  }

  if (violations.length === 0) {
    console.log('\nNo architecture dependency violations found.');
    return;
  }

  console.error('\nArchitecture dependency violations found:');
  for (const item of violations) {
    console.error(`- ${item.source} -> @/${item.import}`);
    console.error(`  Reason: ${item.reason}`);
  }

  process.exitCode = 1;
}

main();
