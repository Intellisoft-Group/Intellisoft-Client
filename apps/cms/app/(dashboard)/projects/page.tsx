'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getUser } from '@/lib/api';
import { isAdmin } from '@/lib/roles';

export default function ProjectsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [mine, setMine] = useState(false);
  const [form, setForm] = useState({ organizationId: '', name: '', description: '', status: 'PLANNED' });
  const router = useRouter();
  const admin = isAdmin(getUser()?.role);

  function load() {
    const q = !admin && mine ? '?mine=1' : '';
    api(`/projects${q}`).then(setRows);
    api('/organizations').then(setOrgs);
  }
  useEffect(() => { load(); }, [admin, mine]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const p = await api('/projects', { method: 'POST', body: form });
    router.push(`/projects/${p.id}`);
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Projects</h1>
        </div>
        {!admin && (
          <button className="btn ghost" type="button" onClick={() => setMine((v) => !v)}>
            {mine ? 'Show all' : 'My projects'}
          </button>
        )}
      </div>
      <form className="card form-grid" style={{ marginBottom: 16 }} onSubmit={create}>
        <label className="field">Client
          <select required value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })}>
            <option value="">Select</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
        <label className="field">Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="field span-2">Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <button className="btn" type="submit">Create project</button>
      </form>
      <div className="card">
        <table>
          <thead><tr><th>Project</th><th>Client</th><th>Members</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="clickable" onClick={() => router.push(`/projects/${r.id}`)}>
                <td>{r.name}</td>
                <td>{r.organization?.name}</td>
                <td>{r._count?.members ?? 0}</td>
                <td><span className={`badge ${r.status}`}>{r.status}</span></td>
                <td>
                  <button
                    className="btn sm ghost"
                    type="button"
                    onClick={(e) => { e.stopPropagation(); router.push(`/projects/${r.id}/files`); }}
                  >
                    Files
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
