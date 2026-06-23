import { describe, expect, it } from 'vitest';

import { mapDomainError } from '@/features/burner/application/domain/error-mapping';
import { ProtocolPacketReadError } from '@/protocol/beggar_socket/packet-read';

describe('error-mapping', () => {
  it('prefers stable error codes over message substrings', () => {
    const error = new ProtocolPacketReadError(
      'PACKET_TIMEOUT',
      'opaque transport detail without timeout keyword',
      'opaque transport detail without timeout keyword',
    );

    const mapped = mapDomainError('protocol', error, 'fallback');

    expect(mapped.code).toBe('timeout');
    expect(mapped.message).toBe('opaque transport detail without timeout keyword');
  });
});
