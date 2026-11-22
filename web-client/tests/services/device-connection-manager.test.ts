import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConnectionOperationCoordinator } from '@/features/burner/application';
import { AdvancedSettings } from '@/settings/advanced-settings';
import { PortFilters } from '@/utils/port-filter';

const connectionUseCaseState = vi.hoisted(() => ({
  listAvailableSelections: vi.fn(),
  reconnectWithSelection: vi.fn(),
  prepareConnection: vi.fn(),
  disconnect: vi.fn(),
  ensureConnected: vi.fn(),
  snapshot: { state: 'idle', context: { generation: 0, handle: null, selection: null } },
  operationCoordinator: null as unknown as ConnectionOperationCoordinator,
}));

vi.mock('@/features/burner/adapters', () => ({
  createConnectionOrchestrationUseCase: () => connectionUseCaseState,
}));

vi.mock('@/platform/runtime', () => ({
  getRuntimeKind: vi.fn(() => 'tauri'),
  isTauriRuntime: vi.fn(() => true),
  isWebRuntime: vi.fn(() => false),
}));

describe('DeviceConnectionManager', () => {
  beforeEach(async () => {
    AdvancedSettings.resetToDefaults();
    vi.clearAllMocks();
    connectionUseCaseState.operationCoordinator = new ConnectionOperationCoordinator();
    connectionUseCaseState.snapshot = { state: 'idle', context: { generation: 0, handle: null, selection: null } };
    connectionUseCaseState.listAvailableSelections.mockResolvedValue({
      success: true,
      ports: [],
    });
    connectionUseCaseState.reconnectWithSelection.mockResolvedValue({
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
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    connectionUseCaseState.listAvailableSelections.mockResolvedValue({
      success: true,
      ports: [
        {
          portInfo: {
            path: '/dev/tty.usbmodem6D83538A48851',
            vendorId: '0483',
            productId: '0721',
          },
          context: {
            portInfo: {
              path: '/dev/tty.usbmodem6D83538A48851',
              vendorId: '0483',
              productId: '0721',
            },
          },
        },
      ],
    });

    const { DeviceConnectionManager } = await import('@/services/device-connection-manager');
    const manager = DeviceConnectionManager.getInstance();
    await manager.requestDevice(PortFilters.presets.beggarSocket());

    expect(connectionUseCaseState.reconnectWithSelection).toHaveBeenCalledWith({
      portInfo: {
        path: '/dev/tty.usbmodem6D83538A48851',
        vendorId: '0483',
        productId: '0721',
      },
      context: {
        portInfo: {
          path: '/dev/tty.usbmodem6D83538A48851',
          vendorId: '0483',
          productId: '0721',
        },
      },
    });
    expect(connectionUseCaseState.disconnect).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(
      '[DeviceConnectionManager] firmware profile detected',
      expect.objectContaining({
        source: 'connectWithSelectedPort',
        profile: 'stm',
        configuredProfile: 'stm',
        inferredProfile: 'stm',
        port: expect.objectContaining({
          path: '/dev/tty.usbmodem6D83538A48851',
          vendorId: '0483',
          productId: '0721',
        }),
      }),
    );
    infoSpy.mockRestore();
  });

  it('uses configured firmware profile instead of native path inference', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    AdvancedSettings.firmwareProfile = 'stc';

    const { DeviceConnectionManager } = await import('@/services/device-connection-manager');
    const manager = DeviceConnectionManager.getInstance();

    const device = await manager.connectWithSelectedPort({
      path: '/dev/tty.usbmodem6D83538A48851',
      vendorId: '0483',
      productId: '0721',
    });

    expect(device.firmwareProfile?.id).toBe('stc');
    expect(infoSpy).toHaveBeenCalledWith(
      '[DeviceConnectionManager] firmware profile detected',
      expect.objectContaining({
        source: 'connectWithSelectedPort',
        profile: 'stc',
        configuredProfile: 'stc',
        inferredProfile: 'stm',
      }),
    );
    infoSpy.mockRestore();
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
    expect(connectionUseCaseState.reconnectWithSelection).not.toHaveBeenCalled();
  });

  it('fails fast when orchestration returns a handle without a valid DeviceHandle context', async () => {
    connectionUseCaseState.prepareConnection.mockResolvedValue({
      success: true,
      context: {
        handle: {
          platform: 'tauri',
          portInfo: { path: '/dev/tty.usbmodem1' },
          context: {
            platform: 'tauri',
            port: null,
            connection: null,
          },
        },
      },
    });

    const { DeviceConnectionManager } = await import('@/services/device-connection-manager');
    const manager = DeviceConnectionManager.getInstance();

    await expect(manager.requestDevice()).rejects.toThrow('Invalid connection handle: context is not a valid DeviceHandle');
  });

  it('propagates selected reconnect cleanup failures without a separate disconnect', async () => {
    connectionUseCaseState.reconnectWithSelection.mockResolvedValue({
      success: false,
      context: {},
      failure: { stage: 'disconnect', code: 'disconnect_failed', message: 'close failed' },
    });
    const { DeviceConnectionManager } = await import('@/services/device-connection-manager');
    const manager = DeviceConnectionManager.getInstance();

    await expect(manager.connectWithSelectedPort({ path: '/dev/selected' })).rejects.toThrow('[disconnect/disconnect_failed] close failed');
    expect(connectionUseCaseState.reconnectWithSelection).toHaveBeenCalledOnce();
    expect(connectionUseCaseState.disconnect).not.toHaveBeenCalled();
  });

  it('clears legacy device state even when disconnect fails', async () => {
    connectionUseCaseState.disconnect.mockResolvedValue({
      success: false,
      failure: {
        stage: 'disconnect',
        code: 'disconnect_failed',
        message: 'close failed',
      },
    });

    const { DeviceConnectionManager } = await import('@/services/device-connection-manager');
    const manager = DeviceConnectionManager.getInstance();
    const device = {
      transport: {},
      port: {},
      connection: {},
      serialHandle: { platform: 'tauri' },
      portInfo: { path: '/dev/tty.usbmodem1' },
    } as never;

    await expect(manager.disconnectDevice(device)).rejects.toThrow('[disconnect/disconnect_failed] close failed');
    expect(manager.isDeviceConnected(device)).toBe(false);
    expect(device).toMatchObject({
      transport: null,
      port: null,
      connection: null,
      serialHandle: null,
    });
  });

  it('preserves effective firmware profile on portInfo updates, applies new profile on reconnect, and rejects stale generation operations', async () => {
    AdvancedSettings.firmwareProfile = 'stc';
    connectionUseCaseState.snapshot = {
      state: 'connected',
      context: { generation: 1, handle: { id: 'h1' } as never, selection: null },
    };
    connectionUseCaseState.reconnectWithSelection.mockResolvedValueOnce({
      success: true,
      context: {
        generation: 1,
        handle: {
          id: 'h1',
          platform: 'tauri',
          portInfo: { path: '/dev/tty.usbmodem1' },
          context: {
            platform: 'tauri',
            transport: { send: vi.fn() },
            port: null,
            connection: null,
            portInfo: { path: '/dev/tty.usbmodem1' },
          },
        },
      },
    });

    const { DeviceConnectionManager } = await import('@/services/device-connection-manager');
    const manager = DeviceConnectionManager.getInstance();

    // Connect with STM-looking port metadata while manual profile is STC
    const firstDevice = await manager.connectWithSelectedPort({
      path: '/dev/tty.usbmodem6D83538A48851',
      vendorId: '0483',
      productId: '0721',
    });
    expect(firstDevice.firmwareProfile?.id).toBe('stc');
    expect(firstDevice.serialHandle?.firmwareProfile?.id).toBe('stc');
    expect(firstDevice.connectionGeneration).toBe(1);

    // Changing setting while connected does NOT mutate active connection profile
    AdvancedSettings.firmwareProfile = 'stm';
    expect(firstDevice.firmwareProfile?.id).toBe('stc');

    // Reconnect increments generation and applies new profile
    connectionUseCaseState.snapshot = {
      state: 'connected',
      context: { generation: 2, handle: { id: 'h2' } as never, selection: null },
    };
    connectionUseCaseState.reconnectWithSelection.mockResolvedValueOnce({
      success: true,
      context: {
        generation: 2,
        handle: {
          id: 'h2',
          platform: 'tauri',
          portInfo: { path: '/dev/tty.usbmodem1' },
          context: {
            platform: 'tauri',
            transport: { send: vi.fn() },
            port: null,
            connection: null,
            portInfo: { path: '/dev/tty.usbmodem1' },
          },
        },
      },
    });

    const secondDevice = await manager.connectWithSelectedPort({
      path: '/dev/tty.usbmodem6D83538A48851',
      vendorId: '0483',
      productId: '0721',
    });
    expect(secondDevice.firmwareProfile?.id).toBe('stm');
    expect(secondDevice.connectionGeneration).toBe(2);

    // Stale operation bound to firstDevice's generation is rejected before touching transport
    const touchNewTransport = vi.fn();
    const staleResult = await manager.runConnectionOperation({
      expectedGeneration: firstDevice.connectionGeneration,
      fn: touchNewTransport,
    });
    expect(staleResult).toMatchObject({
      ok: false,
      reason: 'stale_context',
    });
    expect(touchNewTransport).not.toHaveBeenCalled();
  });

  it('performs GBFlash CH340 handshake at 2M, runtime profile generation, and disconnect cleanup', async () => {
    const { isTauriRuntime } = await import('@/platform/runtime');
    vi.mocked(isTauriRuntime).mockReturnValue(false);
    AdvancedSettings.firmwareProfile = 'flashgbx';
    AdvancedSettings.flashgbxBaudRate = 'auto';

    const sent: number[][] = [];
    let rx = [
      // 0xA1 -> size=8, L, fw=14, pcb=13, ts, nameLen=8, "GBFlash\0", flags1=0x01, flags2=0x01
      0x08, 0x4c, 0x00, 0x0e, 0x0d, 0x68, 0x30, 0x3d, 0x4c,
      0x08, 0x47, 0x42, 0x46, 0x6c, 0x61, 0x73, 0x68, 0x00,
      0x01, 0x01,
      0x01, // disconnect CART_PWR_OFF ACK
    ];
    const transport = {
      send: vi.fn((p: Uint8Array) => { sent.push(Array.from(p)); return Promise.resolve(true); }),
      read: vi.fn((len: number) => {
        const chunk = rx.slice(0, len);
        rx = rx.slice(len);
        return Promise.resolve({ data: new Uint8Array(chunk) });
      }),
      setSignals: vi.fn(),
      flushInput: vi.fn(() => Promise.resolve(undefined)),
      flushOutput: vi.fn(() => Promise.resolve(undefined)),
    };

    const fakeWebPort = { id: 'gbflash-web-port' } as unknown as SerialPort;
    connectionUseCaseState.prepareConnection.mockResolvedValueOnce({
      success: true,
      context: {
        generation: 1,
        handle: {
          id: 'web:1',
          platform: 'web',
          portInfo: { path: 'web-serial', vendorId: '1a86', productId: '7523' },
          context: {
            platform: 'web',
            transport,
            port: fakeWebPort,
            connection: null,
            portInfo: { path: 'web-serial', vendorId: '1a86', productId: '7523' },
          },
        },
      },
    });

    const { DeviceConnectionManager } = await import('@/services/device-connection-manager');
    const manager = DeviceConnectionManager.getInstance();
    const device = await manager.requestDevice(PortFilters.presets.flashgbx());

    expect(connectionUseCaseState.prepareConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        baudRate: 2_000_000,
        skipSignalInit: true,
      }),
    );
    expect(sent).toEqual([[0xa1]]);
    expect(sent.flat()).not.toContain(0x3e);
    expect(transport.setSignals).not.toHaveBeenCalled();
    expect(device.firmwareProfile?.id).toBe('flashgbx');
    expect(device.firmwareProfile?.label).toBe('GBFlash');
    expect(device.firmwareProfile?.firmwareVersion).toBe('L14');
    expect(device.firmwareProfile?.capabilities.nativeFlashgbxProtocol).toBe(true);
    expect(device.firmwareProfile?.capabilities.cartPowerControl).toBe(true);
    expect(device.firmwareProfile?.capabilities.audioWePin).toBe(true);

    await manager.disconnectDevice(device);
    expect(sent).toEqual([[0xa1], [0xf3]]);
    expect(connectionUseCaseState.disconnect).toHaveBeenCalledOnce();
  });

  it('connects CH340 GBFlash at configured baud rate and cleans up on handshake failure', async () => {
    const { isTauriRuntime } = await import('@/platform/runtime');
    vi.mocked(isTauriRuntime).mockReturnValue(true);
    AdvancedSettings.firmwareProfile = 'flashgbx';
    AdvancedSettings.flashgbxBaudRate = 1_500_000;

    const sent: number[][] = [];
    let rx = [
      0x08, 0x4c, 0x00, 0x0e, 0x0d, 0x68, 0x30, 0x3d, 0x4c,
      0x08, 0x47, 0x42, 0x46, 0x6c, 0x61, 0x73, 0x68, 0x00,
      0x01, 0x01,
    ];
    const transport = {
      send: vi.fn((p: Uint8Array) => { sent.push(Array.from(p)); return Promise.resolve(true); }),
      read: vi.fn((len: number) => {
        const chunk = rx.slice(0, len);
        rx = rx.slice(len);
        return Promise.resolve({ data: new Uint8Array(chunk) });
      }),
      setSignals: vi.fn(),
      flushInput: vi.fn(() => Promise.resolve(undefined)),
      flushOutput: vi.fn(() => Promise.resolve(undefined)),
    };

    connectionUseCaseState.reconnectWithSelection.mockResolvedValueOnce({
      success: true,
      context: {
        generation: 1,
        handle: {
          id: 'tauri:1',
          platform: 'tauri',
          portInfo: { path: '/dev/cu.usbserial-110', vendorId: '1a86', productId: '7523' },
          context: {
            platform: 'tauri',
            transport,
            port: null,
            connection: null,
            portInfo: { path: '/dev/cu.usbserial-110', vendorId: '1a86', productId: '7523' },
          },
        },
      },
    });

    const { DeviceConnectionManager } = await import('@/services/device-connection-manager');
    const manager = DeviceConnectionManager.getInstance();
    const device = await manager.connectWithSelectedPort({
      path: '/dev/cu.usbserial-110',
      vendorId: '1a86',
      productId: '7523',
    });

    expect(sent).toEqual([[0xa1]]);
    expect(connectionUseCaseState.reconnectWithSelection).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ baudRate: 1_500_000, skipSignalInit: true }),
      }),
    );
    expect(device.firmwareProfile?.label).toBe('GBFlash');
    expect(device.firmwareProfile?.firmwareVersion).toBe('L14');
    expect(device.firmwareProfile?.capabilities.cartPowerControl).toBe(true);

    // Handshake failure cleanup
    const failingTransport = {
      send: vi.fn(() => Promise.resolve(true)),
      read: vi.fn(() => Promise.resolve({ data: new Uint8Array([0x04]) })), // invalid size != 8
      setSignals: vi.fn(),
      flushInput: vi.fn(() => Promise.resolve(undefined)),
      flushOutput: vi.fn(() => Promise.resolve(undefined)),
    };
    connectionUseCaseState.reconnectWithSelection.mockResolvedValueOnce({
      success: true,
      context: {
        generation: 2,
        handle: {
          id: 'tauri:2',
          platform: 'tauri',
          portInfo: { path: '/dev/cu.usbmodem1', vendorId: '16c0', productId: '27dd' },
          context: {
            platform: 'tauri',
            transport: failingTransport,
            port: null,
            connection: null,
            portInfo: { path: '/dev/cu.usbmodem1', vendorId: '16c0', productId: '27dd' },
          },
        },
      },
    });

    await expect(
      manager.connectWithSelectedPort({ path: '/dev/cu.usbmodem1', vendorId: '16c0', productId: '27dd' }),
    ).rejects.toMatchObject({ stage: 'fw_info_header' });
    expect(connectionUseCaseState.disconnect).toHaveBeenCalled();
  });
});
