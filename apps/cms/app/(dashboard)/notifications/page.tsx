'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function NotificationsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', body: '', organizationId: '', pinAsAnnouncement: true });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    api('/notifications')
      .then((all) => {
        // Staff send page: only announcements we broadcast — not invoice/chat/system alerts.
        const sent = (Array.isArray(all) ? all : []).filter((r: any) => r.type === 'ANNOUNCEMENT');
        // One row per broadcast (API stores one notification per client recipient).
        const seen = new Set<string>();
        const unique: any[] = [];
        for (const r of sent) {
          const key = `${r.title}|${r.body}|${String(r.createdAt).slice(0, 16)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          unique.push(r);
        }
        setRows(unique);
      })
      .catch(() => setRows([]));
    api('/organizations').then(setOrgs).catch(() => setOrgs([]));
  }
  useEffect(() => { load(); }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      const res = await api('/notifications/broadcast', {
        method: 'POST',
        body: {
          title: form.title,
          body: form.body,
          organizationId: form.organizationId || undefined,
          type: 'ANNOUNCEMENT',
          pinAsAnnouncement: form.pinAsAnnouncement,
        },
      });
      setForm({ title: '', body: '', organizationId: '', pinAsAnnouncement: true });
      setMsg(`Sent to ${res.recipients || 0} clients · ${res.pushed || 0} devices notified.`);
      load();
    } catch (err: any) {
      setMsg(err.message || 'Failed to send');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Announcements</h1>
        </div>
      </div>
      <form className="card stack" style={{ marginBottom: 16 }} onSubmit={send}>
        <label className="field">Client audience
          <select value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })}>
            <option value="">All client companies</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
        <input placeholder="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea placeholder="Message" required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        <label className="check">
          <input
            type="checkbox"
            checked={form.pinAsAnnouncement}
            onChange={(e) => setForm({ ...form, pinAsAnnouncement: e.target.checked })}
          />
          Also show on the client home screen
        </label>
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send to clients'}</button>
        {msg && <p className="muted">{msg}</p>}
      </form>
      <div className="card">
        <div className="card-head">
          <h3 className="ui">Sent announcements</h3>
        </div>
        <table>
          <thead><tr><th>When</th><th>Title</th><th>Message</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{String(r.createdAt).slice(0, 16).replace('T', ' ')}</td>
                <td>{r.title}</td>
                <td className="muted">{r.body}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={3} className="muted">No announcements sent yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
