'use client';

import { Suspense } from 'react';
import NewInvoicePage from './new-invoice';

export default function Page() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <NewInvoicePage />
    </Suspense>
  );
}
