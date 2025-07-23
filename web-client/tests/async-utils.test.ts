import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { timeoutIn, withTimeout } from '../src/utils/async-utils';

describe('async-utils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('timeoutIn', () => {
    it('应该在指定时间后抛出错误', async () => {
      const promise = timeoutIn(1000, '超时错误');

      // 快进时间
      vi.advanceTimersByTime(1000);

      await expect(promise).rejects.toThrow('超时错误');
    });

    it('应该使用自定义错误消息', async () => {
      const customMessage = '自定义超时消息';
      const promise = timeoutIn(500, customMessage);

      vi.advanceTimersByTime(500);

      await expect(promise).rejects.toThrow(customMessage);
    });
  });

  describe('withTimeout', () => {
    it('应该在promise完成时返回结果', async () => {
      const mockPromise = Promise.resolve('成功结果');

      const result = await withTimeout(mockPromise, 1000);

      expect(result).toBe('成功结果');
    });

    it('应该在超时时抛出错误', async () => {
      const slowPromise = new Promise(resolve => {
        setTimeout(() => { resolve('慢结果'); }, 2000);
      });

      const timeoutPromise = withTimeout(slowPromise, 1000);

      // 快进到超时时间
      vi.advanceTimersByTime(1000);

      await expect(timeoutPromise).rejects.toThrow('操作超时');
    });

    it('应该使用自定义超时消息', async () => {
      const slowPromise = new Promise(resolve => {
        setTimeout(() => { resolve('慢结果'); }, 2000);
      });

      const customMessage = '自定义超时消息';
      const timeoutPromise = withTimeout(slowPromise, 1000, customMessage);

      vi.advanceTimersByTime(1000);

      await expect(timeoutPromise).rejects.toThrow(customMessage);
    });

    it('应该在promise比超时先完成时返回promise结果', async () => {
      const fastPromise = new Promise(resolve => {
        setTimeout(() => { resolve('快结果'); }, 500);
      });

      const timeoutPromise = withTimeout(fastPromise, 1000);

      // 快进到promise完成时间
      vi.advanceTimersByTime(500);

      const result = await timeoutPromise;
      expect(result).toBe('快结果');
    });

    it('应该处理promise拒绝', async () => {
      const rejectPromise = Promise.reject(new Error('Promise错误'));

      await expect(withTimeout(rejectPromise, 1000)).rejects.toThrow('Promise错误');
    });
  });
});
