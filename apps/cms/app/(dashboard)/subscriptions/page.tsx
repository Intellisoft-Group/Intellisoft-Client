import { Suspense } from 'react';
import SubscriptionsPage from './subscriptions-view';

export default function Page() {
  return (
    <Suspense fallback={<p className="page-loading">Loading subscriptions…</p>}>
      <SubscriptionsPage />
    </Suspense>
  );
}
