'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type FaqRow = {
  id?: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
};

const empty: FaqRow = { question: '', answer: '', sortOrder: 0, isActive: true };

export default function FaqsPage() {
  const [rows, setRows] = useState<FaqRow[]>([]);
  const [form, setForm] = useState<FaqRow>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    api('/cms/faqs')
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => setErr(e.message || 'Failed to load FAQs'));
  }

  useEffect(() => { load(); }, []);

  function startEdit(row: FaqRow) {
    setEditingId(row.id || null);
    setForm({
      question: row.question || '',
      answer: row.answer || '',
      sortOrder: Number(row.sortOrder) || 0,
      isActive: row.isActive !== false,
    });
    setMsg('');
    setErr('');
  }

  function resetForm() {
    setEditingId(null);
    setForm(empty);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    setErr('');
    try {
      const body = {
        question: form.question.trim(),
        answer: form.answer.trim(),
        sortOrder: Number(form.sortOrder) || 0,
        isActive: !!form.isActive,
      };
      if (!body.question || !body.answer) throw new Error('Question and answer are required.');
      if (editingId) {
        await api(`/cms/faqs/${editingId}`, { method: 'PATCH', body });
        setMsg('FAQ updated. Clients see the change in the app and portal.');
      } else {
        await api('/cms/faqs', { method: 'POST', body });
        setMsg('FAQ published. Clients see it in the app and portal.');
      }
      resetForm();
      load();
    } catch (e: any) {
      setErr(e.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this FAQ? Clients will no longer see it.')) return;
    setBusy(true);
    setErr('');
    try {
      await api(`/cms/faqs/${id}`, { method: 'DELETE' });
      setMsg('FAQ deleted.');
      if (editingId === id) resetForm();
      load();
    } catch (e: any) {
      setErr(e.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: FaqRow) {
    if (!row.id) return;
    setBusy(true);
    try {
      await api(`/cms/faqs/${row.id}`, {
        method: 'PATCH',
        body: { isActive: !row.isActive },
      });
      load();
    } catch (e: any) {
      setErr(e.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>FAQs</h1>
          <p>Answers shown in the Intellisoft client app and portal. Edit here anytime — no app update required.</p>
        </div>
      </div>

      <form className="card stack" style={{ marginBottom: 16 }} onSubmit={save}>
        <div className="card-head">
          <h3 className="ui">{editingId ? 'Edit FAQ' : 'Add FAQ'}</h3>
          {editingId && (
            <button type="button" className="btn ghost sm" onClick={resetForm}>Cancel edit</button>
          )}
        </div>
        <label className="field">
          Question
          <input
            required
            value={form.question}
            onChange={(e) => setForm({ ...form, question: e.target.value })}
            placeholder="e.g. Do you serve clients outside India?"
          />
        </label>
        <label className="field">
          Answer
          <textarea
            required
            rows={5}
            value={form.answer}
            onChange={(e) => setForm({ ...form, answer: e.target.value })}
            placeholder="Clear, corporate answer clients can understand quickly."
          />
        </label>
        <div className="row">
          <label className="field" style={{ maxWidth: 140 }}>
            Sort order
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="check" style={{ alignSelf: 'end', marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Published to clients
          </label>
        </div>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Saving…' : editingId ? 'Save changes' : 'Publish FAQ'}
        </button>
        {msg && <p className="muted">{msg}</p>}
        {err && <p className="error">{err}</p>}
      </form>

      <div className="card">
        <div className="card-head">
          <h3 className="ui">Published and draft FAQs</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: 64 }}>Order</th>
              <th>Question</th>
              <th>Status</th>
              <th style={{ width: 220 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.sortOrder}</td>
                <td>
                  <strong>{r.question}</strong>
                  <div className="muted" style={{ marginTop: 4, fontSize: 13, maxWidth: 560 }}>
                    {r.answer}
                  </div>
                </td>
                <td>
                  <span className={`badge ${r.isActive ? 'ACTIVE' : 'CANCELLED'}`}>
                    {r.isActive ? 'Published' : 'Hidden'}
                  </span>
                </td>
                <td>
                  <div className="row">
                    <button type="button" className="btn ghost sm" onClick={() => startEdit(r)} disabled={busy}>
                      Edit
                    </button>
                    <button type="button" className="btn ghost sm" onClick={() => toggleActive(r)} disabled={busy}>
                      {r.isActive ? 'Hide' : 'Publish'}
                    </button>
                    <button type="button" className="btn ghost sm" onClick={() => r.id && remove(r.id)} disabled={busy}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="muted">No FAQs yet. Add the first one above.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
