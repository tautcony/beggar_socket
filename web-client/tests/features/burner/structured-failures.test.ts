import { describe, expect, it } from 'vitest';

import { runWithCommandBufferReset } from '@/composables/cartburner/withCommandBufferReset';
import { CartridgeProtocolPortAdapter } from '@/features/burner/adapters/cartridge-protocol-port';
import { BurnerFacadeImpl, BurnerUseCaseImpl } from '@/features/burner/application/burner-use-case';
import { mapDomainError } from '@/features/burner/application/domain/error-mapping';
import type { BurnerProtocolSession } from '@/features/burner/application/domain/ports';
import { isCommandError } from '@/types/command-error';
import type { CommandOptions } from '@/types/command-options';
import type { CommandResult } from '@/types/command-result';
import { errorToBurnerLog } from '@/utils/burner-log';

const port = new CartridgeProtocolPortAdapter();
const facade = new BurnerFacadeImpl(new BurnerUseCaseImpl(port, key => key, value => String(value)));
const options = { cfiInfo: {} } as CommandOptions;
function session(result: CommandResult | Error): BurnerProtocolSession {
  return { id: 'test', readROM: () => result instanceof Error ? Promise.reject(result) : Promise.resolve(result) } as unknown as BurnerProtocolSession;
}
describe('structured command failures', () => {
  it.each(['timeout', 'aborted', 'transport_failure', 'ack_failure', 'verification_mismatch'] as const)('preserves %s metadata and cause through port and facade', async code => {
    const cause = new Error('original');
    const error = Object.freeze({ stage: 'protocol' as const, code, message: 'detail', recoverable: false, cause, operation: 'readROM', address: 16, cleanupError: new Error('cleanup') });
    const input = Object.freeze({ success: false, message: 'translated', error });
    const result = await facade.readRom(session(input), 4, options);
    expect(result.error).toBe(error);
    expect(result.error?.cause).toBe(cause);
    expect(input.message).toBe('translated');
    expect(result.message).toBe('translated');
    expect(result).toBe(input);
  });
  it('preserves existing mapped error unchanged', () => {
    const error = { stage: 'protocol' as const, code: 'timeout' as const, message: 'detail', recoverable: false, cause: new Error('original') };
    expect(mapDomainError('transport', error, 'fallback')).toBe(error);
  });
  it('does not fabricate a cause for legacy failures', async () => {
    const result = await facade.readRom(session({ success: false, message: 'legacy' }), 4, options);
    expect(result.error?.message).toBe('legacy');
    expect(result.error).not.toHaveProperty('cause');
  });
  it('preserves thrown error identity', async () => {
    const cause = Object.assign(new Error('opaque'), { code: 'PACKET_TIMEOUT' });
    const result = await facade.readRom(session(cause), 4, options);
    expect(result.error?.code).toBe('timeout');
    expect(result.error?.cause).toBe(cause);
  });
  it.each([{ stage: 'future', code: 'timeout' }, { stage: 'protocol', code: 'FUTURE_CODE' }])('rejects invalid structured enum values', values => {
    const input = { ...values, message: 'opaque', recoverable: false };
    expect(isCommandError(input)).toBe(false);
    const mapped = mapDomainError('protocol', input, 'fallback');
    expect(mapped).not.toBe(input);
    expect(mapped.cause).toBe(input);
  });
  it.each([[undefined, 'undefined'], [null, 'null'], [{}, '[object Object]'], ['text', 'text'], [42, '42']] as const)('keeps legacy non-Error log strings for %s', (error, expected) => {
    expect(errorToBurnerLog('failure', error).error).toBe(expected);
  });
  it('retains legacy failure data and message while adding diagnostic', async () => {
    const data = new Uint8Array([7]);
    const input = Object.freeze({ success: false, message: 'translated', data });
    const result = await facade.readRom(session(input), 1, options);
    expect(result.message).toBe(input.message);
    expect(result.data).toBe(data);
    expect(input).not.toHaveProperty('error');
  });
  it('reset keeps Error throw contract and original cause', async () => {
    const cause = Object.assign(new Error('opaque'), { code: 'TRANSPORT_FAILURE' });
    const resetSession = { ...session({ success: true, message: '' }), resetCommandBuffer: () => Promise.reject(cause) };
    const thrown = await facade.resetCommandBuffer(resetSession).catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(Error);
    expect(mapDomainError('transport', thrown, 'fallback').cause).toBe(cause);
  });
  it('reset cleanup diagnostic preserves cause and original operation result', async () => {
    const cause = Object.assign(new Error('opaque'), { code: 'TRANSPORT_FAILURE' });
    const resetSession = { ...session({ success: true, message: '' }), resetCommandBuffer: () => Promise.reject(cause) };
    const original = { success: true, message: 'completed' };
    let diagnostic: ReturnType<typeof errorToBurnerLog> | undefined;
    const result = await runWithCommandBufferReset(resetSession, () => Promise.resolve(original), adapter => facade.resetCommandBuffer(adapter), error => { diagnostic = errorToBurnerLog('Reset failed', error); });
    expect(result).toBe(original);
    expect(diagnostic?.diagnostic?.code).toBe('transport_failure');
    expect(diagnostic?.diagnostic?.cause).toBe(cause);
  });
  it('passes healthy results and byte identities unchanged', async () => {
    const data = new Uint8Array([0, 255, 2]);
    const input = Object.freeze({ success: true, message: 'ok', data });
    const result = await facade.readRom(session(input), 3, options);
    expect(result).toBe(input);
    expect(result.data).toBe(data);
    expect(result).not.toHaveProperty('error');
  });
});
