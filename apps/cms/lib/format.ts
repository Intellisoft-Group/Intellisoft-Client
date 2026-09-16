/** Locale-aware date/time for CMS tables and chat. */
export function stamp(value?: string | null, empty = '') {
  if (!value) return empty;
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Local staff browser clock — never use a server-provided greeting. */
export function greeting(date: Date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning,';
  if (h < 17) return 'Good afternoon,';
  return 'Good evening,';
}

export function displayPersonName(name?: string | null, fallback = '') {
  const n = String(name || '').trim();
  return n || fallback;
}
