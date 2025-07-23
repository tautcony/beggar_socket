/* eslint-disable @typescript-eslint/unbound-method */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DebugSettings } from '../src/settings/debug-settings';

describe('DebugSettings', () => {
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => localStorageMock[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          localStorageMock[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete localStorageMock[key];
        }),
        clear: vi.fn(() => {
          localStorageMock = {};
        }),
      },
      writable: true,
    });

    // Reset settings to default values
    DebugSettings.debugMode = false;
    DebugSettings.showDebugPanel = false;
    DebugSettings.simulatedDelay = 1000;
    DebugSettings.progressUpdateInterval = 100;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('debugMode', () => {
    it('应该有默认值false', () => {
      expect(DebugSettings.debugMode).toBe(false);
    });

    it('应该可以设置和获取debugMode', () => {
      DebugSettings.debugMode = true;
      expect(DebugSettings.debugMode).toBe(true);
    });

    it('应该在设置时保存到localStorage', () => {
      DebugSettings.debugMode = true;
      expect(localStorage.setItem).toHaveBeenCalledWith('debug_mode', 'true');
    });
  });

  describe('showDebugPanel', () => {
    it('应该有默认值false', () => {
      expect(DebugSettings.showDebugPanel).toBe(false);
    });

    it('应该可以设置和获取showDebugPanel', () => {
      DebugSettings.showDebugPanel = true;
      expect(DebugSettings.showDebugPanel).toBe(true);
    });

    it('应该在设置时保存到localStorage', () => {
      DebugSettings.showDebugPanel = true;
      expect(localStorage.setItem).toHaveBeenCalledWith('show_debug_panel', 'true');
    });
  });

  describe('simulatedDelay', () => {
    it('应该有默认值1000', () => {
      expect(DebugSettings.simulatedDelay).toBe(1000);
    });

    it('应该可以设置和获取simulatedDelay', () => {
      DebugSettings.simulatedDelay = 2000;
      expect(DebugSettings.simulatedDelay).toBe(2000);
    });

    it('应该确保延迟时间不小于0', () => {
      DebugSettings.simulatedDelay = -100;
      expect(DebugSettings.simulatedDelay).toBe(0);
    });
  });

  describe('progressUpdateInterval', () => {
    it('应该有默认值100', () => {
      expect(DebugSettings.progressUpdateInterval).toBe(100);
    });

    it('应该可以设置和获取progressUpdateInterval', () => {
      DebugSettings.progressUpdateInterval = 200;
      expect(DebugSettings.progressUpdateInterval).toBe(200);
    });

    it('应该确保更新间隔不小于50', () => {
      DebugSettings.progressUpdateInterval = 10;
      expect(DebugSettings.progressUpdateInterval).toBe(50);
    });
  });

  describe('static methods', () => {
    it('delay方法应该返回Promise', async () => {
      DebugSettings.debugMode = true; // 确保调试模式启用
      DebugSettings.simulatedDelay = 10;
      const start = Date.now();
      await DebugSettings.delay();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(9); // 允许一些误差
    });

    it('shouldSimulateError方法应该返回boolean', () => {
      const result = DebugSettings.shouldSimulateError();
      expect(typeof result).toBe('boolean');
    });

    it('createMockDeviceInfo应该返回设备信息对象', () => {
      const deviceInfo = DebugSettings.createMockDeviceInfo();

      expect(deviceInfo).toHaveProperty('port');
      expect(deviceInfo).toHaveProperty('reader');
      expect(deviceInfo).toHaveProperty('writer');
    });

    it('loadSettings应该从localStorage加载设置', () => {
      // 设置localStorage值
      localStorageMock.debug_mode = 'true';
      localStorageMock.show_debug_panel = 'true';

      DebugSettings.init();

      expect(DebugSettings.debugMode).toBe(true);
      expect(DebugSettings.showDebugPanel).toBe(true);
    });
  });

  describe('error simulation', () => {
    it('shouldSimulateError应该根据错误概率返回结果', () => {
      // 设置错误概率为0，应该不模拟错误
      DebugSettings.errorProbability = 0;
      let hasError = false;
      for (let i = 0; i < 100; i++) {
        if (DebugSettings.shouldSimulateError()) {
          hasError = true;
          break;
        }
      }
      expect(hasError).toBe(false);

      // 设置错误概率为1，应该总是模拟错误
      DebugSettings.debugMode = true;
      DebugSettings.simulateErrors = true;
      DebugSettings.errorProbability = 1;
      expect(DebugSettings.shouldSimulateError()).toBe(true);
    });
  });

  describe('localStorage integration', () => {
    it('应该在localStorage中持久化设置', () => {
      DebugSettings.debugMode = true;
      DebugSettings.showDebugPanel = true;

      // 验证localStorage被调用
      expect(localStorage.setItem).toHaveBeenCalledWith('debug_mode', 'true');
      expect(localStorage.setItem).toHaveBeenCalledWith('show_debug_panel', 'true');
    });

    it('应该处理localStorage中的无效值', () => {
      localStorageMock.debug_mode = 'invalid';

      // 应该不会抛出错误，而是使用默认值
      expect(() => { DebugSettings.init(); }).not.toThrow();
    });
  });
});
