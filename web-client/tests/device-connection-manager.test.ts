import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PortFilters } from '@/utils/port-filter';

const connectionUseCaseState = vi.hoisted(() => ({
  listAvailableSelections: vi.fn(),
  prepareConnectionWithSelection: vi.fn(),
  prepareConnection: vi.fn(),
  disconnect: vi.fn(),
  ensureConnected: vi.fn(),
  snapshot: { state: 'idle', context: {} },
}));

vi.mock('@/features/burner/adapters', () => ({
  createConnectionOrchestrationUseCase: () => connectionUseCaseState,
}));

vi.mock('@/utils/tauri', () => ({
  isTauri: vi.fn(() => true),
}));

describe('DeviceConnectionManager', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    connectionUseCaseState.listAvailableSelections.mockResolvedValue({
      success: true,
      ports: [],
    });
    connectionUseCaseState.prepareConnectionWithSelection.mockResolvedValue({
      success: true,
      context: {
        handle: {
          platform: 'tauri',
          portInfo: { path: '/dev/tty.usbmodem1' },
          context: {
            platform: 'tauri',
            transport: {},
            port: null,
            connection: null,
            portInfo: { path: '/dev/tty.usbmodem1' },
          },
        },
      },
    });
    connectionUseCaseState.prepareConnection.mockResolvedValue({
      success: false,
      context: {},
      failure: {
        stage: 'select',
        code: 'selection_required',
        message: 'selection required',
      },
    });
    connectionUseCaseState.disconnect.mockResolvedValue({ success: true });
    connectionUseCaseState.ensureConnected.mockResolvedValue({ success: true, context: { handle: null } });

    const module = await import('@/services/device-connection-manager');
    (module.DeviceConnectionManager as unknown as { instance: unknown }).instance = undefined;
  });

  it('connects immediately when exactly one filtered port is available', async () => {
    connectionUseCaseState.listAvailableSelections.mockResolvedValue({
      success: true,
      ports: [
        {
          portInfo: { path: '/dev/tty.usbmodem1', vendorId: '0483', productId: '0721' },
          context: { portInfo: { path: '/dev/tty.usbmodem1', vendorId: '0483', productId: '0721' } },
        },
      ],
    });

    const { DeviceConnectionManager } = await import('@/services/device-connection-manager');
    const manager = DeviceConnectionManager.getInstance();
    await manager.requestDevice(PortFilters.presets.beggarSocket());

    expect(connectionUseCaseState.prepareConnectionWithSelection).toHaveBeenCalledWith({
      portInfo: { path: '/dev/tty.usbmodem1', vendorId: '0483', productId: '0721' },
      context: { portInfo: { path: '/dev/tty.usbmodem1', vendorId: '0483', productId: '0721' } },
    });
  });

  it('falls back to all visible ports for manual selection when no filtered port matches', async () => {
    connectionUseCaseState.listAvailableSelections.mockResolvedValue({
      success: true,
      ports: [
        {
          portInfo: { path: '/dev/cu.usbmodem1', manufacturer: 'Apple' },
          context: { portInfo: { path: '/dev/cu.usbmodem1', manufacturer: 'Apple' } },
        },
        {
          portInfo: { path: '/dev/cu.usbmodem2', manufacturer: 'STMicroelectronics' },
          context: { portInfo: { path: '/dev/cu.usbmodem2', manufacturer: 'STMicroelectronics' } },
        },
      ],
    });

    const { DeviceConnectionManager } = await import('@/services/device-connection-manager');
    const manager = DeviceConnectionManager.getInstance();

    await expect(manager.requestDevice(PortFilters.presets.beggarSocket())).rejects.toMatchObject({
      name: 'PortSelectionRequiredError',
      availablePorts: [
        { path: '/dev/cu.usbmodem1', manufacturer: 'Apple' },
        { path: '/dev/cu.usbmodem2', manufacturer: 'STMicroelectronics' },
      ],
    });
    expect(connectionUseCaseState.prepareConnectionWithSelection).not.toHaveBeenCalled();
  });
});
