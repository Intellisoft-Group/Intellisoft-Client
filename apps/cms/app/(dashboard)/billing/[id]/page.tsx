'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, getUser, money, openAuthenticatedFile } from '@/lib/api';
import { canSee, ROLE_GROUPS } from '@/lib/roles';

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [inv, setInv] = useState<any>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [offline, setOffline] = useState({ gateway: 'BANK', utr: '', notes: '', amount: 0 });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfErr, setPdfErr] = useState('');
  const [pdfMsg, setPdfMsg] = useState('');
  const role = getUser()?.role;
  const canFinance = canSee(role, ROLE_GROUPS.financeAdmin);

  function load() {
    setError('');
    api(`/invoices/${id}`)
      .then((row) => {
        setInv(row);
        setOffline((o) => ({ ...o, amount: row.amountDue }));
      })
      .catch((e) => setError(e.message || 'Failed to load invoice'));
  }
  useEffect(() => { load(); }, [id]);

  async function send() {
    try {
      const row = await api(`/invoices/${id}/send`, { method: 'POST', body: {} });
      setInv(row);
      if (row.payUrl) await copyLink(row.payUrl);
    } catch (e: any) {
      setError(e.message || 'Send failed');
    }
  }

  async function share() {
    try {
      const row = await api(`/invoices/${id}/share`, { method: 'POST', body: {} });
      setInv(row);
      if (row.payUrl) await copyLink(row.payUrl);
    } catch (e: any) {
      setError(e.message || 'Share failed');
    }
  }

  async function copyLink(url?: string) {
    const link = url || inv?.payUrl;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied('Pay link copied');
    } catch {
      setCopied(link);
    }
    setTimeout(() => setCopied(''), 2500);
  }

  function whatsapp() {
    if (!inv?.payUrl) return;
    const text = `Invoice ${inv.number} from Intellisoft for ${money(inv.amountDue > 0 ? inv.amountDue : inv.total, inv.currency)}.\nBank transfer details: ${inv.payUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  async function voidInv() {
    try {
      await api(`/invoices/${id}/void`, { method: 'POST', body: {} });
      load();
    } catch (e: any) {
      setError(e.message || 'Void failed');
    }
  }

  async function markPaid(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(`/payments/invoices/${id}/offline`, { method: 'POST', body: offline });
      setPdfMsg('Invoice marked Paid. Upload the invoice PDF so the client can download it.');
      load();
    } catch (err: any) {
      setError(err?.message || 'Could not mark paid');
    }
  }

  async function uploadPdf(e: React.FormEvent) {
    e.preventDefault();
    setPdfErr('');
    setPdfMsg('');
    if (!pdfFile) {
      setPdfErr('Choose a PDF file to upload');
      return;
    }
    setPdfBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', pdfFile);
      const row = await api(`/invoices/${id}/pdf`, { method: 'POST', form: fd });
      setInv(row);
      setPdfFile(null);
      setPdfMsg('Invoice PDF uploaded.');
    } catch (err: any) {
      setPdfErr(err?.message || 'Could not upload PDF');
    } finally {
      setPdfBusy(false);
    }
  }

  if (error && !inv) return <p className="error">{error}</p>;
  if (!inv) return <p>Loading…</p>;

  const shareable = inv.status !== 'VOID';
  const needsPdf = inv.status === 'PAID' && !inv.hasPdf;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{inv.number}</h1>
          <p>{inv.organization?.name} · <span className={`badge ${inv.status}`}>{inv.status}</span></p>
        </div>
        <div className="row">
          {canFinance && inv.status === 'DRAFT' && <button className="btn" onClick={send}>Send &amp; get pay link</button>}
          {canFinance && shareable && inv.status !== 'DRAFT' && <button className="btn" onClick={share}>Copy pay link</button>}
          {inv.payUrl && <button className="btn ghost" onClick={whatsapp}>WhatsApp</button>}
          {inv.hasPdf && (
            <button
              className="btn ghost"
              type="button"
              onClick={() =>
                openAuthenticatedFile(`/invoices/${inv.id}/pdf`, `${inv.number}.pdf`).catch((e) => setError(e.message))
              }
            >
              View PDF
            </button>
          )}
          {canFinance && inv.status !== 'VOID' && inv.amountPaid === 0 && <button className="btn danger" onClick={voidInv}>Void</button>}
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {shareable && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="ui">Settlement link</h3>
          <p style={{ color: 'var(--muted)', marginTop: 0 }}>
            Bank transfer instructions for this invoice. Record payment after funds are confirmed.
          </p>
          {inv.payUrl ? (
            <p style={{ wordBreak: 'break-all' }}><a href={inv.payUrl} target="_blank" rel="noreferrer">{inv.payUrl}</a></p>
          ) : (
            <p style={{ color: 'var(--muted)' }}>Issue the invoice to generate a settlement link.</p>
          )}
          {copied && <p style={{ color: 'var(--ok)' }}>{copied}</p>}
        </div>
      )}
      <div className="card" style={{ marginBottom: 16 }}>
        <table>
          <thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Amount</th></tr></thead>
          <tbody>
            {inv.lines?.map((l: any) => (
              <tr key={l.id}>
                <td>{l.description}</td>
                <td>{l.quantity}</td>
                <td>{money(l.unitPrice, inv.currency)}</td>
                <td>{money(l.amount, inv.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>Subtotal {money(inv.subtotal, inv.currency)}</p>
        {inv.cgst > 0 && <p>CGST {money(inv.cgst, inv.currency)}</p>}
        {inv.sgst > 0 && <p>SGST {money(inv.sgst, inv.currency)}</p>}
        {inv.igst > 0 && <p>IGST {money(inv.igst, inv.currency)}</p>}
        <h3>Total {money(inv.total, inv.currency)} · Due {money(inv.amountDue, inv.currency)}</h3>
      </div>
      {inv.payments?.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="ui">Payments</h3>
          <table>
            <thead><tr><th>Date</th><th>Method</th><th>Status</th><th>Amount</th><th>Ref</th></tr></thead>
            <tbody>
              {inv.payments.map((p: any) => (
                <tr key={p.id}>
                  <td>{String(p.paidAt || p.createdAt).slice(0, 10)}</td>
                  <td>{p.gateway}</td>
                  <td><span className={`badge ${p.status}`}>{p.status}</span></td>
                  <td>{money(p.amount, inv.currency)}</td>
                  <td>{p.utr || p.gatewayPaymentId || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canFinance && inv.amountDue > 0 && inv.status !== 'DRAFT' && inv.status !== 'VOID' && (
        <form className="card form-grid" onSubmit={markPaid}>
          <h3 className="ui span-2">Record payment</h3>
          <p className="span-2" style={{ color: 'var(--muted)', margin: 0 }}>
            Bank account details:{' '}
            <a href="/settings#bank-details" style={{ color: 'var(--teal)' }}>Settings → Bank account details</a>
            . Reference: <strong>{inv.number}</strong>.
          </p>
          <label className="field">Method
            <select value={offline.gateway} onChange={(e) => setOffline({ ...offline, gateway: e.target.value })}>
              <option value="BANK">BANK</option>
              <option value="CASH">CASH</option>
              <option value="CHEQUE">CHEQUE</option>
            </select>
          </label>
          <label className="field">Amount<input type="number" value={offline.amount} onChange={(e) => setOffline({ ...offline, amount: Number(e.target.value) })} /></label>
          <label className="field">UTR / cheque no.<input value={offline.utr} onChange={(e) => setOffline({ ...offline, utr: e.target.value })} placeholder="Bank UTR" /></label>
          <label className="field">Notes<input value={offline.notes} onChange={(e) => setOffline({ ...offline, notes: e.target.value })} placeholder={`Matched reference ${inv.number}`} /></label>
          <button className="btn" type="submit">Mark paid</button>
        </form>
      )}
      {canFinance && inv.status === 'PAID' && (
        <form className="card form-grid" style={{ marginTop: 16 }} onSubmit={uploadPdf}>
          <h3 className="ui span-2">Invoice PDF</h3>
          <p className="span-2" style={{ color: 'var(--muted)', margin: 0 }}>
            {needsPdf ? 'Upload the signed invoice PDF for client access.' : 'Replace the current invoice PDF.'}
          </p>
          <label className="field span-2">PDF file
            <input type="file" accept="application/pdf,.pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} />
          </label>
          {pdfErr && <p className="error span-2">{pdfErr}</p>}
          {pdfMsg && <p className="span-2" style={{ color: 'var(--ok)' }}>{pdfMsg}</p>}
          <button className="btn" type="submit" disabled={pdfBusy}>{pdfBusy ? 'Uploading…' : 'Upload PDF'}</button>
        </form>
      )}
    </>
  );
}
