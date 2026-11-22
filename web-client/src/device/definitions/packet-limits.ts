/**
 * Host-derived packet limits per firmware.
 *
 * Single source for both the new `TransportRequirements.packetLimits` declarations and
 * the legacy `platform/serial/platform-packet-policy` accessor.
 */
import type { HostPacketLimits } from '@/types/host-platform';

/**
 * Beggar STM32 (`usbser.sys` on Windows, CDC-ACM tty elsewhere):
 * - Windows keeps the firmware ceiling 4096B.
 * - macOS / Linux tty buffers are ~4KB, so writes converge to 3072B (0x0c00).
 */
export const BEGGAR_STM_PACKET_LIMITS: HostPacketLimits = {
  windows: { romWrite: 0x1000, romRead: 0x1000, ramPage: 0x1000 },
  macos: { romWrite: 0x0c00, romRead: 0x0c00, ramPage: 0x0c00 },
  linux: { romWrite: 0x0c00, romRead: 0x0c00, ramPage: 0x0c00 },
  unknown: { romWrite: 0x1000, romRead: 0x1000, ramPage: 0x1000 },
};

/**
 * Beggar STC8: writes behave like STM; reads stream 62B packets, so the Windows read
 * page grows to 8KB to cut round trips while macOS / Linux stay at 4KB.
 */
export const BEGGAR_STC_PACKET_LIMITS: HostPacketLimits = {
  windows: { romWrite: 0x1000, romRead: 0x2000, ramPage: 0x1000 },
  macos: { romWrite: 0x0c00, romRead: 0x1000, ramPage: 0x0c00 },
  linux: { romWrite: 0x0c00, romRead: 0x1000, ramPage: 0x0c00 },
  unknown: { romWrite: 0x1000, romRead: 0x2000, ramPage: 0x1000 },
};

/** FlashGBX framing caps every packet at 256B regardless of host. */
export const FLASHGBX_PACKET_LIMITS: HostPacketLimits = {
  windows: { romWrite: 0x100, romRead: 0x100, ramPage: 0x100 },
  macos: { romWrite: 0x100, romRead: 0x100, ramPage: 0x100 },
  linux: { romWrite: 0x100, romRead: 0x100, ramPage: 0x100 },
  unknown: { romWrite: 0x100, romRead: 0x100, ramPage: 0x100 },
};
