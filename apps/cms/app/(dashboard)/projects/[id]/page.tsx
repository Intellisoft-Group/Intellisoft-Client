'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, getUser, openAuthenticatedFile } from '@/lib/api';
import { CURRENCIES, currencyOptionLabel, currencySymbol } from '@/lib/currencies';
import { useVisibleInterval } from '@/lib/hooks/use-visible-interval';
import { canSee, isAdmin, ROLE_GROUPS } from '@/lib/roles';
import { StaffName } from '@/lib/staff-name';

const DEFAULT_STAGES = [
  { title: 'Stage 1 — Advance / kickoff', percent: '40' },
  { title: 'Stage 2 — Mid delivery', percent: '40' },
  { title: 'Stage 3 — Final delivery', percent: '20' },
];

const SINGLE_PAYMENT = [{ title: 'Full payment', percent: '100' }];

function moneyFmt(n: number | null | undefined, currency = 'INR') {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const sym = currencySymbol(currency);
  return `${sym}${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const role = getUser()?.role;
  const admin = isAdmin(role);
  const canBill = canSee(role, ROLE_GROUPS.commercial);
  const [p, setP] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [update, setUpdate] = useState('');
  const [staff, setStaff] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [memberId, setMemberId] = useState('');
  const [teamErr, setTeamErr] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [chatBody, setChatBody] = useState('');
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [contractAmount, setContractAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [applyTax, setApplyTax] = useState(false);
  const [taxPercent, setTaxPercent] = useState('0');
  const [defaultTax, setDefaultTax] = useState(18);
  const [stages, setStages] = useState(DEFAULT_STAGES);
  const [payErr, setPayErr] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [stagePdfBusy, setStagePdfBusy] = useState<string | null>(null);
  const [stagePdfMsg, setStagePdfMsg] = useState('');

  function load() {
    api(`/projects/${id}`).then((row) => {
      setP(row);
      if (row.contractAmount != null) setContractAmount(String(row.contractAmount));
      if (row.currency) setCurrency(row.currency);
      if (row.taxPercent != null) {
        setTaxPercent(String(row.taxPercent));
        setApplyTax(Number(row.taxPercent) > 0);
      }
      if (row.paymentStages?.length) {
        setStages(row.paymentStages.map((s: any) => ({ title: s.title, percent: String(s.percent) })));
      }
      if (row.organizationId) {
        api(`/organizations/${row.organizationId}`)
          .then((org) => setClients((org.users || []).filter((u: any) => u.role === 'CLIENT' && u.isActive !== false)))
          .catch(() => setClients([]));
      }
    });
  }
  useEffect(() => {
    load();
    api('/users/staff').then(setStaff).catch(() => setStaff([]));
    api('/settings/public').then((s) => {
      setDefaultTax(Number(s?.defaultTaxPercent) || 18);
    }).catch(() => undefined);
  }, [id]);

  const pull = useCallback(() => {
    if (!p?.chatThread?.id) return;
    api(`/chat/threads/${p.chatThread.id}/messages`)
      .then((d) => setMessages(Array.isArray(d) ? d : d.messages || []))
      .catch(() => undefined);
  }, [p?.chatThread?.id]);

  useEffect(() => {
    if (!p?.chatThread?.id) return;
    pull();
  }, [p?.chatThread?.id, pull]);

  useVisibleInterval(() => {
    if (p?.chatThread?.id) pull();
  }, p?.chatThread?.id ? 5000 : null);

  async function addMilestone(e: React.FormEvent) {
    e.preventDefault();
    await api(`/projects/${id}/milestones`, { method: 'POST', body: { title } });
    setTitle('');
    load();
  }
  async function toggle(m: any) {
    await api(`/projects/${id}/milestones/${m.id}`, { method: 'PATCH', body: { completed: !m.completed } });
    load();
  }
  async function postUpdate(e: React.FormEvent) {
    e.preventDefault();
    await api(`/projects/${id}/updates`, { method: 'POST', body: { body: update } });
    setUpdate('');
    load();
  }
  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!memberId) return;
    setTeamErr('');
    try {
      await api(`/projects/${id}/members`, { method: 'POST', body: { userId: memberId } });
      setMemberId('');
      load();
    } catch (e: any) {
      setTeamErr(e.message);
    }
  }

  async function removeMember(userId: string, name: string) {
    if (!confirm(`Remove ${name} from this project?`)) return;
    setTeamErr('');
    try {
      await api(`/projects/${id}/members/${userId}/remove`, { method: 'POST' });
      load();
    } catch (e: any) {
      setTeamErr(e.message);
    }
  }
  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!p?.chatThread?.id) return;
    const text = chatBody.trim();
    if (!text && !chatFile) return;
    try {
      const fd = new FormData();
      fd.append('body', text);
      if (chatFile) fd.append('file', chatFile);
      await api(`/chat/threads/${p.chatThread.id}/messages`, { method: 'POST', form: fd });
      setChatBody('');
      setChatFile(null);
      api(`/chat/threads/${p.chatThread.id}/messages`).then((d) => setMessages(Array.isArray(d) ? d : d.messages || []));
    } catch (err: any) {
      setTeamErr(err?.message || 'Could not send message');
    }
  }

  async function saveSchedule(e: React.FormEvent) {
    e.preventDefault();
    setPayErr('');
    setPayBusy(true);
    try {
      await api(`/projects/${id}/payment-schedule`, {
        method: 'PUT',
        body: {
          contractAmount: Number(contractAmount),
          currency,
          taxPercent: applyTax ? Number(taxPercent) : 0,
          stages: stages.map((s) => ({ title: s.title, percent: Number(s.percent) })),
        },
      });
      load();
    } catch (err: any) {
      setPayErr(err.message || 'Could not save schedule');
    } finally {
      setPayBusy(false);
    }
  }

  async function issueStage(stageId: string, title: string) {
    if (!confirm(`Issue invoice for "${title}" and send it to the client app?`)) return;
    setPayErr('');
    setPayBusy(true);
    try {
      const res = await api(`/projects/${id}/payment-stages/${stageId}/invoice`, { method: 'POST', body: {} });
      load();
      if (res?.invoice?.id) {
        window.location.href = `/billing/${res.invoice.id}`;
      }
    } catch (err: any) {
      setPayErr(err.message || 'Could not issue invoice');
    } finally {
      setPayBusy(false);
    }
  }

  async function uploadStagePdf(invoiceId: string, file: File | null) {
    if (!file) return;
    setPayErr('');
    setStagePdfMsg('');
    setStagePdfBusy(invoiceId);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api(`/invoices/${invoiceId}/pdf`, { method: 'POST', form: fd });
      setStagePdfMsg('Stage invoice PDF uploaded. Client can download it in the app.');
      load();
    } catch (err: any) {
      setPayErr(err.message || 'Could not upload stage PDF');
    } finally {
      setStagePdfBusy(null);
    }
  }

  if (!p) return <p>Loading…</p>;

  const percentTotal = stages.reduce((a, s) => a + (Number(s.percent) || 0), 0);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{p.name}</h1>
          <p>{p.organization?.name} · {p.status}</p>
        </div>
        <Link className="btn" href={`/projects/${id}/files`}>Open project files</Link>
      </div>

      {canBill && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <h3 className="ui">Payment schedule</h3>
          </div>
          {p.paymentSummary && (
            <p className="muted" style={{ marginBottom: 12 }}>
              Contract {moneyFmt(p.paymentSummary.contractAmount, p.currency)} · Paid {moneyFmt(p.paymentSummary.paidAmount, p.currency)} ·
              Due now {moneyFmt(p.paymentSummary.dueNow, p.currency)} · Remaining {moneyFmt(p.paymentSummary.remainingAmount, p.currency)}
            </p>
          )}
          {p.paymentStages?.length > 0 && (
            <table className="presence-table" style={{ marginBottom: 16 }}>
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>%</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Invoice</th>
                  <th>PDF</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {p.paymentStages.map((s: any) => (
                  <tr key={s.id}>
                    <td>{s.title}</td>
                    <td>{s.percent}%</td>
                    <td>{moneyFmt(s.amount, p.currency)}</td>
                    <td className="muted">{String(s.status || '').replaceAll('_', ' ')}</td>
                    <td>
                      {s.invoice?.id ? (
                        <Link href={`/billing/${s.invoice.id}`}>{s.invoice.number}</Link>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {s.status === 'PAID' && s.invoice?.id ? (
                        <div className="stack" style={{ gap: 6 }}>
                          {s.invoice.hasPdf ? (
                            <button
                              className="btn sm ghost"
                              type="button"
                              onClick={() =>
                                openAuthenticatedFile(`/invoices/${s.invoice.id}/pdf`, `${s.invoice.number || 'invoice'}.pdf`).catch((e) =>
                                  alert(e.message),
                                )
                              }
                            >
                              View PDF
                            </button>
                          ) : (
                            <span className="muted" style={{ fontSize: 12 }}>Upload after Paid</span>
                          )}
                          <label className="btn sm ghost" style={{ cursor: stagePdfBusy === s.invoice.id ? 'wait' : 'pointer' }}>
                            {stagePdfBusy === s.invoice.id ? 'Uploading…' : s.invoice.hasPdf ? 'Replace PDF' : 'Upload PDF'}
                            <input
                              type="file"
                              accept="application/pdf,.pdf"
                              hidden
                              disabled={stagePdfBusy === s.invoice.id}
                              onChange={(e) => {
                                const f = e.target.files?.[0] || null;
                                e.target.value = '';
                                uploadStagePdf(s.invoice.id, f);
                              }}
                            />
                          </label>
                        </div>
                      ) : s.invoice?.id ? (
                        <span className="muted" style={{ fontSize: 12 }}>Mark Paid first</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {s.status === 'PLANNED' && (
                        <button className="btn sm" type="button" disabled={payBusy} onClick={() => issueStage(s.id, s.title)}>
                          Issue invoice
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {stagePdfMsg && <p style={{ color: 'var(--ok)' }}>{stagePdfMsg}</p>}
          {payErr && <p style={{ color: 'var(--danger)' }}>{payErr}</p>}
          <p className="muted" style={{ marginBottom: 12 }}>
            Stage invoices are managed under Billing. Upload the PDF after the stage is marked Paid.
          </p>
          <form className="stack" onSubmit={saveSchedule}>
            <div className="row">
              <label className="stack" style={{ flex: 1 }}>
                <span className="muted">Project contract amount ({currencySymbol(currency)})</span>
                <input
                  required
                  inputMode="decimal"
                  value={contractAmount}
                  onChange={(e) => setContractAmount(e.target.value)}
                  placeholder="100000"
                />
              </label>
              <label className="stack" style={{ width: 220 }}>
                <span className="muted">Currency</span>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{currencyOptionLabel(c)}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={applyTax}
                onChange={(e) => {
                  const on = e.target.checked;
                  setApplyTax(on);
                  setTaxPercent(on ? String(defaultTax) : '0');
                }}
              />
              Apply tax on project invoices
            </label>
            {applyTax && (
              <label className="stack" style={{ width: 120 }}>
                <span className="muted">Tax %</span>
                <input required inputMode="decimal" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
              </label>
            )}
            {stages.map((s, i) => (
              <div className="row" key={i}>
                <input
                  required
                  style={{ flex: 2 }}
                  value={s.title}
                  onChange={(e) => setStages(stages.map((row, j) => (j === i ? { ...row, title: e.target.value } : row)))}
                  placeholder={`Stage ${i + 1} title`}
                />
                <input
                  required
                  style={{ width: 90 }}
                  inputMode="decimal"
                  value={s.percent}
                  onChange={(e) => setStages(stages.map((row, j) => (j === i ? { ...row, percent: e.target.value } : row)))}
                  placeholder="%"
                />
                {stages.length > 1 && (
                  <button
                    className="btn ghost sm"
                    type="button"
                    onClick={() => setStages(stages.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <p className={Math.abs(percentTotal - 100) < 0.05 ? 'muted' : 'error'}>
              Stage percentages total: {percentTotal}% (must be 100%)
            </p>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              <button className="btn" type="submit" disabled={payBusy}>
                {p.paymentStages?.length ? 'Update schedule' : 'Save payment schedule'}
              </button>
              <button
                className="btn ghost"
                type="button"
                onClick={() => setStages([...stages, { title: `Stage ${stages.length + 1}`, percent: '0' }])}
              >
                Add stage
              </button>
              <button className="btn ghost" type="button" onClick={() => setStages(DEFAULT_STAGES)}>
                Use 40 / 40 / 20
              </button>
              <button className="btn ghost" type="button" onClick={() => setStages(SINGLE_PAYMENT)}>
                Use single payment (100%)
              </button>
            </div>
            {payErr && <p className="error">{payErr}</p>}
            <p className="muted">
              Save the schedule, then use <strong>Issue invoice</strong> when a stage is due. Clients pay only on the invoice (Bills). After bank transfer, mark Paid under Billing, then upload the PDF.
            </p>
          </form>
        </div>
      )}

      {!canBill && p.paymentStages?.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="ui">Payment schedule</h3>
          <ul>
            {p.paymentStages.map((s: any) => (
              <li key={s.id}>
                {s.title} — {s.percent}% · {moneyFmt(s.amount, p.currency)} · {String(s.status).replaceAll('_', ' ')}
                {s.invoice?.number ? ` · ${s.invoice.number}` : ''}
                {s.invoice?.hasPdf ? ' · PDF ready' : s.status === 'PAID' ? ' · PDF pending' : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <p>{p.description}</p>
        <div className="card-head">
          <h3 className="ui">Project members</h3>
          <p>{p.members?.length || 0} assigned</p>
        </div>
        {(!p.members || p.members.length === 0) ? (
          <p className="muted">No team members assigned.</p>
        ) : (
          <table className="presence-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Email</th>
                {admin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {p.members.map((m: any) => (
                <tr key={m.id}>
                  <td>
                    <span className="staff-name">
                      {m.user?.avatarUrl
                        ? <img className="profile-pic" src={m.user.avatarUrl} alt="" />
                        : <span className="profile-pic profile-pic-fallback">{(m.user?.name || '?').slice(0, 1)}</span>}
                      {m.user?.name}
                    </span>
                  </td>
                  <td className="muted">{m.user?.jobTitle || (m.user?.role === 'CLIENT' ? 'Client' : m.user?.role?.replaceAll('_', ' '))}</td>
                  <td className="muted">{m.user?.email}</td>
                  {admin && (
                    <td>
                      <button className="btn sm ghost" type="button" onClick={() => removeMember(m.user.id, m.user.name)}>
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {admin && (
          <form className="row" style={{ marginTop: 16 }} onSubmit={addMember}>
            <select required value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              <option value="">Assign a member</option>
              <optgroup label="Staff">
                {staff.filter((s) => !p.members?.some((m: any) => m.user?.id === s.id)).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.jobTitle ? ` · ${s.jobTitle}` : ''}</option>
                ))}
              </optgroup>
              <optgroup label="Client company">
                {clients.filter((u) => !p.members?.some((m: any) => m.user?.id === u.id)).map((u) => (
                  <option key={u.id} value={u.id}>{u.name}{u.email ? ` · ${u.email}` : ''}</option>
                ))}
              </optgroup>
            </select>
            <button className="btn" type="submit">Assign</button>
          </form>
        )}
        {teamErr && <p className="error" style={{ marginTop: 10 }}>{teamErr}</p>}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3 className="ui">Files from client and team</h3>
          <Link href={`/projects/${id}/files`}>Open as chat</Link>
        </div>
        <p className="muted">Files with uploader attribution.</p>
        <Link className="btn" href={`/projects/${id}/files`}>Open project files</Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="ui">Project chat</h3>
        <div className="chat-log" style={{ marginBottom: 12 }}>
          {messages.filter((m) => !m.deleted).map((m) => (
            <div key={m.id} className={`bubble ${m.author?.role !== 'CLIENT' ? 'staff' : ''}`}>
              <StaffName name={m.author?.name} role={m.author?.role} jobTitle={m.author?.jobTitle} avatarUrl={m.author?.avatarUrl} avatarPath={m.author?.avatarPath} />
              {m.body && <p style={{ margin: '6px 0 0' }}>{m.body}</p>}
              {m.fileName && (
                <button
                  className="btn sm ghost"
                  type="button"
                  style={{ marginTop: 8 }}
                  onClick={() => openAuthenticatedFile(`/chat/files/${m.id}`, m.fileName).catch((e) => alert(e.message))}
                >
                  {m.fileName}
                </button>
              )}
              {admin && (
                <button
                  className="btn sm ghost"
                  type="button"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    if (!confirm('Delete this message completely? It will disappear for everyone.')) return;
                    api(`/chat/messages/${m.id}`, { method: 'DELETE' })
                      .then(() => api(`/chat/threads/${p.chatThread.id}/messages`))
                      .then((d) => setMessages(Array.isArray(d) ? d : d.messages || []))
                      .catch((e) => alert(e.message || 'Could not delete message'));
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
        <form className="stack" onSubmit={sendChat}>
          <textarea value={chatBody} onChange={(e) => setChatBody(e.target.value)} placeholder="Message the client on this project…" />
          <input type="file" onChange={(e) => setChatFile(e.target.files?.[0] || null)} />
          <button className="btn" type="submit">Send</button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="ui">Milestones</h3>
        <ul>
          {p.milestones?.map((m: any) => (
            <li key={m.id}>
              <label className="check">
                <input type="checkbox" checked={m.completed} onChange={() => toggle(m)} />
                {m.title}
              </label>
            </li>
          ))}
        </ul>
        <form className="row" onSubmit={addMilestone}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New milestone" required />
          <button className="btn" type="submit">Add</button>
        </form>
      </div>

      <form className="card stack" onSubmit={postUpdate}>
        <h3 className="ui">Client-visible update</h3>
        <textarea value={update} onChange={(e) => setUpdate(e.target.value)} required />
        <button className="btn" type="submit">Post update</button>
        {p.updates?.map((u: any) => (
          <p key={u.id}><strong>{String(u.createdAt).slice(0, 10)}</strong> — {u.body}</p>
        ))}
      </form>
    </>
  );
}
