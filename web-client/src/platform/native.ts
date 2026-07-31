import { invoke } from '@tauri-apps/api/core';

import { isTauriRuntime, isWebRuntime } from '@/platform/runtime';
import type { SerialPortInfo } from '@/types/serial';

export interface NativeRuntimeMetadata {
  appName: string;
  appVersion: string;
  identifier: string;
  tauriVersion: string;
  os: string;
  arch: string;
}

export interface NativeSerialSessionInfo {
  sessionId: number;
}

interface NativeSerialPortInfo {
  path: string;
  manufacturer?: string | null;
  product?: string | null;
  serialNumber?: string | null;
  vendorId?: string | null;
  productId?: string | null;
}

export async function saveBinaryFile(data: Uint8Array, filename: string): Promise<{ saved: boolean; path?: string }> {
  if (!isTauriRuntime()) {
    return saveBinaryFileInBrowser(data, filename);
  }

  const savedPath = await invoke<string | null>('save_binary_file', {
    suggestedFilename: filename,
    bytes: Array.from(data),
  });

  return {
    saved: Boolean(savedPath),
    path: savedPath ?? undefined,
  };
}

export async function getNativeRuntimeMetadata(): Promise<NativeRuntimeMetadata> {
  if (!isTauriRuntime()) {
    return {
      appName: 'ChisFlash Burner',
      appVersion: typeof import.meta.env.VITE_APP_VERSION === 'string'
        ? import.meta.env.VITE_APP_VERSION
        : 'Web Version',
      identifier: 'web',
      tauriVersion: 'web',
      os: 'web',
      arch: 'browser',
    };
  }

  return invoke<NativeRuntimeMetadata>('native_runtime_metadata');
}

export async function getPlatformDescription(): Promise<string> {
  const metadata = await getNativeRuntimeMetadata();
  if (isWebRuntime()) {
    return 'Web';
  }

  return `${metadata.appName} on ${metadata.os}/${metadata.arch} (${metadata.identifier})`;
}

export async function getRuntimeAppVersion(): Promise<string> {
  const metadata = await getNativeRuntimeMetadata();

  return isTauriRuntime()
    ? `${metadata.appVersion} (Tauri ${metadata.tauriVersion})`
    : metadata.appVersion;
}

export async function listNativeSerialPorts(): Promise<SerialPortInfo[]> {
  const ports = await invoke<NativeSerialPortInfo[]>('native_list_serial_ports');
  return ports.map(toSerialPortInfo);
}

export function openNativeSerialPort(path: string): Promise<NativeSerialSessionInfo> {
  return invoke<NativeSerialSessionInfo>('native_open_serial_port', { path });
}

export function writeNativeSerial(sessionId: number, bytes: Uint8Array, timeoutMs?: number): Promise<void> {
  return invoke('native_serial_write', {
    sessionId,
    bytes: Array.from(bytes),
    timeoutMs,
  });
}

export async function readNativeSerial(sessionId: number, length: number, timeoutMs?: number): Promise<Uint8Array> {
  const data = await invoke<number[]>('native_serial_read', {
    sessionId,
    length,
    timeoutMs,
  });
  return new Uint8Array(data);
}

export function setNativeSerialSignals(sessionId: number, signals: SerialOutputSignals): Promise<void> {
  return invoke('native_serial_set_signals', {
    sessionId,
    dataTerminalReady: signals.dataTerminalReady,
    requestToSend: signals.requestToSend,
  });
}

export function flushNativeSerialInput(sessionId: number): Promise<void> {
  return invoke('native_serial_flush_input', { sessionId });
}

export function closeNativeSerial(sessionId: number): Promise<void> {
  return invoke('native_serial_close', { sessionId });
}

function saveBinaryFileInBrowser(data: Uint8Array, filename: string): Promise<{ saved: boolean; path?: string }> {
  let url: string | null = null;
  let anchor: HTMLAnchorElement | null = null;

  try {
    const blob = new Blob([data as BlobPart], { type: 'application/octet-stream' });
    url = URL.createObjectURL(blob);
    anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    if (anchor?.parentNode) {
      anchor.parentNode.removeChild(anchor);
    }
    if (url) {
      URL.revokeObjectURL(url);
    }
  }

  return Promise.resolve({ saved: true });
}

function toSerialPortInfo(port: NativeSerialPortInfo): SerialPortInfo {
  return {
    path: port.path,
    manufacturer: port.manufacturer ?? undefined,
    product: port.product ?? undefined,
    serialNumber: port.serialNumber ?? undefined,
    vendorId: normalizeUsbId(port.vendorId ?? undefined),
    productId: normalizeUsbId(port.productId ?? undefined),
  };
}

function normalizeUsbId(value: string | undefined): string | undefined {
  if (!value || value === 'Unknown') {
    return undefined;
  }

  const radix = /^0x/i.test(value) || /^[0-9a-f]{4}$/i.test(value) ? 16 : 10;
  const numericValue = Number.parseInt(value, radix);
  return Number.isNaN(numericValue) ? value.toLowerCase() : numericValue.toString(16).padStart(4, '0');
}
