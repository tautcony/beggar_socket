import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { isAppNavigationUrl, isSafeExternalUrl } = require('../electron/security-utils.js') as {
  isSafeExternalUrl: (url: string) => boolean;
  isAppNavigationUrl: (url: string, isDev: boolean) => boolean;
};

describe('electron security utils', () => {
  describe('isSafeExternalUrl', () => {
    it('允许 http/https/mailto 协议', () => {
      expect(isSafeExternalUrl('https://example.com')).toBe(true);
      expect(isSafeExternalUrl('http://example.com')).toBe(true);
      expect(isSafeExternalUrl('mailto:test@example.com')).toBe(true);
    });

    it('拒绝危险或无效协议', () => {
      expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false);
      expect(isSafeExternalUrl('not-a-url')).toBe(false);
    });
  });

  describe('isAppNavigationUrl', () => {
    it('允许 file 协议作为应用内部导航', () => {
      expect(isAppNavigationUrl('file:///index.html', false)).toBe(true);
    });

    it('仅在开发环境允许 localhost 页面', () => {
      expect(isAppNavigationUrl('http://localhost:5173/', true)).toBe(true);
      expect(isAppNavigationUrl('http://localhost:5173/', false)).toBe(false);
    });

    it('拒绝外部页面导航', () => {
      expect(isAppNavigationUrl('https://example.com', true)).toBe(false);
    });
  });
});
