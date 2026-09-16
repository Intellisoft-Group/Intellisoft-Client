'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, money } from '@/lib/api';
import { day, statusLabel } from '@/lib/format';

const FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'UNPAID', label: 'Unpaid' },
  { id: 'OVERDUE', label: 'Overdue' },
  { id: 'PAID', label: 'Paid' },
] as const;

export default function BillsPage() {
  const [status, setStatus] = useState<string>('ALL');
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = status === 'ALL' ? '' : `?status=${status}`;
    api(`/invoices${q}`)
      .then(setRows)
      .catch((e) => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Bills</h1>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`btn ${status === f.id ? '' : 'ghost'} sm`}
            onClick={() => setStatus(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="page-loading">Loading bills…</p>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Type</th>
                <th>Status</th>
                <th>Due</th>
                <th>Total</th>
                <th>Due amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => (
                <tr key={inv.id} className="clickable">
                  <td>
                    <Link href={`/bills/${inv.id}`} style={{ color: 'var(--teal)', fontWeight: 600 }}>
                      {inv.number}
                    </Link>
                  </td>
                  <td>{inv.type === 'PROFORMA' ? 'Quote' : 'Invoice'}</td>
                  <td><span className={`badge ${inv.status}`}>{statusLabel(inv.status)}</span></td>
                  <td>{day(inv.dueDate)}</td>
                  <td>{money(inv.total, inv.currency)}</td>
                  <td>{money(inv.amountDue, inv.currency)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={6} style={{ color: 'var(--muted)' }}>No bills in this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
