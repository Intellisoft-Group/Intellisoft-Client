'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, money, openAuthenticatedFile } from '@/lib/api';
import { day, stamp, statusLabel } from '@/lib/format';

export default function BillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [inv, setInv] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api(`/invoices/${id}`)
      .then(setInv)
      .catch((e) => setError(e.message || 'Failed to load'));
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!inv) return <p className="page-loading">Loading invoice…</p>;

  const unpaid = ['SENT', 'PARTIAL', 'OVERDUE'].includes(inv.status);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{inv.number}</h1>
          <p>{inv.type === 'PROFORMA' ? 'Quote' : 'Invoice'} · {inv.organization?.name || 'Your organisation'}</p>
        </div>
        <div className="row">
          {inv.hasPdf && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => openAuthenticatedFile(`/invoices/${inv.id}/pdf`, `${inv.number}.pdf`)}
            >
              Download PDF
            </button>
          )}
          {unpaid && (
            <Link className="btn" href={`/bills/${inv.id}/pay`}>Pay by bank transfer</Link>
          )}
          <Link className="btn ghost" href="/bills">Back</Link>
        </div>
      </div>

      <div className="grid-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat">
          <label>Status</label>
          <strong><span className={`badge ${inv.status}`}>{statusLabel(inv.status)}</span></strong>
        </div>
        <div className="stat">
          <label>Total</label>
          <strong>{money(inv.total, inv.currency)}</strong>
        </div>
        <div className="stat">
          <label>Amount due</label>
          <strong>{money(inv.amountDue, inv.currency)}</strong>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
          Issued {day(inv.issueDate)} · Due {day(inv.dueDate)}
        </p>
        <table style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Tax %</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {(inv.lines || []).map((l: any) => (
              <tr key={l.id}>
                <td>{l.description}</td>
                <td>{l.quantity}</td>
                <td>{money(l.unitPrice, inv.currency)}</td>
                <td>{l.taxPercent}</td>
                <td>{money(l.amount, inv.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 16, textAlign: 'right', fontSize: 14 }}>
          <div>Subtotal {money(inv.subtotal, inv.currency)}</div>
          {(inv.cgst > 0 || inv.sgst > 0) && (
            <div>CGST {money(inv.cgst, inv.currency)} · SGST {money(inv.sgst, inv.currency)}</div>
          )}
          {inv.igst > 0 && <div>IGST {money(inv.igst, inv.currency)}</div>}
          <div style={{ fontWeight: 700, marginTop: 6 }}>Total {money(inv.total, inv.currency)}</div>
        </div>
      </div>

      {!!inv.payments?.length && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Payments</h3>
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Gateway</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.payments.map((p: any) => (
                <tr key={p.id}>
                  <td>{stamp(p.paidAt || p.createdAt)}</td>
                  <td>{p.gateway}</td>
                  <td><span className={`badge ${p.status}`}>{p.status}</span></td>
                  <td>{money(p.amount, inv.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
