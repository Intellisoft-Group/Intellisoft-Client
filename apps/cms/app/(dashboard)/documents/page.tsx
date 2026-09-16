'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, getUser, openAuthenticatedFile } from '@/lib/api';
import { canSee, ROLE_GROUPS } from '@/lib/roles';
import { StaffName } from '@/lib/staff-name';

/** Project file categories mapped to DocumentType. */
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

function typeLabel(value: string) {
  return PROJECT_FILE_TYPES.find((t) => t.value === value)?.label || value;
}

export default function DocumentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('ASSET');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const canProjects = canSee(getUser()?.role, ROLE_GROUPS.delivery);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId],
  );

  function load() {
    const q = new URLSearchParams();
    if (filterProject) q.set('projectId', filterProject);
    api(`/documents${q.toString() ? `?${q}` : ''}`).then((docs) => {
      const list = Array.isArray(docs) ? docs : [];
      // Project documents library — prefer rows linked to a project.
      setRows(filterProject ? list : list.filter((d: any) => d.projectId || d.project?.id));
    });
    if (canProjects) {
      api('/projects')
        .then((rows) => {
          const list = Array.isArray(rows) ? rows : [];
          setProjects(list);
          if (!projectId && list[0]?.id) setProjectId(list[0].id);
        })
        .catch(() => setProjects([]));
    } else {
      setProjects([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterProject, canProjects]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMsg('');
    if (!file) {
      setError('Select a file.');
      return;
    }
    if (!projectId || !selectedProject?.organizationId) {
      setError('Select a project.');
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('organizationId', selectedProject.organizationId);
      fd.append('projectId', projectId);
      fd.append('title', title.trim() || file.name);
      fd.append('type', type);
      await api('/documents', { method: 'POST', form: fd });
      setTitle('');
      setFile(null);
      setMsg('File uploaded to the project.');
      load();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Project files</h1>
          <p>Logos, briefs, contracts, and delivery assets linked to a client project.</p>
        </div>
      </div>

      <form className="card form-grid" style={{ marginBottom: 16 }} onSubmit={upload}>
        <label className="field span-2">
          Project
          <select
            required
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={!canProjects || !projects.length}
          >
            <option value="">{projects.length ? 'Select project' : 'No projects available'}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.organization?.name ? ` · ${p.organization.name}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Category
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {PROJECT_FILE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Optional — defaults to file name"
          />
        </label>
        <label className="field span-2">
          File
          <input
            type="file"
            required
            accept={PROJECT_ACCEPT}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
        <p className="span-2 muted" style={{ margin: 0 }}>
          Accepted: PDF, PNG, JPEG, GIF, WebP, SVG, Word, Excel, PowerPoint, CSV, TXT, ZIP · max 25 MB
        </p>
        {error && <p className="error span-2">{error}</p>}
        {msg && <p className="span-2" style={{ color: 'var(--ok)', margin: 0 }}>{msg}</p>}
        <button className="btn" type="submit" disabled={busy || !canProjects}>
          {busy ? 'Uploading…' : 'Upload to project'}
        </button>
      </form>

      <div className="card row" style={{ marginBottom: 12, gap: 16 }}>
        <label className="field">
          Filter by project
          <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} disabled={!canProjects}>
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Project</th>
              <th>Client</th>
              <th>Category</th>
              <th>From</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">No project files yet.</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td>{r.project?.name || '—'}</td>
                <td>{r.organization?.name || '—'}</td>
                <td>{typeLabel(r.type)}</td>
                <td>
                  {r.source}
                  {r.uploadedBy?.name ? (
                    <> · <StaffName name={r.uploadedBy.name} role={r.uploadedBy.role} as="span" /></>
                  ) : null}
                </td>
                <td className="row" style={{ gap: 8 }}>
                  {canProjects && r.project?.id && (
                    <Link className="btn sm" href={`/projects/${r.project.id}/files`}>Open project</Link>
                  )}
                  <button
                    className="btn sm ghost"
                    type="button"
                    onClick={() => openAuthenticatedFile(`/documents/${r.id}/file`, r.fileName || r.title).catch((e) => alert(e.message))}
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
