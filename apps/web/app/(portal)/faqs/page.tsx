'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function FaqsPage() {
  const [faqs, setFaqs] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/cms/bootstrap')
      .then((data) => setFaqs(data.faqs || []))
      .catch((e) => setError(e.message || 'Failed to load'));
  }, []);

  return (
    <>
      <div className="topbar">
        <div className="page-greeting">
          <p className="wish">Help centre</p>
          <h1>FAQs</h1>
        </div>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 16 }}>
        About Intellisoft, our services, billing, and support.
      </p>
      {error && <p className="error">{error}</p>}
      <div className="stack">
        {faqs.map((f) => (
          <div key={f.id} className="card">
            <h3 style={{ marginTop: 0 }}>{f.question}</h3>
            <p style={{ marginBottom: 0, color: 'var(--muted)', lineHeight: 1.55 }}>{f.answer}</p>
          </div>
        ))}
        {!faqs.length && !error && (
          <div className="card" style={{ color: 'var(--muted)' }}>No FAQs published yet.</div>
        )}
      </div>
    </>
  );
}
