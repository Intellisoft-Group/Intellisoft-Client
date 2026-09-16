'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { api, money } from '@/lib/api';
import { day } from '@/lib/format';

export default function ServicesPage() {
  const [subs, setSubs] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    setError('');
    api('/subscriptions')
      .then((s) => setSubs(Array.isArray(s) ? s : []))
      .catch((e) => setError(e.message || 'Failed to load subscriptions'));
    api('/catalog?published=true')
      .then((c) => setCatalog(Array.isArray(c) ? c : []))
      .catch((e) => setError((prev) => prev || e.message || 'Failed to load services'));
  }

  useEffect(() => { load(); }, []);

  async function requestService(catalogId: string, name: string) {
    setBusyId(catalogId);
    setMsg('');
    setError('');
    try {
      await api('/cms/service-requests', {
        method: 'POST',
        body: {
          kind: 'NEW',
          catalogId,
          message: `Please share a proposal for ${name}.`,
        },
      });
      setMsg('Request sent. An account manager will follow up.');
    } catch (err: any) {
      setError(err.message || 'Request failed');
    } finally {
      setBusyId('');
    }
  }

  async function requestRenewal(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    setError('');
    const form = e.target as HTMLFormElement;
    const message = (new FormData(form).get('message') as string) || '';
    try {
      await api('/cms/service-requests', {
        method: 'POST',
        body: { kind: 'RENEWAL', message },
      });
      setMsg('Renewal request sent.');
      form.reset();
    } catch (err: any) {
      setError(err.message || 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  const subscribed = new Set(subs.map((s) => s.catalogId));

  return (
    <>
      <div className="topbar">
        <div className="page-greeting">
          <p className="wish">Catalogue</p>
          <h1>Services</h1>
        </div>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 16 }}>
        Intellisoft IT and consulting offerings for your organisation.
      </p>

      {error && <p className="error">{error}</p>}
      {msg && <p style={{ color: 'var(--ok)', fontSize: 13 }}>{msg}</p>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Your services</h3>
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>Status</th>
              <th>Start</th>
              <th>Renewal</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.id} className="clickable">
                <td>
                  <Link href={`/services/${s.id}`} style={{ color: 'var(--teal)', fontWeight: 600 }}>
                    {s.catalog?.name || 'Service'}
                  </Link>
                </td>
                <td><span className={`badge ${s.status}`}>{s.status}</span></td>
                <td>{day(s.startDate)}</td>
                <td>{day(s.renewalDate)}</td>
              </tr>
            ))}
            {!subs.length && (
              <tr><td colSpan={4} style={{ color: 'var(--muted)' }}>No active services assigned yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Our services</h3>
        {!catalog.length ? (
          <p className="muted">No services listed yet. Please check again shortly.</p>
        ) : (
          <div className="stack">
            {catalog.map((c) => {
              const active = subscribed.has(c.id);
              return (
                <div key={c.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ flex: 1 }}>
                    <strong>{c.name}</strong>
                    {c.category ? <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{c.category}</div> : null}
                    {(c.summary || c.description) ? (
                      <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>{c.summary || c.description}</p>
                    ) : null}
                    {c.price != null ? (
                      <div style={{ marginTop: 6, fontWeight: 600 }}>{money(Number(c.price), c.currency || 'INR')}</div>
                    ) : null}
                  </div>
                  {active ? (
                    <span className="badge ACTIVE">Active</span>
                  ) : (
                    <button
                      className="btn sm"
                      type="button"
                      disabled={!!busyId}
                      onClick={() => requestService(c.id, c.name)}
                    >
                      {busyId === c.id ? 'Sending…' : 'Request'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Request a renewal</h3>
        <form className="stack" onSubmit={requestRenewal}>
          <label className="field">
            Message
            <textarea name="message" required placeholder="Tell us which service to renew and any notes." />
          </label>
          <button className="btn ghost" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Request renewal'}</button>
        </form>
      </div>
    </>
  );
}
