'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money } from '@/lib/api';
import { CURRENCIES, currencyOptionLabel } from '@/lib/currencies';

export default function CatalogPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [applyTax, setApplyTax] = useState(false);
  const [defaultTax, setDefaultTax] = useState(18);
  const [form, setForm] = useState({
    name: '',
    category: 'Consulting',
    sacCode: '998314',
    price: 0,
    taxPercent: 0,
    billingCycle: 'YEARLY',
    description: '',
    isPublished: true,
    currency: 'INR',
  });

  function load() {
    api('/catalog').then(setRows);
  }
  useEffect(() => {
    load();
    api('/settings/public').then((s) => {
      const on = !!s?.chargesTax;
      const pct = Number(s?.defaultTaxPercent) || 18;
      setApplyTax(on);
      setDefaultTax(pct);
      if (on) setForm((f) => ({ ...f, taxPercent: pct }));
    }).catch(() => undefined);
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await api('/catalog', { method: 'POST', body: { ...form, taxPercent: applyTax ? form.taxPercent : 0 } });
    setForm({ ...form, name: '', description: '', price: 0 });
    load();
  }

  async function toggle(row: any) {
    await api(`/catalog/${row.id}`, { method: 'PATCH', body: { isPublished: !row.isPublished } });
    load();
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Service catalog</h1>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <form className="form-grid" onSubmit={create}>
          <label className="field">Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="field">Category
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {['Consulting', 'Development', 'Implementation', 'Support', 'Hosting', 'Cloud', 'Security', 'Analytics', 'Staffing', 'Training', 'Licenses'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">Currency
            <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{currencyOptionLabel(c)}</option>
              ))}
            </select>
          </label>
          <label className="field">Price<input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></label>
          <label className="check span-2">
            <input
              type="checkbox"
              checked={applyTax}
              onChange={(e) => {
                const on = e.target.checked;
                setApplyTax(on);
                setForm({ ...form, taxPercent: on ? defaultTax : 0 });
              }}
            />
            Apply tax when quoting from this service
          </label>
          {applyTax && (
            <label className="field">Tax %<input type="number" value={form.taxPercent} onChange={(e) => setForm({ ...form, taxPercent: Number(e.target.value) })} /></label>
          )}
          <label className="field">Cycle
            <select value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}>
              <option>ONE_TIME</option><option>MONTHLY</option><option>QUARTERLY</option><option>YEARLY</option>
            </select>
          </label>
          <label className="field span-2">Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label className="check span-2">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
            />
            Publish to client app and portal
          </label>
          <button className="btn" type="submit">Add service</button>
        </form>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Service</th><th>Category</th><th>Price</th><th>App</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.category}</td>
                <td>{money(Number(r.price), r.currency)}</td>
                <td>{r.isPublished ? 'Published' : 'Hidden'}</td>
                <td className="row" style={{ gap: 8 }}>
                  <Link className="btn sm" href={`/billing/new?catalog=${r.id}&type=PROFORMA`}>Quote</Link>
                  <button className="btn sm ghost" type="button" onClick={() => toggle(r)}>{r.isPublished ? 'Hide' : 'Publish'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
