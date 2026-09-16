'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Renewals live under Subscriptions → Renewals tab. */
export default function RenewalsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/subscriptions?tab=renewals');
  }, [router]);
  return <p className="page-loading">Opening renewals…</p>;
}
