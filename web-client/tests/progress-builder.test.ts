import { describe, expect, it } from 'vitest';

import { ProgressInfoBuilder } from '../src/utils/progress/progress-builder';

describe('ProgressInfoBuilder', () => {
  describe('basic builder functionality', () => {
    it('should create empty progress info by default', () => {
      const builder = new ProgressInfoBuilder();
      const info = builder.build();

      expect(info).toEqual({});
    });

    it('should set operation type', () => {
      const info = ProgressInfoBuilder.create()
        .type('write')
        .build();

      expect(info.type).toBe('write');
    });

    it('should set progress percentage', () => {
      const info = ProgressInfoBuilder.create()
        .progress(75)
        .build();

      expect(info.progress).toBe(75);
    });

    it('should clamp progress to 0-100 range', () => {
      const info1 = ProgressInfoBuilder.create()
        .progress(-10)
        .build();

      const info2 = ProgressInfoBuilder.create()
        .progress(150)
        .build();

      expect(info1.progress).toBe(0);
      expect(info2.progress).toBe(100);
    });

    it('should set detail message', () => {
      const detail = 'Erasing sector 5 of 10';
      const info = ProgressInfoBuilder.create()
        .detail(detail)
        .build();

      expect(info.detail).toBe(detail);
    });

    it('should set start time', () => {
      const startTime = Date.now();
      const info = ProgressInfoBuilder.create()
        .startTime(startTime)
        .build();

      expect(info.startTime).toBe(startTime);
    });

    it('should set current speed', () => {
      const speed = 1024; // KiB/s
      const info = ProgressInfoBuilder.create()
        .speed(speed)
        .build();

      expect(info.currentSpeed).toBe(speed);
    });

    it('should set cancellable state', () => {
      const info1 = ProgressInfoBuilder.create()
        .cancellable(true)
        .build();

      const info2 = ProgressInfoBuilder.create()
        .cancellable(false)
        .build();

      expect(info1.allowCancel).toBe(true);
      expect(info2.allowCancel).toBe(false);
    });

    it('should default cancellable to true when no parameter', () => {
      const info = ProgressInfoBuilder.create()
        .cancellable()
        .build();

      expect(info.allowCancel).toBe(true);
    });

    it('should set state', () => {
      const info = ProgressInfoBuilder.create()
        .state('running')
        .build();

      expect(info.state).toBe('running');
    });
  });

  describe('bytes functionality', () => {
    it('should set transferred and total bytes', () => {
      const info = ProgressInfoBuilder.create()
        .bytes(512, 1024)
        .build();

      expect(info.transferredBytes).toBe(512);
      expect(info.totalBytes).toBe(1024);
    });

    it('should auto-calculate progress from bytes when progress not set', () => {
      const info = ProgressInfoBuilder.create()
        .bytes(250, 1000)
        .build();

      expect(info.progress).toBe(25);
    });

    it('should not override manually set progress', () => {
      const info = ProgressInfoBuilder.create()
        .progress(50)
        .bytes(250, 1000)
        .build();

      expect(info.progress).toBe(50); // Should remain 50, not 25
    });

    it('should handle zero total bytes gracefully', () => {
      const info = ProgressInfoBuilder.create()
        .bytes(0, 0)
        .build();

      expect(info.transferredBytes).toBe(0);
      expect(info.totalBytes).toBe(0);
      expect(info.progress).toBeUndefined();
    });
  });

  describe('sectors functionality', () => {
    it('should set sector progress information', () => {
      const sectors = [
        { address: 0x0000, size: 4096, state: 'completed' as const },
        { address: 0x1000, size: 4096, state: 'processing' as const },
        { address: 0x2000, size: 4096, state: 'pending' as const },
      ];

      const info = ProgressInfoBuilder.create()
        .sectors(sectors, 1, 1)
        .build();

      expect(info.sectorProgress).toEqual({
        sectors,
        totalSectors: 3,
        completedSectors: 1,
        currentSectorIndex: 1,
      });
    });
  });

  describe('method chaining', () => {
    it('should support fluent interface', () => {
      const info = ProgressInfoBuilder.create()
        .type('write')
        .progress(50)
        .detail('Writing data...')
        .state('running')
        .cancellable(true)
        .speed(1024)
        .bytes(512, 1024)
        .build();

      expect(info.type).toBe('write');
      expect(info.progress).toBe(50);
      expect(info.detail).toBe('Writing data...');
      expect(info.state).toBe('running');
      expect(info.allowCancel).toBe(true);
      expect(info.currentSpeed).toBe(1024);
      expect(info.transferredBytes).toBe(512);
      expect(info.totalBytes).toBe(1024);
    });
  });

  describe('reset functionality', () => {
    it('should reset builder to empty state', () => {
      const builder = ProgressInfoBuilder.create()
        .type('write')
        .progress(50)
        .detail('test');

      builder.reset();
      const info = builder.build();

      expect(info).toEqual({});
    });

    it('should allow reuse after reset', () => {
      const builder = ProgressInfoBuilder.create()
        .type('write')
        .progress(50);

      builder.reset();

      const info = builder
        .type('read')
        .progress(25)
        .build();

      expect(info.type).toBe('read');
      expect(info.progress).toBe(25);
    });
  });

  describe('static factory methods', () => {
    it('should create running operation', () => {
      const info = ProgressInfoBuilder.running('erase').build();

      expect(info.type).toBe('erase');
      expect(info.state).toBe('running');
      expect(info.allowCancel).toBe(true);
    });

    it('should create completed operation', () => {
      const info = ProgressInfoBuilder.completed('verify').build();

      expect(info.type).toBe('verify');
      expect(info.state).toBe('completed');
      expect(info.progress).toBe(100);
      expect(info.allowCancel).toBe(false);
    });

    it('should create error operation', () => {
      const errorMessage = 'Device disconnected';
      const info = ProgressInfoBuilder.error('read', errorMessage).build();

      expect(info.type).toBe('read');
      expect(info.state).toBe('error');
      expect(info.detail).toBe(errorMessage);
      expect(info.allowCancel).toBe(false);
    });
  });

  describe('immutability', () => {
    it('should return copy of internal state', () => {
      const builder = ProgressInfoBuilder.create()
        .type('write')
        .progress(50);

      const info1 = builder.build();
      const info2 = builder.build();

      expect(info1).toEqual(info2);
      expect(info1).not.toBe(info2); // Different objects
    });

    it('should not affect built objects when builder is modified', () => {
      const builder = ProgressInfoBuilder.create()
        .type('write')
        .progress(50);

      const info1 = builder.build();

      builder.progress(75);
      const info2 = builder.build();

      expect(info1.progress).toBe(50);
      expect(info2.progress).toBe(75);
    });
  });
});
