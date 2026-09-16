'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

function timeLabel(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function TeamPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [err, setErr] = useState('');

  async function load() {
    const [team, leaveRows] = await Promise.all([
      api('/attendance/team'),
      api('/attendance/leave'),
    ]);
    setRows(team);
    setLeaves(leaveRows);
  }

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, []);

  async function decide(id: string, status: 'APPROVED' | 'REJECTED') {
    await api(`/attendance/leave/${id}`, { method: 'PATCH', body: { status } });
    load();
  }

  const inCount = rows.filter((r) => r.status === 'IN').length;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Team attendance</h1>
        </div>
        <Link className="btn ghost" href="/staff">Staff & roles</Link>
      </div>
      {err && <p className="error">{err}</p>}
      <div className="grid-stats">
        <div className="stat"><label>Team</label><strong>{rows.length}</strong></div>
        <div className="stat"><label>Punched in</label><strong>{inCount}</strong></div>
        <div className="stat"><label>Out / not in</label><strong>{rows.length - inCount}</strong></div>
        <div className="stat"><label>Leave pending</label><strong>{leaves.filter((l) => l.status === 'PENDING').length}</strong></div>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last punch</th>
              <th>Hours</th>
              <th>Tickets</th>
              <th>Projects</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.name}</strong>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{r.email}</div>
                </td>
                <td>{String(r.role).replaceAll('_', ' ')}</td>
                <td><span className={`badge ${r.status === 'IN' ? 'ACTIVE' : ''}`}>{r.status === 'IN' ? 'IN' : 'OUT'}</span></td>
                <td>{timeLabel(r.lastAt)}</td>
                <td>{r.hours ?? 0}</td>
                <td>{r.openTickets ?? 0}</td>
                <td>{r.projects ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3 className="ui">Leave requests</h3>
        <table>
          <thead><tr><th>Employee</th><th>From</th><th>To</th><th>Reason</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {leaves.map((l) => (
              <tr key={l.id}>
                <td>{l.user?.name}</td>
                <td>{String(l.fromDate).slice(0, 10)}</td>
                <td>{String(l.toDate).slice(0, 10)}</td>
                <td>{l.reason}</td>
                <td>{l.status}</td>
                <td>
                  {l.status === 'PENDING' && (
                    <div className="row">
                      <button className="btn sm" onClick={() => decide(l.id, 'APPROVED')}>Approve</button>
                      <button className="btn sm ghost" onClick={() => decide(l.id, 'REJECTED')}>Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {leaves.length === 0 && <tr><td colSpan={6}>No leave requests.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
