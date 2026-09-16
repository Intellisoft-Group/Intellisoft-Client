'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { api } from '@/lib/api';
import { PasswordField } from '@/components/PasswordField';

function ResetInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initialToken = useMemo(() => params.get('token') || '', [params]);
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, password } });
      router.push('/login');
    } catch (err: any) {
      setError(err.message || 'Reset failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="login-card stack card" onSubmit={onSubmit}>
      <h2 className="ui">Reset password</h2>
      <label className="field">
        Reset token
        <input required value={token} onChange={(e) => setToken(e.target.value)} />
      </label>
      <PasswordField
        label="New password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
      />
      {error && <p className="error">{error}</p>}
      <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
      <Link href="/login" style={{ fontSize: 13, color: 'var(--teal)' }}>Back to sign in</Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="login-box" style={{ minHeight: '100vh' }}>
      <Suspense fallback={<p className="page-loading">Loading…</p>}>
        <ResetInner />
      </Suspense>
    </div>
  );
}
