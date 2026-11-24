import { describe, expect, it } from 'vitest';

import { buildConnectionLogReport } from '@/device-runtime/connection-report';
import { SessionStageError } from '@/device-runtime/diagnostics';
import { DeviceSelectionError } from '@/services/device-connection-manager';
import { formatDeviceError, localizeConnectionLogEntries, type TranslateFn } from '@/utils/device-error';

const mockT: TranslateFn = (key, params) => {
  if (!params || Object.keys(params).length === 0) {
    return `[i18n:${key}]`;
  }
  return `[i18n:${key}:${JSON.stringify(params)}]`;
};

describe('formatDeviceError', () => {
  it('translates missing device selection errors', () => {
    const error = new DeviceSelectionError(
      'No valid device selection. Choose a device and firmware in the advanced settings.',
    );

    expect(formatDeviceError(error, mockT)).toBe('[i18n:messages.device.errors.noValidSelection]');
  });

  it('translates unregistered device selection errors with variantId', () => {
    const error = new DeviceSelectionError('Device selection legacy-stc is not registered');

    expect(formatDeviceError(error, mockT)).toBe(
      '[i18n:messages.device.errors.selectionNotRegistered:{"variantId":"legacy-stc"}]',
    );
  });

  it('translates wrapped SessionStageError causes inside connection failures', () => {
    const stageError = new SessionStageError(
      'probe',
      'Beggar Boost handshake did not answer; the selected 丐中丐（Boost） variant requires Boost firmware',
      { code: 'boost-unsupported' },
    );
    const error = Object.assign(new Error('[probe/probe_failed] ...'), {
      failure: {
        stage: 'probe',
        code: 'probe_failed',
        message: stageError.message,
        cause: stageError,
      },
    });

    expect(formatDeviceError(error, mockT)).toBe('[i18n:messages.device.errors.boostUnsupported]');
  });

  it('translates diagnostic codes when failure cause has no code', () => {
    const error = Object.assign(new Error('[probe/probe_failed]'), {
      failure: {
        stage: 'probe',
        code: 'probe_failed',
        message: 'GBFlash handshake failed',
        diagnostics: [{ code: 'unsupported-firmware', message: 'Unsupported' }],
      },
    });

    expect(formatDeviceError(error, mockT)).toBe('[i18n:messages.device.errors.gbflashUnsupported]');
  });

  it('translates generic fallback failure messages', () => {
    const error = Object.assign(new Error('[connect/connect_failed] Failed to connect to selected port'), {
      failure: {
        stage: 'connect',
        code: 'connect_failed',
        message: 'Failed to connect to selected port',
      },
    });

    expect(formatDeviceError(error, mockT)).toBe('[i18n:messages.device.errors.connectFailed]');
  });

  it('preserves OS-level serial port error messages', () => {
    const error = Object.assign(new Error('[connect/connect_failed] Failed to open serial port: Resource busy'), {
      failure: {
        stage: 'connect',
        code: 'connect_failed',
        message: 'Failed to open serial port',
        cause: new Error('Resource busy'),
      },
    });

    expect(formatDeviceError(error, mockT)).toBe('Resource busy');
  });

  it('translates known DeviceConnectionManager plain errors and falls back for unknown errors', () => {
    expect(formatDeviceError(new Error('Device connection already in progress'), mockT)).toBe(
      '[i18n:messages.device.errors.connectionInProgress]',
    );
    expect(formatDeviceError(new Error('This method is only available in Tauri environment'), mockT)).toBe(
      '[i18n:messages.device.errors.tauriOnly]',
    );
    expect(formatDeviceError(new Error('Unexpected serial timeout'), mockT)).toBe('Unexpected serial timeout');
    expect(formatDeviceError('raw error', mockT)).toBe('raw error');
  });

  it('localizes structured ConnectionLogEntry payloads in the UI layer', () => {
    const entries = localizeConnectionLogEntries(
      buildConnectionLogReport({
        failure: {
          stage: 'probe',
          message: 'handshake failed',
          diagnostics: [
            {
              code: 'port-mismatch',
              severity: 'warning',
              stage: 'transport',
              message: {
                key: 'messages.device.diagnostics.portMismatch',
                params: { observed: '1a86:7523', variantId: 'beggar-stm', expected: '0483:0721 (STM32 CDC)' },
              },
            },
          ],
        },
      }),
      mockT,
    );

    expect(entries[0].message).toBe('[i18n:messages.device.log.connectionFailedAt:{"stage":"probe","message":"handshake failed"}]');
    expect(entries[0].details).toBe('[i18n:messages.device.stageHints.probe]');
    expect(entries[1].message).toBe(
      '[transport/port-mismatch] [i18n:messages.device.diagnostics.portMismatch:{"observed":"1a86:7523","variantId":"beggar-stm","expected":"0483:0721 (STM32 CDC)"}]',
    );
  });
});
