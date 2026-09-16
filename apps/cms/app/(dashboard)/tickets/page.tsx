'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getUser } from '@/lib/api';
import { isAdmin } from '@/lib/roles';

export default function TicketsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [mine, setMine] = useState(false);
  const router = useRouter();
  const admin = isAdmin(getUser()?.role);

  useEffect(() => {
    const q = !admin && mine ? '?mine=1' : '';
    api(`/tickets${q}`).then(setRows);
  }, [admin, mine]);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Tickets</h1>
        </div>
        {!admin && (
          <button className="btn ghost" type="button" onClick={() => setMine((v) => !v)}>
            {mine ? 'Show all' : 'My tickets'}
          </button>
        )}
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Number</th><th>Client</th><th>Subject</th><th>Priority</th><th>Status</th><th>Assignee</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="clickable" onClick={() => router.push(`/tickets/${r.id}`)}>
                <td>{r.number}</td>
                <td>{r.organization?.name}</td>
                <td>{r.subject}</td>
                <td><span className={`badge ${r.priority}`}>{r.priority}</span></td>
                <td><span className={`badge ${r.status}`}>{r.status}</span></td>
                <td>{r.assignee?.name || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
