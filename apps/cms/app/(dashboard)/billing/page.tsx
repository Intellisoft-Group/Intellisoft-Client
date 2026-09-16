'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, money } from '@/lib/api';

const TYPE_LABEL: Record<string, string> = {
  TAX: 'Invoice',
  PROFORMA: 'Quote',
  CREDIT_NOTE: 'Credit note',
};

export default function BillingPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState('ALL');
  const router = useRouter();
  const params = useSearchParams();
  const type = params.get('type') || 'ALL';

  useEffect(() => {
    const q = new URLSearchParams({ status });
    if (type !== 'ALL') q.set('type', type);
    api(`/invoices?${q}`).then(setRows);
  }, [status, type]);

  function setType(next: string) {
    const q = next === 'ALL' ? '' : `?type=${next}`;
    router.replace(`/billing${q}`);
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{type === 'PROFORMA' ? 'Quotes' : 'Invoices'}</h1>
        </div>
        <Link className="btn" href={`/billing/new${type === 'PROFORMA' ? '?type=PROFORMA' : ''}`}>
          {type === 'PROFORMA' ? 'New quote' : 'Create invoice'}
        </Link>
      </div>
      <div className="row" style={{ marginBottom: 8 }}>
        {['ALL', 'PROFORMA', 'TAX', 'CREDIT_NOTE'].map((t) => (
          <button key={t} className={`btn sm ${type === t ? '' : 'ghost'}`} type="button" onClick={() => setType(t)}>
            {t === 'ALL' ? 'All types' : TYPE_LABEL[t] || t}
          </button>
        ))}
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        {['ALL', 'UNPAID', 'PAID', 'OVERDUE', 'DRAFT'].map((s) => (
          <button key={s} className={`btn sm ${status === s ? '' : 'ghost'}`} onClick={() => setStatus(s)}>{s}</button>
        ))}
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Number</th><th>Type</th><th>Client</th><th>Status</th><th>Total</th><th>Due</th><th>Due date</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="clickable" onClick={() => router.push(`/billing/${r.id}`)}>
                <td>{r.number}</td>
                <td>{TYPE_LABEL[r.type] || r.type}</td>
                <td>{r.organization?.name}</td>
                <td><span className={`badge ${r.status}`}>{r.status}</span></td>
                <td>{money(r.total, r.currency)}</td>
                <td>{money(r.amountDue, r.currency)}</td>
                <td>{String(r.dueDate).slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
