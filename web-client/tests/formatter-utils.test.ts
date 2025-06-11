import { describe, expect, it } from 'vitest';

import { formatBytes, formatSpeed, formatTime } from '../src/utils/formatter-utils';

describe('formatter-utils', () => {
  describe('formatBytes', () => {
    it('应该正确格式化0字节', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('应该正确格式化字节数', () => {
      expect(formatBytes(512)).toBe('512.0 B');
      expect(formatBytes(1023)).toBe('1023.0 B');
    });

    it('应该正确格式化KB', () => {
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(2048)).toBe('2.0 KB');
    });

    it('应该正确格式化MB', () => {
      expect(formatBytes(1048576)).toBe('1.0 MB');
      expect(formatBytes(1572864)).toBe('1.5 MB');
      expect(formatBytes(5242880)).toBe('5.0 MB');
    });

    it('应该正确格式化GB', () => {
      expect(formatBytes(1073741824)).toBe('1.0 GB');
      expect(formatBytes(2147483648)).toBe('2.0 GB');
    });

    it('应该处理小数点精度', () => {
      expect(formatBytes(1025)).toBe('1.0 KB');
      expect(formatBytes(1075)).toBe('1.0 KB');
      expect(formatBytes(1126)).toBe('1.1 KB');
    });
  });

  describe('formatSpeed', () => {
    it('应该正确格式化0速度', () => {
      expect(formatSpeed(0)).toBe('0 KB/s');
    });

    it('应该正确格式化KB/s', () => {
      expect(formatSpeed(512)).toBe('512.0 KB/s');
      expect(formatSpeed(1023)).toBe('1023.0 KB/s');
    });

    it('应该正确格式化MB/s', () => {
      expect(formatSpeed(1024)).toBe('1.0 MB/s');
      expect(formatSpeed(1536)).toBe('1.5 MB/s');
      expect(formatSpeed(2048)).toBe('2.0 MB/s');
    });

    it('应该处理小数点精度', () => {
      expect(formatSpeed(1025)).toBe('1.0 MB/s');
      expect(formatSpeed(1126)).toBe('1.1 MB/s');
    });
  });

  describe('formatTime', () => {
    it('应该正确格式化0时间', () => {
      expect(formatTime(0)).toBe('00:00');
      expect(formatTime(0, 'ms')).toBe('00:00');
      expect(formatTime(0, 's', true)).toBe('00:00.0');
      expect(formatTime(0, 'ms', true)).toBe('00:00.0');
    });

    it('应该正确格式化秒数', () => {
      expect(formatTime(30)).toBe('00:30');
      expect(formatTime(59)).toBe('00:59');
    });

    it('应该正确格式化分钟', () => {
      expect(formatTime(60)).toBe('01:00');
      expect(formatTime(90)).toBe('01:30');
      expect(formatTime(125)).toBe('02:05');
    });

    it('应该正确格式化大于1小时的时间', () => {
      expect(formatTime(3600)).toBe('60:00');
      expect(formatTime(3661)).toBe('61:01');
    });

    it('应该正确处理毫秒单位', () => {
      expect(formatTime(30000, 'ms')).toBe('00:30');
      expect(formatTime(90500, 'ms')).toBe('01:30');
      expect(formatTime(500, 'ms')).toBe('00:00');
    });

    it('应该正确显示毫秒（100ms最小单位）', () => {
      expect(formatTime(30.15, 's', true)).toBe('00:30.1');
      expect(formatTime(30.95, 's', true)).toBe('00:30.9');
      expect(formatTime(1550, 'ms', true)).toBe('00:01.5');
      expect(formatTime(1990, 'ms', true)).toBe('00:01.9');
      expect(formatTime(125.25, 's', true)).toBe('02:05.2');
    });

    it('应该处理边界值', () => {
      expect(formatTime(1)).toBe('00:01');
      expect(formatTime(999, 'ms')).toBe('00:00');
      expect(formatTime(1000, 'ms')).toBe('00:01');
      expect(formatTime(1, 's', true)).toBe('00:01.0');
      expect(formatTime(999, 'ms', true)).toBe('00:00.9');
      expect(formatTime(1000, 'ms', true)).toBe('00:01.0');
    });

    it('应该正确处理小于100ms的值', () => {
      expect(formatTime(50, 'ms', true)).toBe('00:00.0');
      expect(formatTime(150, 'ms', true)).toBe('00:00.1');
      expect(formatTime(250, 'ms', true)).toBe('00:00.2');
    });
  });
});
