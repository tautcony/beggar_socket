const SAFE_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function parseUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function isSafeExternalUrl(url) {
  const parsed = parseUrl(url);
  if (!parsed) {
    return false;
  }
  return SAFE_EXTERNAL_PROTOCOLS.has(parsed.protocol);
}

function isAppNavigationUrl(url, isDev) {
  const parsed = parseUrl(url);
  if (!parsed) {
    return false;
  }

  if (parsed.protocol === 'file:') {
    return true;
  }

  if (isDev && parsed.origin === 'http://localhost:5173') {
    return true;
  }

  return false;
}

module.exports = {
  isSafeExternalUrl,
  isAppNavigationUrl,
};
