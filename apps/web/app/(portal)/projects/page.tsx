'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { day } from '@/lib/format';

export default function ProjectsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/projects')
      .then(setRows)
      .catch((e) => setError(e.message || 'Failed to load'));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!rows) return <p className="page-loading">Loading…</p>;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Projects</h1>
        </div>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/projects/${p.id}`} style={{ color: 'var(--teal)', fontWeight: 600 }}>
                    {p.name}
                  </Link>
                </td>
                <td><span className={`badge ${p.status}`}>{p.status}</span></td>
                <td>{day(p.updatedAt)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={3} style={{ color: 'var(--muted)' }}>No projects yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
