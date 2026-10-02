import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CartridgeProtocolPortAdapter, createCartridgeProtocolSession } from '@/features/burner/adapters/cartridge-protocol-port';
import { BurnerSession } from '@/features/burner/application/burner-session';
import { BurnerFacadeImpl, BurnerUseCaseImpl } from '@/features/burner/application/burner-use-case';
import { ProtocolPacketReadError } from '@/protocol/beggar_socket/packet-read';
import { GBAAdapter } from '@/services/gba-adapter';
import { MBC5Adapter } from '@/services/mbc5-adapter';
import { AdvancedSettings } from '@/settings/advanced-settings';
import type { CommandOptions } from '@/types/command-options';
import type { DeviceInfo } from '@/types/device-info';
import { STM_FIRMWARE_PROFILE } from '@/types/firmware-profile';
import { errorToBurnerLog } from '@/utils/burner-log';
import type { CFIInfo } from '@/utils/parsers/cfi-parser';

const io = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn(), erase: vi.fn() }));
vi.mock('@/protocol', async original => ({ ...await original<typeof import('@/protocol')>(), rom_read: io.read, gbc_read: io.read, rom_program: io.write, rom_erase_chip: io.erase, gbc_rom_erase_chip: io.erase, rom_erase_sector: io.erase, gbc_rom_erase_sector: io.erase }));
vi.mock('@/utils/async-utils', () => ({ timeout: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/utils/monitoring/sentry-tracker', () => ({ PerformanceTracker: { trackAsyncOperation: (_name: string, operation: () => unknown) => operation() } }));
const device = (): DeviceInfo => ({ port: null, connection: null, firmwareProfile: STM_FIRMWARE_PROFILE, transport: { send: vi.fn(), read: vi.fn(), sendAndReceive: vi.fn().mockResolvedValue({ data: new Uint8Array([0xaa]) }), flushInput: vi.fn(), setSignals: vi.fn() } });
const options = { cfiInfo: { deviceSize: 1024, eraseSectorBlocks: [{ sectorSize: 1024, sectorCount: 1, totalSize: 1024, startAddress: 0, endAddress: 1023 }] } as CFIInfo, size: 4, romPageSize: 4, mbcType: 'MBC5' } as CommandOptions;
describe('service structured failure propagation', () => {
  beforeEach(() => { vi.restoreAllMocks(); Object.values(io).forEach(mock => mock.mockReset()); AdvancedSettings.resetToDefaults(); AdvancedSettings.romReadRetryCount = 0; AdvancedSettings.romEraseRetryCount = 0; });
  it.each([['gba', 'PACKET_TIMEOUT', 'timeout', 'protocol'], ['mbc', 'PACKET_TIMEOUT', 'timeout', 'protocol'], ['gba', 'LENGTH_MISMATCH', 'length_mismatch', 'protocol'], ['mbc', 'LENGTH_MISMATCH', 'length_mismatch', 'protocol'], ['gba', 'TRANSPORT_FAILURE', 'transport_failure', 'transport'], ['mbc', 'TRANSPORT_FAILURE', 'transport_failure', 'transport']] as const)('%s preserves %s through facade and UI log', async (platform, sourceCode, code, stage) => {
    const cause = new ProtocolPacketReadError(sourceCode, 'opaque', 'detail', { cause: new Error('inner') });
    io.read.mockRejectedValue(cause);
    const adapter = platform === 'gba' ? new GBAAdapter(device()) : new MBC5Adapter(device());
    const facade = new BurnerFacadeImpl(new BurnerUseCaseImpl(new CartridgeProtocolPortAdapter(), key => key, value => String(value)));
    const result = await facade.readRom(createCartridgeProtocolSession(adapter), 4, options, undefined, false);
    expect(result.success).toBe(false);
    expect(result.error).toMatchObject({ code, stage, recoverable: true });
    expect(result.error?.cause).toBe(cause);
    const logs = new BurnerSession();
    logs.addLog('now', errorToBurnerLog(result.message, result.error), 'error');
    expect(logs.snapshot.logs[0]?.diagnostic).toBe(result.error);
    expect(logs.snapshot.logs[0]?.diagnostic?.cause).toBe(cause);
  });
  it.each(['gba', 'mbc'] as const)('%s verification mismatch has explicit code without invented cause', async platform => {
    io.read.mockResolvedValue(new Uint8Array([9, 9, 9, 9]));
    const adapter = platform === 'gba' ? new GBAAdapter(device()) : new MBC5Adapter(device());
    const result = await adapter.verifyROM(new Uint8Array([1, 2, 3, 4]), options, new AbortController().signal);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('verification_mismatch');
    expect(result.error).not.toHaveProperty('cause');
  });
  it.each(['gba', 'mbc'] as const)('%s cancelled command preserves signal reason', async platform => {
    const controller = new AbortController();
    const cause = new Error('cancel reason');
    controller.abort(cause);
    const adapter = platform === 'gba' ? new GBAAdapter(device()) : new MBC5Adapter(device());
    const result = await adapter.readROM(4, options, controller.signal, false);
    expect(result.error?.code).toBe('aborted');
    expect(result.error?.cause).toBe(cause);
    expect(io.read).not.toHaveBeenCalled();
  });
  it.each(['batteryless-read', 'batteryless-write', 'gba-erase', 'mbc-erase', 'gba-sectors', 'mbc-sectors'] as const)('%s cancelled during I/O retains aborted classification and original rejection', async operation => {
    const controller = new AbortController();
    const failure = new ProtocolPacketReadError('PACKET_TIMEOUT', 'opaque I/O failure', 'detail');
    const rejectAfterAbort = () => { controller.abort(new Error('user reason')); return Promise.reject(failure); };
    io.read.mockImplementation(rejectAfterAbort);
    io.write.mockImplementation(rejectAfterAbort);
    io.erase.mockImplementation(rejectAfterAbort);
    const adapter = operation.startsWith('mbc') ? new MBC5Adapter(device()) : new GBAAdapter(device());
    let result;
    if (operation === 'batteryless-read' || operation === 'batteryless-write') {
      if (!(adapter instanceof GBAAdapter)) throw new Error('Expected GBA');
      vi.spyOn(adapter, 'searchBatteryless').mockResolvedValue({ offset: 0, size: 4 });
      vi.spyOn(adapter, 'eraseSectors').mockResolvedValue({ success: true, message: 'ok' });
      result = operation === 'batteryless-read'
        ? await adapter.readBatterylessSave(options, controller.signal)
        : await adapter.writeBatterylessSave(new Uint8Array([1, 2, 3, 4]), options, controller.signal);
    } else if (operation.endsWith('sectors')) {
      result = await adapter.eraseSectors(options.cfiInfo.eraseSectorBlocks, options, controller.signal);
    } else {
      result = await adapter.eraseChip(options, controller.signal);
    }
    expect(result.message).toBe('messages.operation.cancelled');
    expect(result.error?.code).toBe('aborted');
    expect(result.error?.cause).toBe(failure);
  });

});
