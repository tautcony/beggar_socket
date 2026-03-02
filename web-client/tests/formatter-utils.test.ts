import { describe, expect, it } from 'vitest';

import { formatBytes, formatSpeed, formatTimeClock } from '../src/utils/formatter-utils';

describe('formatter-utils', () => {
  describe('formatBytes', () => {
    it('formats zero bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('formats raw bytes without unit scaling', () => {
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(1023)).toBe('1023 B');
    });

    it('formats KiB with fixed one decimal place', () => {
      expect(formatBytes(1024)).toBe('1.0 KiB');
      expect(formatBytes(1536)).toBe('1.5 KiB');
      expect(formatBytes(2048)).toBe('2.0 KiB');
    });

    it('formats MiB with fixed one decimal place', () => {
      expect(formatBytes(1048576)).toBe('1.0 MiB');
      expect(formatBytes(1572864)).toBe('1.5 MiB');
      expect(formatBytes(5242880)).toBe('5.0 MiB');
    });

    it('formats GiB with fixed one decimal place', () => {
      expect(formatBytes(1073741824)).toBe('1.0 GiB');
      expect(formatBytes(2147483648)).toBe('2.0 GiB');
    });

    it('handles decimal precision near unit boundaries', () => {
      expect(formatBytes(1025)).toBe('1.0 KiB');
      expect(formatBytes(1075)).toBe('1.0 KiB');
      expect(formatBytes(1126)).toBe('1.1 KiB');
    });
  });

  describe('formatSpeed', () => {
    it('formats zero speed', () => {
      expect(formatSpeed(0)).toBe('0 B/s');
    });

    it('formats KiB/s', () => {
      expect(formatSpeed(512 * 1024)).toBe('512 KiB/s');
      expect(formatSpeed(1023 * 1024)).toBe('1023 KiB/s');
    });

    it('formats MiB/s and GiB/s', () => {
      expect(formatSpeed(1024 * 1024 * 1024)).toBe('1 GiB/s');
      expect(formatSpeed(1536 * 1024)).toBe('1.5 MiB/s');
      expect(formatSpeed(2048 * 1024)).toBe('2 MiB/s');
    });

    it('handles speed decimal precision', () => {
      expect(formatSpeed(1025 * 1024)).toBe('1.0 MiB/s');
      expect(formatSpeed(1126 * 1024)).toBe('1.1 MiB/s');
    });
  });

  describe('formatTime', () => {
    it('formats zero time', () => {
      expect(formatTimeClock(0)).toBe('00:00');
      expect(formatTimeClock(0, 'ms')).toBe('00:00');
      expect(formatTimeClock(0, 's', true)).toBe('00:00.0');
      expect(formatTimeClock(0, 'ms', true)).toBe('00:00.0');
    });

    it('formats seconds', () => {
      expect(formatTimeClock(30)).toBe('00:30');
      expect(formatTimeClock(59)).toBe('00:59');
    });

    it('formats minutes', () => {
      expect(formatTimeClock(60)).toBe('01:00');
      expect(formatTimeClock(90)).toBe('01:30');
      expect(formatTimeClock(125)).toBe('02:05');
    });

    it('formats large durations', () => {
      expect(formatTimeClock(3600)).toBe('60:00');
      expect(formatTimeClock(3661)).toBe('61:01');
    });

    it('handles ms unit conversion', () => {
      expect(formatTimeClock(30000, 'ms')).toBe('00:30');
      expect(formatTimeClock(90500, 'ms')).toBe('01:30');
      expect(formatTimeClock(500, 'ms')).toBe('00:00');
    });

    it('shows deciseconds when enabled', () => {
      expect(formatTimeClock(30.15, 's', true)).toBe('00:30.1');
      expect(formatTimeClock(30.95, 's', true)).toBe('00:30.9');
      expect(formatTimeClock(1550, 'ms', true)).toBe('00:01.5');
      expect(formatTimeClock(1990, 'ms', true)).toBe('00:01.9');
      expect(formatTimeClock(125.25, 's', true)).toBe('02:05.2');
    });

    it('handles boundary values', () => {
      expect(formatTimeClock(1)).toBe('00:01');
      expect(formatTimeClock(999, 'ms')).toBe('00:00');
      expect(formatTimeClock(1000, 'ms')).toBe('00:01');
      expect(formatTimeClock(1, 's', true)).toBe('00:01.0');
      expect(formatTimeClock(999, 'ms', true)).toBe('00:00.9');
      expect(formatTimeClock(1000, 'ms', true)).toBe('00:01.0');
    });

    it('handles sub-100ms values', () => {
      expect(formatTimeClock(50, 'ms', true)).toBe('00:00.0');
      expect(formatTimeClock(150, 'ms', true)).toBe('00:00.1');
      expect(formatTimeClock(250, 'ms', true)).toBe('00:00.2');
    });
  });
});
