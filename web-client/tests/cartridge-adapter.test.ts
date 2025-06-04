import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CartridgeAdapter, EnhancedProgressCallback, LogCallback, ProgressCallback, ProgressInfo } from '@/services/cartridge-adapter';
import { DeviceInfo } from '@/types/device-info';
import { CommandOptions } from '@/types/command-options';

// 创建测试用的具体实现类
class TestCartridgeAdapter extends CartridgeAdapter {
  async readID() {
    return { success: true, message: 'Test ID', idStr: 'TEST123' };
  }

  async getROMSize() {
    return { deviceSize: 1024, sectorCount: 16, sectorSize: 64, bufferWriteBytes: 256 };
  }

  async eraseChip() {
    this.log('Erasing chip', 'info');
    return { success: true, message: 'Chip erased successfully' };
  }

  async eraseSectors(startAddress: number, endAddress: number, sectorSize: number) {
    this.log(`Erasing sectors from ${startAddress} to ${endAddress}`, 'info');
    return { success: true, message: 'Sectors erased successfully' };
  }

  async writeROM(fileData: Uint8Array, options?: CommandOptions) {
    this.updateProgress(50, 'Writing ROM...');
    this.sendEnhancedProgress(this.createProgressInfo(50, 'Writing ROM...', fileData.length, fileData.length / 2));
    return { success: true, message: 'ROM written successfully' };
  }

  async readROM(size: number, baseAddress: number = 0) {
    this.updateProgress(100, 'ROM read complete');
    return { success: true, message: 'ROM read successfully', data: new Uint8Array(size) };
  }

  async verifyROM(fileData: Uint8Array, baseAddress: number = 0) {
    return { success: true, message: 'ROM verification successful' };
  }

  async writeRAM(fileData: Uint8Array, options?: CommandOptions) {
    return { success: true, message: 'RAM written successfully' };
  }

  async readRAM(size: number, options?: CommandOptions) {
    return { success: true, message: 'RAM read successfully', data: new Uint8Array(size) };
  }

  async verifyRAM(fileData: Uint8Array, options?: CommandOptions) {
    return { success: true, message: 'RAM verification successful' };
  }
}

