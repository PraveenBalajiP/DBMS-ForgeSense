'use client';
import { useDeferredValue, useState } from 'react';
import { useApi } from '@/lib/useApi';
import { api, fmtMoney } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { Badge, Card, DataTable, ErrorBox, Field, Modal, PageHeader, Spinner, useAction } from '@/components/ui';

const blank = { Part_Name: '', Part_Number: '', Quantity_In_Stock: 0, Reorder_Level: 0, Unit_Cost: 0 };
export default function Parts() {
  const { me } = useAuth(), run = useAction();
  const [text, setText] = useState(''), [low, setLow] = useState(false), [add, setAdd] = useState(false), [form, setForm] = useState(blank), [restock, setRestock] = useState(null), [qty, setQty] = useState(10);
  const search = useDeferredValue(text);
  const { data: rows, error, loading, reload } = useApi(`/api/parts?${low ? 'low=1&' : ''}q=${encodeURIComponent(search)}`);
  const mgr = me.role !== 'Technician';
  const create = async (e) => { e.preventDefault(); if (await run(() => api('/api/parts', { method: 'POST', body: form }), 'Part added')) { setAdd(false); setForm(blank); reload(); } };
  return (
    <>
      <PageHeader title="Spare parts inventory" subtitle="Stock is decremented inside a database transaction when a technician uses a part" actions={mgr && <button className="btn" onClick={() => setAdd(true)}>+ Add part</button>} />
      <div className="row" style={{ marginBottom: 12 }}>
        <input placeholder="Search name or number…" value={text} onChange={(e) => setText(e.target.value)} />
        <button className={`chip ${low ? 'on' : ''}`} onClick={() => setLow(!low)}>Low stock only (view v_low_stock_parts logic)</button>
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !rows ? <Spinner /> : (
        <Card><DataTable rows={(rows || []).map((p) => ({ id: p.Part_ID, ...p }))} empty="No parts match." columns={[
          { key: 'Part_Name', label: 'Part', render: (p) => <b>{p.Part_Name}</b> }, { key: 'Part_Number', label: 'Number' },
          { key: 'Quantity_In_Stock', label: 'In stock', render: (p) => (<div className="row"><span style={{ minWidth: 28, fontWeight: 700, color: p.Low_Stock ? 'var(--bad)' : undefined }}>{p.Quantity_In_Stock}</span>
            <div className="meter"><i style={{ width: `${Math.min(100, (p.Quantity_In_Stock / Math.max(p.Reorder_Level * 3, 1)) * 100)}%`, background: p.Low_Stock ? 'var(--bad)' : 'var(--ok)' }} /></div>{p.Low_Stock ? <Badge v="High">Reorder</Badge> : null}</div>) },
          { key: 'Reorder_Level', label: 'Reorder at', align: 'right' }, { key: 'Unit_Cost', label: 'Unit cost', align: 'right', render: (p) => fmtMoney(p.Unit_Cost) },
          { key: 'act', label: '', render: (p) => (<div className="row">{mgr && <button className="btn sec sm" onClick={() => setRestock(p)}>Restock</button>}
            {me.role === 'Admin' && <button className="btn dng sm" onClick={async () => { if (confirm(`Delete ${p.Part_Name}?`) && await run(() => api('/api/parts', { method: 'DELETE', body: { part_id: p.Part_ID } }), 'Part deleted')) reload(); }}>Delete</button>}</div>) },
        ]} /></Card>
      )}
      <Modal open={add} title="Add part" onClose={() => setAdd(false)}>
        <form className="form" onSubmit={create}>
          <Field label="Name *"><input required value={form.Part_Name} onChange={(e) => setForm({ ...form, Part_Name: e.target.value })} /></Field>
          <Field label="Part number"><input value={form.Part_Number} onChange={(e) => setForm({ ...form, Part_Number: e.target.value })} /></Field>
          <Field label="In stock"><input type="number" min="0" value={form.Quantity_In_Stock} onChange={(e) => setForm({ ...form, Quantity_In_Stock: e.target.value })} /></Field>
          <Field label="Reorder level"><input type="number" min="0" value={form.Reorder_Level} onChange={(e) => setForm({ ...form, Reorder_Level: e.target.value })} /></Field>
          <Field label="Unit cost"><input type="number" min="0" step="0.01" value={form.Unit_Cost} onChange={(e) => setForm({ ...form, Unit_Cost: e.target.value })} /></Field>
          <div className="full row"><button className="btn">Add</button></div>
        </form>
      </Modal>
      <Modal open={!!restock} title={`Restock ${restock?.Part_Name || ''}`} onClose={() => setRestock(null)}>
        <div className="row"><input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Quantity to add" />
          <button className="btn" onClick={async () => { if (await run(() => api('/api/parts', { method: 'PATCH', body: { part_id: restock.Part_ID, add: Number(qty) } }), 'Stock updated')) { setRestock(null); reload(); } }}>Add to stock</button></div>
      </Modal>
    </>
  );
}
