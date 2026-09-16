export const BANK_DETAIL_LABELS = {
  companyName: 'Company Name',
  bank: 'Bank',
  accountNumber: 'Account Number',
  ifscCode: 'IFSC Code',
  branch: 'Branch',
} as const;

type Settlement = {
  companyName?: string | null;
  legalName?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankIfsc?: string | null;
  bankBranch?: string | null;
};

function companyName(s: Settlement): string {
  const name = (s.legalName || s.companyName || '').trim();
  return name || '—';
}

export function buildBankDetailRows(s: Settlement): { label: string; value: string }[] {
  return [
    { label: BANK_DETAIL_LABELS.companyName, value: companyName(s) },
    { label: BANK_DETAIL_LABELS.bank, value: (s.bankName || '').trim() || '—' },
    { label: BANK_DETAIL_LABELS.accountNumber, value: (s.bankAccount || '').trim() || '—' },
    { label: BANK_DETAIL_LABELS.ifscCode, value: (s.bankIfsc || '').trim() || '—' },
    { label: BANK_DETAIL_LABELS.branch, value: (s.bankBranch || '').trim() || '—' },
  ];
}

export function hasBankDetails(s: Settlement): boolean {
  return !!(s.bankName || s.bankAccount || s.bankIfsc || s.bankBranch);
}
