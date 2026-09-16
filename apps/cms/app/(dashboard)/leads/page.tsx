'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, getUser } from '@/lib/api';
import { canSee, ROLE_GROUPS } from '@/lib/roles';

export default function LeadsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const canQuote = canSee(getUser()?.role, ROLE_GROUPS.commercial);

  function load() {
    api('/cms/service-requests').then(setRows);
  }
  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: string) {
    await api(`/cms/service-requests/${id}`, { method: 'PATCH', body: { status } });
    load();
  }

  async function assignSubscription(row: any) {
    if (!row.catalogId) {
      setMsg('Pick or attach a catalog service before assigning.');
      return;
    }
    const start = new Date().toISOString().slice(0, 10);
    const renew = new Date();
    renew.setFullYear(renew.getFullYear() + 1);
    await api('/subscriptions', {
      method: 'POST',
      body: {
        organizationId: row.organizationId,
        catalogId: row.catalogId,
        status: 'ACTIVE',
        startDate: start,
        renewalDate: row.catalog?.billingCycle === 'ONE_TIME' ? null : renew.toISOString().slice(0, 10),
        slaNotes: row.catalog?.category === 'Support' || row.catalog?.category === 'Consulting'
          ? 'First response within 8 business hours. Critical incidents same day.'
          : undefined,
      },
    });
    await setStatus(row.id, 'ACCEPTED');
    setMsg(`Assigned ${row.catalog?.name} to ${row.organization?.name}. It now appears in the client app.`);
  }

  async function createProject(row: any) {
    const name = row.catalog?.name || (row.kind === 'CONSULTING' ? 'Consulting engagement' : 'Delivery project');
    const project = await api('/projects', {
      method: 'POST',
      body: {
        organizationId: row.organizationId,
        name: `${name} — ${row.organization?.name || 'Client'}`,
        description: row.message || name,
        status: 'PLANNED',
      },
    });
    await setStatus(row.id, 'ACCEPTED');
    setMsg(`Project created. Open files or chat from Projects.`);
    window.location.href = `/projects/${project.id}`;
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Service requests</h1>
        </div>
      </div>
      {msg && <p className="card" style={{ marginBottom: 12 }}>{msg}</p>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Client</th>
              <th>Service</th>
              <th>Kind</th>
              <th>Message / callback reason</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{String(r.createdAt).slice(0, 10)}</td>
                <td>{r.organization?.name}</td>
                <td>{r.catalog?.name || '—'}</td>
                <td>
                  <span className={`badge ${r.kind === 'CALLBACK' ? 'OVERDUE' : ''}`}>{r.kind}</span>
                </td>
                <td>
                  {r.kind === 'CALLBACK' ? (
                    <div>
                      <strong style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>Callback reason</strong>
                      {r.message}
                    </div>
                  ) : (
                    r.message
                  )}
                </td>
                <td>
                  <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)}>
                    {['NEW', 'REVIEWING', 'QUOTED', 'ACCEPTED', 'DECLINED'].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td className="row" style={{ gap: 6 }}>
                  {canQuote && (
                    <Link className="btn sm" href={`/billing/new?org=${r.organizationId}${r.catalogId ? `&catalog=${r.catalogId}` : ''}`}>Quote</Link>
                  )}
                  {r.catalogId && (
                    <button className="btn sm ghost" type="button" onClick={() => assignSubscription(r)}>Assign service</button>
                  )}
                  {r.kind !== 'CALLBACK' && (
                    <button className="btn sm ghost" type="button" onClick={() => createProject(r)}>Start project</button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="muted">No service requests yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
