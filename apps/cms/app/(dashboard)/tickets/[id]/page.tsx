'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, getUser } from '@/lib/api';
import { canSee } from '@/lib/roles';
import { StaffName } from '@/lib/staff-name';

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [t, setT] = useState<any>(null);
  const [body, setBody] = useState('');
  const [staff, setStaff] = useState<any[]>([]);
  // Matches API PATCH /tickets/:id — SUPER_ADMIN + SUPPORT only.
  const canManage = canSee(getUser()?.role, ['SUPER_ADMIN', 'SUPPORT']);

  function load() {
    api(`/tickets/${id}`).then(setT);
  }
  useEffect(() => {
    load();
    if (canManage) {
      api('/users/staff').then(setStaff).catch(() => setStaff([]));
    }
  }, [id, canManage]);

  async function reply(e: React.FormEvent) {
    e.preventDefault();
    await api(`/tickets/${id}/messages`, { method: 'POST', body: { body } });
    setBody('');
    load();
  }

  async function patch(data: any) {
    await api(`/tickets/${id}`, { method: 'PATCH', body: data });
    load();
  }

  if (!t) return <p>Loading…</p>;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{t.number}</h1>
          <p>
            {t.subject} · {t.organization?.name}
            {t.subscription?.catalog?.name ? ` · ${t.subscription.catalog.name}` : ''}
          </p>
        </div>
        {canManage ? (
          <div className="row">
            <select value={t.status} onChange={(e) => patch({ status: e.target.value })}>
              {['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'].map((s) => <option key={s}>{s}</option>)}
            </select>
            <select value={t.assigneeId || ''} onChange={(e) => patch({ assigneeId: e.target.value || null })}>
              <option value="">Unassigned</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        ) : (
          <span className={`badge ${t.status}`}>{String(t.status || '').replaceAll('_', ' ')}</span>
        )}
      </div>
      {t.subscription && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="ui">Linked service</h3>
          <p>{t.subscription.catalog?.name} · {t.subscription.status}</p>
          {t.subscription.slaNotes && <p className="muted">{t.subscription.slaNotes}</p>}
        </div>
      )}
      <div className="card stack" style={{ marginBottom: 16 }}>
        {t.messages?.map((m: any) => (
          <div key={m.id}>
            <StaffName name={m.author?.name} role={m.author?.role} jobTitle={m.author?.jobTitle} avatarUrl={m.author?.avatarUrl} avatarPath={m.author?.avatarPath} />
            <span style={{ color: 'var(--muted)', fontSize: 12 }}> · {m.author?.role} · {String(m.createdAt).slice(0, 16)}</span>
            <p>{m.body}</p>
          </div>
        ))}
      </div>
      <form className="card stack" onSubmit={reply}>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Reply to the client…" required />
        <button className="btn" type="submit">Send reply</button>
      </form>
    </>
  );
}
