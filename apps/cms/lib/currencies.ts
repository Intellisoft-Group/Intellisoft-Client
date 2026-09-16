/** Currencies available when creating invoices / project schedules. */
export const CURRENCIES = [
  { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', label: 'UAE Dirham' },
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar' },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]['code'];

export function currencySymbol(code?: string | null) {
  const hit = CURRENCIES.find((c) => c.code === code);
  return hit?.symbol || code || '₹';
}

export function currencyOptionLabel(c: (typeof CURRENCIES)[number]) {
  return `${c.symbol} ${c.code} — ${c.label}`;
}
