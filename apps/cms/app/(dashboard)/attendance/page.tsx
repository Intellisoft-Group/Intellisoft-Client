'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { stamp } from '@/lib/format';

export default function AttendancePage() {
  const [today, setToday] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [leave, setLeave] = useState({ fromDate: '', toDate: '', reason: '' });

  async function load() {
    const [day, history, leaveRows] = await Promise.all([
      api('/attendance/today'),
      api('/attendance/me'),
      api('/attendance/leave'),
    ]);
    setToday(day);
    setRows(history);
    setLeaves(leaveRows);
  }

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, []);

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

  async function requestLeave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await api('/attendance/leave', { method: 'POST', body: leave });
      setLeave({ fromDate: '', toDate: '', reason: '' });
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const inNow = today?.status === 'IN';

  return (
    <>
      <div className="topbar">
        <div>
          <h1>My attendance</h1>
        </div>
        <div className="row">
          <button className="btn" disabled={busy || inNow} onClick={() => punch('IN')}>Punch in</button>
          <button className="btn ghost" disabled={busy || !inNow} onClick={() => punch('OUT')}>Punch out</button>
        </div>
      </div>
      {err && <p className="error">{err}</p>}
      <div className="grid-stats">
        <div className="stat"><label>Status</label><strong>{inNow ? 'In' : 'Out'}</strong></div>
        <div className="stat"><label>Hours today</label><strong>{today?.hours ?? 0}</strong></div>
        <div className="stat"><label>Last punch</label><strong style={{ fontSize: 16 }}>{stamp(today?.lastAt, '—')}</strong></div>
        <div className="stat"><label>Leave pending</label><strong>{leaves.filter((l) => l.status === 'PENDING').length}</strong></div>
      </div>
      <div className="split">
        <div className="card">
          <h3 className="ui">Punch log</h3>
          <table>
            <thead><tr><th>When</th><th>Type</th><th>Note</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{stamp(r.at)}</td>
                  <td><span className={`badge ${r.type === 'IN' ? 'ACTIVE' : ''}`}>{r.type}</span></td>
                  <td>{r.note || '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={3}>No punches yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3 className="ui">Leave</h3>
          <form className="stack" onSubmit={requestLeave} style={{ marginBottom: 16 }}>
            <label className="field">From<input type="date" required value={leave.fromDate} onChange={(e) => setLeave({ ...leave, fromDate: e.target.value })} /></label>
            <label className="field">To<input type="date" required value={leave.toDate} onChange={(e) => setLeave({ ...leave, toDate: e.target.value })} /></label>
            <label className="field">Reason<textarea required value={leave.reason} onChange={(e) => setLeave({ ...leave, reason: e.target.value })} /></label>
            <button className="btn" disabled={busy} type="submit">Request leave</button>
          </form>
          <ul className="plain">
            {leaves.map((l) => (
              <li key={l.id}>
                {String(l.fromDate).slice(0, 10)} → {String(l.toDate).slice(0, 10)} · {l.reason} · {l.status}
              </li>
            ))}
            {leaves.length === 0 && <li>No leave requests.</li>}
          </ul>
        </div>
      </div>
    </>
  );
}
