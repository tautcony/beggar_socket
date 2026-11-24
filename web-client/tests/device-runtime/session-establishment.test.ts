import { describe, expect, it, vi } from 'vitest';

import {
  BEGGAR_RUNTIME_BINDING_ID,
  GBFLASH_RUNTIME_BINDING_ID,
  VARIANT_IDS,
} from '@/device/definitions';
import type { DeviceDisplayModel } from '@/device/display';
import type { ProbeResult, SessionTransport } from '@/device/session';
import type { SelectionProvider } from '@/device/types';
import {
  createDeviceRuntime,
  createRuntimeCompositionRegistry,
  createSessionEstablishment,
  isSessionStageError,
  planConnection,
  type RuntimeBinding,
  SessionStageError,
} from '@/device-runtime';

import { captureStageError } from '../helpers/rejection';

interface StubDriver {
  readonly probe: ReturnType<typeof vi.fn>;
  readonly initialize: ReturnType<typeof vi.fn>;
  readonly teardown: ReturnType<typeof vi.fn>;
  readonly cleanupPending: ReturnType<typeof vi.fn>;
}

function createStubDriver(overrides: Partial<StubDriver> = {}): StubDriver {
  const driver: StubDriver = {
    probe: vi.fn(({ pending }: { pending: { selection: { firmware: { id: string } } } }) => Promise.resolve<ProbeResult<unknown>>({
      firmwareId: pending.selection.firmware.id,
      verification: 'verified',
      firmwareVersion: 'test-fw',
      facts: { marker: 'stub' },
    })),
    initialize: vi.fn(() => Promise.resolve()),
    teardown: vi.fn(() => Promise.resolve()),
    cleanupPending: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
  return driver;
}

const display: DeviceDisplayModel = {
  title: 'Stub device',
  subtitle: 'Stub firmware',
  badges: [],
  infoRows: [],
  warnings: [],
};

function createHarness(options: {
  selection?: SelectionProvider;
  driver?: StubDriver;
  composition?: ReturnType<typeof createRuntimeCompositionRegistry>;
} = {}) {
  const driver = options.driver ?? createStubDriver();
  const composition = options.composition ?? createRuntimeCompositionRegistry();
  const binding: RuntimeBinding<unknown> = {
    driver: driver as unknown as RuntimeBinding<unknown>['driver'],
    displayContributor: { build: () => display },
    adapterFactory: {
      create() {
        throw new Error('adapter factory is not used by the establishment tests');
      },
    },
  };
  if (!composition.has(BEGGAR_RUNTIME_BINDING_ID)) {
    composition.register(BEGGAR_RUNTIME_BINDING_ID, binding);
  }
  if (!composition.has(GBFLASH_RUNTIME_BINDING_ID)) {
    composition.register(GBFLASH_RUNTIME_BINDING_ID, binding);
  }

  const runtime = createDeviceRuntime({ composition });
  const selection = options.selection ?? {
    read: () => ({ variantId: VARIANT_IDS.stm, source: 'legacy' as const }),
  };
  const establishment = createSessionEstablishment({
    selection,
    registry: runtime.registry,
    store: runtime.store,
    resolver: runtime.resolver,
    composition,
  });

  return { driver, establishment, runtime };
}

function createTransport(): { transport: SessionTransport; closed: () => number } {
  let closed = 0;
  return {
    transport: {
      send: () => Promise.resolve(true),
      read: () => Promise.resolve({ data: new Uint8Array(0) }),
      sendAndReceive: () => Promise.resolve({ data: new Uint8Array(0) }),
      close: () => {
        closed += 1;
        return Promise.resolve();
      },
    },
    closed: () => closed,
  };
}

const PORT = { path: '/dev/cu.usbmodem1', vendorId: '0483', productId: '0721' };

describe('SessionEstablishment', () => {
  it('commits an ActiveSession with the resolved profile and the driver probe facts', async () => {
    const { establishment, driver } = createHarness();
    const { transport } = createTransport();

    const established = await establishment.establish({
      connectionId: 'session-1',
      transport,
      portInfo: PORT,
      backend: 'serial',
      usb: { vendorId: '0483', productId: '0721' },
    });

    expect(established.active.connectionId).toBe('session-1');
    expect(established.active.transport).toBe(transport);
    expect(established.active.profile.variantId).toBe(VARIANT_IDS.stm);
    expect(established.active.profile.verification).toBe('verified');
    expect(established.active.profile.firmwareVersion).toBe('test-fw');
    expect(established.diagnostics).toEqual(established.active.profile.diagnostics);
    expect(established.probeFacts).toEqual({ marker: 'stub' });
    expect(driver.cleanupPending).not.toHaveBeenCalled();
  });

  it('fails at the selection stage when the saved selection is invalid', async () => {
    const { establishment, driver } = createHarness({
      selection: { read: () => ({ source: 'invalid' }) },
    });
    const { transport } = createTransport();

    const error = await captureStageError(establishment
      .establish({ connectionId: 'session-1', transport, backend: 'serial' }));

    expect(isSessionStageError(error)).toBe(true);
    expect(error).toMatchObject({ stage: 'selection', code: 'selection-invalid' });
    expect(error.diagnostics[0]).toMatchObject({ code: 'selection-invalid', stage: 'selection' });
    expect(driver.probe).not.toHaveBeenCalled();
  });

  it('runs cleanupPending and keeps the port open when the probe fails', async () => {
    const driver = createStubDriver({
      probe: vi.fn(() => Promise.reject(new Error('no answer'))),
    });
    const { establishment } = createHarness({ driver });
    const { transport, closed } = createTransport();

    const error = await captureStageError(establishment
      .establish({ connectionId: 'session-1', transport, portInfo: PORT, backend: 'serial' }));

    expect(error).toMatchObject({ stage: 'probe', code: 'probe-failed' });
    expect(driver.cleanupPending).toHaveBeenCalledWith(
      expect.objectContaining({ transport }),
      'probe',
    );
    // Teardown belongs to the orchestration, which closes the pending transport.
    expect(closed()).toBe(0);
  });

  it('maps a resolve failure to the resolve stage and cleans the pending session', async () => {
    // The driver may not rewrite firmware identity, so the resolver rejects this probe.
    const driver = createStubDriver({
      probe: vi.fn(() => Promise.resolve<ProbeResult<unknown>>({
        firmwareId: 'not-the-selected-firmware',
        verification: 'verified',
        facts: {},
      })),
    });
    const { establishment } = createHarness({ driver });
    const { transport } = createTransport();

    const error = await captureStageError(establishment
      .establish({ connectionId: 'session-1', transport, backend: 'serial' }));

    expect(error).toMatchObject({ stage: 'resolve', code: 'resolve-failed' });
    expect(driver.cleanupPending).toHaveBeenCalledWith(expect.anything(), 'resolve');
  });

  it('maps an initialize failure to the initialize stage and records a cleanup warning when that also fails', async () => {
    const driver = createStubDriver({
      initialize: vi.fn(() => Promise.reject(new Error('init blew up'))),
      cleanupPending: vi.fn(() => Promise.reject(new Error('cleanup blew up'))),
    });
    const { establishment } = createHarness({ driver });
    const { transport } = createTransport();

    const error = await captureStageError(establishment
      .establish({ connectionId: 'session-1', transport, backend: 'serial', usb: { vendorId: '0483', productId: '0721' } }));

    expect(error).toMatchObject({ stage: 'initialize', code: 'initialize-failed' });
    expect(error.diagnostics.map((diagnostic: { code: string }) => diagnostic.code))
      .toEqual(['initialize-failed', 'cleanup-failed']);
  });

  it('allows an immediate retry after a failed attempt', async () => {
    let attempts = 0;
    const driver = createStubDriver({
      probe: vi.fn(({ pending }: { pending: { selection: { firmware: { id: string } } } }) => {
        attempts += 1;
        return attempts === 1
          ? Promise.reject(new Error('first attempt fails'))
          : Promise.resolve<ProbeResult<unknown>>({
            firmwareId: pending.selection.firmware.id,
            verification: 'verified',
            facts: {},
          });
      }),
    });
    const { establishment } = createHarness({ driver });

    await expect(
      establishment.establish({ connectionId: 'a', transport: createTransport().transport, backend: 'serial' }),
    ).rejects.toMatchObject({ stage: 'probe' });

    const retried = await establishment.establish({
      connectionId: 'b',
      transport: createTransport().transport,
      backend: 'serial',
    });
    expect(retried.active.connectionId).toBe('b');
    expect(driver.cleanupPending).toHaveBeenCalledTimes(1);
  });

  it('resolves the attempt plan instead of re-reading the settings mid-transaction', async () => {
    // Settings are saved while the port is being opened: the attempt must still publish the
    // variant and baud rate it started with, because those are what opened the port.
    const selection: SelectionProvider = {
      read: () => ({ variantId: VARIANT_IDS.gbflash, source: 'v2' as const }),
    };
    const { establishment, runtime } = createHarness({ selection });
    runtime.store.set('gbflash.cfw', 'baudRate', 1_000_000);
    const plan = planConnection({
      selection,
      registry: runtime.registry,
      store: runtime.store,
    });
    expect(plan).toMatchObject({ variantId: VARIANT_IDS.gbflash, baudRate: 1_000_000 });

    // A second edit lands between the plan and the handshake.
    runtime.store.set('gbflash.cfw', 'baudRate', 2_000_000);

    const established = await establishment.establish({
      connectionId: 'session-1',
      transport: createTransport().transport,
      backend: 'serial',
      plan,
    });

    expect(established.active.profile.variantId).toBe(VARIANT_IDS.gbflash);
    expect(established.active.profile.transport.baudRate).toBe(1_000_000);
    expect(established.active.profile.connectionParameters.baudRate).toBe(1_000_000);
  });

  it('returns teardown diagnostics instead of throwing when teardown fails', async () => {
    const driver = createStubDriver({
      teardown: vi.fn(() => Promise.reject(new Error('power off refused'))),
    });
    const { establishment } = createHarness({ driver });
    const established = await establishment.establish({
      connectionId: 'session-1',
      transport: createTransport().transport,
      backend: 'serial',
    });

    const diagnostics = await establishment.teardown(established.active);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ code: 'teardown-failed', stage: 'disconnect' });
  });

  it('keeps a driver-reported stage error and still records the cleanup failure', async () => {
    // The Boost probe reports its own stage error; before, that error won the way out and
    // the cleanup outcome was lost because only `cause` carried it.
    const driver = createStubDriver({
      probe: vi.fn(() => Promise.reject(new SessionStageError('probe', 'boost handshake did not answer', {
        code: 'boost-unsupported',
        diagnostics: [{ code: 'boost-probe-timeout', severity: 'info', message: 'boost probe timed out', stage: 'probe' }],
      }))),
      cleanupPending: vi.fn(() => Promise.reject(new Error('cleanup blew up'))),
    });
    const { establishment } = createHarness({ driver });

    const error = await captureStageError(establishment.establish({
      connectionId: 'session-1',
      transport: createTransport().transport,
      backend: 'serial',
      usb: { vendorId: '0483', productId: '0721' },
    }));

    expect(error.code).toBe('boost-unsupported');
    // The driver's own diagnostics stay first; the cleanup failure is appended, not swapped.
    expect(error.diagnostics.map(diagnostic => diagnostic.code)).toEqual(['boost-probe-timeout', 'cleanup-failed']);
    expect(error.cause).toMatchObject({ cleanup: expect.any(Error), original: expect.anything() });
  });

  it('warns instead of throwing when no runtime can tear the session down', async () => {
    const { establishment } = createHarness();
    const established = await establishment.establish({
      connectionId: 'session-1',
      transport: createTransport().transport,
      backend: 'serial',
    });

    const foreign = {
      ...established.active,
      profile: { ...established.active.profile, variantId: 'ghost' },
    };
    const diagnostics = await establishment.teardown(foreign);

    expect(diagnostics[0]).toMatchObject({ code: 'teardown-failed', severity: 'warning' });
  });

  it.each([VARIANT_IDS.gbflash, VARIANT_IDS.stmBoost])(
    'rejects a simulated %s session before the first protocol byte',
    async (variantId) => {
      const { establishment, driver } = createHarness({
        selection: { read: () => ({ variantId, source: 'legacy' as const }) },
      });

      const error = await captureStageError(establishment.establish({
        connectionId: 'session-1',
        transport: createTransport().transport,
        backend: 'simulated',
      }));

      // The simulator implements the standard Beggar frames only, so committing a session
      // for these variants would publish a connection that fails on its first operation.
      expect(error).toMatchObject({ stage: 'probe', code: 'simulated-protocol-unsupported' });
      expect(error.diagnostics.map(diagnostic => diagnostic.code)).toEqual(['simulated-protocol-unsupported']);
      expect(driver.probe).not.toHaveBeenCalled();
      expect(driver.cleanupPending).not.toHaveBeenCalled();
    },
  );

  it('establishes a simulated STM session that the simulator can drive', async () => {
    const { establishment, driver } = createHarness();

    const established = await establishment.establish({
      connectionId: 'session-1',
      transport: createTransport().transport,
      backend: 'simulated',
    });

    expect(established.active.profile.variantId).toBe(VARIANT_IDS.stm);
    expect(established.active.profile.transport.backend).toBe('simulated');
    expect(driver.probe).toHaveBeenCalledOnce();
  });
});
