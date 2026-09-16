'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function ClientFilesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [org, setOrg] = useState<any>(null);
  const [projects, setProjects] = useState<any[] | null>(null);

  useEffect(() => {
    api(`/organizations/${id}`).then(setOrg);
    api(`/projects?organizationId=${id}`).then((rows) => {
      const list = Array.isArray(rows) ? rows : [];
      setProjects(list);
      if (list.length === 1) router.replace(`/projects/${list[0].id}/files`);
    });
  }, [id, router]);

  if (!org || projects === null) return <p>Loading…</p>;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{org.name} files</h1>
        </div>
        <Link className="btn ghost" href={`/clients/${id}`}>Back to client</Link>
      </div>
      <div className="card">
        {projects.length === 0 ? (
          <p className="muted">This client has no projects yet. Create one under Projects, then files can be shared there.</p>
        ) : (
          <table>
            <thead><tr><th>Project</th><th>Status</th><th>Files</th><th></th></tr></thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => router.push(`/projects/${p.id}/files`)}>
                  <td>{p.name}</td>
                  <td><span className={`badge ${p.status}`}>{p.status}</span></td>
                  <td>{p._count?.documents ?? '—'}</td>
                  <td><Link className="btn sm" href={`/projects/${p.id}/files`} onClick={(e) => e.stopPropagation()}>Open files</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
