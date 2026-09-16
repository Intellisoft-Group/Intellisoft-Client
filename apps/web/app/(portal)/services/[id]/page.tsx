'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, money } from '@/lib/api';
import { day } from '@/lib/format';

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [row, setRow] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api(`/subscriptions/${id}`)
      .then(setRow)
      .catch((e) => setError(e.message || 'Failed to load'));
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!row) return <p className="page-loading">Loading service…</p>;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{row.catalog?.name || 'Service'}</h1>
          <p>{row.catalog?.description || 'Subscription details'}</p>
        </div>
        <Link className="btn ghost" href="/services">Back</Link>
      </div>
      <div className="card stack">
        <div><span className={`badge ${row.status}`}>{row.status}</span></div>
        <div>Start: {day(row.startDate)}</div>
        <div>Renewal: {day(row.renewalDate)}</div>
        {row.customPrice != null && <div>Custom price: {money(Number(row.customPrice))}</div>}
        {row.slaNotes && <div>SLA: {row.slaNotes}</div>}
        {row.notes && <div>Notes: {row.notes}</div>}
      </div>
    </>
  );
}
