'use client';

import Image from 'next/image';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setSession } from '@/lib/api';
import { homeFor } from '@/lib/roles';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [answer, setAnswer] = useState('');
  const [captcha, setCaptcha] = useState<{ question: string; token: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadCaptcha = useCallback(async () => {
    try {
      const next = await api('/auth/captcha');
      setCaptcha({ question: next.question, token: next.token });
      setAnswer('');
    } catch (e: any) {
      setError(e.message || 'Could not load the security check');
    }
  }, []);

  useEffect(() => { loadCaptcha(); }, [loadCaptcha]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!captcha?.token) {
      setError('Security check is still loading. Try again.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: {
          email,
          password,
          captchaToken: captcha.token,
          captchaAnswer: answer.trim(),
        },
      });
      if (data.user?.role === 'CLIENT') {
        setError('Client accounts sign in on the client portal.');
        await loadCaptcha();
        return;
      }
      setSession(data.accessToken, data.refreshToken, data.user);
      router.push(homeFor(data.user?.role));
    } catch (err: any) {
      setError(err.message || 'Login failed');
      await loadCaptcha();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-hero">
        <Image className="login-hero-bg" src="/brand/login-hero.png" alt="" fill priority sizes="50vw" />
        <Image className="login-logo" src="/brand/logo.png" alt="Intellisoft" width={220} height={44} priority />
        <h1>Staff sign in</h1>
      </div>
      <div className="login-box">
        <form className="login-card stack" onSubmit={onSubmit}>
          <h2 className="ui">Sign in</h2>
          <label className="field">
            Work email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="username" />
          </label>
          <label className="field">
            Password
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required autoComplete="current-password" />
          </label>
          <label className="field">
            Security check
            <span className="captcha">
              <span className="captcha-q">{captcha?.question || '…'}</span>
              <input
                required
                inputMode="numeric"
                autoComplete="off"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Answer"
              />
              <button
                className="btn ghost captcha-refresh"
                type="button"
                onClick={loadCaptcha}
                disabled={busy}
                aria-label="Refresh security check"
                title="Refresh"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 8 8h-2a6 6 0 1 1-6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z"
                  />
                </svg>
              </button>
            </span>
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn" disabled={busy || !captcha} type="submit">
            {busy ? 'Signing in…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
