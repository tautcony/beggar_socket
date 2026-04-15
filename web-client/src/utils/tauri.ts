import { getIdentifier, getName, getTauriVersion, getVersion } from '@tauri-apps/api/app';

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function getPlatform(): Promise<string> {
  if (!isTauri()) {
    return 'Web';
  }

  const runtimeVersion = navigator.userAgent;
  const runtimePlatform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
    ?? runtimeVersion
    ?? 'Unknown';
  const [appName, identifier] = await Promise.all([
    getName().catch(() => 'ChisFlash Burner'),
    getIdentifier().catch(() => 'unknown'),
  ]);

  return `${appName} on ${runtimePlatform} (${identifier})`;
}

export async function getAppVersion(): Promise<string> {
  const fallbackVersion = typeof import.meta.env.VITE_APP_VERSION === 'string'
    ? import.meta.env.VITE_APP_VERSION
    : 'Web Version';

  if (!isTauri()) {
    return fallbackVersion;
  }

  const [appVersion, tauriVersion] = await Promise.all([
    getVersion().catch(() => fallbackVersion),
    getTauriVersion().catch(() => 'unknown'),
  ]);

  return `${appVersion} (Tauri ${tauriVersion})`;
}
