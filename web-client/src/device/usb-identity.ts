/**
 * USB identity helpers.
 *
 * Shared by `registry.matchPort` (discovery / manual candidate ordering) and the
 * session resolver (`port-mismatch` diagnostics), so both use exactly the same
 * normalization and matcher semantics.
 */
import type { DeviceFirmwareBinding, UsbIdentity } from './types';

/** Minimal shape shared by `SerialPortInfo` and `TransportFacts.usb`. */
export interface UsbIds {
  readonly vendorId?: string;
  readonly productId?: string;
}

export function normalizeUsbId(value?: string): string {
  return value?.trim().toLowerCase().padStart(4, '0') ?? '';
}

/** Diagnostic-friendly `vid:pid` rendering; missing halves stay readable. */
export function formatUsbIds(ids?: UsbIds | null): string {
  const vendorId = normalizeUsbId(ids?.vendorId);
  const productId = normalizeUsbId(ids?.productId);
  if (!vendorId && !productId) {
    return 'no VID/PID';
  }
  return `${vendorId || '----'}:${productId || '----'}`;
}

/** Expected identities of a binding, rendered for diagnostics. */
export function describeIdentityMatchers(binding: DeviceFirmwareBinding): string {
  if (binding.identityMatchers.length === 0) {
    return 'no identity matcher';
  }
  return binding.identityMatchers
    .map((matcher) => {
      const ids = `${normalizeUsbId(matcher.vendorId) || '----'}:${normalizeUsbId(matcher.productId) || '----'}`;
      return matcher.description ? `${ids} (${matcher.description})` : ids;
    })
    .join(' | ');
}

/**
 * `unknown` means the port carried no VID/PID at all, so no identity claim can be
 * made; only `mismatch` is a real diagnostic signal.
 */
export function matchUsbIdentity(binding: DeviceFirmwareBinding, ids?: UsbIds | null): UsbIdentity {
  const vendorId = normalizeUsbId(ids?.vendorId);
  const productId = normalizeUsbId(ids?.productId);
  if (!vendorId && !productId) {
    return 'unknown';
  }
  const matched = binding.identityMatchers.some((matcher) => {
    const matcherVendor = normalizeUsbId(matcher.vendorId);
    const matcherProduct = normalizeUsbId(matcher.productId);
    if (matcherVendor && matcherVendor !== vendorId) {
      return false;
    }
    if (matcherProduct && matcherProduct !== productId) {
      return false;
    }
    return true;
  });
  return matched ? 'match' : 'mismatch';
}
