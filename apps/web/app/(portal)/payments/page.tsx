'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, money } from '@/lib/api';
import { stamp } from '@/lib/format';

export default function PaymentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/payments')
      .then(setRows)
      .catch((e) => setError(e.message || 'Failed to load'));
  }, []);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Payments</h1>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Invoice</th>
              <th>Method</th>
              <th>Status</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{stamp(p.paidAt || p.createdAt)}</td>
                <td>
                  {p.invoice?.id ? (
                    <Link href={`/bills/${p.invoice.id}`} style={{ color: 'var(--teal)' }}>
                      {p.invoice.number}
                    </Link>
                  ) : '—'}
                </td>
                <td>{p.gateway}</td>
                <td><span className={`badge ${p.status}`}>{p.status}</span></td>
                <td>{money(p.amount, p.currency)}</td>
              </tr>
            ))}
            {!rows.length && !error && (
              <tr><td colSpan={5} style={{ color: 'var(--muted)' }}>No payments recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
