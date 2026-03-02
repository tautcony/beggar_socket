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
  it('protocol layer must not import services/serial-service', () => {
    const testsDir = path.dirname(fileURLToPath(import.meta.url));
    const root = path.resolve(testsDir, '../src/protocol');
    const files = walk(root);
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes("from '@/services/serial-service'")) {
        violations.push(path.relative(path.resolve(testsDir, '..'), file));
      }
    }

    expect(violations).toEqual([]);
  });
});
