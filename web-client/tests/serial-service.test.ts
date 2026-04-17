import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SerialService } from '@/services/serial-service';

const { mockGateway, mockToLegacyDeviceInfo } = vi.hoisted(() => ({
  mockGateway: {
    connect: vi.fn(),
    list: vi.fn(),
  },
  mockToLegacyDeviceInfo: vi.fn(),
}));

vi.mock('@/platform/serial', () => ({
  getDeviceGateway: vi.fn(() => mockGateway),
  toLegacyDeviceInfo: mockToLegacyDeviceInfo,
}));

describe('SerialService.openPort', () => {
  beforeEach(() => {
    mockGateway.connect.mockReset();
    mockGateway.list.mockReset();
    mockToLegacyDeviceInfo.mockReset();
  });

  it('closes both transport and port when legacy conversion fails', async () => {
    const transportClose = vi.fn().mockRejectedValue(new Error('transport close failed'));
    const portClose = vi.fn().mockResolvedValue(undefined);

    mockGateway.connect.mockResolvedValue({
      transport: {
        close: transportClose,
      },
      port: {
        close: portClose,
      },
    });
    mockToLegacyDeviceInfo.mockImplementation(() => {
      throw new Error('conversion failed');
    });

    const service = SerialService.getInstance();

    await expect(service.openPort('/dev/mock', {} as SerialOptions)).rejects.toThrow('conversion failed');
    expect(transportClose).toHaveBeenCalledTimes(1);
    expect(portClose).toHaveBeenCalledTimes(1);
  });
});
