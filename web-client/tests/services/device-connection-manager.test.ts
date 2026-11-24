import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VARIANT_IDS } from '@/device/definitions';
import { ConnectionOperationCoordinator } from '@/features/burner/application';
import { isTauriRuntime } from '@/platform/runtime';
import { AdvancedSettings } from '@/settings/advanced-settings';

import { buildFlashgbxSession, buildStmSession, TEST_FLASHGBX_INFO } from '../helpers/session-profile';

const connectionUseCaseState = vi.hoisted(() => ({
  listAvailableSelections: vi.fn(),
  reconnectWithSelection: vi.fn(),
  prepareConnection: vi.fn(),
  retryConnection: vi.fn(),
  disconnect: vi.fn(),
  ensureConnected: vi.fn(),
  reinitializeConnection: vi.fn(),
  snapshot: { state: 'idle', context: { generation: 0, handle: null, selection: null } },
  /** Nothing to reuse until a failed attempt leaves a granted Web Serial port behind. */
  retryableSelection: null as null | {
    portInfo?: { path?: string; vendorId?: string; productId?: string };
    context: unknown;
  },
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

/** Per-test selection override; everything else stays the real runtime. */
const selectionOverride = vi.hoisted(() => ({
  read: null as null | (() => { variantId?: string; source: 'legacy' | 'v2' | 'invalid' }),
}));

vi.mock('@/device-runtime/runtime-instance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/device-runtime/runtime-instance')>();
  return {
    ...actual,
    getDeviceRuntime: () => {
      const runtime = actual.getDeviceRuntime();
      const read = selectionOverride.read;
      return read ? { ...runtime, selection: { read } } : runtime;
    },
  };
});

const CH340_PORT = { path: '/dev/cu.usbserial-110', vendorId: '1a86', productId: '7523' };
const STM_PORT = { path: '/dev/tty.usbmodem6D83538A48851', vendorId: '0483', productId: '0721' };

function port(portInfo: Record<string, unknown>) {
  return { portInfo, context: { portInfo } };
}

function handleWith(
  context: Record<string, unknown>,
  options: {
    id?: string;
    platform?: 'tauri' | 'web';
    portInfo?: Record<string, unknown>;
  } = {},
) {
  const portInfo = options.portInfo ?? CH340_PORT;
  return {
    id: options.id ?? 'tauri:1',
    platform: options.platform ?? 'tauri',
    portInfo,
    context: {
      platform: options.platform ?? 'tauri',
      transport: { send: vi.fn() },
      port: null,
      connection: null,
      portInfo,
      ...context,
    },
  };
}

/** `reconnectWithSelection` / `prepareConnection` result context. */
function connectionContext(
  generation: number,
  options: {
    portInfo?: Record<string, unknown>;
    session?: unknown;
    probeFacts?: unknown;
    diagnostics?: readonly unknown[];
  } = {},
) {
  return {
    generation,
    handle: handleWith({}, options),
    ...(options.session
      ? {
        session: {
          profile: options.session,
          diagnostics: options.diagnostics ?? [],
          ...(options.probeFacts ? { probeFacts: options.probeFacts } : {}),
        },
      }
      : {}),
  };
}

describe('DeviceConnectionManager', () => {
  beforeEach(async () => {
    AdvancedSettings.resetToDefaults();
    vi.clearAllMocks();
    selectionOverride.read = null;
    connectionUseCaseState.operationCoordinator = new ConnectionOperationCoordinator();
    connectionUseCaseState.snapshot = { state: 'idle', context: { generation: 0, handle: null, selection: null } };
    connectionUseCaseState.retryableSelection = null;
    vi.mocked(isTauriRuntime).mockReturnValue(true);
    connectionUseCaseState.listAvailableSelections.mockResolvedValue({ success: true, ports: [] });
    connectionUseCaseState.reconnectWithSelection.mockResolvedValue({
      success: true,
      context: connectionContext(1),
    });
    connectionUseCaseState.prepareConnection.mockResolvedValue({
      success: false,
      context: {},
      failure: { stage: 'select', code: 'selection_required', message: 'selection required' },
    });
    connectionUseCaseState.disconnect.mockResolvedValue({ success: true });
    connectionUseCaseState.ensureConnected.mockResolvedValue({ success: true, context: { handle: null } });

    const module = await import('@/services/device-connection-manager');
    (module.DeviceConnectionManager as unknown as { instance: unknown }).instance = undefined;
  });

  it('connects immediately when exactly one port matches the saved variant', async () => {
    AdvancedSettings.setVariantId(VARIANT_IDS.gbflash);
    connectionUseCaseState.listAvailableSelections.mockResolvedValue({
      success: true,
      ports: [port(CH340_PORT), port({ path: '/dev/cu.usbmodem', vendorId: 'dead', productId: 'beef' })],
    });

    const { DeviceConnectionManager } = await import('@/services/device-connection-manager');
    const manager = DeviceConnectionManager.getInstance();
    await manager.requestDevice();

    // The single match is opened with the binding's own connection parameters, and the
    // attempt snapshot travels with the selection so the session resolves the same values.
    expect(connectionUseCaseState.reconnectWithSelection).toHaveBeenCalledWith({
      portInfo: CH340_PORT,
      context: expect.objectContaining({
        portInfo: CH340_PORT,
        baudRate: 2_000_000,
        skipSignalInit: true,
      }),
      plan: expect.objectContaining({
        variantId: VARIANT_IDS.gbflash,
        baudRate: 2_000_000,
        parameters: expect.objectContaining({ baudRate: 'auto' }),
      }),
    });
    expect(connectionUseCaseState.disconnect).not.toHaveBeenCalled();
  });

  it('retries the authorized Web Serial port instead of prompting again', async () => {
    AdvancedSettings.setVariantId(VARIANT_IDS.stm);
    vi.mocked(isTauriRuntime).mockReturnValue(false);
    const authorized = {
      portInfo: { path: 'web-serial', vendorId: '0483', productId: '0721' },
      context: { webPort: {} },
    };
    connectionUseCaseState.retryableSelection = authorized;
    connectionUseCaseState.retryConnection.mockResolvedValue({
      success: true,
      context: connectionContext(4),
    });

    const { DeviceConnectionManager } = await import('@/services/device-connection-manager');
    const manager = DeviceConnectionManager.getInstance();
    await manager.requestDevice();

    // The already authorized port is reopened with this attempt's plan, without a second
    // user gesture and without falling back to a fresh discovery prompt.
    expect(connectionUseCaseState.retryConnection).toHaveBeenCalledWith(expect.objectContaining({
      plan: expect.objectContaining({ variantId: VARIANT_IDS.stm }),
    }));
    expect(connectionUseCaseState.prepareConnection).not.toHaveBeenCalled();
  });

  it('prompts for another port instead of reusing the authorized one', async () => {
    AdvancedSettings.setVariantId(VARIANT_IDS.stm);
    vi.mocked(isTauriRuntime).mockReturnValue(false);
    connectionUseCaseState.retryableSelection = {
      portInfo: { path: 'web-serial', vendorId: '0483', productId: '0721' },
      context: { webPort: {} },
    };

    const { DeviceConnectionManager } = await import('@/services/device-connection-manager');
    const manager = DeviceConnectionManager.getInstance();

    // "Choose another port" must reach the picker even though a grant is still usable:
    // reusing it would reopen exactly the port the user asked to replace.
    await expect(manager.requestDevice({ allowAnyPort: true })).rejects.toMatchObject({
      name: 'PortSelectionRequiredError',
    });

    expect(connectionUseCaseState.retryConnection).not.toHaveBeenCalled();
    expect(connectionUseCaseState.prepareConnection).toHaveBeenCalledWith(
      expect.objectContaining({ filter: undefined }),
    );
  });

  it('requires an explicit choice when several ports match and opens nothing', async () => {
    AdvancedSettings.setVariantId(VARIANT_IDS.gbflash);
    const second = { path: '/dev/cu.usbmodem27dd', vendorId: '16c0', productId: '27dd' };
    connectionUseCaseState.listAvailableSelections.mockResolvedValue({
      success: true,
      ports: [port(CH340_PORT), port(second)],
    });

    const { DeviceConnectionManager } = await import('@/services/device-connection-manager');
    const manager = DeviceConnectionManager.getInstance();

    await expect(manager.requestDevice()).rejects.toMatchObject({
      name: 'PortSelectionRequiredError',
      availablePorts: [CH340_PORT, second],
    });
    expect(connectionUseCaseState.reconnectWithSelection).not.toHaveBeenCalled();
    expect(connectionUseCaseState.prepareConnection).not.toHaveBeenCalled();
  });

  it('offers every visible port but opens nothing when no port matches the saved variant', async () => {
    AdvancedSettings.setVariantId(VARIANT_IDS.gbflash);
    const apple = { path: '/dev/cu.usbmodem1', manufacturer: 'Apple' };
    const stm = { path: '/dev/cu.usbmodem2', manufacturer: 'STMicroelectronics' };
    connectionUseCaseState.listAvailableSelections.mockResolvedValue({
      success: true,
      ports: [port(apple), port(stm)],
    });

    const { DeviceConnectionManager } = await import('@/services/device-connection-manager');
    const manager = DeviceConnectionManager.getInstance();

    await expect(manager.requestDevice()).rejects.toMatchObject({
      name: 'PortSelectionRequiredError',
      availablePorts: [apple, stm],
    });
    expect(connectionUseCaseState.reconnectWithSelection).not.toHaveBeenCalled();
  });

  it('skips discovery when the user explicitly asks for any port', async () => {
    AdvancedSettings.setVariantId(VARIANT_IDS.gbflash);
    connectionUseCaseState.prepareConnection.mockResolvedValue({
      success: true,
      context: connectionContext(3, {
        session: buildFlashgbxSession(),
        probeFacts: { firmwareInfo: TEST_FLASHGBX_INFO },
      }),
    });

    const { DeviceConnectionManager } = await import('@/services/device-connection-manager');
    const manager = DeviceConnectionManager.getInstance();
    await manager.requestDevice({ allowAnyPort: true });

    expect(connectionUseCaseState.listAvailableSelections).not.toHaveBeenCalled();
    expect(connectionUseCaseState.prepareConnection).toHaveBeenCalledWith(
      expect.objectContaining({ filter: undefined, baudRate: 2_000_000, skipSignalInit: true }),
    );
  });

  it('fails with a select-stage error when no variant is saved', async () => {
    selectionOverride.read = () => ({ source: 'invalid' });

    const { DeviceConnectionManager } = await import('@/services/device-connection-manager');
    const manager = DeviceConnectionManager.getInstance();

    await expect(manager.requestDevice()).rejects.toMatchObject({
      name: 'DeviceSelectionError',
      stage: 'select',
      code: 'selection_invalid',
    });
    expect(connectionUseCaseState.reconnectWithSelection).not.toHaveBeenCalled();
  });

  it('projects the committed session, not the port metadata, onto DeviceInfo', async () => {
    AdvancedSettings.setVariantId(VARIANT_IDS.stc);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    connectionUseCaseState.reconnectWithSelection.mockResolvedValueOnce({
      success: true,
      context: connectionContext(4, {
        portInfo: STM_PORT,
        session: buildFlashgbxSession(),
        probeFacts: { firmwareInfo: TEST_FLASHGBX_INFO },
        diagnostics: [],
      }),
    });

    const { DeviceConnectionManager } = await import('@/services/device-connection-manager');
    const manager = DeviceConnectionManager.getInstance();
    const device = await manager.connectWithSelectedPort(STM_PORT);

    // STC is what the user selected, so STC is what the connection reports — the STM-looking
    // USBMODEM path no longer changes the firmware profile.
    expect(device.session?.variantId).toBe('gbflash');
    expect(device.firmwareProfile?.id).toBe('flashgbx');
    expect(device.firmwareProfile?.label).toBe('GBFlash');
    expect(device.firmwareProfile?.firmwareVersion).toBe('L14');
    expect(device.firmwareProfile?.maxReadChunk).toBe(0x1000);
    expect(device.firmwareProfile?.capabilities.cartPowerControl).toBe(true);
    expect(device.flashgbxInfo?.pcbName).toBe('GBFlash');
    expect(device.connectionId).toBe('tauri:1');
    expect(device.serialHandle?.firmwareProfile?.id).toBe('flashgbx');

    expect(infoSpy).toHaveBeenCalledWith(
      '[DeviceConnectionManager] session established',
      expect.objectContaining({
        source: 'connectWithSelectedPort',
        variant: 'gbflash',
        firmware: 'flashgbx.cfw',
        baudRate: 2_000_000,
      }),
    );
    infoSpy.mockRestore();
  });

  it('keeps a mismatch port when it is picked explicitly and surfaces the diagnostic', async () => {
    AdvancedSettings.setVariantId(VARIANT_IDS.stm);
    const mismatch = { path: '/dev/cu.usbserial-110', vendorId: '1a86', productId: '7523' };
    const session = buildStmSession({
      usb: { vendorId: '1a86', productId: '7523' },
    });
    connectionUseCaseState.reconnectWithSelection.mockResolvedValueOnce({
      success: true,
      context: connectionContext(5, {
        portInfo: mismatch,
        session,
        diagnostics: session.diagnostics,
      }),
    });

    const { DeviceConnectionManager } = await import('@/services/device-connection-manager');
    const manager = DeviceConnectionManager.getInstance();
    const device = await manager.connectWithSelectedPort(mismatch);

    expect(device.portInfo).toEqual(mismatch);
    expect(device.diagnostics?.map(diagnostic => diagnostic.code)).toContain('port-mismatch');
  });

  it('runs teardown once inside the connection transaction and clears legacy state', async () => {
    AdvancedSettings.setVariantId(VARIANT_IDS.gbflash);
    connectionUseCaseState.reconnectWithSelection.mockResolvedValueOnce({
      success: true,
      context: connectionContext(6, {
        session: buildFlashgbxSession(),
        probeFacts: { firmwareInfo: TEST_FLASHGBX_INFO },
      }),
    });

    const { DeviceConnectionManager } = await import('@/services/device-connection-manager');
    const manager = DeviceConnectionManager.getInstance();
    const device = await manager.connectWithSelectedPort(CH340_PORT);

    await manager.disconnectDevice(device);

    // No separate protocol close: `disconnect()` owns teardown + port close.
    expect(connectionUseCaseState.disconnect).toHaveBeenCalledOnce();
    expect(device.transport).toBeNull();
    expect(device.session).toBeUndefined();
    expect(device.flashgbxInfo).toBeUndefined();
    expect(manager.isDeviceConnected(device)).toBe(false);
  });

  it('clears legacy state and rethrows when the disconnect transaction fails', async () => {
    connectionUseCaseState.disconnect.mockResolvedValue({
      success: false,
      failure: { stage: 'disconnect', code: 'disconnect_failed', message: 'close failed' },
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

  it('rejects operations bound to a previous generation before touching the transport', async () => {
    AdvancedSettings.setVariantId(VARIANT_IDS.gbflash);
    connectionUseCaseState.snapshot = {
      state: 'connected',
      context: { generation: 2, handle: { id: 'h2' } as never, selection: null },
    };
    connectionUseCaseState.reconnectWithSelection.mockResolvedValueOnce({
      success: true,
      context: connectionContext(2, {
        session: buildFlashgbxSession(),
        probeFacts: { firmwareInfo: TEST_FLASHGBX_INFO },
      }),
    });

    const { DeviceConnectionManager } = await import('@/services/device-connection-manager');
    const manager = DeviceConnectionManager.getInstance();
    const device = await manager.connectWithSelectedPort(CH340_PORT);
    expect(device.connectionGeneration).toBe(2);

    const touchNewTransport = vi.fn();
    const staleResult = await manager.runConnectionOperation({
      expectedGeneration: 1,
      fn: touchNewTransport,
    });
    expect(staleResult).toMatchObject({ ok: false, reason: 'stale_context' });
    expect(touchNewTransport).not.toHaveBeenCalled();
  });

  it('reports no matching ports when the saved selection is invalid', async () => {
    selectionOverride.read = () => ({ source: 'invalid' });
    connectionUseCaseState.listAvailableSelections.mockResolvedValue({
      success: true,
      ports: [port(CH340_PORT)],
    });

    const { DeviceConnectionManager } = await import('@/services/device-connection-manager');
    const manager = DeviceConnectionManager.getInstance();

    await expect(manager.listPortsMatchingSelection()).resolves.toEqual([]);
  });
});
