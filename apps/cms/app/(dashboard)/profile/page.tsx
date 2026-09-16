'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, getToken, getUser, setSession } from '@/lib/api';
import { PasswordField } from '@/components/PasswordField';

export default function ProfilePage() {
  const [me, setMe] = useState<any>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');

  function syncSession(data: any) {
    const access = getToken();
    const refresh = typeof window !== 'undefined' ? localStorage.getItem('is_refresh') : null;
    const session = getUser();
    if (access && refresh && session) {
      setSession(access, refresh, {
        ...session,
        name: data.name,
        email: data.email,
        phone: data.phone,
        avatarUrl: data.avatarUrl,
        jobTitle: data.jobTitle,
      });
    }
  }

  async function load() {
    try {
      const data = await api('/auth/me');
      setMe(data);
      setName(data.name || '');
      setPhone(data.phone || '');
      syncSession(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load profile');
    }
  }

  useEffect(() => { load(); }, []);

  async function onProfile(e: FormEvent) {
    e.preventDefault();
    setProfileBusy(true);
    setError('');
    setMsg('');
    try {
      const data = await api('/users/me', {
        method: 'PATCH',
        body: { name: name.trim(), phone: phone.trim() || null },
      });
      setMe(data);
      syncSession(data);
      setMsg('Profile updated.');
    } catch (err: any) {
      setError(err.message || 'Could not update profile');
    } finally {
      setProfileBusy(false);
    }
  }

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileBusy(true);
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
      setProfileBusy(false);
      e.target.value = '';
    }
  }

  async function onPassword(e: FormEvent) {
    e.preventDefault();
    setPasswordBusy(true);
    setError('');
    setMsg('');
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword: current, newPassword: next },
      });
      setMsg('Password updated.');
      setCurrent('');
      setNext('');
    } catch (err: any) {
      setError(err.message || 'Could not change password');
    } finally {
      setPasswordBusy(false);
    }
  }

  if (!me && !error) return <p className="page-loading">Loading profile…</p>;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>My profile</h1>
          <p>Update how your name appears across the CMS</p>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {msg && <p style={{ color: 'var(--ok)', fontSize: 13 }}><strong>{msg}</strong></p>}

      {me && (
        <div className="split">
          <form className="card stack" onSubmit={onProfile}>
            <label className="field">
              Your name
              <input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
            <label className="field">
              Phone
              <input value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </label>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>{me.email} · {String(me.role || '').replaceAll('_', ' ')}</p>
            <button className="btn" type="submit" disabled={profileBusy}>{profileBusy ? 'Saving…' : 'Save profile'}</button>
            <label className="field">
              Profile photo
              <input type="file" accept="image/*" disabled={profileBusy} onChange={onAvatar} />
            </label>
          </form>

          <form className="card stack" onSubmit={onPassword}>
            <h3 className="ui" style={{ margin: 0 }}>Change password</h3>
            <PasswordField
              label="Current password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
            />
            <PasswordField
              label="New password"
              required
              minLength={8}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
            />
            <button className="btn" type="submit" disabled={passwordBusy}>{passwordBusy ? 'Saving…' : 'Update password'}</button>
          </form>
        </div>
      )}
    </>
  );
}
