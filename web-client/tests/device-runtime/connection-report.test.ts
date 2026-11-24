import { describe, expect, it } from 'vitest';

import { VARIANT_IDS } from '@/device/definitions';
import { buildConnectionLogReport } from '@/device-runtime/connection-report';
import type { DeviceInfo } from '@/types/device-info';

import { buildGbflashSession, buildStmSession } from '../helpers/session-profile';

function device(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  const session = buildGbflashSession();
  return {
    port: null,
    transport: null,
    connection: null,
    connectionId: 'session-1',
    portInfo: { path: '/dev/cu.usbserial-110', vendorId: '1a86', productId: '7523' },
    session,
    diagnostics: session.diagnostics,
    ...overrides,
  };
}

describe('buildConnectionLogReport', () => {
  it('reports the committed device, firmware, port and match result', () => {
    const entries = buildConnectionLogReport({
      device: device({ session: buildGbflashSession({ usb: { vendorId: '1a86', productId: '7523' } }) }),
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ level: 'info', message: 'Connected: GBFlash (L14)' });
    expect(entries[0].details).toBe(
      'variant=gbflash, firmware=GBFlash L14, port=/dev/cu.usbserial-110 (1a86:7523), match=match, baud=2000000, transport=serial',
    );
  });

  it('reports an unknown match when the port exposes no USB identity', () => {
    const entries = buildConnectionLogReport({
      device: device({ portInfo: { path: '/dev/cu.Bluetooth-Incoming-Port' } }),
    });

    expect(entries[0].details).toContain('port=/dev/cu.Bluetooth-Incoming-Port (no VID/PID)');
    expect(entries[0].details).toContain('match=unknown');
  });

  it('reports a mismatch with its reason and keeps the diagnostic entries', () => {
    const session = buildStmSession({ usb: { vendorId: '1a86', productId: '7523' } });
    const entries = buildConnectionLogReport({
      device: device({
        portInfo: { path: '/dev/cu.usbserial-110', vendorId: '1a86', productId: '7523' },
        session,
        diagnostics: session.diagnostics,
      }),
    });

    expect(entries[0].details).toContain('match=mismatch');
    expect(entries[0].details).toContain('does not match the identity for beggar-stm');
    expect(entries[1]).toMatchObject({
      level: 'warn',
      message: expect.stringContaining('[transport/port-mismatch]'),
    });
  });

  it.each([
    ['list', 'Could not enumerate serial ports'],
    ['select', 'Choose a device and firmware'],
    ['connect', 'Check the USB cable'],
    ['init', 'signal initialisation failed'],
    ['probe', 'did not answer the selected firmware handshake'],
    ['resolve', 'could not be resolved'],
    ['initialize', 'session initialisation failed'],
    ['disconnect', 'Protocol teardown failed'],
    ['unknown', 'Connection failed. Check the device, cable and advanced settings'],
  ])('gives an actionable hint for the %s stage', (stage, hint) => {
    const entries = buildConnectionLogReport({ failure: { stage, message: 'boom' } });

    expect(entries[0]).toMatchObject({ level: 'error', message: `Connection failed at ${stage}: boom` });
    expect(entries[0].details).toContain(hint);
  });

  it('reports the variant, port and match of an attempt that never opened', () => {
    const entries = buildConnectionLogReport({
      failure: {
        stage: 'connect',
        message: 'Failed to open serial port: port is busy',
        context: {
          variantId: VARIANT_IDS.stm,
          port: { path: '/dev/cu.usbserial-110', vendorId: '1a86', productId: '7523' },
          portIdentity: {
            outcome: 'mismatch',
            reason: 'mismatch',
            observed: '1a86:7523',
            expected: '0483:0721',
            missing: [],
          },
        },
      },
    });

    // A busy, unplugged or denied port reports the same fields a committed session does.
    expect(entries[0].details).toContain(`variant=${VARIANT_IDS.stm}`);
    expect(entries[0].details).toContain('port=/dev/cu.usbserial-110 (1a86:7523)');
    expect(entries[0].details).toContain('match=mismatch (expected 0483:0721)');
    expect(entries[0].details).toContain('Check the USB cable');
  });

  it('appends the diagnostics of a failed attempt', () => {
    const entries = buildConnectionLogReport({
      failure: {
        stage: 'probe',
        message: 'Boost handshake did not answer',
        diagnostics: [
          { code: 'boost-probe-failed', severity: 'error', message: 'Boost handshake failed', stage: 'probe' },
          { code: 'cleanup-failed', severity: 'warning', message: 'Cleanup failed', stage: 'probe' },
        ],
      },
    });

    expect(entries.map(entry => [entry.level, entry.message])).toEqual([
      ['error', 'Connection failed at probe: Boost handshake did not answer'],
      ['error', '[probe/boost-probe-failed] Boost handshake failed'],
      ['warn', '[probe/cleanup-failed] Cleanup failed'],
    ]);
  });

  it('falls back to the legacy profile label when no session is attached', () => {
    const entries = buildConnectionLogReport({
      device: device({
        session: undefined,
        diagnostics: undefined,
        firmwareProfile: {
          id: 'stm',
          label: '丐中丐',
          maxReadChunk: 0x1000,
          capabilities: {
            gbaSectorErase: true,
            gbaFramRam: true,
            gbcFramRam: true,
            cartPowerControl: false,
            boostMode: false,
            nativeGbflashProtocol: false,
            audioWePin: false,
          },
        },
      }),
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].message).toBe('Connected: 丐中丐');
    expect(entries[0].details).toContain('variant=stm');
  });

  it('emits nothing without a device or a failure', () => {
    expect(buildConnectionLogReport({})).toEqual([]);
    expect(buildConnectionLogReport({ device: null, failure: null })).toEqual([]);
  });

  it('keeps the Boost banner as the firmware version of a verified session', () => {
    const session = buildStmSession({ verification: 'verified' } as never);
    const entries = buildConnectionLogReport({ device: device({ session, diagnostics: session.diagnostics }) });

    expect(entries[0].message).toContain('丐中丐');
    expect(entries[0].details).toContain(`variant=${VARIANT_IDS.stm}`);
  });
});
