import { describe, expect, it, vi } from 'vitest';

import type { CommandResult } from '../src/types/command-result';
import type { DeviceInfo } from '../src/types/device-info';

describe('TypeScript Types', () => {
  describe('CommandResult', () => {
    it('应该允许创建成功的结果', () => {
      const result: CommandResult = {
        success: true,
        message: '操作成功',
      };

      expect(result.success).toBe(true);
      expect(result.message).toBe('操作成功');
      expect(result.data).toBeUndefined();
    });

    it('应该允许创建失败的结果', () => {
      const result: CommandResult = {
        success: false,
        message: '操作失败',
      };

      expect(result.success).toBe(false);
      expect(result.message).toBe('操作失败');
    });

    it('应该允许包含数据的结果', () => {
      const testData = new Uint8Array([1, 2, 3, 4]);
      const result: CommandResult = {
        success: true,
        message: '读取成功',
        data: testData,
      };

      expect(result.success).toBe(true);
      expect(result.message).toBe('读取成功');
      expect(result.data).toEqual(testData);
    });

    it('应该正确处理空数据', () => {
      const result: CommandResult = {
        success: true,
        message: '无数据',
        data: new Uint8Array(0),
      };

      expect(result.data).toEqual(new Uint8Array(0));
      expect(result.data?.length).toBe(0);
    });
  });

  describe('DeviceInfo', () => {
    // 创建mock对象来测试类型
    const createMockSerialPort = (): SerialPort => ({
      readable: null,
      writable: null,
      open: vi.fn(),
      close: vi.fn(),
      forget: vi.fn(),
      getInfo: vi.fn(),
      getSignals: vi.fn(),
      setSignals: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onconnect: null,
      ondisconnect: null,
    } as unknown as SerialPort);

    const createMockReader = (): ReadableStreamDefaultReader<Uint8Array> => ({
      read: vi.fn(),
      releaseLock: vi.fn(),
      cancel: vi.fn(),
      closed: Promise.resolve(undefined),
    } as unknown as ReadableStreamDefaultReader<Uint8Array>);

    const createMockWriter = (): WritableStreamDefaultWriter<Uint8Array> => ({
      write: vi.fn(),
      close: vi.fn(),
      abort: vi.fn(),
      releaseLock: vi.fn(),
      ready: Promise.resolve(undefined),
      closed: Promise.resolve(undefined),
      desiredSize: 0,
    } as unknown as WritableStreamDefaultWriter<Uint8Array>);

    it('应该允许创建完整的设备信息', () => {
      const port = createMockSerialPort();
      const reader = createMockReader();
      const writer = createMockWriter();

      const deviceInfo: DeviceInfo = {
        port,
        reader,
        writer,
      };

      expect(deviceInfo.port).toBe(port);
      expect(deviceInfo.reader).toBe(reader);
      expect(deviceInfo.writer).toBe(writer);
    });

    it('应该允许null的reader和writer', () => {
      const port = createMockSerialPort();

      const deviceInfo: DeviceInfo = {
        port,
        reader: null,
        writer: null,
      };

      expect(deviceInfo.port).toBe(port);
      expect(deviceInfo.reader).toBeNull();
      expect(deviceInfo.writer).toBeNull();
    });

    it('应该正确处理部分初始化的设备', () => {
      const port = createMockSerialPort();
      const reader = createMockReader();

      const deviceInfo: DeviceInfo = {
        port,
        reader,
        writer: null,
      };

      expect(deviceInfo.port).toBe(port);
      expect(deviceInfo.reader).toBe(reader);
      expect(deviceInfo.writer).toBeNull();
    });
  });

  describe('Type Safety', () => {
    it('CommandResult应该强制包含必需字段', () => {
      // 这个测试确保TypeScript编译器会捕获缺少必需字段的错误
      // 在实际编译时，以下代码会产生类型错误

      // @ts-expect-error - 缺少message字段
      const invalidResult1: CommandResult = {
        success: true,
      };

      // @ts-expect-error - 缺少success字段
      const invalidResult2: CommandResult = {
        message: '测试',
      };

      // 这些期望是为了让测试通过，实际上在编译时会有错误
      expect(invalidResult1).toBeDefined();
      expect(invalidResult2).toBeDefined();
    });

    it('DeviceInfo应该强制包含所有必需字段', () => {
      // @ts-expect-error - 缺少必需字段
      const invalidDeviceInfo: DeviceInfo = {
        port: null as unknown as SerialPort,
      };

      expect(invalidDeviceInfo).toBeDefined();
    });

    it('应该允许正确的类型扩展', () => {
      // 扩展CommandResult类型
      interface ExtendedCommandResult extends CommandResult {
        timestamp: number;
        operationType: string;
      }

      const extendedResult: ExtendedCommandResult = {
        success: true,
        message: '扩展结果',
        timestamp: Date.now(),
        operationType: 'read',
      };

      expect(extendedResult.success).toBe(true);
      expect(extendedResult.timestamp).toBeTypeOf('number');
      expect(extendedResult.operationType).toBe('read');
    });
  });
});
