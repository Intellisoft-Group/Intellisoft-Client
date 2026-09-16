export type GstSplit = {
  cgst: number;
  sgst: number;
  igst: number;
  taxTotal: number;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Intra-state (same place of supply) uses CGST+SGST; otherwise IGST. */
export function splitGst(
  taxableAmount: number,
  taxPercent: number,
  supplierState: string,
  placeOfSupply: string,
): GstSplit {
  const taxTotal = round2((taxableAmount * taxPercent) / 100);
  const sameState =
    normalizeState(supplierState) === normalizeState(placeOfSupply);

  if (sameState) {
    const half = round2(taxTotal / 2);
    return { cgst: half, sgst: round2(taxTotal - half), igst: 0, taxTotal };
  }

  return { cgst: 0, sgst: 0, igst: taxTotal, taxTotal };
}

export function normalizeState(value: string): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function formatMoney(amount: number, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function invoiceStatusFromAmounts(
  amountDue: number,
  amountPaid: number,
  dueDate: Date | string,
  now = new Date(),
): 'PAID' | 'PARTIAL' | 'OVERDUE' | 'SENT' {
  if (amountDue <= 0.009) return 'PAID';
  if (amountPaid > 0) return 'PARTIAL';
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  if (due.getTime() < now.getTime()) return 'OVERDUE';
  return 'SENT';
}
