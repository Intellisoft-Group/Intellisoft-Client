import { Suspense } from 'react';
import InboxView from './inbox-view';

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="page-loading">Loading inbox…</div>}>
      <InboxView />
    </Suspense>
  );
}
