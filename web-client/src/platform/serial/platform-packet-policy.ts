import type { FirmwareProfileId } from '@/types/firmware-profile';

export type HostPlatform = 'windows' | 'macos' | 'linux' | 'unknown';

export interface PlatformPacketLimits {
  readonly romWrite: number;
  readonly romRead: number;
  readonly ramPage: number;
}

/**
 * 结合固件类型（STM32 / STC8）与宿主操作系统 USB CDC / tty 驱动特性的最佳包长度表：
 * - STM32 (`stm` / `unknown`):
 *   - Windows (`usbser.sys`): 支持较大内核收发缓冲，使用固件上限 4096B。
 *   - macOS (`AppleUSBCDCACMData`) / Linux (`cdc_acm` / `n_tty`): 内核 tty 缓冲约 4KB，
 *     收敛至 3072B（0x0c00，含协议头尾 3074B/3083B）留出 ~1KB 余量。
 * - STC8 (`stc`):
 *   - Windows (`usbser.sys`): 写入支持流式消费 + USB OUT NAK 流控，保持 4096B；
 *   - macOS (`AppleUSBCDCACMData`): 内核 tty 缓冲约 4KB，4096B 写入包加协议头尾会跨越 4KB 边界并叠加
 *     NAK 反压导致超时锁死，收敛至 3072B（0x0c00，含协议头尾 3074B/3083B）留出 ~1KB 余量；
 *   - 读取以 62B/包流式回传（受限于单缓冲 ~500 KiB/s 硬件上限），无需过大包长：
 *     Windows 下设为 8KB（0x2000）减少命令往返即可，macOS / Linux 下设为 4KB（0x1000）兼顾稳定与取消响应。
 */
const STM_PACKET_LIMITS: Readonly<Record<HostPlatform, PlatformPacketLimits>> = {
  windows: { romWrite: 0x1000, romRead: 0x1000, ramPage: 0x1000 },
  macos: { romWrite: 0x0c00, romRead: 0x0c00, ramPage: 0x0c00 },
  linux: { romWrite: 0x0c00, romRead: 0x0c00, ramPage: 0x0c00 },
  unknown: { romWrite: 0x1000, romRead: 0x1000, ramPage: 0x1000 },
};

const STC_PACKET_LIMITS: Readonly<Record<HostPlatform, PlatformPacketLimits>> = {
  windows: { romWrite: 0x1000, romRead: 0x2000, ramPage: 0x1000 },
  macos: { romWrite: 0x0c00, romRead: 0x1000, ramPage: 0x0c00 },
  linux: { romWrite: 0x0c00, romRead: 0x1000, ramPage: 0x0c00 },
  unknown: { romWrite: 0x1000, romRead: 0x2000, ramPage: 0x1000 },
};

export const PLATFORM_PACKET_LIMITS: Readonly<Record<FirmwareProfileId, Readonly<Record<HostPlatform, PlatformPacketLimits>>>> = {
  stm: STM_PACKET_LIMITS,
  stc: STC_PACKET_LIMITS,
  unknown: STM_PACKET_LIMITS,
};

export function detectHostPlatform(): HostPlatform {
  if (typeof navigator === 'undefined') {
    return 'unknown';
  }

  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const userAgent = nav.userAgent ?? '';
  const explicitPlatform = nav.userAgentData?.platform ?? nav.platform ?? '';
  const hint = /jsdom/i.test(userAgent)
    ? explicitPlatform
    : `${explicitPlatform} ${userAgent}`;

  if (/win/i.test(hint)) {
    return 'windows';
  }
  if (/mac|darwin/i.test(hint)) {
    return 'macos';
  }
  if (/linux|x11/i.test(hint)) {
    return 'linux';
  }
  return 'unknown';
}

export function getOptimalPacketLimits(
  firmwareId: FirmwareProfileId = 'unknown',
  platform: HostPlatform = detectHostPlatform(),
): PlatformPacketLimits {
  return PLATFORM_PACKET_LIMITS[firmwareId][platform];
}
