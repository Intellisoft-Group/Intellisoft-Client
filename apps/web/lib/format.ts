export function stamp(value?: string | null, empty = '—') {
  if (!value) return empty;
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export function day(value?: string | null, empty = '—') {
  if (!value) return empty;
  const s = String(value).trim();
  // Date-only — avoid UTC midnight shifting the calendar day.
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', { dateStyle: 'medium' });
  }
  return new Date(value).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

/** Local device/browser clock — never use a server-provided greeting. */
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

/** Client-facing status labels (invoices, project stages). */
export function statusLabel(value?: string | null) {
  if (!value) return '';
  const v = String(value).toUpperCase();
  const map: Record<string, string> = {
    SENT: 'Pending',
    PARTIAL: 'Partially paid',
    OVERDUE: 'Overdue',
    PAID: 'Paid',
    DRAFT: 'Draft',
    VOID: 'Void',
    INVOICED: 'Awaiting payment',
    PLANNED: 'Upcoming',
    UNPAID: 'Unpaid',
    ALL: 'All',
  };
  if (map[v]) return map[v];
  return v
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
