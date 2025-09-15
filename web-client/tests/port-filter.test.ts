import { describe, expect, it } from 'vitest';

import type { SerialPortInfo } from '@/services/serial-service';
import { PortFilters } from '@/utils/port-filter';

describe('重新设计的串口过滤器', () => {
  const mockSTM32Port: SerialPortInfo = {
    path: '/dev/ttyUSB0',
    vendorId: '0483',
    productId: '0721',
    manufacturer: 'STMicroelectronics',
  };

  const mockArduinoPort: SerialPortInfo = {
    path: '/dev/ttyUSB1',
    vendorId: '2341',
    productId: 'abcd',
    manufacturer: 'Arduino LLC',
  };

  const mockCH340Port: SerialPortInfo = {
    path: '/dev/ttyUSB2',
    vendorId: '1a86',
    productId: '7523',
    manufacturer: 'QinHeng Electronics',
  };

  describe('单个设备过滤器', () => {
    it('应该正确过滤设备（vendor + product）', () => {
      const filter = PortFilters.device(0x0483, 0x0721);

      expect(filter(mockSTM32Port)).toBe(true);
      expect(filter(mockArduinoPort)).toBe(false);
      expect(filter.config?.devices).toHaveLength(1);
      expect(filter.config?.devices?.[0]).toEqual({ vendorId: 0x0483, productId: 0x0721 });
    });

    it('应该正确过滤厂商设备（仅 vendor）', () => {
      const filter = PortFilters.device(0x0483);

      expect(filter(mockSTM32Port)).toBe(true);
      expect(filter(mockArduinoPort)).toBe(false);
      expect(filter.config?.devices).toHaveLength(1);
      expect(filter.config?.devices?.[0]).toEqual({ vendorId: 0x0483 });
    });
  });

  describe('多设备过滤器', () => {
    it('应该正确实现 OR 逻辑', () => {
      const filter = PortFilters.devices([
        { vendorId: 0x0483 },
        { vendorId: 0x2341 },
      ]);

      expect(filter(mockSTM32Port)).toBe(true);
      expect(filter(mockArduinoPort)).toBe(true);
      expect(filter(mockCH340Port)).toBe(false);
      expect(filter.config?.devices).toHaveLength(2);
    });
  });

  describe('制造商过滤器', () => {
    it('应该创建带制造商过滤的设备过滤器', () => {
      const filterWithManufacturer = PortFilters.device(0x0483, undefined, 'STMicroelectronics');

      expect(filterWithManufacturer(mockSTM32Port)).toBe(true);
      expect(filterWithManufacturer(mockArduinoPort)).toBe(false);

      // 检查配置中包含制造商信息
      expect(filterWithManufacturer.config?.devices?.[0]?.manufacturer).toBe('STMicroelectronics');
    });

    it('制造商过滤不应该影响 Web Serial 过滤器', () => {
      const deviceFilter = PortFilters.device(0x0483);
      const filterWithManufacturer = PortFilters.device(0x0483, undefined, 'STMicroelectronics');

      const webSerialFilters1 = deviceFilter.toWebSerialFilters?.();
      const webSerialFilters2 = filterWithManufacturer.toWebSerialFilters?.();

      expect(webSerialFilters1).toEqual(webSerialFilters2);
      expect(webSerialFilters1).toEqual([{ usbVendorId: 0x0483 }]);
    });

    it('应该支持多设备配置中的制造商过滤', () => {
      const filter = PortFilters.devices([
        { vendorId: 0x0483, manufacturer: 'STMicroelectronics' },
        { vendorId: 0x2341, manufacturer: 'Arduino' },
      ]);

      expect(filter(mockSTM32Port)).toBe(true);
      expect(filter(mockArduinoPort)).toBe(true);
      expect(filter(mockCH340Port)).toBe(false);
    });
  });

  describe('配置过滤器', () => {
    it('应该根据配置创建单设备过滤器', () => {
      const filter = PortFilters.fromConfig({
        devices: [{ vendorId: 0x0483, productId: 0x0721 }],
      });

      expect(filter(mockSTM32Port)).toBe(true);
      expect(filter(mockArduinoPort)).toBe(false);
    });

    it('应该根据配置创建多设备过滤器', () => {
      const filter = PortFilters.fromConfig({
        devices: [
          { vendorId: 0x0483 },
          { vendorId: 0x2341 },
        ],
      });

      expect(filter(mockSTM32Port)).toBe(true);
      expect(filter(mockArduinoPort)).toBe(true);
      expect(filter(mockCH340Port)).toBe(false);
    });

    it('应该根据配置创建带制造商过滤的过滤器', () => {
      const filter = PortFilters.fromConfig({
        devices: [{ vendorId: 0x0483, manufacturer: 'STMicroelectronics' }],
      });

      expect(filter(mockSTM32Port)).toBe(true);
      expect(filter(mockArduinoPort)).toBe(false);
    });
  });

  describe('Web Serial API 过滤器提取', () => {
    it('应该从单个设备过滤器提取 Web Serial 过滤器', () => {
      const filter = PortFilters.device(0x0483, 0x0721);

      const webSerialFilters = filter.toWebSerialFilters?.();
      expect(webSerialFilters).toHaveLength(1);
      expect(webSerialFilters?.[0]).toEqual({
        usbVendorId: 0x0483,
        usbProductId: 0x0721,
      });
    });

    it('应该从多设备过滤器提取多个 Web Serial 过滤器', () => {
      const filter = PortFilters.devices([
        { vendorId: 0x0483, productId: 0x0721 },
        { vendorId: 0x2341 },
        { vendorId: 0x1a86 },
      ]);

      const webSerialFilters = filter.toWebSerialFilters?.();
      expect(webSerialFilters).toHaveLength(3);
      expect(webSerialFilters).toEqual([
        { usbVendorId: 0x0483, usbProductId: 0x0721 },
        { usbVendorId: 0x2341 },
        { usbVendorId: 0x1a86 },
      ]);
    });
  });

  describe('预设过滤器', () => {
    it('STM32 预设过滤器应该正常工作', () => {
      const filter = PortFilters.presets.stm32();

      expect(filter(mockSTM32Port)).toBe(true);
      expect(filter(mockArduinoPort)).toBe(false);

      const webSerialFilters = filter.toWebSerialFilters?.();
      expect(webSerialFilters).toEqual([{ usbVendorId: 0x0483 }]);
    });

    it('Arduino 预设过滤器应该正常工作', () => {
      const filter = PortFilters.presets.arduino();

      expect(filter(mockArduinoPort)).toBe(true);
      expect(filter(mockCH340Port)).toBe(true);
      expect(filter(mockSTM32Port)).toBe(false);

      const webSerialFilters = filter.toWebSerialFilters?.();
      expect(webSerialFilters?.length).toBeGreaterThan(0);
      expect(webSerialFilters?.some(f => f.usbVendorId === 0x2341)).toBe(true);
      expect(webSerialFilters?.some(f => f.usbVendorId === 0x1a86)).toBe(true);
    });

    it('Beggar Socket 预设过滤器应该正常工作', () => {
      const filter = PortFilters.presets.beggarSocket();

      expect(filter(mockSTM32Port)).toBe(true);
      expect(filter(mockArduinoPort)).toBe(false);

      const webSerialFilters = filter.toWebSerialFilters?.();
      expect(webSerialFilters).toEqual([{
        usbVendorId: 0x0483,
        usbProductId: 0x0721,
      }]);
    });
  });

  describe('字符串和数字 ID 转换', () => {
    it('应该正确处理数字形式的 vendor/product ID', () => {
      const filter = PortFilters.device(1155, 1825); // 0x0483, 0x0721

      const webSerialFilters = filter.toWebSerialFilters?.();
      expect(webSerialFilters?.[0]).toEqual({
        usbVendorId: 1155,
        usbProductId: 1825,
      });
    });

    it('应该正确处理十六进制字符串形式的 ID', () => {
      const filter = PortFilters.device('0483', '0721');

      const webSerialFilters = filter.toWebSerialFilters?.();
      expect(webSerialFilters?.[0]).toEqual({
        usbVendorId: 0x0483,
        usbProductId: 0x0721,
      });
    });
  });
});
