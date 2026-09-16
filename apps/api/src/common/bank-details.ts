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

/** Account holder name shown on bank transfer instructions. */
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

export function settlementPayload(s: SettlementInput) {
  const holder = settlementCompanyName(s);
  return {
    companyName: holder === '—' ? (s.companyName || 'Intellisoft') : holder,
    legalName: s.legalName || '',
    bankName: s.bankName || '',
    bankAccount: s.bankAccount || '',
    bankIfsc: s.bankIfsc || '',
    bankBranch: s.bankBranch || '',
  };
}

export function hasBankDetails(s: SettlementInput): boolean {
  return buildBankDetailRows(s).some(
    (row) => row.label !== BANK_DETAIL_LABELS.companyName && row.value !== '—',
  );
}
