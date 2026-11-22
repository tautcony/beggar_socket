/**
 * Display contracts for the pure device definition layer.
 *
 * The definition layer only carries data; rendering lives in UI components and the
 * contributors that build these models live in `src/device-runtime/`.
 */

/** i18n friendly text: a translation key with params, plus a plain-text fallback. */
export type DisplayText =
  | string
  | {
    readonly key: string;
    readonly params?: Readonly<Record<string, string | number>>;
    readonly fallback?: string;
  };

export interface DisplayBadge {
  readonly id: string;
  readonly text: DisplayText;
  readonly tone: 'info' | 'success' | 'warn';
}

export interface DisplayInfoRow {
  readonly label: DisplayText;
  readonly value: DisplayText;
  readonly copyable?: boolean;
}

/** Normalized display model contributed by a runtime binding. */
export interface DeviceDisplayModel {
  readonly title: DisplayText;
  readonly subtitle?: DisplayText;
  readonly badges: readonly DisplayBadge[];
  readonly infoRows: readonly DisplayInfoRow[];
  readonly warnings: readonly DisplayText[];
}
