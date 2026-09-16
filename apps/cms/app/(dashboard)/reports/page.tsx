'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, getUser, money } from '@/lib/api';
import { isAdmin } from '@/lib/roles';

export default function ReportsPage() {
  const [gst, setGst] = useState<any>(null);
  const [aging, setAging] = useState<any>(null);
  const [mix, setMix] = useState<any>({});
  const [revenue, setRevenue] = useState<any>(null);
  const [sales, setSales] = useState<any>(null);
  const admin = isAdmin(getUser()?.role);

  useEffect(() => {
    api('/reports/gst').then(setGst);
    api('/reports/aging').then(setAging);
    api('/reports/services').then(setMix);
    api('/reports/revenue').then(setRevenue);
    if (admin) api('/reports/sales').then(setSales).catch(() => setSales(null));
  }, [admin]);

  const agingRows = useMemo(() => {
    const rows = aging?.rows || [];
    return [...rows].sort((a: any, b: any) => (b.daysOverdue || 0) - (a.daysOverdue || 0));
  }, [aging]);

  const mixRows = useMemo(
    () => Object.entries(mix || {}).sort((a, b) => Number(b[1]) - Number(a[1])),
    [mix],
  );

  const monthRows = useMemo(() => {
    const byMonth = revenue?.byMonth || {};
    return Object.entries(byMonth).sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  }, [revenue]);

  function csvAging() {
    if (!aging) return;
    const header = 'Invoice,Client,Due,Days overdue\n';
    const body = agingRows
      .map((r: any) => `${r.number},${r.client},${r.amountDue},${r.daysOverdue}`)
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'intellisoft-aging.csv';
    a.click();
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Reports</h1>
        </div>
        <button className="btn ghost" type="button" onClick={csvAging} disabled={!agingRows.length}>
          Export aging CSV
        </button>
      </div>

      {gst && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <h3 className="ui">Tax summary</h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>Taxable</th>
                <th>CGST</th>
                <th>SGST</th>
                <th>IGST</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{money(gst.taxable)}</td>
                <td>{money(gst.cgst)}</td>
                <td>{money(gst.sgst)}</td>
                <td>{money(gst.igst)}</td>
                <td>{money(gst.total ?? (Number(gst.taxable || 0) + Number(gst.cgst || 0) + Number(gst.sgst || 0) + Number(gst.igst || 0)))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {aging && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <h3 className="ui">Receivables aging</h3>
          </div>
          <table style={{ marginBottom: 16 }}>
            <thead>
              <tr>
                <th>Bucket</th>
                <th>Amount due</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Current (not overdue)</td><td>{money(aging.buckets.current)}</td></tr>
              <tr><td>1–30 days overdue</td><td>{money(aging.buckets.d30)}</td></tr>
              <tr><td>31–60 days overdue</td><td>{money(aging.buckets.d60)}</td></tr>
              <tr><td>61–90 days overdue</td><td>{money(aging.buckets.d90)}</td></tr>
              <tr><td>Over 90 days</td><td>{money(aging.buckets.older)}</td></tr>
            </tbody>
          </table>
          <h3 className="ui" style={{ marginBottom: 8 }}>Unpaid invoice list</h3>
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Client</th>
                <th>Amount due</th>
                <th>Days overdue</th>
              </tr>
            </thead>
            <tbody>
              {agingRows.map((r: any) => (
                <tr key={r.id}>
                  <td>{r.number}</td>
                  <td>{r.client}</td>
                  <td>{money(r.amountDue)}</td>
                  <td>{r.daysOverdue}</td>
                </tr>
              ))}
              {agingRows.length === 0 && (
                <tr><td colSpan={4} className="muted">No unpaid invoices.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3 className="ui">Monthly collections</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Collected</th>
            </tr>
          </thead>
          <tbody>
            {monthRows.map(([month, amount]) => (
              <tr key={String(month)}>
                <td>{String(month)}</td>
                <td>{money(Number(amount))}</td>
              </tr>
            ))}
            {monthRows.length === 0 && (
              <tr><td colSpan={2} className="muted">No collections recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3 className="ui">Active service mix</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Active count</th>
            </tr>
          </thead>
          <tbody>
            {mixRows.map(([category, count]) => (
              <tr key={String(category)}>
                <td>{String(category)}</td>
                <td>{String(count)}</td>
              </tr>
            ))}
            {mixRows.length === 0 && (
              <tr><td colSpan={2} className="muted">No active subscriptions.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {sales && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <h3 className="ui">Sales summary</h3>
          </div>
          <table style={{ marginBottom: 16 }}>
            <thead>
              <tr>
                <th>Salesperson</th>
                <th>Client accounts</th>
                <th>Services sold</th>
              </tr>
            </thead>
            <tbody>
              {(sales.summary || []).map((s: any) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.clientCount}</td>
                  <td>{s.saleCount}</td>
                </tr>
              ))}
              {(sales.summary || []).length === 0 && (
                <tr><td colSpan={3} className="muted">No sales data yet.</td></tr>
              )}
            </tbody>
          </table>
          <div className="card-head">
            <h3 className="ui">Sales detail</h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Salesperson</th>
                <th>Client</th>
                <th>Service</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(sales.sales || []).map((s: any) => (
                <tr key={s.id}>
                  <td>{s.soldAt ? String(s.soldAt).slice(0, 10) : '—'}</td>
                  <td>{s.salesPerson || '—'}</td>
                  <td>{s.client}</td>
                  <td>{s.service}</td>
                  <td>{s.status}</td>
                </tr>
              ))}
              {(sales.sales || []).length === 0 && (
                <tr><td colSpan={5} className="muted">No sales rows yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
