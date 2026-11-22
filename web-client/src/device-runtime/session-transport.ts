/**
 * `SessionTransport` is a structural view owned by the pure definition layer, while the
 * protocols operate on the platform `Transport`. Drivers live in this assembly layer, so
 * this is the single place that narrows the structural view back to the real transport.
 */
import type { SessionTransport } from '@/device/session';
import type { Transport } from '@/platform/serial';

export function asPlatformTransport(transport: SessionTransport): Transport {
  const candidate = transport as Partial<Transport>;
  if (typeof candidate.send !== 'function' || typeof candidate.read !== 'function') {
    throw new Error('Session transport does not implement the platform Transport contract');
  }
  return candidate as Transport;
}
