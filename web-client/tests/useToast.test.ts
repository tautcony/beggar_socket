import { describe, expect, it, vi } from 'vitest';

import { useToast } from '../src/composables/useToast';

describe('useToast', () => {
  it('应该返回showToast函数', () => {
    const { showToast } = useToast();
    expect(typeof showToast).toBe('function');
  });

  it('应该触发自定义事件', () => {
    const { showToast } = useToast();
    const eventListener = vi.fn();

    window.addEventListener('show-toast', eventListener);

    showToast('测试消息', 'success', 3000);

    expect(eventListener).toHaveBeenCalledOnce();
    expect(eventListener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          message: '测试消息',
          type: 'success',
          duration: 3000,
        },
      }),
    );

    window.removeEventListener('show-toast', eventListener);
  });

  it('应该使用默认参数', () => {
    const { showToast } = useToast();
    const eventListener = vi.fn();

    window.addEventListener('show-toast', eventListener);

    showToast('默认参数测试');

    expect(eventListener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          message: '默认参数测试',
          type: 'success',
          duration: 3000,
        },
      }),
    );

    window.removeEventListener('show-toast', eventListener);
  });

  it('应该支持不同的消息类型', () => {
    const { showToast } = useToast();
    const eventListener = vi.fn();

    window.addEventListener('show-toast', eventListener);

    // 测试错误类型
    showToast('错误消息', 'error');
    expect(eventListener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          type: 'error',
        }),
      }),
    );

    // 测试idle类型
    showToast('空闲消息', 'idle');
    expect(eventListener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          type: 'idle',
        }),
      }),
    );

    window.removeEventListener('show-toast', eventListener);
  });

  it('应该支持自定义持续时间', () => {
    const { showToast } = useToast();
    const eventListener = vi.fn();

    window.addEventListener('show-toast', eventListener);

    showToast('自定义时长', 'success', 5000);

    expect(eventListener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          duration: 5000,
        }),
      }),
    );

    window.removeEventListener('show-toast', eventListener);
  });
});
