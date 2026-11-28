/**
 * Returns a safe in-app path for ?next=, or the fallback.
 * Blocks open redirects: only same-origin absolute paths ("/x"), never "//host" or "/\\host".
 */
export function safeNextPath(next: string | null | undefined, fallback = '/'): string {
  if (!next) return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  if (/^\/(login|register|forgot-password|check-email)\b/.test(next)) return fallback;
  return next;
}

/** Absolute URL on the current origin, for links in Auth emails. */
export function appUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}
