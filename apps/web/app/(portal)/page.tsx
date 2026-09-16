'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, getUser, money } from '@/lib/api';
import { day, displayPersonName, greeting } from '@/lib/format';

export default function HomePage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(() => (typeof window !== 'undefined' ? getUser() : null));

  useEffect(() => {
    api('/home')
      .then((home) => {
        setData(home);
        if (home?.user) setUser((prev: any) => ({ ...(prev || {}), ...home.user }));
      })
      .catch((e) => setError(e.message || 'Failed to load'));
    api('/auth/me')
      .then((me) => setUser(me))
      .catch(() => {});
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="page-loading">Loading home…</p>;

  const wish = greeting();
  const name = displayPersonName(user?.name || data.user?.name);

  return (
    <>
      <div className="topbar">
        <div className="page-greeting">
          <p className="wish">{wish}</p>
          <h1>{name || 'Account'}</h1>
        </div>
      </div>

      <div className="grid-stats">
        <div className="stat">
          <label>Amount due</label>
          <strong>{money(data.dueTotal)}</strong>
        </div>
        <div className="stat">
          <label>Unpaid bills</label>
          <strong>{data.unpaidCount}</strong>
        </div>
        <div className="stat">
          <label>Overdue</label>
          <strong>{data.overdueCount}</strong>
        </div>
        <div className="stat">
          <label>Active services</label>
          <strong>{data.activeServices}</strong>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Recent bills</h3>
          <Link className="btn ghost sm" href="/bills">View all</Link>
        </div>
        <table>
          <thead>
            <tr>
              <th>Number</th>
              <th>Status</th>
              <th>Due</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {(data.invoices || []).map((inv: any) => (
              <tr key={inv.id} className="clickable" onClick={() => { window.location.href = `/bills/${inv.id}`; }}>
                <td>{inv.number}</td>
                <td><span className={`badge ${inv.status}`}>{inv.status}</span></td>
                <td>{day(inv.dueDate)}</td>
                <td>{money(inv.amountDue ?? inv.total, inv.currency)}</td>
              </tr>
            ))}
            {!data.invoices?.length && (
              <tr><td colSpan={4} style={{ color: 'var(--muted)' }}>No invoices yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
