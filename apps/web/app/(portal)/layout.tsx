'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearSession, getUser } from '@/lib/api';
import { NAV, navActive } from '@/lib/nav';

/** Calm gate — no shimmering skeleton shell (that flashed after login). */
function AuthGate() {
  return (
    <div className="auth-gate" aria-busy="true" aria-live="polite">
      <p className="page-loading">Loading portal…</p>
    </div>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'CLIENT') {
      clearSession();
      router.replace('/login');
      return;
    }
    setUser(u);
    setReady(true);
  }, [router]);

  useEffect(() => {
    const sync = () => {
      const u = getUser();
      if (u && u.role === 'CLIENT') setUser(u);
    };
    sync();
    window.addEventListener('is-session-updated', sync);
    return () => window.removeEventListener('is-session-updated', sync);
  }, [pathname]);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!ready || !user) return <AuthGate />;

  return (
    <div className={`shell ${open ? 'nav-open' : ''}`}>
      <header className="mobile-topbar">
        <div className="mobile-topbar-brand">
          <Image className="mobile-topbar-logo" src="/brand/logo.png" alt="Intellisoft" width={150} height={30} priority />
          <span className="mobile-topbar-role">Client</span>
        </div>
        <div className="mobile-topbar-actions">
          {!open ? (
            <button className="nav-toggle ui" type="button" onClick={() => setOpen(true)} aria-label="Open menu">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path fill="currentColor" d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" />
              </svg>
            </button>
          ) : (
            <button className="nav-close ui" type="button" onClick={() => setOpen(false)} aria-label="Close menu">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path fill="currentColor" d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z" />
              </svg>
            </button>
          )}
        </div>
      </header>
      <aside className={`sidebar ui ${open ? 'open' : ''}`}>
        <div className="brand sidebar-brand">
          <Image className="brand-logo" src="/brand/logo.png" alt="Intellisoft" width={220} height={34} priority />
          <span>Client</span>
        </div>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link ${navActive(pathname, item.href) ? 'active' : ''}`}
          >
            <span className="nav-ico">{item.icon}</span>
            {item.label}
          </Link>
        ))}
        <div className="spacer" />
        <div className="user-chip">
          {user.name}
          <br />
          {user.email}
        </div>
        <button
          className="btn ghost"
          style={{ color: '#fff', borderColor: 'rgba(255,255,255,.2)' }}
          onClick={() => {
            clearSession();
            router.push('/login');
          }}
        >
          Sign out
        </button>
      </aside>
      {open && <div className="nav-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
      <div className="main">{children}</div>
    </div>
  );
}
