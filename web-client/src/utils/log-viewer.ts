export function resolveAutoScrollEnabled(
  currentEnabled: boolean,
  _logCount: number,
  hasUserOverride: boolean,
  defaultEnabled = true,
): boolean {
  if (hasUserOverride) {
    return currentEnabled;
  }

  return defaultEnabled;
}
