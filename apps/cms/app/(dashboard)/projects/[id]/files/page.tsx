'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, getUser, openAuthenticatedFile } from '@/lib/api';
import { stamp } from '@/lib/format';
import { StaffName } from '@/lib/staff-name';

const PROJECT_FILE_TYPES = [
  { value: 'LOGO', label: 'Brand / logo' },
  { value: 'BRIEF', label: 'Brief / requirements' },
  { value: 'ASSET', label: 'Design asset / pack' },
  { value: 'CONTRACT', label: 'Contract / agreement' },
  { value: 'QUOTE', label: 'Proposal / quote' },
  { value: 'REPORT', label: 'Deliverable / report' },
  { value: 'TAX', label: 'Tax / compliance' },
  { value: 'OTHER', label: 'Other project file' },
] as const;

const PROJECT_ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,application/pdf,image/*,application/zip';

export default function ProjectFilesPage() {
  const { id } = useParams<{ id: string }>();
  const me = getUser();
  const [data, setData] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('ASSET');
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  function load() {
    api(`/projects/${id}/files`).then(setData);
  }
  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [data?.files?.length]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !data?.project) return;
    setErr('');
    setBusy(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('organizationId', data.project.organizationId);
    fd.append('projectId', String(id));
    fd.append('title', title.trim() || file.name);
    fd.append('type', type);
    try {
      await api('/documents', { method: 'POST', form: fd });
      setTitle('');
      setFile(null);
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p className="muted">Loading…</p>;
  const { project, files } = data;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{project.name}</h1>
          <p>{project.organization?.name} · Project files</p>
        </div>
        <div className="row">
          <Link className="btn ghost" href={`/projects/${id}`}>Project</Link>
          <Link className="btn ghost" href="/documents">All project files</Link>
          {project.chatThreadId && <Link className="btn ghost" href="/inbox">Chat</Link>}
        </div>
      </div>
      <div className="card file-board">
        <div className="chat-log file-thread" ref={logRef}>
          {files.length === 0 && (
            <p className="muted">No files on this project yet.</p>
          )}
          {files.map((f: any) => {
            const mine = f.author?.id && f.author.id === me?.id;
            const staff = f.author?.role !== 'CLIENT';
            return (
              <div key={`${f.kind}-${f.id}`} className={`bubble ${staff ? 'staff' : ''} ${mine ? 'mine' : ''}`}>
                <div className="bubble-meta">
                  <StaffName name={f.author?.name} role={f.author?.role} jobTitle={f.author?.jobTitle} avatarUrl={f.author?.avatarUrl} avatarPath={f.author?.avatarPath} />
                  <span>{f.authorLabel} · {stamp(f.createdAt)}</span>
                </div>
                {f.caption && <p>{f.caption}</p>}
                {f.type && f.type !== 'OTHER' && (
                  <p className="muted" style={{ margin: '0 0 6px', fontSize: 12 }}>
                    {PROJECT_FILE_TYPES.find((t) => t.value === f.type)?.label || f.type}
                  </p>
                )}
                <div className="chat-file">
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => openAuthenticatedFile(f.openPath, f.fileName || f.title).catch((e) => setErr(e.message))}
                  >
                    {f.fileName || f.title}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <form className="composer file-composer" onSubmit={upload}>
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="File category">
            {PROJECT_FILE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" />
          <input
            type="file"
            required
            accept={PROJECT_ACCEPT}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</button>
        </form>
        <p className="muted" style={{ padding: '0 16px 12px', margin: 0, fontSize: 12 }}>
          PDF, images (incl. SVG), Office, CSV, TXT, ZIP · max 25 MB
        </p>
        {err && <p className="error" style={{ padding: '0 16px 12px' }}>{err}</p>}
      </div>
    </>
  );
}
