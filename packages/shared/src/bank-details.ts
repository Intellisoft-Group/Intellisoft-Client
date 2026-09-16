/** Labels and order for Clear invoice / bank transfer surfaces. */
export const BANK_DETAIL_LABELS = {
  companyName: 'Company Name',
  bank: 'Bank',
  accountNumber: 'Account Number',
  ifscCode: 'IFSC Code',
  branch: 'Branch',
} as const;

export type SettlementInput = {
  companyName?: string | null;
  legalName?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankIfsc?: string | null;
  bankBranch?: string | null;
};

export function settlementCompanyName(s: SettlementInput): string {
  const name = (s.legalName || s.companyName || '').trim();
  return name || '—';
}

export function buildBankDetailRows(s: SettlementInput): { label: string; value: string }[] {
  return [
    { label: BANK_DETAIL_LABELS.companyName, value: settlementCompanyName(s) },
    { label: BANK_DETAIL_LABELS.bank, value: (s.bankName || '').trim() || '—' },
    { label: BANK_DETAIL_LABELS.accountNumber, value: (s.bankAccount || '').trim() || '—' },
    { label: BANK_DETAIL_LABELS.ifscCode, value: (s.bankIfsc || '').trim() || '—' },
    { label: BANK_DETAIL_LABELS.branch, value: (s.bankBranch || '').trim() || '—' },
  ];
}
