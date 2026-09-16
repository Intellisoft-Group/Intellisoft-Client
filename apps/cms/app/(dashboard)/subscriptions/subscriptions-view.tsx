'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

type Tab = 'ALL' | 'RENEWALS';

export default function SubscriptionsPage() {
  const searchParams = useSearchParams();
  const initialTab: Tab = searchParams.get('tab') === 'renewals' ? 'RENEWALS' : 'ALL';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [rows, setRows] = useState<any[]>([]);
  const [renewals, setRenewals] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    organizationId: '',
    serviceName: '',
    customPrice: '',
    billingCycle: 'YEARLY',
    startDate: new Date().toISOString().slice(0, 10),
    renewalDate: '',
    slaNotes: '',
  });

  function load() {
    api('/subscriptions').then(setRows);
    api('/subscriptions/renewals?days=45').then(setRenewals).catch(() => setRenewals([]));
    api('/organizations').then(setOrgs);
    api('/catalog').then(setCatalog);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    setTab(searchParams.get('tab') === 'renewals' ? 'RENEWALS' : 'ALL');
  }, [searchParams]);

  useEffect(() => {
    function hide(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', hide);
    return () => document.removeEventListener('mousedown', hide);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? catalog.filter((c) => `${c.name} ${c.category}`.toLowerCase().includes(q))
      : catalog;
    return list.slice(0, 8);
  }, [catalog, query]);

  function pickService(name: string, extras?: { customPrice?: string; billingCycle?: string }) {
    setQuery(name);
    setForm((f) => ({
      ...f,
      serviceName: name,
      customPrice: extras?.customPrice ?? f.customPrice,
      billingCycle: extras?.billingCycle ?? f.billingCycle,
    }));
    setOpen(false);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      if (!form.serviceName.trim()) throw new Error('Type a service name.');
      await api('/subscriptions', {
        method: 'POST',
        body: {
          organizationId: form.organizationId,
          serviceName: form.serviceName.trim(),
          customPrice: form.customPrice === '' ? null : Number(form.customPrice),
          billingCycle: form.billingCycle,
          startDate: form.startDate,
          renewalDate: form.renewalDate || null,
          slaNotes: form.slaNotes,
        },
      });
      setForm((f) => ({ ...f, serviceName: '', customPrice: '', slaNotes: '', renewalDate: '' }));
      setQuery('');
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function setStatus(id: string, status: string) {
    await api(`/subscriptions/${id}`, { method: 'PATCH', body: { status } });
    load();
  }

  const list = tab === 'RENEWALS' ? renewals : rows;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Subscriptions</h1>
          <p>Active services and upcoming renewals.</p>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        <button type="button" className={`btn ${tab === 'ALL' ? '' : 'ghost'} sm`} onClick={() => setTab('ALL')}>
          All
        </button>
        <button type="button" className={`btn ${tab === 'RENEWALS' ? '' : 'ghost'} sm`} onClick={() => setTab('RENEWALS')}>
          Renewals (45 days)
        </button>
      </div>

      {tab === 'ALL' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <form className="form-grid" onSubmit={create}>
            <label className="field">Client
              <select required value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })}>
                <option value="">Select</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
            <div className="suggest" ref={box}>
              <label className="field">Service
                <input
                  required
                  value={query}
                  onChange={(e) => {
                    const value = e.target.value;
                    setQuery(value);
                    setForm((f) => ({ ...f, serviceName: value }));
                    setOpen(true);
                  }}
                  onFocus={() => setOpen(true)}
                  placeholder="e.g. Website AMC, custom ERP support"
                  autoComplete="off"
                />
              </label>
              {open && (
                <div className="suggest-list">
                  {matches.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="suggest-item"
                      onClick={() => pickService(c.name, {
                        customPrice: String(c.price ?? ''),
                        billingCycle: c.billingCycle || 'YEARLY',
                      })}
                    >
                      <span>
                        <strong>{c.name}</strong>
                        <span className="muted" style={{ display: 'block' }}>{c.category} · {c.billingCycle}</span>
                      </span>
                    </button>
                  ))}
                  {query.trim() && !matches.some((c) => c.name.toLowerCase() === query.trim().toLowerCase()) && (
                    <button type="button" className="suggest-item" onClick={() => pickService(query.trim())}>
                      <span className="profile-pic profile-pic-fallback">+</span>
                      <span>
                        <strong>Add custom service “{query.trim()}”</strong>
                        <span className="muted" style={{ display: 'block' }}>Save this name on the subscription</span>
                      </span>
                    </button>
                  )}
                  {!query.trim() && matches.length === 0 && <p className="muted" style={{ padding: 12 }}>Type a service name to add it.</p>}
                </div>
              )}
            </div>
            <label className="field">Price
              <input type="number" min="0" value={form.customPrice} onChange={(e) => setForm({ ...form, customPrice: e.target.value })} placeholder="Optional" />
            </label>
            <label className="field">Billing
              <select value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="YEARLY">Yearly</option>
                <option value="ONE_TIME">One time</option>
              </select>
            </label>
            <label className="field">Start<input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
            <label className="field">Renewal<input type="date" value={form.renewalDate} onChange={(e) => setForm({ ...form, renewalDate: e.target.value })} /></label>
            <label className="field span-2">SLA notes<input value={form.slaNotes} onChange={(e) => setForm({ ...form, slaNotes: e.target.value })} /></label>
            {err && <p className="error span-2">{err}</p>}
            <button className="btn" type="submit">Assign</button>
          </form>
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Service</th>
              {tab === 'ALL' && <th>Sold by</th>}
              <th>Status</th>
              <th>Renewal</th>
              {tab === 'ALL' && <th></th>}
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td>{r.organization?.name}</td>
                <td>{r.catalog?.name}</td>
                {tab === 'ALL' && <td>{r.soldBy?.name || '—'}</td>}
                <td><span className={`badge ${r.status}`}>{r.status}</span></td>
                <td>{r.renewalDate ? String(r.renewalDate).slice(0, 10) : '—'}</td>
                {tab === 'ALL' && (
                  <td className="row">
                    <button className="btn sm ghost" onClick={() => setStatus(r.id, 'SUSPENDED')}>Suspend</button>
                    <button className="btn sm ghost" onClick={() => setStatus(r.id, 'ACTIVE')}>Activate</button>
                  </td>
                )}
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={tab === 'ALL' ? 6 : 4} className="muted">
                  {tab === 'RENEWALS' ? 'No renewals in the next 45 days.' : 'No subscriptions yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
