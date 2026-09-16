'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function StaffPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [titles, setTitles] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', email: '', role: 'SUPPORT', jobTitle: '', password: '' });
  const [newTitle, setNewTitle] = useState('');
  const [temp, setTemp] = useState('');
  const [err, setErr] = useState('');

  function load() {
    api('/users/staff').then(setRows).catch((e) => setErr(e.message));
    api('/users/titles').then(setTitles).catch(() => setTitles([]));
  }
  useEffect(() => { load(); }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const res = await api('/users/staff', { method: 'POST', body: form });
    setTemp(res.temporaryPassword || 'Password provided');
    setForm({ name: '', email: '', role: 'SUPPORT', jobTitle: form.jobTitle, password: '' });
    load();
  }

  async function toggle(row: any) {
    await api(`/users/staff/${row.id}`, { method: 'PATCH', body: { isActive: !row.isActive } });
    load();
  }

  async function setTitle(row: any, jobTitle: string) {
    await api(`/users/staff/${row.id}`, { method: 'PATCH', body: { jobTitle } });
    load();
  }

  async function addTitle(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await api('/users/titles', { method: 'POST', body: { name: newTitle.trim() } });
    setNewTitle('');
    load();
  }

  async function removeTitle(id: string) {
    await api(`/users/titles/${id}`, { method: 'DELETE' });
    load();
  }

  async function uploadPhoto(id: string, file?: File | null) {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    await api(`/users/${id}/avatar`, { method: 'POST', form: fd });
    load();
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Staff & roles</h1>
        </div>
      </div>
      {err && <p className="error">{err}</p>}
      <form className="card form-grid" style={{ marginBottom: 16 }} onSubmit={addTitle}>
        <label className="field span-2">Job titles
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {titles.map((t) => (
              <span key={t.id} className="badge">
                {t.name}{' '}
                <button type="button" className="btn sm ghost" onClick={() => removeTitle(t.id)}>×</button>
              </span>
            ))}
          </div>
        </label>
        <label className="field">New title<input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Team Lead" /></label>
        <button className="btn" type="submit">Add title</button>
      </form>
      <form className="card form-grid" style={{ marginBottom: 16 }} onSubmit={invite}>
        <label className="field">Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="field">Email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="field">Access role
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option>SUPER_ADMIN</option><option>FINANCE</option><option>SUPPORT</option><option>SALES</option>
          </select>
        </label>
        <label className="field">Job title
          <select value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}>
            <option value="">Select</option>
            {titles.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </label>
        <label className="field">Password (optional)<input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        <button className="btn" type="submit">Invite staff</button>
      </form>
      {temp && <p>Temporary password: <strong>{temp}</strong></p>}
      <div className="card">
        <table>
          <thead><tr><th>Profile</th><th>Email</th><th>Access</th><th>Title</th><th>Photo</th><th>Active</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="staff-name">
                    {r.avatarUrl ? <img className="profile-pic" src={r.avatarUrl} alt="" /> : <span className="profile-pic profile-pic-fallback">{r.name?.slice(0, 1)}</span>}
                    {r.name}
                  </span>
                </td>
                <td>{r.email}</td>
                <td>{r.role}</td>
                <td>
                  <select value={r.jobTitle || ''} onChange={(e) => setTitle(r, e.target.value)}>
                    <option value="">—</option>
                    {titles.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                </td>
                <td>
                  <input type="file" accept="image/*" onChange={(e) => uploadPhoto(r.id, e.target.files?.[0])} />
                </td>
                <td>
                  {r.isActive ? 'Yes' : 'No'}{' '}
                  <button className="btn sm ghost" onClick={() => toggle(r)}>{r.isActive ? 'Disable' : 'Enable'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
