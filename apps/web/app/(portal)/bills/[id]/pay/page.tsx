'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, money } from '@/lib/api';
import { buildBankDetailRows, hasBankDetails } from '@/lib/bank-details';

export default function PayPage() {
  const { id } = useParams<{ id: string }>();
  const [inv, setInv] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        let invoice = await api(`/invoices/${id}`);
        if (!invoice.payUrl && ['SENT', 'PARTIAL', 'OVERDUE'].includes(invoice.status)) {
          invoice = await api(`/invoices/${id}`);
        }
        setInv(invoice);
      } catch (e: any) {
        setError(e.message || 'Failed to load');
      }
    })();
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!inv) return <p className="page-loading">Loading payment instructions…</p>;

  const settlement = inv.settlement || {};
  const bankRows = buildBankDetailRows(settlement);
  const bankReady = hasBankDetails(settlement);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Clear invoice {inv.number}</h1>
        </div>
        <Link className="btn ghost" href={`/bills/${inv.id}`}>Back to bill</Link>
      </div>

      <div className="card stack" style={{ maxWidth: 640, marginBottom: 16 }}>
        <div>
          <div style={{ color: 'var(--muted)', fontSize: 12, textTransform: 'uppercase' }}>Amount due</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{money(inv.amountDue, inv.currency)}</div>
        </div>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14, lineHeight: 1.5 }}>
          Transfer the amount by bank transfer using the account details below. Use the invoice number as your payment reference.
        </p>
      </div>

      <div className="card" style={{ maxWidth: 640, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Bank account details</h3>
        {!bankReady ? (
          <p className="muted">Bank account details are not configured yet. Contact your account manager.</p>
        ) : (
          <table>
            <tbody>
              {bankRows.map((row) => (
                <tr key={row.label}>
                  <th style={{ textAlign: 'left', color: 'var(--muted)', fontWeight: 600, width: '38%', padding: '10px 12px 10px 0' }}>
                    {row.label}
                  </th>
                  <td style={{ padding: '10px 0', fontWeight: 600 }}>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card stack" style={{ maxWidth: 640 }}>
        <div>
          <div style={{ color: 'var(--muted)', fontSize: 12, textTransform: 'uppercase' }}>Payment reference</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{inv.number}</div>
        </div>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14, lineHeight: 1.5 }}>
          Include this invoice number in the transfer reference. Share the UTR with Intellisoft after payment.
        </p>
        {inv.payUrl ? (
          <a className="btn ghost" href={inv.payUrl} target="_blank" rel="noopener noreferrer">
            Open printable transfer page
          </a>
        ) : null}
      </div>
    </>
  );
}
