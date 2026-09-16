'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [devToken, setDevToken] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMsg('');
    setDevToken('');
    try {
      const data = await api('/auth/forgot-password', { method: 'POST', body: { email } });
      setMsg('If that email is registered, reset instructions were sent.');
      if (data.resetToken) setDevToken(data.resetToken);
    } catch (err: any) {
      setError(err.message || 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-box" style={{ minHeight: '100vh' }}>
      <form className="login-card stack card" onSubmit={onSubmit}>
        <h2 className="ui">Forgot password</h2>
        <label className="field">
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        {msg && <p style={{ color: 'var(--ok)', fontSize: 13 }}>{msg}</p>}
        {devToken && (
          <p style={{ fontSize: 12, wordBreak: 'break-all' }}>
            Dev token:{' '}
            <Link href={`/reset-password?token=${encodeURIComponent(devToken)}`} style={{ color: 'var(--teal)' }}>
              reset password
            </Link>
          </p>
        )}
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset'}</button>
        <Link href="/login" style={{ fontSize: 13, color: 'var(--teal)' }}>Back to sign in</Link>
      </form>
    </div>
  );
}
