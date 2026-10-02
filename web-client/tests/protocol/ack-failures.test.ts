import { describe, expect, it, vi } from 'vitest';

import { mapDomainError } from '@/features/burner/application/domain/error-mapping';
import type { Transport } from '@/platform/serial/types';
import { gbc_rom_program, gbc_write, ram_write, rom_program, rom_write } from '@/protocol';
import { ProtocolAckError } from '@/protocol/beggar_socket/protocol';

describe('protocol ACK structured failure', () => {
  it.each([rom_write, ram_write, gbc_write, (t: Transport, d: Uint8Array, a: number) => rom_program(t, d, a, 256), (t: Transport, d: Uint8Array, a: number) => gbc_rom_program(t, d, a, 256)])('classifies rejected ACK and preserves exact thrown error', async write => {
    const transport: Transport = { send: vi.fn(), read: vi.fn(), setSignals: vi.fn(), sendAndReceive: vi.fn().mockResolvedValue({ data: new Uint8Array([0]) }) };
    const caught = await write(transport, new Uint8Array([42]), 0).catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(ProtocolAckError);
    const mapped = mapDomainError('protocol', caught, 'fallback');
    expect(mapped.code).toBe('ack_failure');
    expect(mapped.cause).toBe(caught);
    expect(transport.sendAndReceive).toHaveBeenCalledTimes(1);
  });
});
