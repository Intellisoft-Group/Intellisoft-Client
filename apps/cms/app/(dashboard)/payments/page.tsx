'use client';

import { useEffect, useState } from 'react';
import { api, money } from '@/lib/api';

export default function PaymentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api('/payments').then(setRows); }, []);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Payments</h1>
        </div>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Date</th><th>Client</th><th>Invoice</th><th>Method</th><th>Status</th><th>Amount</th><th>Ref</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{String(r.paidAt || r.createdAt).slice(0, 10)}</td>
                <td>{r.organization?.name}</td>
                <td>{r.invoice?.number}</td>
                <td>{r.gateway}</td>
                <td><span className={`badge ${r.status}`}>{r.status}</span></td>
                <td>{money(r.amount, r.currency)}</td>
                <td>{r.gatewayPaymentId || r.utr || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
