'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useState } from 'react';
import { api, clearSession, fileUrl, getToken, getUser, setSession } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function AccountPage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');

  async function load() {
    try {
      const data = await api('/auth/me');
      setMe(data);
      const access = getToken();
      const refresh = typeof window !== 'undefined' ? localStorage.getItem('is_client_refresh') : null;
      const session = getUser();
      if (access && refresh && session) {
        setSession(access, refresh, {
          ...session,
          name: data.name,
          email: data.email,
          avatarUrl: data.avatarUrl,
        });
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load profile');
    }
  }

  useEffect(() => { load(); }, []);

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const form = new FormData();
      form.append('file', file);
      await api('/users/me/avatar', { method: 'POST', form });
      setMsg('Avatar updated.');
      await load();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  async function onPassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await api('/auth/change-password', { method: 'POST', body: { currentPassword: current, newPassword: next } });
      setMsg('Password updated.');
      setCurrent('');
      setNext('');
    } catch (err: any) {
      setError(err.message || 'Could not change password');
    } finally {
      setBusy(false);
    }
  }

  if (!me && !error) return <p className="page-loading">Loading account…</p>;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Account</h1>
        </div>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            clearSession();
            router.push('/login');
          }}
        >
          Sign out
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {msg && <p style={{ color: 'var(--ok)', fontSize: 13 }}>{msg}</p>}

      {me && (
        <div className="split">
          <div className="card stack">
            <div className="row" style={{ alignItems: 'center' }}>
              {me.avatarUrl || me.avatarPath ? (
                <Image
                  src={me.avatarUrl || fileUrl(me.avatarPath)}
                  alt=""
                  width={64}
                  height={64}
                  unoptimized
                  style={{ borderRadius: 8, objectFit: 'cover' }}
                />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: 8, background: 'var(--sand)' }} />
              )}
              <div>
                <strong>{me.name}</strong>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>{me.email}</div>
                {me.phone && <div style={{ color: 'var(--muted)', fontSize: 13 }}>{me.phone}</div>}
              </div>
            </div>
            <label className="field">
              Update avatar
              <input type="file" accept="image/*" disabled={busy} onChange={onAvatar} />
            </label>
            {me.organization && (
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                <div><strong>Organisation</strong></div>
                <div>{me.organization.name}</div>
                {me.organization.gstin && <div>GSTIN: {me.organization.gstin}</div>}
                {me.organization.email && <div>{me.organization.email}</div>}
              </div>
            )}
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              <a className="btn ghost sm" href="/documents">Project files</a>
              <a className="btn ghost sm" href="/payments">Payment history</a>
            </div>
          </div>

          <form className="card stack" onSubmit={onPassword}>
            <h3 style={{ margin: 0 }}>Change password</h3>
            <label className="field">
              Current password
              <input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
            </label>
            <label className="field">
              New password
              <input type="password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
            </label>
            <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
          </form>
        </div>
      )}
    </>
  );
}
