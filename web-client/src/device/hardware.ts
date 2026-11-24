/**
 * Hardware traits and transport requirements for the pure device definition layer.
 *
 * `HardwareTraits` describes the product hardware only. It is deliberately **not** a
 * capability map: it gates the four `cart.*` capabilities that have a hardware
 * counterpart and nothing else.
 */
import type { HostPacketLimits } from '@/types/host-platform';

/** Cart voltages the hardware can drive. */
export type CartVoltage = '3.3V' | '5V';

export interface HardwareTraits {
  readonly cartVoltages: readonly CartVoltage[];
  readonly cartPowerControl: 'none' | 'software' | 'auto';
  /** GBA / DMG switching: physical switch on the board or software controlled. */
  readonly modeSwitch: 'none' | 'hardware-switch' | 'software';
  readonly cartPresenceDetect: boolean;
  /** Static pin default; per-PCB reality may narrow it through probe facts. */
  readonly audioWePin: boolean;
}

/**
 * Baud rates the Rust side enforces (`src-tauri/src/native_platform.rs`).
 * Kept here for UI pre-validation only; it must stay in sync with the Rust whitelist.
 */
export const ALLOWED_BAUD_RATES: readonly number[] = [9600, 1_000_000, 1_500_000, 2_000_000];

/** Static transport requirements declared by a binding. */
export interface TransportRequirements {
  readonly defaultBaudRate?: number | 'auto';
  readonly allowedBaudRates?: readonly number[];
  /** Replaces the legacy `skipSignalInit` boolean. */
  readonly signalInit: 'dtr-rts-pulse' | 'none';
  /** Host-derived packet limits; unified source for every binding. */
  readonly packetLimits: HostPacketLimits;
  /**
   * Firmware-side read chunk ceiling. The effective read page is the stored
   * parameter clamped by this value; STC streams short replies so its ceiling is
   * above the host `romRead` default.
   */
  readonly maxReadChunk: number;
  /**
   * Default size of one read *request*.
   *
   * Defaults to the host `romRead` packet limit, which is also the request size for
   * firmwares that stream a read reply. Firmwares whose packet limit only bounds a
   * transport frame (GBFlash caps every frame at 256B) declare their real request size
   * here, so the read page is not silently cut into one command per frame.
   */
  readonly readPageDefault?: number;
}
