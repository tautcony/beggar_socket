import { BEGGAR_STC_PACKET_LIMITS, BEGGAR_STM_PACKET_LIMITS, FLASHGBX_PACKET_LIMITS } from '@/device/definitions/packet-limits';
import type { FirmwareProfileId } from '@/types/firmware-profile';
import type { HostPlatform, PlatformPacketLimits } from '@/types/host-platform';

// Host platform shapes are owned by `types/` so device definitions can declare
// host-derived packet limits without importing platform implementations.
export type { HostPacketLimits, HostPlatform, PlatformPacketLimits } from '@/types/host-platform';

/**
 * 结合固件类型（STM32 / STC8）与宿主操作系统 USB CDC / tty 驱动特性的最佳包长度表。
 * 数值的权威来源是 `device/definitions/packet-limits.ts`；本表只做旧 profile id 到
 * 新固件定义的过渡映射，P4 清理旧 profile 后删除。
 */
export const PLATFORM_PACKET_LIMITS: Readonly<Record<FirmwareProfileId, Readonly<Record<HostPlatform, PlatformPacketLimits>>>> = {
  stm: BEGGAR_STM_PACKET_LIMITS,
  stc: BEGGAR_STC_PACKET_LIMITS,
  flashgbx: FLASHGBX_PACKET_LIMITS,
  unknown: BEGGAR_STM_PACKET_LIMITS,
};

/**
 * 历史注释（数值现已迁至 `device/definitions/packet-limits.ts`）：
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
