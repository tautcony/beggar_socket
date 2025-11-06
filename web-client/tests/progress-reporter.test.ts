import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { ProgressInfo, SectorProgressInfo } from '../src/types/progress-info';
import { ProgressReporter } from '../src/utils/progress/progress-reporter';

describe('ProgressReporter', () => {
  let reporter: ProgressReporter;
  let mockUpdateCallback: Mock<(progressInfo: ProgressInfo) => void>;
  let mockTranslateFunc: Mock<(key: string, params?: Record<string, unknown>) => string>;
  const totalBytes = 1024 * 1024; // 1MB

  beforeEach(() => {
    mockUpdateCallback = vi.fn();
    mockTranslateFunc = vi.fn((key: string) => `translated_${key}`);

    reporter = new ProgressReporter(
      'write',
      totalBytes,
      mockUpdateCallback,
      mockTranslateFunc,
    );
  });

  describe('constructor', () => {
    it('should initialize with correct parameters', () => {
      expect(reporter).toBeInstanceOf(ProgressReporter);
    });
  });

  describe('setSectors', () => {
    it('should set sector information', () => {
      const sectors: SectorProgressInfo[] = [
        { address: 0x0000, size: 4096, state: 'pending' },
        { address: 0x1000, size: 4096, state: 'pending' },
      ];

      reporter.setSectors(sectors);

      // Verify sectors are set by checking reportProgress includes them
      reporter.reportProgress(0, 0, 'test', 0, 0);

      expect(mockUpdateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          sectorProgress: expect.objectContaining({
            sectors,
            totalSectors: 2,
            completedSectors: 0,
            currentSectorIndex: 0,
          }) as Record<string, unknown>,
        }),
      );
    });
  });

  describe('reportStart', () => {
    it('should report start status with correct progress info', () => {
      const message = 'Starting write operation';

      reporter.reportStart(message);

      expect(mockUpdateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'write',
          state: 'running',
          detail: message,
          transferredBytes: 0,
          totalBytes,
          allowCancel: true,
          startTime: expect.any(Number) as number,
        }),
      );
    });
  });

  describe('reportProgress', () => {
    it('should report progress with correct information', () => {
      const transferredBytes = 512 * 1024; // 512KB
      const currentSpeed = 1024; // KiB/s
      const message = 'Writing data...';
      const completedSectors = 2;
      const currentSectorIndex = 3;

      reporter.reportProgress(
        transferredBytes,
        currentSpeed,
        message,
        completedSectors,
        currentSectorIndex,
      );

      expect(mockUpdateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'write',
          state: 'running',
          detail: message,
          transferredBytes,
          totalBytes,
          currentSpeed,
          allowCancel: true,
          startTime: expect.any(Number) as number,
        }),
      );
    });

    it('should include sector progress when sectors are set', () => {
      const sectors: SectorProgressInfo[] = [
        { address: 0x0000, size: 4096, state: 'completed' },
        { address: 0x1000, size: 4096, state: 'processing' },
      ];

      reporter.setSectors(sectors);
      reporter.reportProgress(512, 1024, 'test', 1, 1);

      expect(mockUpdateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          sectorProgress: {
            sectors,
            totalSectors: 2,
            completedSectors: 1,
            currentSectorIndex: 1,
          },
        }),
      );
    });

    it('should work without sector information', () => {
      reporter.reportProgress(512, 1024, 'test');

      const call = mockUpdateCallback.mock.calls[0][0];
      expect(call.sectorProgress).toBeUndefined();
    });
  });

  describe('reportCompleted', () => {
    it('should report completed status', () => {
      const message = 'Write completed successfully';
      const avgSpeed = 2048;

      reporter.reportCompleted(message, avgSpeed);

      expect(mockUpdateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'write',
          state: 'completed',
          detail: message,
          transferredBytes: totalBytes,
          totalBytes,
          currentSpeed: avgSpeed,
          progress: 100,
          allowCancel: false,
          startTime: expect.any(Number) as number,
        }),
      );
    });

    it('should include completed sector information when available', () => {
      const sectors: SectorProgressInfo[] = [
        { address: 0x0000, size: 4096, state: 'completed' },
        { address: 0x1000, size: 4096, state: 'completed' },
      ];

      reporter.setSectors(sectors);
      reporter.reportCompleted('Done', 1024);

      expect(mockUpdateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          sectorProgress: {
            sectors,
            totalSectors: 2,
            completedSectors: 2,
            currentSectorIndex: -1,
          },
        }),
      );
    });
  });

  describe('reportError', () => {
    it('should report error status', () => {
      const errorMessage = 'Device disconnected';

      reporter.reportError(errorMessage);

      expect(mockUpdateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'write',
          state: 'error',
          detail: errorMessage,
          allowCancel: false,
        }),
      );
    });
  });

  describe('updateSectorProgress', () => {
    beforeEach(() => {
      const sectors: SectorProgressInfo[] = [
        { address: 0x0000, size: 4096, state: 'pending' },
        { address: 0x1000, size: 4096, state: 'pending' },
        { address: 0x2000, size: 4096, state: 'pending' },
      ];
      reporter.setSectors(sectors);
    });

    it('should update sector state by address', () => {
      const sectorIndex = reporter.updateSectorProgress(0x1500, 'processing');

      expect(sectorIndex).toBe(1); // Should find sector at 0x1000
    });

    it('should return correct sector index', () => {
      const index1 = reporter.updateSectorProgress(0x0500, 'completed');
      const index2 = reporter.updateSectorProgress(0x2500, 'error');

      expect(index1).toBe(0); // First sector (0x0000-0x0FFF)
      expect(index2).toBe(2); // Third sector (0x2000-0x2FFF)
    });

    it('should return -1 for address not in any sector', () => {
      const sectorIndex = reporter.updateSectorProgress(0x5000, 'completed');

      expect(sectorIndex).toBe(-1);
    });

    it('should handle exact address boundaries', () => {
      const index1 = reporter.updateSectorProgress(0x1000, 'processing'); // Start of sector 1
      const index2 = reporter.updateSectorProgress(0x0FFF, 'completed'); // End of sector 0

      expect(index1).toBe(1);
      expect(index2).toBe(0);
    });
  });

  describe('updateSectorRangeProgress', () => {
    beforeEach(() => {
      const sectors: SectorProgressInfo[] = [
        { address: 0x0000, size: 4096, state: 'pending' },
        { address: 0x1000, size: 4096, state: 'pending' },
        { address: 0x2000, size: 4096, state: 'pending' },
        { address: 0x3000, size: 4096, state: 'pending' },
      ];
      reporter.setSectors(sectors);
    });

    it('should update sectors within address range', () => {
      reporter.updateSectorRangeProgress(0x0500, 0x2500, 'completed');

      // Check by reporting progress to see updated sectors
      reporter.reportProgress(0, 0, 'test');
      const call = mockUpdateCallback.mock.calls[0][0];
      const sectors = call.sectorProgress?.sectors;

      expect(sectors?.[0].state).toBe('pending'); // 0x0000 - outside range
      expect(sectors?.[1].state).toBe('completed'); // 0x1000 - in range
      expect(sectors?.[2].state).toBe('completed'); // 0x2000 - in range
      expect(sectors?.[3].state).toBe('pending'); // 0x3000 - outside range
    });

    it('should handle edge cases with exact boundaries', () => {
      reporter.updateSectorRangeProgress(0x1000, 0x2000, 'error');

      reporter.reportProgress(0, 0, 'test');
      const call = mockUpdateCallback.mock.calls[0][0];
      const sectors = call.sectorProgress?.sectors;

      expect(sectors?.[0].state).toBe('pending'); // 0x0000 - outside range
      expect(sectors?.[1].state).toBe('error'); // 0x1000 - in range
      expect(sectors?.[2].state).toBe('error'); // 0x2000 - in range
      expect(sectors?.[3].state).toBe('pending'); // 0x3000 - outside range
    });

    it('should handle empty range', () => {
      reporter.updateSectorRangeProgress(0x5000, 0x6000, 'completed');

      reporter.reportProgress(0, 0, 'test');
      const call = mockUpdateCallback.mock.calls[0][0];
      const sectors = call.sectorProgress?.sectors;

      // All sectors should remain pending
      sectors?.forEach(sector => {
        expect(sector.state).toBe('pending');
      });
    });
  });

  describe('different operation types', () => {
    it('should work with different operation types', () => {
      const eraseReporter = new ProgressReporter('erase', 1024, mockUpdateCallback, mockTranslateFunc);
      const readReporter = new ProgressReporter('read', 1024, mockUpdateCallback, mockTranslateFunc);

      eraseReporter.reportStart('Erasing...');
      readReporter.reportStart('Reading...');

      expect(mockUpdateCallback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'erase' }),
      );
      expect(mockUpdateCallback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'read' }),
      );
    });
  });
});
