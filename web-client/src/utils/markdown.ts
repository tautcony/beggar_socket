import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
});

const DOWNLOADABLE_EXTENSIONS = new Set([
  '.gba',
  '.gb',
  '.gbc',
  '.bin',
  '.rom',
  '.zip',
  '.7z',
  '.rar',
  '.tar',
  '.tar.gz',
]);

function shouldForceDownload(anchor: HTMLAnchorElement): boolean {
  const href = anchor.getAttribute('href');
  if (!href) {
    return false;
  }

  try {
    const url = new URL(href, window.location.href);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    // Force download only for same-origin files to avoid mixed content warnings.
    if (url.origin !== window.location.origin) {
      return false;
    }

    const pathname = url.pathname.toLowerCase();
    for (const ext of DOWNLOADABLE_EXTENSIONS) {
      if (pathname.endsWith(ext)) {
        return true;
      }
    }
  } catch {
    // ignore invalid URLs
  }

  return false;
}

function enhanceLinks(html: string): string {
  if (typeof window === 'undefined') {
    return html;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const anchors = doc.querySelectorAll('a');

  anchors.forEach((anchor) => {
    if (!anchor.hasAttribute('target')) {
      anchor.setAttribute('target', '_blank');
    }

    const relValues = new Set((anchor.getAttribute('rel') ?? '').split(/\s+/).filter(Boolean));
    relValues.add('noopener');
    relValues.add('noreferrer');
    anchor.setAttribute('rel', Array.from(relValues).join(' '));

    if (shouldForceDownload(anchor)) {
      anchor.setAttribute('download', '');
    }
  });

  return doc.body.innerHTML;
}

export function renderMarkdown(markdown: string): string {
  if (!markdown) {
    return '';
  }

  try {
    const rawHtml = marked.parse(markdown) as string;
    const sanitized = DOMPurify.sanitize(rawHtml, {
      ADD_ATTR: ['target', 'rel'],
    });
    return enhanceLinks(sanitized);
  } catch (error) {
    console.warn('[Markdown] Failed to render content', error);
    return markdown;
  }
}
