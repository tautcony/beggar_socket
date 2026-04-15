import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (entry.name.endsWith('.ts') || entry.name.endsWith('.vue')) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('Architecture serial boundary', () => {
  it('protocol layer must not import concrete serial implementations', () => {
    const testsDir = path.dirname(fileURLToPath(import.meta.url));
    const root = path.resolve(testsDir, '../src/protocol');
    const files = walk(root);
    const violations: string[] = [];
    const forbiddenImports = [
      "from '@/services/serial-service'",
      "from '@/platform/serial/tauri",
      "from '@/platform/serial/web",
      "from '@/platform/serial/transports",
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      if (forbiddenImports.some(pattern => content.includes(pattern))) {
        violations.push(path.relative(path.resolve(testsDir, '..'), file));
      }
    }

    expect(violations).toEqual([]);
  });

  it('application/service layers must not import protocol internals', () => {
    const testsDir = path.dirname(fileURLToPath(import.meta.url));
    const roots = [
      path.resolve(testsDir, '../src/features'),
      path.resolve(testsDir, '../src/services'),
    ];
    const violations: string[] = [];

    for (const root of roots) {
      const files = walk(root);
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes("from '@/protocol/beggar_socket/")) {
          violations.push(path.relative(path.resolve(testsDir, '..'), file));
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('burner application layer must not import runtime serial/services implementations directly', () => {
    const testsDir = path.dirname(fileURLToPath(import.meta.url));
    const root = path.resolve(testsDir, '../src/features/burner/application');
    const files = walk(root);
    const violations: string[] = [];
    const forbiddenImports = [
      "from '@/platform/serial/",
      "from '@/services/",
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      if (forbiddenImports.some(pattern => content.includes(pattern))) {
        violations.push(path.relative(path.resolve(testsDir, '..'), file));
      }
    }

    expect(violations).toEqual([]);
  });

  it('operation presentation components must not import platform/services/orchestration implementations', () => {
    const testsDir = path.dirname(fileURLToPath(import.meta.url));
    const root = path.resolve(testsDir, '../src/components/operaiton');
    const files = walk(root);
    const violations: string[] = [];
    const forbiddenImports = [
      "from '@/platform/",
      "from '@/services/",
      "from '@/features/burner/application/",
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      if (forbiddenImports.some(pattern => content.includes(pattern))) {
        violations.push(path.relative(path.resolve(testsDir, '..'), file));
      }
    }

    expect(violations).toEqual([]);
  });
});
