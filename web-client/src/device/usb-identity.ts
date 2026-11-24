/**
 * USB identity helpers.
 *
 * Shared by `registry.matchPort` (discovery / manual candidate ordering), the session
 * resolver (transport diagnostics) and the connection log, so all of them use exactly the
 * same normalization and matcher semantics.
 */
import type { DeviceDiagnostic } from './session';
import type { DeviceFirmwareBinding, UsbIdentity, UsbIdentityMatcher } from './types';

/** Minimal shape shared by `SerialPortInfo` and `TransportFacts.usb`. */
export interface UsbIds {
  readonly vendorId?: string;
  readonly productId?: string;
}

/** Why the observed ids could not be confirmed as a match. */
export type PortIdentityReason =
  /** A matcher confirmed the ids. */
  | 'matched'
  /** The ids answered every matcher field and none of them matched. */
  | 'mismatch'
  /** The port carries ids, but not the ones a matcher needs to decide. */
  | 'incomplete'
  /** The port carries no USB id at all. */
  | 'missing';

/**
 * Structured discovery result.
 *
 * `unknown` never means "matched": automatic discovery may only open a confirmable
 * `match`, while `incomplete`/`missing` stay user choices.
 */
export interface PortIdentityAssessment {
  readonly outcome: UsbIdentity;
  readonly reason: PortIdentityReason;
  /** `vid:pid` the port reported, `no VID/PID` when it reported nothing. */
  readonly observed: string;
  /** Identities the selected binding accepts, one matcher per entry. */
  readonly expected: string;
  /** Matcher fields this port cannot supply, so identity cannot be confirmed. */
  readonly missing: readonly ('vendorId' | 'productId')[];
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
export function describeIdentityMatchers(matchers: readonly UsbIdentityMatcher[]): string {
  if (matchers.length === 0) {
    return 'no identity matcher';
  }
  return matchers
    .map((matcher) => {
      const ids = `${normalizeUsbId(matcher.vendorId) || '----'}:${normalizeUsbId(matcher.productId) || '----'}`;
      return matcher.description ? `${ids} (${matcher.description})` : ids;
    })
    .join(' | ');
}

/**
 * Classifies the port identity of one selection.
 *
 * A matcher can only answer for the fields it declares: when the port lacks a field the
 * matcher needs, the result is `incomplete` rather than `mismatch`, because "we could not
 * check" is not the same claim as "it is the wrong device". Only a matcher whose every
 * declared field is present decides between `match` and `mismatch`.
 */
export function assessPortIdentity(
  binding: DeviceFirmwareBinding,
  ids?: UsbIds | null,
): PortIdentityAssessment {
  return assessPortIdentityFromMatchers(binding.identityMatchers, ids);
}

/**
 * Matcher-level form of {@link assessPortIdentity}.
 *
 * Callers that only hold the copied matchers of an attempt snapshot (a failed connection
 * has no resolved binding to read them from) must reach the same verdict as the resolver.
 */
export function assessPortIdentityFromMatchers(
  matchers: readonly UsbIdentityMatcher[],
  ids?: UsbIds | null,
): PortIdentityAssessment {
  const vendorId = normalizeUsbId(ids?.vendorId);
  const productId = normalizeUsbId(ids?.productId);
  const observed = formatUsbIds({ vendorId, productId });
  const expected = describeIdentityMatchers(matchers);

  if (!vendorId && !productId) {
    return { outcome: 'unknown', reason: 'missing', observed, expected, missing: [] };
  }

  const pending = new Set<'vendorId' | 'productId'>();
  for (const matcher of matchers) {
    const matcherVendor = normalizeUsbId(matcher.vendorId);
    const matcherProduct = normalizeUsbId(matcher.productId);
    const missingVendor = matcherVendor !== '' && vendorId === '';
    const missingProduct = matcherProduct !== '' && productId === '';
    if (missingVendor || missingProduct) {
      if (missingVendor) pending.add('vendorId');
      if (missingProduct) pending.add('productId');
      continue;
    }
    if (matcherVendor && matcherVendor !== vendorId) {
      continue;
    }
    if (matcherProduct && matcherProduct !== productId) {
      continue;
    }
    return { outcome: 'match', reason: 'matched', observed, expected, missing: [] };
  }

  if (pending.size > 0) {
    return { outcome: 'unknown', reason: 'incomplete', observed, expected, missing: [...pending] };
  }

  return { outcome: 'mismatch', reason: 'mismatch', observed, expected, missing: [] };
}

/**
 * `unknown` means the port carried no usable identity for the matchers, so no identity
 * claim can be made; only `mismatch` is a confirmed negative signal.
 */
export function matchUsbIdentity(binding: DeviceFirmwareBinding, ids?: UsbIds | null): UsbIdentity {
  return assessPortIdentity(binding, ids).outcome;
}

/**
 * Transport diagnostic of a discovery result, or `undefined` for a confirmed match.
 *
 * Both the resolver and the establishment transaction use this, so a committed profile and
 * a failed attempt never disagree about what the port reported.
 */
export function portIdentityDiagnostic(
  assessment: PortIdentityAssessment,
  variantId?: string,
): DeviceDiagnostic | undefined {
  const selected = variantId ? ` for ${variantId}` : '';
  switch (assessment.reason) {
    case 'mismatch':
      // A mismatch is a warning, not a failure: the user may have picked the right device
      // on a cable that reports no usable VID/PID.
      return {
        code: 'port-mismatch',
        severity: 'warning',
        message: `Port ${assessment.observed} does not match the identity${selected} (${assessment.expected})`,
        stage: 'transport',
      };
    case 'incomplete':
      return {
        code: 'port-identity-incomplete',
        severity: 'warning',
        message: `Port ${assessment.observed} does not report ${assessment.missing.join('/')}, so it cannot be matched against ${assessment.expected}`,
        stage: 'transport',
      };
    case 'missing':
      return {
        code: 'port-identity-unknown',
        severity: 'info',
        message: `Port reported no USB identity, so ${assessment.expected} could not be checked`,
        stage: 'transport',
      };
    default:
      return undefined;
  }
}
