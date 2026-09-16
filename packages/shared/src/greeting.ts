/**
 * Time-of-day greeting from the caller's local clock (browser / device).
 * Do not compute this on the server — VPS timezone will be wrong for users.
 */
export function greeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning,';
  if (h < 17) return 'Good afternoon,';
  return 'Good evening,';
}

/** Prefer full display name; never fall back to company brand. */
export function displayPersonName(
  name?: string | null,
  fallback = '',
): string {
  const n = String(name || '').trim();
  return n || fallback;
}
