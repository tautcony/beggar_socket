import { describe, expect, it } from 'vitest';

import { resolveAutoScrollEnabled } from '@/utils/log-viewer';

describe('resolveAutoScrollEnabled', () => {
  it('在用户未覆盖时，日志较少默认启用自动滚动', () => {
    expect(resolveAutoScrollEnabled(false, 10, false)).toBe(true);
  });

  it('在用户未覆盖时，日志较多默认禁用自动滚动', () => {
    expect(resolveAutoScrollEnabled(true, 120, false)).toBe(false);
  });

  it('在用户已覆盖时，保持用户当前选择', () => {
    expect(resolveAutoScrollEnabled(true, 120, true)).toBe(true);
    expect(resolveAutoScrollEnabled(false, 10, true)).toBe(false);
  });
});
