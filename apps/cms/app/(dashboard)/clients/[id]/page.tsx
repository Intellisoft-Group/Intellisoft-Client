'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getUser, money } from '@/lib/api';
import { canSee, isAdmin, ROLE_GROUPS } from '@/lib/roles';

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [org, setOrg] = useState<any>(null);
  const [invite, setInvite] = useState({ email: '', name: '', phone: '', password: '' });
  const [temp, setTemp] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [salesPersonId, setSalesPersonId] = useState('');
  const user = getUser();
  const admin = isAdmin(user?.role);
  const canProjects = canSee(user?.role, ROLE_GROUPS.delivery);
  const canInvoice = canSee(user?.role, ROLE_GROUPS.commercial);
  const canManageUsers = canSee(user?.role, ROLE_GROUPS.clientCrm);

  function load() {
    api(`/organizations/${id}`).then(setOrg);
  }
  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    if (admin) api('/users/staff').then(setStaff).catch(() => setStaff([]));
  }, [admin]);
  useEffect(() => {
    setSalesPersonId(org?.salesPerson?.id || '');
  }, [org?.salesPerson?.id]);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setPwdError('');
    try {
      const body: any = {
        email: invite.email,
        name: invite.name,
        phone: invite.phone || undefined,
      };
      if (invite.password.trim()) body.password = invite.password.trim();
      const res = await api(`/organizations/${id}/invite`, { method: 'POST', body });
      setTemp(res.temporaryPassword || (invite.password.trim() ? 'Password set as entered' : ''));
      setInvite({ email: '', name: '', phone: '', password: '' });
      load();
    } catch (err: any) {
      setPwdError(err.message || 'Invite failed');
    }
  }

  async function setUserPassword(userId: string, mode: 'set' | 'reset') {
    setPwdError('');
    setPwdMsg('');
    let password: string | undefined;
    if (mode === 'set') {
      const entered = window.prompt('Enter new password for this client (min 8 characters):');
      if (entered == null) return;
      password = entered.trim();
      if (password.length < 8) {
        setPwdError('Password must be at least 8 characters');
        return;
      }
    }
    setBusyUserId(userId);
    try {
      const res = await api(`/organizations/${id}/users/${userId}/password`, {
        method: 'POST',
        body: {
          ...(password ? { password } : {}),
          notify: true,
        },
      });
      if (res.temporaryPassword) {
        setPwdMsg(`Temporary password for ${res.email}: ${res.temporaryPassword}`);
      } else {
        setPwdMsg(`Password updated for ${res.email}. Share it with the client securely.`);
      }
      load();
    } catch (err: any) {
      setPwdError(err.message || 'Could not update password');
    } finally {
      setBusyUserId(null);
    }
  }

  if (!org) return <p>Loading…</p>;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{org.name}</h1>
          <p>{org.legalName || 'Client organization'} · {org.gstin || 'No GSTIN'}</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Link className="btn ghost" href={`/inbox?org=${org.id}`}>Open chat</Link>
          <Link className="btn ghost" href={`/clients/${org.id}/files`}>Files</Link>
          {canProjects && <Link className="btn ghost" href="/projects">Projects</Link>}
          {canInvoice && <Link className="btn" href={`/billing/new?org=${org.id}`}>Invoice this client</Link>}
        </div>
      </div>
      <div className="card stack" style={{ marginBottom: 16 }}>
        <p>{org.billingAddress}</p>
        <p className="ui" style={{ color: 'var(--muted)' }}>{org.city} {org.state} {org.pincode} · Place of supply: {org.placeOfSupply}</p>
        {org.notes && <p>{org.notes}</p>}
        <p><strong>Salesperson:</strong> {org.salesPerson?.name || 'Not assigned'}</p>
        {admin && (
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <select value={salesPersonId} onChange={(e) => setSalesPersonId(e.target.value)}>
              <option value="">Unassigned</option>
              {staff.filter((s) => s.role === 'SALES' || s.role === 'SUPER_ADMIN').map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              className="btn sm"
              type="button"
              onClick={async () => {
                await api(`/organizations/${id}`, { method: 'PATCH', body: { salesPersonId: salesPersonId || null } });
                load();
              }}
            >
              Update
            </button>
          </div>
        )}
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="ui">Users</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
          Auto password is <strong>InSo</strong> + last 6 digits of the phone (e.g. phone …987654 → <code>InSo987654</code>). Or set a custom password.
        </p>
        {pwdError && <p className="error">{pwdError}</p>}
        {pwdMsg && <p style={{ color: 'var(--ok)', fontSize: 13 }}><strong>{pwdMsg}</strong></p>}
        <table>
          <thead>
            <tr>
              <th>Profile</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Photo</th>
              {canManageUsers && <th>Password</th>}
            </tr>
          </thead>
          <tbody>
            {org.users?.map((u: any) => (
              <tr key={u.id}>
                <td>
                  <span className="staff-name">
                    {u.avatarUrl ? <img className="profile-pic" src={u.avatarUrl} alt="" /> : <span className="profile-pic profile-pic-fallback">{u.name?.slice(0, 1)}</span>}
                    {u.name}
                  </span>
                </td>
                <td>{u.email}</td>
                <td>{u.phone}</td>
                <td>
                  <input type="file" accept="image/*" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const fd = new FormData();
                    fd.append('file', file);
                    await api(`/users/${u.id}/avatar`, { method: 'POST', form: fd });
                    load();
                  }} />
                </td>
                {canManageUsers && (
                  <td>
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn sm"
                        disabled={busyUserId === u.id}
                        onClick={() => setUserPassword(u.id, 'set')}
                      >
                        Set password
                      </button>
                      <button
                        type="button"
                        className="btn sm ghost"
                        disabled={busyUserId === u.id}
                        onClick={() => {
                          if (!window.confirm(`Generate a temporary password for ${u.email}?`)) return;
                          setUserPassword(u.id, 'reset');
                        }}
                      >
                        Reset
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {canManageUsers && (
          <>
            <form className="form-grid" style={{ marginTop: 16 }} onSubmit={sendInvite}>
              <label className="field">Name<input required value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} /></label>
              <label className="field">Email<input required type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></label>
              <label className="field">Phone<input required value={invite.phone} onChange={(e) => setInvite({ ...invite, phone: e.target.value })} placeholder="Required for auto password" /></label>
              <label className="field">
                Password (optional)
                <input
                  type="text"
                  minLength={8}
                  autoComplete="off"
                  placeholder="Blank = InSo + last 6 phone digits"
                  value={invite.password}
                  onChange={(e) => setInvite({ ...invite, password: e.target.value })}
                />
              </label>
              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <button className="btn" type="submit">Invite client user</button>
              </div>
            </form>
            {temp && <p>Invite password: <strong>{temp}</strong></p>}
          </>
        )}
      </div>
      {canInvoice && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <h3 className="ui">Invoices</h3>
            <Link href={`/billing/new?org=${org.id}`}>Add invoice</Link>
          </div>
          {(!org.invoices || org.invoices.length === 0) ? (
            <p className="muted">No invoices yet for this client.</p>
          ) : (
            <table>
              <thead><tr><th>Number</th><th>Status</th><th>Total</th><th>Due</th><th>Due date</th></tr></thead>
              <tbody>
                {org.invoices.map((i: any) => (
                  <tr key={i.id} className="clickable" onClick={() => router.push(`/billing/${i.id}`)}>
                    <td>{i.number}</td>
                    <td><span className={`badge ${i.status}`}>{i.status}</span></td>
                    <td>{money(i.total, i.currency)}</td>
                    <td>{money(i.amountDue, i.currency)}</td>
                    <td>{String(i.dueDate).slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <div className="card">
        <h3 className="ui">Subscriptions</h3>
        <table>
          <thead><tr><th>Service</th><th>Sold by</th><th>Status</th><th>Renewal</th></tr></thead>
          <tbody>
            {org.subscriptions?.map((s: any) => (
              <tr key={s.id}>
                <td>{s.catalog?.name}</td>
                <td>{s.soldBy?.name || '—'}</td>
                <td><span className={`badge ${s.status}`}>{s.status}</span></td>
                <td>{s.renewalDate ? s.renewalDate.slice(0, 10) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
