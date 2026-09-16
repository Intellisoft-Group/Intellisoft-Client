'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, money, openAuthenticatedFile } from '@/lib/api';
import { day } from '@/lib/format';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploadErr, setUploadErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [fileType, setFileType] = useState('ASSET');
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const [p, feed] = await Promise.all([
        api(`/projects/${id}`),
        api(`/projects/${id}/files`).catch(() => ({ files: [] })),
      ]);
      setProject(p);
      const list = Array.isArray(feed?.files) ? feed.files : p.files || [];
      setFiles(list);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !id) {
      setUploadErr('Choose a file to upload');
      return;
    }
    setBusy(true);
    setUploadErr('');
    setUploadMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('projectId', id);
      fd.append('title', title.trim() || file.name);
      fd.append('type', fileType);
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

  if (error) return <p className="error">{error}</p>;
  if (!project) return <p className="page-loading">Loading project…</p>;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{project.name}</h1>
          <p>{project.description || 'Project details'}</p>
        </div>
        <Link className="btn ghost" href="/projects">Back</Link>
      </div>

      <div className="grid-stats" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div className="stat">
          <label>Status</label>
          <strong><span className={`badge ${project.status}`}>{project.status?.replaceAll('_', ' ')}</span></strong>
        </div>
        <div className="stat">
          <label>Files</label>
          <strong>{files.length}</strong>
        </div>
      </div>

      {!!project.paymentStages?.filter((s: any) => s.invoice?.id || ['INVOICED', 'PAID'].includes(s.status)).length && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Invoices for this project</h3>
          <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: 14 }}>
            Payments are cleared from Bills. Open an invoice below to pay or download the PDF.
          </p>
          <table>
            <thead>
              <tr>
                <th>Stage</th>
                <th>Invoice</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {project.paymentStages
                .filter((s: any) => s.invoice?.id || ['INVOICED', 'PAID'].includes(s.status))
                .map((s: any) => (
                <tr key={s.id}>
                  <td>{s.title || s.name || 'Stage'}</td>
                  <td>
                    {s.invoice?.id ? (
                      <Link href={`/bills/${s.invoice.id}`} style={{ color: 'var(--teal)' }}>
                        {s.invoice.number || 'View'}
                      </Link>
                    ) : '—'}
                  </td>
                  <td>
                    <span className={`badge ${s.invoice?.status || s.status}`}>
                      {s.invoice?.status === 'SENT' ? 'Pending' : (s.invoice?.status || s.status || '').replaceAll('_', ' ')}
                    </span>
                  </td>
                  <td>{money(s.amount, project.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Project files</h3>
        <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: 14 }}>
          Logos, briefs, contracts, and delivery assets (maximum 25 MB).
        </p>
        <form className="form-grid" onSubmit={upload}>
          <label className="field">
            Category
            <select value={fileType} onChange={(e) => setFileType(e.target.value)}>
              <option value="LOGO">Brand / logo</option>
              <option value="BRIEF">Brief / requirements</option>
              <option value="ASSET">Design asset / pack</option>
              <option value="CONTRACT">Contract / agreement</option>
              <option value="QUOTE">Proposal / quote</option>
              <option value="REPORT">Deliverable / report</option>
              <option value="TAX">Tax / compliance</option>
              <option value="OTHER">Other project file</option>
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
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,application/pdf,image/*,application/zip"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          {uploadErr && <p className="error span-2">{uploadErr}</p>}
          {uploadMsg && <p className="span-2" style={{ color: 'var(--ok)', margin: 0 }}>{uploadMsg}</p>}
          <button className="btn" type="submit" disabled={busy || !file}>
            {busy ? 'Uploading…' : 'Upload'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Files</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>From</th>
              <th>Uploaded</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {files.map((f: any) => (
              <tr key={`${f.kind || 'document'}-${f.id}`}>
                <td>{f.fileName || f.title || 'File'}</td>
                <td>{f.authorLabel || (f.source === 'CLIENT' ? 'You' : f.uploadedBy?.name || 'Team')}</td>
                <td>{day(f.createdAt)}</td>
                <td>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() =>
                      openAuthenticatedFile(
                        f.openPath || `/documents/${f.id}/file`,
                        f.fileName || f.title,
                      ).catch((e) => setError(e.message))
                    }
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
            {!files.length && (
              <tr><td colSpan={4} style={{ color: 'var(--muted)' }}>No files shared yet. Upload above to share with Intellisoft.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
