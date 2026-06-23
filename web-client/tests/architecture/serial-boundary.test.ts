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
  const testFileDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(testFileDir, '../..');

  it('protocol layer must not import concrete serial implementations', () => {
    const root = path.join(projectRoot, 'src/protocol');
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
        violations.push(path.relative(projectRoot, file));
      }
    }

    expect(violations).toEqual([]);
  });

  it('application/service layers must not import protocol internals', () => {
    const roots = [
      path.join(projectRoot, 'src/features'),
      path.join(projectRoot, 'src/services'),
    ];
    const violations: string[] = [];

    for (const root of roots) {
      const files = walk(root);
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes("from '@/protocol/beggar_socket/")) {
          violations.push(path.relative(projectRoot, file));
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('burner application layer must not import runtime serial/services implementations directly', () => {
    const root = path.join(projectRoot, 'src/features/burner/application');
    const files = walk(root);
    const violations: string[] = [];
    const forbiddenImports = [
      "from '@/platform/serial/",
      "from '@/services/",
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      if (forbiddenImports.some(pattern => content.includes(pattern))) {
        violations.push(path.relative(projectRoot, file));
      }
    }

    expect(violations).toEqual([]);
  });

  it('operation presentation components must not import platform/services/orchestration implementations', () => {
    const root = path.join(projectRoot, 'src/components/operaiton');
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
        violations.push(path.relative(projectRoot, file));
      }
    }

    expect(violations).toEqual([]);
  });
});
