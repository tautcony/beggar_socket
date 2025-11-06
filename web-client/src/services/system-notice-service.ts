import { DateTime } from 'luxon';

export interface SystemNoticeMeta {
  id: string;
  title: string;
  publishedAt: string;
  contentPath: string;
}

export interface SystemNoticeRecord {
  acknowledgedAt: string;
  lastViewedAt?: string;
}

const CONFIG_PATH = 'system-notifications.json';
const STORAGE_PREFIX = 'system-notice:';

function getStorageKey(id: string): string {
  return `${STORAGE_PREFIX}${id}`;
}

export function resolvePublicUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  const baseUrl = new URL(base, window.location.href);
  return new URL(path, baseUrl).toString();
}

export async function fetchSystemNoticeConfig(): Promise<SystemNoticeMeta[]> {
  try {
    const response = await fetch(resolvePublicUrl(CONFIG_PATH), { cache: 'no-store' });
    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as { notifications?: SystemNoticeMeta[] };
    const notifications = Array.isArray(data.notifications) ? [...data.notifications] : [];

    notifications.sort((a, b) => {
      const timeA = DateTime.fromISO(a.publishedAt).toMillis();
      const timeB = DateTime.fromISO(b.publishedAt).toMillis();
      return timeB - timeA;
    });

    return notifications;
  } catch (error) {
    console.warn('[SystemNotice] Failed to fetch configuration', error);
    return [];
  }
}

export async function fetchSystemNoticeMarkdown(contentPath: string): Promise<string | null> {
  try {
    const response = await fetch(resolvePublicUrl(contentPath), { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }
    return await response.text();
  } catch (error) {
    console.warn('[SystemNotice] Failed to fetch content', contentPath, error);
    return null;
  }
}

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage might be unavailable (e.g. privacy mode). Ignore silently.
  }
}

function parseRecord(raw: string | null): SystemNoticeRecord | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as SystemNoticeRecord | string;
    if (typeof parsed === 'string') {
      return { acknowledgedAt: parsed, lastViewedAt: parsed };
    }
    if (parsed && typeof parsed === 'object' && typeof parsed.acknowledgedAt === 'string') {
      return parsed;
    }
  } catch {
    // fall through
  }

  if (typeof raw === 'string') {
    return { acknowledgedAt: raw, lastViewedAt: raw };
  }

  return null;
}

export function readNoticeRecord(id: string): SystemNoticeRecord | null {
  return parseRecord(safeGetItem(getStorageKey(id)));
}

export function hasNoticeBeenAcknowledged(id: string): boolean {
  return readNoticeRecord(id) !== null;
}

export function writeNoticeRecord(id: string, record: SystemNoticeRecord): void {
  safeSetItem(getStorageKey(id), JSON.stringify(record));
}

export function markNoticeAcknowledged(id: string, timestamp = new Date().toISOString()): SystemNoticeRecord {
  const record: SystemNoticeRecord = {
    acknowledgedAt: timestamp,
    lastViewedAt: timestamp,
  };
  writeNoticeRecord(id, record);
  return record;
}

export function updateNoticeLastViewed(id: string, timestamp = new Date().toISOString()): SystemNoticeRecord | null {
  const existing = readNoticeRecord(id);
  if (!existing) {
    return null;
  }

  const updated: SystemNoticeRecord = {
    acknowledgedAt: existing.acknowledgedAt,
    lastViewedAt: timestamp,
  };
  writeNoticeRecord(id, updated);
  return updated;
}
