'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, getUser } from '@/lib/api';
import { greeting } from '@/lib/format';
import { canSee, ROLE_GROUPS } from '@/lib/roles';

function timeLabel(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function DeskPage() {
  const [data, setData] = useState<any>(null);
  const [threads, setThreads] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const user = getUser();

  async function load() {
    try {
      const [desk, chats] = await Promise.all([api('/attendance/desk'), api('/chat/threads').catch(() => [])]);
      setData(desk);
      setThreads(chats);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function punch(type: 'IN' | 'OUT') {
    setBusy(true);
    setErr('');
    try {
      await api('/attendance/punch', { method: 'POST', body: { type } });
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data && !err) return <p>Loading desk…</p>;
  const today = data?.today || {};
  const inNow = today.status === 'IN';
  const unread = threads.reduce((n, t) => n + (t.unread || 0), 0);
  const sales = data?.sales;
  const delivery = canSee(user?.role, ROLE_GROUPS.delivery);

  return (
    <div className="ops">
      <section className="ops-hero">
        <div>
          <p className="ops-kicker">{greeting()}</p>
          <h1>{user?.name || 'Welcome'}</h1>
        </div>
        <div className="row">
          <button className="btn" disabled={busy || inNow} onClick={() => punch('IN')}>Punch in</button>
          <button className="btn ghost" disabled={busy || !inNow} onClick={() => punch('OUT')}>Punch out</button>
        </div>
      </section>
      {err && <p className="error">{err}</p>}
      <div className="kpi-grid">
        <article className="kpi">
          <label>Duty</label>
          <strong>{inNow ? 'In' : 'Out'}</strong>
          <span>Last {timeLabel(today.lastAt)} · {today.hours || 0} hrs today</span>
        </article>
        {delivery && (
          <>
            <article className="kpi">
              <label>My tickets</label>
              <strong>{data?.tickets?.length || 0}</strong>
              <span>Assigned to you</span>
            </article>
            <article className="kpi">
              <label>Projects</label>
              <strong>{data?.projects?.length || 0}</strong>
              <span>Teams you are on</span>
            </article>
          </>
        )}
        <article className="kpi">
          <label>Unread chat</label>
          <strong>{unread}</strong>
          <span><Link href="/inbox">Open client chat</Link></span>
        </article>
        {sales && (
          <>
            <article className="kpi ok">
              <label>My client accounts</label>
              <strong>{sales.clientCount}</strong>
              <span><Link href="/clients">Companies assigned to you</Link></span>
            </article>
            <article className="kpi ok">
              <label>Services I sold</label>
              <strong>{sales.saleCount}</strong>
              <span><Link href="/sales">Sales tracking</Link></span>
            </article>
          </>
        )}
      </div>
      {sales && (
        <div className="ops-grid" style={{ marginBottom: 16 }}>
          <section className="card">
            <div className="card-head">
              <h3 className="ui">My client accounts</h3>
              <Link href="/clients">View all</Link>
            </div>
            <ul className="feed">
              {(sales.clients || []).map((c: any) => (
                <li key={c.id}>
                  <Link href={`/clients/${c.id}`}>
                    <strong>{c.name}</strong>
                  </Link>
                </li>
              ))}
              {(!sales.clients || sales.clients.length === 0) && (
                <li className="muted">No client accounts assigned to you yet. Add a client or assign a service from Requests.</li>
              )}
            </ul>
          </section>
          <section className="card">
            <div className="card-head">
              <h3 className="ui">Services I sold</h3>
              <Link href="/sales">Sales tracking</Link>
            </div>
            <ul className="feed">
              {(sales.recentSales || []).map((s: any) => (
                <li key={s.id}>
                  <div>
                    <strong>{s.catalog?.name}</strong>
                    <span>{s.organization?.name} · {s.soldAt ? String(s.soldAt).slice(0, 10) : '—'}</span>
                  </div>
                </li>
              ))}
              {(!sales.recentSales || sales.recentSales.length === 0) && (
                <li className="muted">No services sold yet. Assign a service from Requests or Subscriptions.</li>
              )}
            </ul>
          </section>
        </div>
      )}
      {delivery && (
        <div className="ops-grid">
          <section className="card">
            <div className="card-head">
              <h3 className="ui">Assigned tickets</h3>
              <Link href="/tickets">Queue</Link>
            </div>
            <ul className="feed">
              {(data?.tickets || []).map((t: any) => (
                <li key={t.id}>
                  <Link href={`/tickets/${t.id}`}>
                    <strong>{t.number}</strong>
                    <span>{t.organization?.name} — {t.subject}</span>
                  </Link>
                </li>
              ))}
              {(!data?.tickets || data.tickets.length === 0) && <li className="muted">No tickets assigned to you.</li>}
            </ul>
          </section>
          <section className="card">
            <div className="card-head">
              <h3 className="ui">My projects</h3>
              <Link href="/projects">All</Link>
            </div>
            <ul className="feed">
              {(data?.projects || []).map((p: any) => (
                <li key={p.id}>
                  <Link href={`/projects/${p.id}`}>
                    <strong>{p.name}</strong>
                    <span>{p.organization?.name}</span>
                  </Link>
                </li>
              ))}
              {(!data?.projects || data.projects.length === 0) && <li className="muted">You are not on a project team yet.</li>}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