describe('CartridgeAdapter', () => {
  let mockDevice: DeviceInfo;
  let logCallback: LogCallback;
  let progressCallback: ProgressCallback;
  let enhancedProgressCallback: EnhancedProgressCallback;
  let translateFunc: (key: string, params?: any) => string;
  let adapter: TestCartridgeAdapter;

  beforeEach(() => {
    mockDevice = {
      port: {} as SerialPort, // Mock SerialPort object
      reader: null,
      writer: null,
    };

    logCallback = vi.fn();
    progressCallback = vi.fn();
    enhancedProgressCallback = vi.fn();
    translateFunc = vi.fn((key: string, params?: any) => `translated_${key}`);
  });

  describe('constructor', () => {
    it('should initialize with all callbacks provided', () => {
      adapter = new TestCartridgeAdapter(
        mockDevice,
        logCallback,
        progressCallback,
        translateFunc,
        enhancedProgressCallback,
      );

      expect(adapter['device']).toBe(mockDevice);
      expect(adapter['log']).toBe(logCallback);
      expect(adapter['updateProgress']).toBe(progressCallback);
      expect(adapter['updateEnhancedProgress']).toBe(enhancedProgressCallback);
      expect(adapter['t']).toBe(translateFunc);
    });

    it('should initialize with null callbacks and use defaults', () => {
      adapter = new TestCartridgeAdapter(mockDevice);

      expect(adapter['device']).toBe(mockDevice);
      expect(typeof adapter['log']).toBe('function');
      expect(typeof adapter['updateProgress']).toBe('function');
      expect(adapter['updateEnhancedProgress']).toBeNull();
      expect(typeof adapter['t']).toBe('function');
    });

    it('should handle default log callback', () => {
      adapter = new TestCartridgeAdapter(mockDevice);
      // Should not throw when calling default log callback
      expect(() => adapter['log']('test message')).not.toThrow();
    });

    it('should handle default progress callback', () => {
      adapter = new TestCartridgeAdapter(mockDevice);
      // Should not throw when calling default progress callback
      expect(() => adapter['updateProgress'](50)).not.toThrow();
    });

    it('should handle default translate function', () => {
      adapter = new TestCartridgeAdapter(mockDevice);
      const result = adapter['t']('test_key', { param: 'value' });
      expect(result).toBe('test_key');
    });
  });

  describe('abstract methods implementation', () => {
    beforeEach(() => {
      adapter = new TestCartridgeAdapter(
        mockDevice,
        logCallback,
        progressCallback,
        translateFunc,
        enhancedProgressCallback,
      );
    });

    it('should implement readID method', async () => {
      const result = await adapter.readID();
      expect(result).toEqual({ success: true, message: 'Test ID', idStr: 'TEST123' });
    });

    it('should implement getROMSize method', async () => {
      const result = await adapter.getROMSize();
      expect(result).toEqual({
        deviceSize: 1024,
        sectorCount: 16,
        sectorSize: 64,
        bufferWriteBytes: 256,
      });
    });

    it('should implement eraseChip method', async () => {
      const result = await adapter.eraseChip();
      expect(result).toEqual({ success: true, message: 'Chip erased successfully' });
      expect(logCallback).toHaveBeenCalledWith('Erasing chip', 'info');
    });

    it('should implement eraseSectors method', async () => {
      const result = await adapter.eraseSectors(0, 1023, 64);
      expect(result).toEqual({ success: true, message: 'Sectors erased successfully' });
      expect(logCallback).toHaveBeenCalledWith('Erasing sectors from 0 to 1023', 'info');
    });

    it('should implement writeROM method', async () => {
      const fileData = new Uint8Array([1, 2, 3, 4]);
      const result = await adapter.writeROM(fileData);

      expect(result).toEqual({ success: true, message: 'ROM written successfully' });
      expect(progressCallback).toHaveBeenCalledWith(50, 'Writing ROM...');
      expect(enhancedProgressCallback).toHaveBeenCalledWith({
        progress: 50,
        detail: 'Writing ROM...',
        totalBytes: 4,
        transferredBytes: 2,
        startTime: undefined,
        currentSpeed: undefined,
        allowCancel: undefined,
      });
    });

    it('should implement readROM method', async () => {
      const result = await adapter.readROM(512, 0);
      expect(result.success).toBe(true);
      expect(result.message).toBe('ROM read successfully');
      expect(result.data).toBeInstanceOf(Uint8Array);
      expect(result.data?.length).toBe(512);
      expect(progressCallback).toHaveBeenCalledWith(100, 'ROM read complete');
    });

    it('should implement verifyROM method', async () => {
      const fileData = new Uint8Array([1, 2, 3, 4]);
      const result = await adapter.verifyROM(fileData, 0);
      expect(result).toEqual({ success: true, message: 'ROM verification successful' });
    });

    it('should implement writeRAM method', async () => {
      const fileData = new Uint8Array([1, 2, 3, 4]);
      const options: CommandOptions = { ramType: 'SRAM' };
      const result = await adapter.writeRAM(fileData, options);
      expect(result).toEqual({ success: true, message: 'RAM written successfully' });
    });

    it('should implement readRAM method', async () => {
      const options: CommandOptions = { ramType: 'SRAM' };
      const result = await adapter.readRAM(256, options);
      expect(result.success).toBe(true);
      expect(result.message).toBe('RAM read successfully');
      expect(result.data).toBeInstanceOf(Uint8Array);
      expect(result.data?.length).toBe(256);
    });

    it('should implement verifyRAM method', async () => {
      const fileData = new Uint8Array([1, 2, 3, 4]);
      const options: CommandOptions = { ramType: 'SRAM' };
      const result = await adapter.verifyRAM(fileData, options);
      expect(result).toEqual({ success: true, message: 'RAM verification successful' });
    });
  });

  describe('base CartridgeAdapter abstract methods', () => {
    let baseAdapter: CartridgeAdapter;

    beforeEach(() => {
      baseAdapter = new CartridgeAdapter(mockDevice, logCallback, progressCallback, translateFunc);
    });

    it('should throw error for unimplemented readID', async () => {
      await expect(baseAdapter.readID()).rejects.toThrow('未实现的方法: readID');
    });

    it('should throw error for unimplemented getROMSize', async () => {
      await expect(baseAdapter.getROMSize()).rejects.toThrow('未实现的方法: getROMSize');
    });

    it('should throw error for unimplemented eraseChip', async () => {
      await expect(baseAdapter.eraseChip()).rejects.toThrow('未实现的方法: eraseChip');
    });

    it('should throw error for unimplemented eraseSectors', async () => {
      await expect(baseAdapter.eraseSectors(0, 1023, 64)).rejects.toThrow('未实现的方法: eraseSectors');
    });

    it('should throw error for unimplemented writeROM', async () => {
      const fileData = new Uint8Array([1, 2, 3, 4]);
      await expect(baseAdapter.writeROM(fileData)).rejects.toThrow('未实现的方法: writeROM');
    });

    it('should throw error for unimplemented readROM', async () => {
      await expect(baseAdapter.readROM(512)).rejects.toThrow('未实现的方法: readROM');
    });

    it('should throw error for unimplemented verifyROM', async () => {
      const fileData = new Uint8Array([1, 2, 3, 4]);
      await expect(baseAdapter.verifyROM(fileData)).rejects.toThrow('未实现的方法: verifyROM');
    });

    it('should throw error for unimplemented writeRAM', async () => {
      const fileData = new Uint8Array([1, 2, 3, 4]);
      await expect(baseAdapter.writeRAM(fileData)).rejects.toThrow('未实现的方法: writeRAM');
    });

    it('should throw error for unimplemented readRAM', async () => {
      await expect(baseAdapter.readRAM(256)).rejects.toThrow('未实现的方法: readRAM');
    });

    it('should throw error for unimplemented verifyRAM', async () => {
      const fileData = new Uint8Array([1, 2, 3, 4]);
      await expect(baseAdapter.verifyRAM(fileData)).rejects.toThrow('未实现的方法: verifyRAM');
    });
  });

  describe('progress handling', () => {
    beforeEach(() => {
      adapter = new TestCartridgeAdapter(
        mockDevice,
        logCallback,
        progressCallback,
        translateFunc,
        enhancedProgressCallback,
      );
    });

    it('should send enhanced progress with all parameters', () => {
      const progressInfo: ProgressInfo = {
        progress: 75,
        detail: 'Processing...',
        totalBytes: 1000,
        transferredBytes: 750,
        startTime: Date.now(),
        currentSpeed: 50.5,
        allowCancel: true,
      };

      adapter['sendEnhancedProgress'](progressInfo);

      expect(progressCallback).toHaveBeenCalledWith(75, 'Processing...');
      expect(enhancedProgressCallback).toHaveBeenCalledWith(progressInfo);
    });

    it('should handle missing enhanced progress callback', () => {
      const adapterWithoutEnhanced = new TestCartridgeAdapter(
        mockDevice,
        logCallback,
        progressCallback,
        translateFunc,
        null,
      );

      const progressInfo: ProgressInfo = { progress: 50 };

      expect(() => adapterWithoutEnhanced['sendEnhancedProgress'](progressInfo)).not.toThrow();
      expect(progressCallback).toHaveBeenCalledWith(50, undefined);
    });

    it('should create progress info with all parameters', () => {
      const progressInfo = adapter['createProgressInfo'](
        80,
        'Almost done',
        2000,
        1600,
        Date.now(),
        100.5,
        false,
      );

      expect(progressInfo).toEqual({
        progress: 80,
        detail: 'Almost done',
        totalBytes: 2000,
        transferredBytes: 1600,
        startTime: expect.any(Number),
        currentSpeed: 100.5,
        allowCancel: false,
      });
    });

    it('should create progress info with minimal parameters', () => {
      const progressInfo = adapter['createProgressInfo'](25);

      expect(progressInfo).toEqual({
        progress: 25,
        detail: undefined,
        totalBytes: undefined,
        transferredBytes: undefined,
        startTime: undefined,
        currentSpeed: undefined,
        allowCancel: undefined,
      });
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      adapter = new TestCartridgeAdapter(
        mockDevice,
        logCallback,
        progressCallback,
        translateFunc,
        enhancedProgressCallback,
      );
    });

    it('should handle empty file data', async () => {
      const emptyData = new Uint8Array(0);
      const result = await adapter.writeROM(emptyData);
      expect(result.success).toBe(true);
    });

    it('should handle large file data', async () => {
      const largeData = new Uint8Array(1024 * 1024); // 1MB
      const result = await adapter.writeROM(largeData);
      expect(result.success).toBe(true);
    });

    it('should handle zero size read operations', async () => {
      const result = await adapter.readROM(0);
      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(0);
    });

    it('should handle different base addresses', async () => {
      const fileData = new Uint8Array([1, 2, 3, 4]);
      const result1 = await adapter.verifyROM(fileData, 0);
      const result2 = await adapter.verifyROM(fileData, 0x8000);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });
});
