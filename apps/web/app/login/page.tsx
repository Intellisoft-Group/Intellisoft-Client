'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, clearSession, setSession } from '@/lib/api';
import { PasswordField } from '@/components/PasswordField';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: { email, password, clientApp: true },
      });
      if (data.user?.role !== 'CLIENT') {
        clearSession();
        setError('Staff accounts sign in on the CMS.');
        return;
      }
      setSession(data.accessToken, data.refreshToken, data.user);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-hero">
        <Image className="login-hero-bg" src="/brand/login-hero.png" alt="" fill priority sizes="50vw" />
        <Image className="login-logo" src="/brand/logo.png" alt="Intellisoft" width={220} height={44} priority />
        <h1>Client sign in</h1>
      </div>
      <div className="login-box">
        <form className="login-card stack" onSubmit={onSubmit}>
          <h2 className="ui">Sign in</h2>
          <label className="field">
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="username" />
          </label>
          <PasswordField
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <p className="error">{error}</p>}
          <button className="btn" disabled={busy} type="submit">
            {busy ? 'Signing in…' : 'Continue'}
          </button>
          <p style={{ margin: 0, fontSize: 13 }}>
            <Link href="/forgot-password" style={{ color: 'var(--teal)' }}>Forgot password?</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
