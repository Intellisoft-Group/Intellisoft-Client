'use client';

import { useEffect, useState } from 'react';
import { api, getUser } from '@/lib/api';
import { PasswordField } from '@/components/PasswordField';

const STAFF_ROLES = ['SUPER_ADMIN', 'FINANCE', 'SUPPORT', 'SALES'] as const;

export default function StaffPage() {
  const me = getUser<{ id?: string }>();
  const [rows, setRows] = useState<any[]>([]);
  const [titles, setTitles] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', email: '', role: 'SUPPORT', jobTitle: '', password: '' });
  const [newTitle, setNewTitle] = useState('');
  const [temp, setTemp] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    api('/users/staff').then(setRows).catch((e) => setErr(e.message));
    api('/users/titles').then(setTitles).catch(() => setTitles([]));
  }
  useEffect(() => { load(); }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setMsg('');
    try {
      const res = await api('/users/staff', { method: 'POST', body: form });
      setTemp(res.temporaryPassword || 'Password provided');
      setForm({ name: '', email: '', role: 'SUPPORT', jobTitle: form.jobTitle, password: '' });
      setMsg('Staff member invited.');
      load();
    } catch (e: any) {
      setErr(e.message || 'Invite failed');
    }
  }

  async function toggle(row: any) {
    setErr('');
    setMsg('');
    try {
      await api(`/users/staff/${row.id}`, { method: 'PATCH', body: { isActive: !row.isActive } });
      setMsg(row.isActive ? `${row.name} disabled` : `${row.name} enabled`);
      load();
    } catch (e: any) {
      setErr(e.message || 'Could not update status');
    }
  }

  async function setTitle(row: any, jobTitle: string) {
    await api(`/users/staff/${row.id}`, { method: 'PATCH', body: { jobTitle } });
    load();
  }

  async function setRole(row: any, role: string) {
    setErr('');
    try {
      await api(`/users/staff/${row.id}`, { method: 'PATCH', body: { role } });
      load();
    } catch (e: any) {
      setErr(e.message || 'Could not update role');
    }
  }

  async function rename(row: any) {
    setErr('');
    setMsg('');
    const entered = window.prompt('Staff member name:', row.name || '');
    if (entered == null) return;
    const name = entered.trim();
    if (!name) {
      setErr('Name is required');
      return;
    }
    if (name === row.name) return;
    try {
      await api(`/users/staff/${row.id}`, { method: 'PATCH', body: { name } });
      setMsg(`Name updated to "${name}"`);
      load();
    } catch (e: any) {
      setErr(e.message || 'Could not update name');
    }
  }

  async function setPassword(row: any, mode: 'set' | 'reset') {
    setErr('');
    setMsg('');
    let password: string | undefined;
    if (mode === 'set') {
      const entered = window.prompt(`Enter new password for ${row.email} (min 8 characters):`);
      if (entered == null) return;
      password = entered.trim();
      if (password.length < 8) {
        setErr('Password must be at least 8 characters');
        return;
      }
    } else if (!window.confirm(`Generate a temporary password for ${row.email}?`)) {
      return;
    }
    setBusyId(row.id);
    try {
      const res = await api(`/users/staff/${row.id}/password`, {
        method: 'POST',
        body: {
          ...(password ? { password } : {}),
          notify: true,
        },
      });
      if (res.temporaryPassword) {
        setTemp(res.temporaryPassword);
        setMsg(`Temporary password for ${res.email}: ${res.temporaryPassword}`);
      } else {
        setMsg(`Password updated for ${res.email}. Share it securely.`);
      }
      load();
    } catch (e: any) {
      setErr(e.message || 'Could not update password');
    } finally {
      setBusyId(null);
    }
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
          <p>Create internal team accounts, set access, disable logins, and reset passwords</p>
        </div>
      </div>
      {err && <p className="error">{err}</p>}
      {msg && <p style={{ color: 'var(--ok)', fontSize: 13 }}><strong>{msg}</strong></p>}
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
        <div className="field form-actions">
          <span className="form-actions-label" aria-hidden="true">&nbsp;</span>
          <button className="btn sm" type="submit">Add title</button>
        </div>
      </form>
      <form className="card form-grid" style={{ marginBottom: 16 }} onSubmit={invite}>
        <label className="field">Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="field">Email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="field">Access role
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {STAFF_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="field">Job title
          <select value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}>
            <option value="">Select</option>
            {titles.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </label>
        <PasswordField
          label="Password (optional)"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          autoComplete="new-password"
          placeholder="Blank = temporary password"
        />
        <div className="field form-actions">
          <span className="form-actions-label" aria-hidden="true">&nbsp;</span>
          <button className="btn sm" type="submit">Invite staff</button>
        </div>
      </form>
      {temp && <p>Temporary password: <strong>{temp}</strong></p>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Profile</th>
              <th>Email</th>
              <th>Access</th>
              <th>Title</th>
              <th>Photo</th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
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
                <td>
                  <select
                    value={r.role}
                    disabled={r.id === me?.id}
                    onChange={(e) => setRole(r, e.target.value)}
                  >
                    {STAFF_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                </td>
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
                  <button
                    className="btn sm ghost"
                    type="button"
                    disabled={r.id === me?.id}
                    onClick={() => toggle(r)}
                  >
                    {r.isActive ? 'Disable' : 'Enable'}
                  </button>
                </td>
                <td>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" className="btn sm ghost" onClick={() => rename(r)}>Edit name</button>
                    <button
                      type="button"
                      className="btn sm"
                      disabled={busyId === r.id}
                      onClick={() => setPassword(r, 'set')}
                    >
                      Set password
                    </button>
                    <button
                      type="button"
                      className="btn sm ghost"
                      disabled={busyId === r.id}
                      onClick={() => setPassword(r, 'reset')}
                    >
                      Reset
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
