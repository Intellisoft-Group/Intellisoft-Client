'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getUser } from '@/lib/api';
import { canSee, ROLE_GROUPS } from '@/lib/roles';

export default function ClientsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', gstin: '', email: '', phone: '', state: 'Karnataka', placeOfSupply: 'Karnataka', billingAddress: '' });
  const router = useRouter();
  const user = getUser();
  const isSales = user?.role === 'SALES';
  const canInvoice = canSee(user?.role, ROLE_GROUPS.commercial);

  function load() {
    api(`/organizations${q ? `?q=${encodeURIComponent(q)}` : ''}`).then(setRows);
  }
  useEffect(() => { load(); }, [q]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const org = await api('/organizations', { method: 'POST', body: form });
    setOpen(false);
    router.push(`/clients/${org.id}`);
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Clients</h1>
        </div>
        <button className="btn" onClick={() => setOpen(true)}>Add client</button>
      </div>
      <div className="card stack">
        <input placeholder="Search name, GSTIN, email" value={q} onChange={(e) => setQ(e.target.value)} />
        <table>
          <thead>
            <tr><th>Name</th><th>GSTIN</th><th>State</th>{!isSales && <th>Salesperson</th>}<th>Users</th><th>Invoices</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="clickable" onClick={() => router.push(`/clients/${r.id}`)}>
                <td>{r.name}</td>
                <td>{r.gstin || '—'}</td>
                <td>{r.state || r.placeOfSupply || '—'}</td>
                {!isSales && <td>{r.salesPerson?.name || '—'}</td>}
                <td>{r._count?.users}</td>
                <td>{r._count?.invoices}</td>
                <td>
                  <button
                    className="btn sm ghost"
                    type="button"
                    onClick={(e) => { e.stopPropagation(); router.push(`/inbox?org=${r.id}`); }}
                  >
                    Chat
                  </button>
                  {canInvoice && (
                    <button
                      className="btn sm ghost"
                      type="button"
                      onClick={(e) => { e.stopPropagation(); router.push(`/billing/new?org=${r.id}`); }}
                    >
                      Invoice
                    </button>
                  )}
                  <button
                    className="btn sm ghost"
                    type="button"
                    onClick={(e) => { e.stopPropagation(); router.push(`/clients/${r.id}/files`); }}
                  >
                    Files
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 className="ui">New client</h3>
          <form className="form-grid" onSubmit={create}>
            <label className="field">Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="field">GSTIN<input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></label>
            <label className="field">Email<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="field">Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label className="field">State<input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></label>
            <label className="field">Place of supply<input value={form.placeOfSupply} onChange={(e) => setForm({ ...form, placeOfSupply: e.target.value })} /></label>
            <label className="field span-2">Billing address<textarea value={form.billingAddress} onChange={(e) => setForm({ ...form, billingAddress: e.target.value })} /></label>
            <div className="row span-2">
              <button className="btn" type="submit">Save</button>
              <button className="btn ghost" type="button" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
