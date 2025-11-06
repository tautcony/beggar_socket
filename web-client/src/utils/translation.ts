const GOOGLE_TRANSLATE_BASE_URL = 'https://translate.google.com/';
const GOOGLE_TRANSLATE_API = 'https://translate.googleapis.com/translate_a/single';

const localeMap: Record<string, string> = {
  'zh-Hans': 'zh-CN',
  'zh-Hant': 'zh-TW',
};

function resolveTargetLocale(locale: string): string {
  if (!locale) {
    return 'en';
  }

  const normalized = localeMap[locale];
  if (normalized) {
    return normalized;
  }

  const [language] = locale.split('-');
  return language || 'en';
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

interface GoogleTranslateResponseSegment extends Array<string | null> {
  0: string;
  1: string | null;
}

type GoogleTranslateResponse = [
  GoogleTranslateResponseSegment[],
  string,
  string,
];

export async function translateText(text: string, targetLocale: string): Promise<string> {
  const normalized = normalizeText(text);
  if (!normalized) {
    return '';
  }

  const truncated = normalized.length > 4500 ? `${normalized.slice(0, 4500)}…` : normalized;
  const target = resolveTargetLocale(targetLocale);
  const url = `${GOOGLE_TRANSLATE_API}?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(truncated)}`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Translate request failed with status ${response.status}`);
  }

  const data = (await response.json()) as GoogleTranslateResponse | null;
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error('Unexpected translate response');
  }

  const segments = data[0]
    .map((segment) => (Array.isArray(segment) && typeof segment[0] === 'string') ? segment[0] : '')
    .filter((segment) => segment.length > 0);

  return segments.join('');
}

export function openGoogleTranslate(text: string, targetLocale: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const normalized = normalizeText(text);
  if (!normalized) {
    return;
  }

  const truncated = normalized.length > 1500 ? `${normalized.slice(0, 1500)}…` : normalized;
  const target = resolveTargetLocale(targetLocale);
  const url = `${GOOGLE_TRANSLATE_BASE_URL}?sl=auto&tl=${encodeURIComponent(target)}&text=${encodeURIComponent(truncated)}&op=translate`;

  window.open(url, '_blank', 'noopener');
}
