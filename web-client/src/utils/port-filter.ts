import { type SerialPortInfo } from '@/services/serial-service';

/**
 * 基础设备标识符（vendorId + productId 组合）
 */
export interface DeviceIdentifier {
  vendorId: string | number;
  productId?: string | number;
  manufacturer?: string;
}

/**
 * 串口过滤器配置类型
 */
export interface PortFilterConfig {
  devices?: DeviceIdentifier[];
}

/**
 * 过滤器函数
 */
export interface PortFilter {
  (port: SerialPortInfo): boolean;
  /** 过滤器的原始配置信息 */
  config?: PortFilterConfig;
  /** 提取 Web Serial API 过滤器 */
  toWebSerialFilters?: () => SerialPortFilter[];
}

/**
 * 工具函数：将设备标识符转换为 Web Serial API 过滤器
 */
function deviceIdentifierToWebSerialFilter(device: DeviceIdentifier): SerialPortFilter {
  const filter: SerialPortFilter = {};

  // 处理 vendorId
  if (typeof device.vendorId === 'number') {
    filter.usbVendorId = device.vendorId;
  } else {
    filter.usbVendorId = parseInt(device.vendorId, 16);
  }

  // 处理 productId（可选）
  if (device.productId !== undefined) {
    if (typeof device.productId === 'number') {
      filter.usbProductId = device.productId;
    } else {
      filter.usbProductId = parseInt(device.productId, 16);
    }
  }

  return filter;
}

/**
 * 工具函数：检查端口是否匹配设备标识符
 */
function matchesDeviceIdentifier(port: SerialPortInfo, device: DeviceIdentifier): boolean {
  // 检查 vendorId
  const normalizedDeviceVendorId = typeof device.vendorId === 'number'
    ? device.vendorId.toString(16).padStart(4, '0').toLowerCase()
    : device.vendorId.padStart(4, '0').toLowerCase();

  const portVendorId = port.vendorId?.toLowerCase();
  if (portVendorId !== normalizedDeviceVendorId) return false;

  if (device.productId !== undefined) {
    const normalizedDeviceProductId = typeof device.productId === 'number'
      ? device.productId.toString(16).padStart(4, '0').toLowerCase()
      : device.productId.padStart(4, '0').toLowerCase();

    const portProductId = port.productId?.toLowerCase();
    if (portProductId !== normalizedDeviceProductId) return false;
  }

  if (device.manufacturer !== undefined) {
    const portManufacturer = port.manufacturer?.toLowerCase();
    const deviceManufacturer = device.manufacturer.toLowerCase();
    if (!portManufacturer?.includes(deviceManufacturer)) return false;
  }

  return true;
}

/**
 * 常用的串口过滤器
 */
export const PortFilters = {
  /**
   * 创建单个设备过滤器（vendor + product 组合）
   */
  device: (vendorId: string | number, productId?: string | number, manufacturer?: string): PortFilter => {
    const deviceIdentifier: DeviceIdentifier = { vendorId, productId, manufacturer };
    const config: PortFilterConfig = {
      devices: [deviceIdentifier],
    };

    const filter = ((port: SerialPortInfo) => {
      return matchesDeviceIdentifier(port, deviceIdentifier);
    }) as PortFilter;

    filter.config = config;
    filter.toWebSerialFilters = () => [deviceIdentifierToWebSerialFilter(deviceIdentifier)];

    return filter;
  },

  /**
   * 创建多设备过滤器
   */
  devices: (devices: DeviceIdentifier[]): PortFilter => {
    const config: PortFilterConfig = { devices };

    const filter = ((port: SerialPortInfo) => {
      return devices.some(device => matchesDeviceIdentifier(port, device));
    }) as PortFilter;

    filter.config = config;
    filter.toWebSerialFilters = () => devices.map(device => deviceIdentifierToWebSerialFilter(device));

    return filter;
  },

  /**
   * 根据配置创建过滤器
   */
  fromConfig: (config: PortFilterConfig): PortFilter => {
    if (!config.devices || config.devices.length === 0) {
      throw new Error('Config must contain at least one device');
    }

    if (config.devices.length === 1) {
      return PortFilters.device(
        config.devices[0].vendorId,
        config.devices[0].productId,
      );
    } else {
      return PortFilters.devices(config.devices);
    }
  },

  /**
   * 常用设备过滤器预设
   */
  presets: {
    /**
     * STM32 设备过滤器
     */
    stm32: (): PortFilter => PortFilters.device(0x0483),

    /**
     * Arduino 设备过滤器
     */
    arduino: (): PortFilter => PortFilters.devices([
      { vendorId: 0x2341 }, // Arduino LLC
      { vendorId: 0x1a86 }, // QinHeng Electronics (CH340)
      { vendorId: 0x0403 }, // FTDI
    ]),

    /**
     * ESP32 设备过滤器
     */
    esp32: (): PortFilter => PortFilters.devices([
      { vendorId: 0x10c4 }, // Silicon Labs (CP210x)
      { vendorId: 0x1a86 }, // QinHeng Electronics (CH340)
      { vendorId: 0x0403 }, // FTDI
    ]),

    /**
     * Beggar Socket 设备过滤器
     */
    beggarSocket: (): PortFilter => PortFilters.device(0x0483, 0x0721),
  },
};
