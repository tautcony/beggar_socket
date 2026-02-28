export function resolveAutoScrollEnabled(
  currentEnabled: boolean,
  logCount: number,
  hasUserOverride: boolean,
  threshold = 50,
): boolean {
  if (hasUserOverride) {
    return currentEnabled;
  }

  return logCount <= threshold;
}
