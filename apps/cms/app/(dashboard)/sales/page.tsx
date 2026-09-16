'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, getUser } from '@/lib/api';
import { isAdmin } from '@/lib/roles';

export default function SalesTrackingPage() {
  const user = getUser();
  const admin = isAdmin(user?.role);
  const [desk, setDesk] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [personId, setPersonId] = useState('ALL');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (admin) {
      api('/reports/sales')
        .then(setReport)
        .catch((e) => setErr(e.message));
      return;
    }
    api('/attendance/desk')
      .then(setDesk)
      .catch((e) => setErr(e.message));
  }, [admin]);

  const people = report?.summary || [];
  const selected = useMemo(() => {
    if (!admin || !report) return null;
    if (personId === 'ALL') return null;
    return people.find((p: any) => p.id === personId) || null;
  }, [admin, report, personId, people]);

  const ledger = useMemo(() => {
    const rows = report?.sales || [];
    if (personId === 'ALL') return rows;
    return rows.filter((s: any) => s.salesPersonId === personId);
  }, [report, personId]);

  if (err) return <p className="error">{err}</p>;
  if (admin && !report) return <p className="muted">Loading sales tracking…</p>;
  if (!admin && !desk) return <p className="muted">Loading sales tracking…</p>;

  const sales = desk?.sales;
  const totals = report?.totals || {
    salesPeople: people.length,
    clientAccounts: people.reduce((n: number, p: any) => n + (p.clientCount || 0), 0),
    servicesSold: report?.sales?.length || 0,
    unassignedClients: report?.unassignedClients || 0,
  };

  return (
    <div className="ops">
      <section className="ops-hero">
        <div>
          <p className="ops-kicker">Sales tracking</p>
          <h1>{admin ? 'Team sales tracking' : 'My sales'}</h1>
        </div>
        <div className="row">
          <Link className="btn ghost" href="/clients">Client accounts</Link>
          <Link className="btn" href="/subscriptions">Subscriptions</Link>
        </div>
      </section>

      {!admin && sales && (
        <>
          <div className="kpi-grid">
            <article className="kpi ok">
              <label>My client accounts</label>
              <strong>{sales.clientCount}</strong>
              <span>Companies assigned to you</span>
            </article>
            <article className="kpi ok">
              <label>Services I sold</label>
              <strong>{sales.saleCount}</strong>
              <span>Subscriptions you assigned</span>
            </article>
          </div>
          <div className="ops-grid">
            <section className="card">
              <div className="card-head">
                <h3 className="ui">My client accounts</h3>
                <Link href="/clients">View all</Link>
              </div>
              <ul className="feed">
                {(sales.clients || []).map((c: any) => (
                  <li key={c.id}>
                    <Link href={`/clients/${c.id}`}><strong>{c.name}</strong></Link>
                  </li>
                ))}
                {(!sales.clients || sales.clients.length === 0) && (
                  <li className="muted">No client accounts assigned yet.</li>
                )}
              </ul>
            </section>
            <section className="card">
              <div className="card-head">
                <h3 className="ui">Services I sold</h3>
                <Link href="/subscriptions">Subscriptions</Link>
              </div>
              <table>
                <thead>
                  <tr><th>Service</th><th>Client</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {(sales.recentSales || []).map((s: any) => (
                    <tr key={s.id}>
                      <td>{s.catalog?.name}</td>
                      <td>
                        {s.organization?.id
                          ? <Link href={`/clients/${s.organization.id}`}>{s.organization?.name}</Link>
                          : s.organization?.name}
                      </td>
                      <td>{s.soldAt ? String(s.soldAt).slice(0, 10) : '—'}</td>
                    </tr>
                  ))}
                  {(!sales.recentSales || sales.recentSales.length === 0) && (
                    <tr><td colSpan={3} className="muted">No services sold yet.</td></tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}

      {admin && report && (
        <>
          <div className="kpi-grid">
            <article className="kpi">
              <label>Salespeople</label>
              <strong>{totals.salesPeople}</strong>
              <span>Active sales accounts tracked</span>
            </article>
            <article className="kpi ok">
              <label>Client accounts</label>
              <strong>{totals.clientAccounts}</strong>
              <span>Assigned to a salesperson</span>
            </article>
            <article className="kpi ok">
              <label>Services sold</label>
              <strong>{totals.servicesSold}</strong>
              <span>Subscriptions with a seller</span>
            </article>
            <article className={`kpi ${totals.unassignedClients ? 'warn' : ''}`}>
              <label>Unassigned clients</label>
              <strong>{totals.unassignedClients}</strong>
              <span>No salesperson linked yet</span>
            </article>
          </div>

          <section className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <div>
                <h3 className="ui">Filter by employee</h3>
              </div>
              <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
                <option value="ALL">All salespeople</option>
                {people.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.clientCount} clients · {p.saleCount} sold
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <h3 className="ui">Sales employees</h3>
              <Link href="/staff">Staff & roles</Link>
            </div>
            <table className="presence-table">
              <thead>
                <tr>
                  <th>Salesperson</th>
                  <th>Email</th>
                  <th>Client accounts</th>
                  <th>Services sold</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {people.map((p: any) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                      {p.jobTitle ? <div className="muted">{p.jobTitle}</div> : null}
                    </td>
                    <td className="muted">{p.email}</td>
                    <td>{p.clientCount}</td>
                    <td>{p.saleCount}</td>
                    <td>
                      <button className="btn sm ghost" type="button" onClick={() => setPersonId(p.id)}>
                        View detail
                      </button>
                    </td>
                  </tr>
                ))}
                {people.length === 0 && (
                  <tr><td colSpan={5} className="muted">No sales employees found.</td></tr>
                )}
              </tbody>
            </table>
          </section>

          {(selected ? [selected] : people).map((p: any) => (
            <section className="card" key={p.id} style={{ marginBottom: 16 }}>
              <div className="card-head">
                <div>
                  <h3 className="ui">{p.name}</h3>
                  <p>{p.email}{p.phone ? ` · ${p.phone}` : ''}{p.jobTitle ? ` · ${p.jobTitle}` : ''}</p>
                </div>
                <p>{p.clientCount} clients · {p.saleCount} services sold</p>
              </div>
              <div className="ops-grid">
                <div>
                  <h4 className="ui" style={{ marginBottom: 8 }}>Client accounts</h4>
                  {(!p.clients || p.clients.length === 0) ? (
                    <p className="muted">No client accounts assigned.</p>
                  ) : (
                    <table>
                      <thead>
                        <tr><th>Client</th><th>Contact</th><th>Subscriptions</th></tr>
                      </thead>
                      <tbody>
                        {p.clients.map((c: any) => (
                          <tr key={c.id}>
                            <td><Link href={`/clients/${c.id}`}>{c.name}</Link></td>
                            <td className="muted">{c.email || c.phone || '—'}</td>
                            <td>{c.subscriptionCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div>
                  <h4 className="ui" style={{ marginBottom: 8 }}>Services sold</h4>
                  {(!p.services || p.services.length === 0) ? (
                    <p className="muted">No services sold yet.</p>
                  ) : (
                    <table>
                      <thead>
                        <tr><th>Service</th><th>Client</th><th>Status</th><th>Date</th></tr>
                      </thead>
                      <tbody>
                        {p.services.map((s: any) => (
                          <tr key={s.id}>
                            <td>{s.service}</td>
                            <td>
                              {s.clientId
                                ? <Link href={`/clients/${s.clientId}`}>{s.client}</Link>
                                : s.client}
                            </td>
                            <td><span className="badge">{s.status}</span></td>
                            <td>{s.soldAt ? String(s.soldAt).slice(0, 10) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </section>
          ))}

          <section className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <h3 className="ui">{personId === 'ALL' ? 'All services sold' : 'Filtered services sold'}</h3>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Salesperson</th>
                  <th>Client</th>
                  <th>Service</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((s: any) => (
                  <tr key={s.id}>
                    <td>{s.soldAt ? String(s.soldAt).slice(0, 10) : '—'}</td>
                    <td>{s.salesPerson || '—'}</td>
                    <td>
                      {s.clientId ? <Link href={`/clients/${s.clientId}`}>{s.client}</Link> : s.client}
                    </td>
                    <td>{s.service}</td>
                    <td><span className="badge">{s.status}</span></td>
                  </tr>
                ))}
                {ledger.length === 0 && (
                  <tr><td colSpan={5} className="muted">No sales recorded for this view.</td></tr>
                )}
              </tbody>
            </table>
          </section>

          {(report.unassigned || []).length > 0 && (
            <section className="card">
              <div className="card-head">
                <div>
                  <h3 className="ui">Unassigned client accounts</h3>
                </div>
                <Link href="/clients">Open clients</Link>
              </div>
              <table>
                <thead>
                  <tr><th>Client</th><th>Email</th><th>Phone</th><th></th></tr>
                </thead>
                <tbody>
                  {report.unassigned.map((c: any) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td className="muted">{c.email || '—'}</td>
                      <td className="muted">{c.phone || '—'}</td>
                      <td><Link className="btn sm ghost" href={`/clients/${c.id}`}>Assign</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  );
}
