import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import enUS from '@/i18n/locales/en-US.json';
import jaJP from '@/i18n/locales/ja-JP.json';
import ruRU from '@/i18n/locales/ru-RU.json';
import zhHans from '@/i18n/locales/zh-Hans.json';
import zhHant from '@/i18n/locales/zh-Hant.json';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): Set<string> {
  const keys = new Set<string>();
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const nested of flattenKeys(value as Record<string, unknown>, fullKey)) {
        keys.add(nested);
      }
    } else {
      keys.add(fullKey);
    }
  }
  return keys;
}

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (/\.(vue|ts|js)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('i18n locales', () => {
  const localeMap = {
    'zh-Hans': zhHans,
    'zh-Hant': zhHant,
    'en-US': enUS,
    'ja-JP': jaJP,
    'ru-RU': ruRU,
  } as const;

  it('keeps identical key sets across all locale files', () => {
    const baseKeys = flattenKeys(zhHans);
    for (const [locale, messages] of Object.entries(localeMap)) {
      const localeKeys = flattenKeys(messages);
      const missing = [...baseKeys].filter(key => !localeKeys.has(key));
      const extra = [...localeKeys].filter(key => !baseKeys.has(key));
      expect(missing, `${locale} missing keys`).toEqual([]);
      expect(extra, `${locale} extra keys`).toEqual([]);
    }
  });

  it('defines every static translation key referenced in src/', () => {
    const baseKeys = flattenKeys(zhHans);
    const srcDir = path.resolve(process.cwd(), 'src');
    const keyRegex = /(?:\$t|\bt)\(\s*['"]([^'"]+)['"]/g;
    const missing: string[] = [];

    for (const file of collectSourceFiles(srcDir)) {
      const content = fs.readFileSync(file, 'utf8');
      for (const match of content.matchAll(keyRegex)) {
        const key = match[1];
        if (!key.includes('${') && !baseKeys.has(key)) {
          missing.push(`${path.relative(srcDir, file)}: ${key}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
