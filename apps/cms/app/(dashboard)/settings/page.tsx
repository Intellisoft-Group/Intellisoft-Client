'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const [s, setS] = useState<any>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api('/settings');
      setS(data);
    } catch (e: any) {
      setS(null);
      setError(e.message || 'Could not load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const payload = {
        companyName: String(s.companyName ?? '').trim() || 'Intellisoft',
        legalName: String(s.legalName ?? '').trim() || 'Intellisoft',
        gstin: s.gstin ?? null,
        pan: s.pan ?? null,
        email: s.email ?? null,
        phone: s.phone ?? null,
        address: s.address ?? null,
        city: s.city ?? null,
        state: s.state ?? null,
        pincode: s.pincode ?? null,
        country: s.country ?? null,
        bankName: s.bankName ?? null,
        bankAccount: s.bankAccount ?? null,
        bankIfsc: s.bankIfsc ?? null,
        bankBranch: s.bankBranch ?? null,
        logoUrl: s.logoUrl ?? null,
        primaryColor: s.primaryColor ?? null,
        splashCopy: s.splashCopy ?? null,
        maintenanceMode: !!s.maintenanceMode,
        minAppVersion: s.minAppVersion ?? null,
        chargesTax: !!s.chargesTax,
        defaultTaxPercent: Number(s.defaultTaxPercent ?? 18),
      };
      const saved = await api('/settings', { method: 'PATCH', body: payload });
      setS(saved);
      setMsg('Settings saved.');
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading && !s) {
    return <p className="page-loading">Loading settings…</p>;
  }

  if (error && !s) {
    return (
      <>
        <div className="topbar">
          <div>
            <h1>Company settings</h1>
          </div>
        </div>
        <p className="error">{error}</p>
        <button className="btn" type="button" onClick={load}>
          Retry
        </button>
      </>
    );
  }

  if (!s) return null;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Company settings</h1>
          <p>Organisation identity, tax defaults, and bank account details for invoice settlement.</p>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {msg && <p style={{ color: 'var(--ok)', fontSize: 13 }}>{msg}</p>}
      <form className="stack" onSubmit={save} style={{ gap: 16, maxWidth: 920 }}>
        <div className="card form-grid" id="brand-names">
          <h3 className="ui span-2" style={{ marginTop: 0 }}>Organisation names</h3>
          <label className="field span-2">
            Brand name
            <input
              type="text"
              name="companyName"
              autoComplete="organization"
              value={s.companyName ?? ''}
              onChange={(e) => setS({ ...s, companyName: e.target.value })}
            />
          </label>
        </div>

        <div className="card form-grid">
          <h3 className="ui span-2" style={{ marginTop: 0 }}>Registered contact</h3>
          <label className="field">GSTIN<input type="text" value={s.gstin || ''} onChange={(e) => setS({ ...s, gstin: e.target.value })} /></label>
          <label className="field">PAN<input type="text" value={s.pan || ''} onChange={(e) => setS({ ...s, pan: e.target.value })} /></label>
          <label className="field">Email<input type="email" value={s.email || ''} onChange={(e) => setS({ ...s, email: e.target.value })} /></label>
          <label className="field">Phone<input type="text" value={s.phone || ''} onChange={(e) => setS({ ...s, phone: e.target.value })} /></label>
          <label className="field span-2">Address<textarea value={s.address || ''} onChange={(e) => setS({ ...s, address: e.target.value })} /></label>
          <label className="field">City<input type="text" value={s.city || ''} onChange={(e) => setS({ ...s, city: e.target.value })} /></label>
          <label className="field">State<input type="text" value={s.state || ''} onChange={(e) => setS({ ...s, state: e.target.value })} /></label>
        </div>

        <div className="card form-grid" id="bank-details">
          <h3 className="ui span-2" style={{ marginTop: 0 }}>Bank account details</h3>
          <p className="span-2" style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
            Shown to clients on Clear invoice and bank transfer instructions, in this order.
          </p>
          <label className="field span-2">
            Company Name
            <input
              type="text"
              name="legalName"
              autoComplete="organization"
              value={s.legalName ?? ''}
              onChange={(e) => setS({ ...s, legalName: e.target.value })}
              placeholder="Registered account holder name"
            />
          </label>
          <label className="field">
            Bank
            <input value={s.bankName || ''} onChange={(e) => setS({ ...s, bankName: e.target.value })} placeholder="e.g. HDFC Bank" />
          </label>
          <label className="field">
            Account Number
            <input value={s.bankAccount || ''} onChange={(e) => setS({ ...s, bankAccount: e.target.value })} inputMode="numeric" />
          </label>
          <label className="field">
            IFSC Code
            <input value={s.bankIfsc || ''} onChange={(e) => setS({ ...s, bankIfsc: e.target.value.toUpperCase() })} placeholder="e.g. HDFC0001234" />
          </label>
          <label className="field">
            Branch
            <input value={s.bankBranch || ''} onChange={(e) => setS({ ...s, bankBranch: e.target.value })} placeholder="Branch name or location" />
          </label>
        </div>

        <div className="card form-grid">
          <h3 className="ui span-2" style={{ marginTop: 0 }}>Tax</h3>
          <label className="check span-2">
            <input
              type="checkbox"
              checked={!!s.chargesTax}
              onChange={(e) => setS({ ...s, chargesTax: e.target.checked })}
            />
            Apply tax on invoices
          </label>
          {s.chargesTax && (
            <label className="field">Default tax %<input type="number" value={Number(s.defaultTaxPercent || 18)} onChange={(e) => setS({ ...s, defaultTaxPercent: Number(e.target.value) })} /></label>
          )}
        </div>

        <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>
      </form>
    </>
  );
}
