/**
 * Host platform identification shared by transport policy and device definitions.
 *
 * Lives in `src/types/` so the pure device definition layer can declare host-derived
 * packet limits without importing `platform/serial` implementations.
 */
export type HostPlatform = 'windows' | 'macos' | 'linux' | 'unknown';

/** Packet limits for a single host platform. */
export interface PlatformPacketLimits {
  readonly romWrite: number;
  readonly romRead: number;
  readonly ramPage: number;
}

/** Packet limits declared per host platform. */
export type HostPacketLimits = Readonly<Record<HostPlatform, PlatformPacketLimits>>;
