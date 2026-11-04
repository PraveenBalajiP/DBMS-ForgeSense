'use client';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { useApi } from '@/lib/useApi';
import { api, fmtDate, fmtMoney } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { Badge, Card, DataTable, ErrorBox, Field, Modal, PageHeader, Spinner, useAction } from '@/components/ui';

const blank = { Machine_ID: '', Priority: 'Medium', Description: '', Due_Date: '', Assigned_To_User_ID: '', Expected_Hours: '' };

export default function WorkOrders() {
  const { me } = useAuth(), run = useAction();
  const [f, setF] = useState({ status: '', priority: '', q: '' }), [create, setCreate] = useState(false), [form, setForm] = useState(blank), [sel, setSel] = useState(null);
  const search = useDeferredValue(f.q);
  const qs = new URLSearchParams(Object.entries({ ...f, q: search }).filter(([, v]) => v)).toString();
  const { data: rows, error, loading, reload } = useApi(`/api/work-orders?${qs}`);
  const { data: lk, reload: reloadLk } = useApi('/api/lookups');
  const detail = useApi(sel ? `/api/work-orders/${sel}` : null, { resetOnChange: true });
  const mgr = me.role !== 'Technician';
  const w = detail.data;
  const open = w && (w.Status === 'Open' || w.Status === 'In Progress');
  const [part, setPart] = useState({ part_id: '', quantity: 1 });

  const refresh = () => { reload(); detail.reload(); reloadLk(); };
  const patch = async (body, ok) => { if (await run(() => api(`/api/work-orders/${sel}`, { method: 'PATCH', body }), ok)) refresh(); };
  const submit = async (e) => {
    e.preventDefault();
    if (await run(() => api('/api/work-orders', { method: 'POST', body: form }), 'Work order created')) { setCreate(false); setForm(blank); reload(); }
  };
  return (
    <>
      <PageHeader title="Work orders" subtitle={me.role === 'Technician' ? 'Your assigned work' : 'Maintenance tasks, assignments and spare-part usage'} actions={mgr && <button className="btn" onClick={() => setCreate(true)}>+ New work order</button>} />
      <div className="row" style={{ marginBottom: 12 }}>
        <input placeholder="Search description (full-text)…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">Any status</option>{['Open', 'In Progress', 'Completed', 'Cancelled'].map((s) => <option key={s}>{s}</option>)}</select>
        <select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="">Any priority</option>{['Critical', 'High', 'Medium', 'Low'].map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !rows ? <Spinner /> : (
        <Card><DataTable rows={(rows || []).map((r) => ({ id: r.Work_Order_ID, ...r }))} onRowClick={(r) => setSel(r.Work_Order_ID)} empty="No work orders." columns={[
          { key: 'Work_Order_ID', label: '#', render: (r) => `#${r.Work_Order_ID}` }, { key: 'Priority', label: 'Priority', render: (r) => <Badge v={r.Priority} /> },
          { key: 'Machine_Code', label: 'Machine' }, { key: 'Description', label: 'Description' }, { key: 'Status', label: 'Status', render: (r) => <Badge v={r.Status} /> },
          { key: 'Assigned_To', label: 'Assigned to', render: (r) => r.Assigned_To || <span className="mute">Unassigned</span> }, { key: 'Due_Date', label: 'Due', render: (r) => fmtDate(r.Due_Date) },
          { key: 'Parts_Cost', label: 'Parts cost', align: 'right', render: (r) => fmtMoney(r.Parts_Cost) },
        ]} /></Card>
      )}

      <Modal open={!!sel} wide title={w ? `Work order #${w.Work_Order_ID}` : 'Work order'} onClose={() => setSel(null)}>
        {detail.loading && !w ? <Spinner /> : <ErrorBox error={detail.error} />}
        {w && (<>
          <div className="row" style={{ marginBottom: 10 }}><Badge v={w.Priority} /><Badge v={w.Status} /><span className="mute">{w.Machine_Code} · {w.Machine_Name}</span><Link href={`/machines/${w.Machine_ID}`}>open machine →</Link></div>
          <p style={{ marginBottom: 10 }}>{w.Description}</p>
          <div className="grid g3" style={{ marginBottom: 12 }}>
            <div><div className="mute">Created by</div>{w.Created_By}</div><div><div className="mute">Assigned to</div>{w.Assigned_To || 'Unassigned'} <span className="mute">({w.Assignment_Status})</span></div>
            <div><div className="mute">Due</div>{fmtDate(w.Due_Date)}</div><div><div className="mute">Completed</div>{fmtDate(w.Completed_At)}</div>
            <div><div className="mute">Expected hours</div>{w.Expected_Hours ?? '—'}</div><div><div className="mute">Source alert</div>{w.Source_Alert_ID ? `#${w.Source_Alert_ID}` : 'manual'}</div>
          </div>
          <h2 style={{ margin: '8px 0' }}>Parts used</h2>
          <DataTable rows={w.parts.map((p) => ({ id: p.Part_ID, ...p }))} empty="No parts used yet." columns={[{ key: 'Part_Name', label: 'Part' }, { key: 'Quantity_Used', label: 'Qty', align: 'right' }, { key: 'Unit_Cost', label: 'Unit cost', align: 'right', render: (p) => fmtMoney(p.Unit_Cost) }, { key: 'line', label: 'Line cost', align: 'right', render: (p) => fmtMoney(p.Quantity_Used * p.Unit_Cost) }]} />
          {open && (<>
            <h2 style={{ margin: '14px 0 8px' }}>Actions</h2>
            <div className="row" style={{ marginBottom: 10 }}>
              {w.Status === 'Open' && <button className="btn sec" onClick={() => patch({ action: 'start' }, 'Work started (machine → Maintenance)')}>Start work</button>}
              <select value={part.part_id} onChange={(e) => setPart({ ...part, part_id: e.target.value })} aria-label="Part"><option value="">Use a part…</option>{lk?.parts.map((p) => <option key={p.Part_ID} value={p.Part_ID}>{p.Part_Name} ({p.Quantity_In_Stock} in stock)</option>)}</select>
              <input type="number" min="1" style={{ width: 80 }} value={part.quantity} onChange={(e) => setPart({ ...part, quantity: e.target.value })} aria-label="Quantity" />
              <button className="btn sec" disabled={!part.part_id} onClick={async () => { if (await run(() => api(`/api/work-orders/${sel}/parts`, { method: 'POST', body: part }), (r) => `Part used · ${r.Remaining_Stock} left in stock`)) refresh(); }}>Use part</button>
            </div>
            <div className="row">
              {mgr && <select value={w.Assigned_To_User_ID || ''} onChange={(e) => e.target.value && patch({ action: 'assign', user_id: e.target.value }, 'Assigned')} aria-label="Assign"><option value="">Assign to…</option>{lk?.staff.map((u) => <option key={u.User_ID} value={u.User_ID}>{u.Name} ({u.Role_Name})</option>)}</select>}
              <button className="btn" onClick={() => patch({ action: 'complete' }, (r) => `Completed · parts cost ${fmtMoney(r.Total_Parts_Cost)} · alerts resolved`)}>Complete (transaction)</button>
              {mgr && <button className="btn sec" onClick={() => patch({ action: 'cancel' }, 'Cancelled')}>Cancel order</button>}
            </div></>)}
          {me.role === 'Admin' && <div className="row" style={{ marginTop: 14 }}><button className="btn dng sm" onClick={async () => { if (confirm('Delete this work order permanently?') && await run(() => api(`/api/work-orders/${sel}`, { method: 'DELETE' }), 'Deleted')) { setSel(null); reload(); } }}>Delete (admin)</button></div>}
        </>)}
      </Modal>

      <Modal open={create} title="New work order" onClose={() => setCreate(false)}>
        <form className="form" onSubmit={submit}>
          <Field label="Machine *"><select required value={form.Machine_ID} onChange={(e) => setForm({ ...form, Machine_ID: e.target.value })}><option value="">Select…</option>{lk?.machines.map((m) => <option key={m.Machine_ID} value={m.Machine_ID}>{m.Machine_Code} — {m.Machine_Name}</option>)}</select></Field>
          <Field label="Priority"><select value={form.Priority} onChange={(e) => setForm({ ...form, Priority: e.target.value })}>{['Low', 'Medium', 'High', 'Critical'].map((p) => <option key={p}>{p}</option>)}</select></Field>
          <div className="full"><Field label="Description *"><textarea required rows={3} style={{ width: '100%' }} value={form.Description} onChange={(e) => setForm({ ...form, Description: e.target.value })} /></Field></div>
          <Field label="Due date"><input type="datetime-local" value={form.Due_Date} onChange={(e) => setForm({ ...form, Due_Date: e.target.value })} /></Field>
          <Field label="Expected hours"><input type="number" step="0.5" min="0.5" value={form.Expected_Hours} onChange={(e) => setForm({ ...form, Expected_Hours: e.target.value })} /></Field>
          <Field label="Assign to"><select value={form.Assigned_To_User_ID} onChange={(e) => setForm({ ...form, Assigned_To_User_ID: e.target.value })}><option value="">Unassigned</option>{lk?.staff.map((u) => <option key={u.User_ID} value={u.User_ID}>{u.Name}</option>)}</select></Field>
          <div className="full row"><button className="btn">Create</button><button type="button" className="btn sec" onClick={() => setCreate(false)}>Cancel</button></div>
        </form>
      </Modal>
    </>
  );
}
