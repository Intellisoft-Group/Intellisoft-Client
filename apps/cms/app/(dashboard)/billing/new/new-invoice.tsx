'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, getUser } from '@/lib/api';
import { CURRENCIES, currencyOptionLabel, currencySymbol } from '@/lib/currencies';

type Line = { description: string; sacCode: string; quantity: number; unitPrice: number; taxPercent: number };

export default function NewInvoicePage() {
  const router = useRouter();
  const params = useSearchParams();
  const role = getUser()?.role;
  const isSales = role === 'SALES';
  const [orgs, setOrgs] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [client, setClient] = useState({ name: '', email: '', phone: '' });
  const [form, setForm] = useState({
    organizationId: params.get('org') || '',
    type: isSales || params.get('type') === 'PROFORMA' ? 'PROFORMA' : 'TAX',
    currency: 'INR',
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    notes: '',
    send: true,
  });
  const [applyTax, setApplyTax] = useState(false);
  const [defaultTax, setDefaultTax] = useState(18);
  const [lines, setLines] = useState<Line[]>([
    { description: '', sacCode: '998313', quantity: 1, unitPrice: 0, taxPercent: 0 },
  ]);
  const [err, setErr] = useState('');
  const [temp, setTemp] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const sym = currencySymbol(form.currency);

  useEffect(() => {
    function hide(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', hide);
    return () => document.removeEventListener('mousedown', hide);
  }, []);

  useEffect(() => {
    api('/settings/public').then((s) => {
      const on = !!s?.chargesTax;
      const pct = Number(s?.defaultTaxPercent) || 18;
      setApplyTax(on);
      setDefaultTax(pct);
      if (on) {
        setLines((prev) => prev.map((l) => ({ ...l, taxPercent: l.taxPercent || pct })));
      }
    }).catch(() => undefined);
    api('/organizations').then((rows) => {
      setOrgs(rows);
      const preset = params.get('org');
      if (preset) {
        const hit = rows.find((o: any) => o.id === preset);
        if (hit) pick(hit);
        else api(`/organizations/${preset}`).then(pick).catch(() => undefined);
      }
    });
    const catalogId = params.get('catalog');
    if (catalogId) {
      api(`/catalog/${catalogId}`).then((match) => {
        if (!match?.name) return;
        setLines([{
          description: match.name,
          sacCode: match.sacCode || '',
          quantity: 1,
          unitPrice: Number(match.price),
          taxPercent: Number(match.taxPercent) || 0,
        }]);
        setForm((f) => ({
          ...f,
          type: match.billingCycle === 'ONE_TIME' || isSales ? 'PROFORMA' : f.type,
          currency: match.currency || f.currency || 'INR',
          notes: `Proposal for ${match.name}`,
        }));
      }).catch(() => undefined);
    }
  }, [params, isSales]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orgs.slice(0, 8);
    return orgs.filter((o) => {
      const users = o.users || [];
      const hay = [o.name, o.email, o.phone, ...users.map((u: any) => `${u.name} ${u.email} ${u.phone}`)].join(' ').toLowerCase();
      return hay.includes(q);
    }).slice(0, 8);
  }, [orgs, query]);

  function pick(org: any) {
    const contact = org.users?.[0] || {};
    setSelected(org);
    setCreatingNew(false);
    setForm((f) => ({ ...f, organizationId: org.id }));
    setClient({
      name: contact.name || org.name || '',
      email: contact.email || org.email || '',
      phone: contact.phone || org.phone || '',
    });
    setQuery(contact.name || org.name || '');
    setOpen(false);
  }

  function startNew(name: string) {
    setSelected(null);
    setCreatingNew(true);
    setForm((f) => ({ ...f, organizationId: '' }));
    setClient({ name, email: '', phone: '' });
    setQuery(name);
    setOpen(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setTemp('');
    try {
      let organizationId = form.organizationId;
      if (!organizationId) {
        if (!creatingNew) {
          throw new Error('Select an existing client, or choose “Add new client” to create an account.');
        }
        if (!client.name.trim() || !client.email.trim() || !client.phone.trim()) {
          throw new Error('Enter client name, email and phone to create their account.');
        }
        const ensured = await api('/organizations/ensure', {
          method: 'POST',
          body: { name: client.name.trim(), email: client.email.trim(), phone: client.phone.trim() },
        });
        organizationId = ensured.organization.id;
        if (ensured.temporaryPassword) {
          setTemp(`New client account created. Temporary password: ${ensured.temporaryPassword}`);
        }
      }
      const billedLines = lines
        .filter((l) => l.description?.trim())
        .map((l) => ({
          description: l.description.trim(),
          sacCode: l.sacCode || undefined,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          taxPercent: applyTax ? Number(l.taxPercent) || 0 : 0,
        }));
      if (!billedLines.length) {
        throw new Error('Add at least one service line with a description.');
      }
      if (billedLines.some((l) => !Number.isFinite(l.quantity) || l.quantity <= 0 || !Number.isFinite(l.unitPrice) || l.unitPrice < 0)) {
        throw new Error('Each line needs a valid quantity and unit price.');
      }
      const inv = await api('/invoices', {
        method: 'POST',
        body: { ...form, organizationId, lines: billedLines },
      });
      router.push(`/billing/${inv.id}`);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{isSales ? 'New quote / bill' : 'New invoice'}</h1>
        </div>
      </div>
      <form className="card stack" onSubmit={submit}>
        <div className="suggest" ref={box}>
          <label className="field">Client
            <input
              required
              value={query}
              onChange={(e) => {
                const value = e.target.value;
                setQuery(value);
                setClient((c) => ({ ...c, name: value, email: '', phone: '' }));
                setSelected(null);
                setCreatingNew(false);
                setForm((f) => ({ ...f, organizationId: '' }));
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="Search existing client by name, email or phone"
              autoComplete="off"
            />
          </label>
          {open && (
            <div className="suggest-list">
              {matches.map((o) => {
                const contact = o.users?.[0];
                return (
                  <button key={o.id} type="button" className="suggest-item" onClick={() => pick(o)}>
                    {contact?.avatarUrl
                      ? <img className="profile-pic" src={contact.avatarUrl} alt="" />
                      : <span className="profile-pic profile-pic-fallback">{(contact?.name || o.name || '?').slice(0, 1)}</span>}
                    <span>
                      <strong>{contact?.name || o.name}</strong>
                      <span className="muted" style={{ display: 'block' }}>{contact?.email || o.email || 'No email'} · {contact?.phone || o.phone || 'No phone'}</span>
                    </span>
                  </button>
                );
              })}
              {query.trim() && (
                <button type="button" className="suggest-item" onClick={() => startNew(query.trim())}>
                  <span className="profile-pic profile-pic-fallback">+</span>
                  <span>
                    <strong>Add new client “{query.trim()}”</strong>
                    <span className="muted" style={{ display: 'block' }}>Then enter email and phone to create their account</span>
                  </span>
                </button>
              )}
              {!query.trim() && matches.length === 0 && (
                <p className="muted" style={{ padding: 12 }}>No clients yet. Type a name, then choose Add new client.</p>
              )}
            </div>
          )}
        </div>
        {selected && (
          <p className="muted">Selected client: <strong>{selected.name}</strong>. Change the search to pick someone else.</p>
        )}
        {creatingNew && (
          <div className="form-grid">
            <label className="field">Client name
              <input
                required
                value={client.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setClient({ ...client, name });
                  setQuery(name);
                }}
                placeholder="Company or contact name"
              />
            </label>
            <label className="field">Work email
              <input
                required
                type="email"
                value={client.email}
                onChange={(e) => setClient({ ...client, email: e.target.value })}
                placeholder="Required to create app login"
              />
            </label>
            <label className="field">Phone
              <input
                required
                value={client.phone}
                onChange={(e) => setClient({ ...client, phone: e.target.value })}
                placeholder="Required to create app login"
              />
            </label>
          </div>
        )}
        <div className="form-grid">
          <label className="field">Type
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="PROFORMA">PROFORMA (quote)</option>
              <option value="TAX">TAX (invoice)</option>
              {!isSales && <option value="CREDIT_NOTE">CREDIT_NOTE</option>}
            </select>
          </label>
          <label className="field">Currency
            <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{currencyOptionLabel(c)}</option>
              ))}
            </select>
          </label>
          <label className="field">Due date
            <input required type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </label>
        </div>
        <label className="check span-2">
          <input
            type="checkbox"
            checked={applyTax}
            onChange={(e) => {
              const on = e.target.checked;
              setApplyTax(on);
              if (on) {
                setLines(lines.map((l) => ({ ...l, taxPercent: l.taxPercent || defaultTax })));
              } else {
                setLines(lines.map((l) => ({ ...l, taxPercent: 0 })));
              }
            }}
          />
          Apply tax on this {form.type === 'PROFORMA' ? 'quote' : 'invoice'}
        </label>
        {lines.map((line, i) => (
          <div className="form-grid" key={i}>
            <label className="field span-2">Service (custom)
              <input value={line.description} onChange={(e) => setLines(lines.map((l, idx) => idx === i ? { ...l, description: e.target.value } : l))} placeholder="Service description" />
            </label>
            {applyTax && (
              <label className="field">SAC
                <input value={line.sacCode} onChange={(e) => setLines(lines.map((l, idx) => idx === i ? { ...l, sacCode: e.target.value } : l))} />
              </label>
            )}
            <label className="field">Qty
              <input type="number" value={line.quantity} onChange={(e) => setLines(lines.map((l, idx) => idx === i ? { ...l, quantity: Number(e.target.value) } : l))} />
            </label>
            <label className="field">Unit price ({sym})
              <input type="number" step="0.01" value={line.unitPrice} onChange={(e) => setLines(lines.map((l, idx) => idx === i ? { ...l, unitPrice: Number(e.target.value) } : l))} />
            </label>
            {applyTax && (
              <label className="field">Tax %
                <input type="number" value={line.taxPercent} onChange={(e) => setLines(lines.map((l, idx) => idx === i ? { ...l, taxPercent: Number(e.target.value) } : l))} />
              </label>
            )}
          </div>
        ))}
        <button className="btn ghost" type="button" onClick={() => setLines([...lines, { description: '', sacCode: applyTax ? '998313' : '', quantity: 1, unitPrice: 0, taxPercent: applyTax ? defaultTax : 0 }])}>Add custom service</button>
        <label className="field">Notes<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        <label className="check">
          <input type="checkbox" checked={form.send} onChange={(e) => setForm({ ...form, send: e.target.checked })} />
          Send to client and generate pay link
        </label>
        {err && <p className="error">{err}</p>}
        {temp && <p>{temp}</p>}
        <button className="btn" type="submit">
          {creatingNew ? 'Create client account & bill' : 'Create & send'}
        </button>
      </form>
    </>
  );
}
