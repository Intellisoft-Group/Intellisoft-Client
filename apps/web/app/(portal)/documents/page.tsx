'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, openAuthenticatedFile } from '@/lib/api';
import { day } from '@/lib/format';

export default function DocumentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [uploadErr, setUploadErr] = useState('');
  const [uploadMsg, setUploadMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    try {
      const [docs, projs] = await Promise.all([
        api('/documents'),
        api('/projects').catch(() => []),
      ]);
      setRows(Array.isArray(docs) ? docs : []);
      setProjects(Array.isArray(projs) ? projs : []);
      if (!projectId && Array.isArray(projs) && projs[0]?.id) setProjectId(projs[0].id);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setUploadErr('Choose a file to upload');
      return;
    }
    if (!projectId) {
      setUploadErr('Select a project.');
      return;
    }
    setBusy(true);
    setUploadErr('');
    setUploadMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('projectId', projectId);
      fd.append('title', title.trim() || file.name);
      fd.append('type', 'OTHER');
      await api('/documents', { method: 'POST', form: fd });
      setFile(null);
      setTitle('');
      setUploadMsg('Upload complete.');
      await load();
    } catch (err: any) {
      setUploadErr(err.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Documents</h1>
          <p>Organisation and project files.</p>
        </div>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Upload</h3>
        {!projects.length ? (
          <p style={{ color: 'var(--muted)', margin: 0 }}>
            No active projects available. Open{' '}
            <Link href="/projects" style={{ color: 'var(--teal)' }}>Projects</Link> when one is assigned.
          </p>
        ) : (
          <form className="form-grid" onSubmit={upload}>
            <label className="field">
              Project
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" />
            </label>
            <label className="field span-2">
              File
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,application/pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
            {uploadErr && <p className="error span-2">{uploadErr}</p>}
            {uploadMsg && <p className="span-2" style={{ color: 'var(--ok)', margin: 0 }}>{uploadMsg}</p>}
            <button className="btn" type="submit" disabled={busy || !file}>
              {busy ? 'Uploading…' : 'Upload'}
            </button>
          </form>
        )}
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Project</th>
              <th>Category</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>{d.title || d.fileName}</td>
                <td>
                  {d.project?.id ? (
                    <Link href={`/projects/${d.project.id}`} style={{ color: 'var(--teal)' }}>
                      {d.project.name}
                    </Link>
                  ) : '—'}
                </td>
                <td>{d.type || '—'}</td>
                <td>{day(d.createdAt)}</td>
                <td>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() =>
                      openAuthenticatedFile(`/documents/${d.id}/file`, d.fileName).catch((e) =>
                        setError(e.message),
                      )
                    }
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && !error && (
              <tr><td colSpan={5} style={{ color: 'var(--muted)' }}>No documents yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
