export function isSafeRedirect(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}
