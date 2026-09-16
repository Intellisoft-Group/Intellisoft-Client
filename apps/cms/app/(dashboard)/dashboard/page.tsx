'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, getUser, money } from '@/lib/api';
import { isAdmin } from '@/lib/roles';
import { displayPersonName, greeting } from '@/lib/format';

function todayLabel() {
  return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function timeAgo(value?: string) {
  if (!value) return '';
  const mins = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function change(current: number, prev: number) {
  if (!prev) return current ? 'New this month' : 'No prior period';
  const pct = Math.round(((current - prev) / prev) * 100);
  if (pct === 0) return 'Unchanged vs last month';
  return `${pct > 0 ? '+' : ''}${pct}% vs last month`;
}

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [team, setTeam] = useState<any[]>([]);
  const [sales, setSales] = useState<any>(null);
  const [err, setErr] = useState('');
  const user = getUser();

  useEffect(() => {
    api('/reports/dashboard').then(setData).catch((e) => setErr(e.message));
    api('/attendance/team').then(setTeam).catch(() => setTeam([]));
    if (isAdmin(user?.role)) {
      api('/reports/sales').then(setSales).catch(() => setSales(null));
    }
  }, []);

  if (err) return <p className="error">{err}</p>;
  if (!data) return <p className="muted">Loading dashboard…</p>;

  const inNow = team.filter((s) => s.status === 'IN');
  const aging = data.aging || { current: 0, d30: 0, d60: 0, older: 0 };
  const agingMax = Math.max(1, aging.current, aging.d30, aging.d60, aging.older);
  const mix = Object.entries(data.serviceMix || {}) as [string, number][];

  return (
    <div className="ops">
      <section className="ops-hero">
        <div className="page-greeting on-dark">
          <p className="wish">{greeting()}</p>
          <h1>{displayPersonName(user?.name, 'Dashboard')}</h1>
          <p className="ops-kicker" style={{ marginTop: 8 }}>{todayLabel()}</p>
        </div>
        <div className="row">
          <Link className="btn ghost" href="/inbox">Inbox</Link>
          <Link className="btn ghost" href="/team">Attendance</Link>
          <Link className="btn" href="/billing/new">New invoice</Link>
        </div>
      </section>

      <div className="kpi-grid">
        <article className="kpi">
          <label>Receivables</label>
          <strong>{money(data.unpaidTotal)}</strong>
          <span>{data.unpaidCount} open invoices</span>
        </article>
        <article className="kpi warn">
          <label>Overdue</label>
          <strong>{money(data.overdueTotal)}</strong>
          <span>{data.overdueCount || 0} past due</span>
        </article>
        <article className="kpi ok">
          <label>Collected this month</label>
          <strong>{money(data.collectedMonth)}</strong>
          <span>{change(data.collectedMonth || 0, data.collectedPrev || 0)}</span>
        </article>
        <article className="kpi">
          <label>Open tickets</label>
          <strong>{data.openTickets}</strong>
          <span>{data.urgentTickets || 0} high priority · {data.activeProjects || 0} live projects</span>
        </article>
        <article className="kpi">
          <label>Renewals · 30 days</label>
          <strong>{data.upcomingRenewals}</strong>
          <span>Contracts due for renewal</span>
        </article>
        <article className="kpi">
          <label>Client accounts</label>
          <strong>{data.clients}</strong>
          <span>{data.staffCount || 0} staff · {data.newLeads || 0} new requests</span>
        </article>
      </div>

      <section className="card presence-card">
        <div className="card-head">
          <div>
            <h3 className="ui">Team attendance</h3>
            <p>{inNow.length} of {team.length} on duty</p>
          </div>
          <Link href="/team">View roster</Link>
        </div>
        {team.length === 0 ? (
          <p className="muted">No attendance recorded today.</p>
        ) : (
          <table className="presence-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Hours</th>
                <th>Tickets</th>
              </tr>
            </thead>
            <tbody>
              {team.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="staff-name">
                      {s.avatarUrl
                        ? <img className="profile-pic" src={s.avatarUrl} alt="" />
                        : <span className="profile-pic profile-pic-fallback">{s.name?.slice(0, 1)}</span>}
                      {s.name}
                    </span>
                  </td>
                  <td className="muted">{s.jobTitle || s.role.replaceAll('_', ' ')}</td>
                  <td>
                    <span className={`status-dot ${s.status === 'IN' ? 'in' : ''}`} />
                    {s.status === 'IN' ? 'On duty' : 'Off duty'}
                  </td>
                  <td>{s.status === 'IN' ? `${s.hours || 0}h` : '—'}</td>
                  <td>{s.openTickets || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {sales && (
        <section className="card presence-card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <div>
              <h3 className="ui">Sales tracking</h3>
            </div>
            <Link href="/sales">Full sales tracking</Link>
          </div>
          {sales.summary?.length > 0 && (
            <table className="presence-table" style={{ marginBottom: 16 }}>
              <thead>
                <tr>
                  <th>Salesperson</th>
                  <th>Client accounts</th>
                  <th>Services sold</th>
                </tr>
              </thead>
              <tbody>
                {sales.summary.map((s: any) => (
                  <tr key={s.id}>
                    <td>{s.name}{s.jobTitle ? ` · ${s.jobTitle}` : ''}</td>
                    <td>{s.clientCount}</td>
                    <td>{s.saleCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <table className="presence-table">
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
              {(sales.sales || []).slice(0, 12).map((s: any) => (
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
              {(!sales.sales || sales.sales.length === 0) && (
                <tr><td colSpan={5} className="muted">No sales recorded yet.</td></tr>
              )}
            </tbody>
          </table>
          {sales.unassignedClients > 0 && (
            <p className="muted" style={{ marginTop: 12 }}>{sales.unassignedClients} client account(s) have no assigned salesperson.</p>
          )}
        </section>
      )}

      <div className="ops-grid">
        <section className="card">
          <div className="card-head">
            <h3 className="ui">Delivery queue</h3>
            <Link href="/tickets">All tickets</Link>
          </div>
          <ul className="feed">
            {(data.recentTickets || []).map((t: any) => (
              <li key={t.id}>
                <Link href={`/tickets/${t.id}`}>
                  <strong>{t.number}</strong>
                  <span>{t.organization?.name} — {t.subject}</span>
                </Link>
                <em className={`badge ${t.priority || t.status}`}>{t.priority || t.status}</em>
              </li>
            ))}
            {(!data.recentTickets || data.recentTickets.length === 0) && <li className="muted">No open tickets.</li>}
          </ul>
        </section>

        <section className="card">
          <div className="card-head">
            <h3 className="ui">Client conversations</h3>
            <Link href="/inbox">Inbox</Link>
          </div>
          <ul className="feed">
            {(data.recentChat || []).map((m: any) => (
              <li key={m.id}>
                <div>
                  <strong>{m.author}</strong>
                  <span>{m.client} · {m.body}</span>
                </div>
                <em>{timeAgo(m.at)}</em>
              </li>
            ))}
            {(!data.recentChat || data.recentChat.length === 0) && <li className="muted">No recent messages.</li>}
          </ul>
        </section>

        <section className="card">
          <div className="card-head">
            <h3 className="ui">Receivables aging</h3>
            <Link href="/reports">Reports</Link>
          </div>
          {[
            ['Current', aging.current, false],
            ['1–30 days', aging.d30, false],
            ['31–60 days', aging.d60, true],
            ['Over 60 days', aging.older, true],
          ].map(([label, value, late]) => (
            <div className="age-row" key={String(label)}>
              <span>{label}</span>
              <div className={`age-track ${late ? 'late' : ''}`}><i style={{ width: `${(Number(value) / agingMax) * 100}%` }} /></div>
              <b>{money(Number(value))}</b>
            </div>
          ))}
        </section>

        <section className="card">
          <div className="card-head">
            <h3 className="ui">Renewals & collections</h3>
            <Link href="/subscriptions?tab=renewals">Renewals</Link>
          </div>
          <ul className="feed">
            {(data.renewalRows || []).map((r: any) => (
              <li key={r.id}>
                <div>
                  <strong>{r.organization?.name}</strong>
                  <span>{r.catalog?.name} · {r.renewalDate ? String(r.renewalDate).slice(0, 10) : ''}</span>
                </div>
              </li>
            ))}
            {(data.recentPayments || []).map((p: any) => (
              <li key={p.id}>
                <div>
                  <strong>{money(p.amount)}</strong>
                  <span>Received · {p.client}</span>
                </div>
                <em>{timeAgo(p.at)}</em>
              </li>
            ))}
            {(!data.renewalRows?.length && !data.recentPayments?.length) && (
              <li className="muted">No renewals or collections in this view.</li>
            )}
          </ul>
          {mix.length > 0 && (
            <div className="mix">
              {mix.map(([name, count]) => (
                <span key={name}>{name} · {count}</span>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
