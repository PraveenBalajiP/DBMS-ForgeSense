'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApi } from '@/lib/useApi';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { Badge, DataTable, ErrorBox, Field, Modal, PageHeader, Card, Spinner, useAction } from '@/components/ui';

const blank = { Machine_Code: '', Machine_Name: '', Model: '', Manufacturer: '', Installation_Date: '', Criticality: 'Medium', Plant_ID: '' };
export default function Machines() {
  const { me } = useAuth(), router = useRouter(), run = useAction();
  const [f, setF] = useState({ q: '', plant: '', status: '' }), [open, setOpen] = useState(false), [form, setForm] = useState(blank);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const { data: rows, error, loading, reload } = useApi(`/api/machines?${qs}`);
  const { data: lk } = useApi('/api/lookups');
  const manage = me.role !== 'Technician';
  const create = async (e) => {
    e.preventDefault();
    if (await run(() => api('/api/machines', { method: 'POST', body: form }), 'Machine added')) { setOpen(false); setForm(blank); reload(); }
  };
  return (
    <>
      <PageHeader title="Machines" subtitle="Assets, their current status and open issues" actions={manage && <button className="btn" onClick={() => setOpen(true)}>+ Add machine</button>} />
      <div className="row" style={{ marginBottom: 12 }}>
        <input placeholder="Search name or code…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <select value={f.plant} onChange={(e) => setF({ ...f, plant: e.target.value })}><option value="">All plants</option>{lk?.plants.map((p) => <option key={p.Plant_ID} value={p.Plant_ID}>{p.Plant_Name}</option>)}</select>
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">Any status</option>{['Operational', 'Warning', 'Faulted', 'Maintenance', 'Decommissioned'].map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !rows ? <Spinner /> : (
        <Card><DataTable rows={rows || []} onRowClick={(m) => router.push(`/machines/${m.Machine_ID}`)} empty="No machines match the filters." columns={[
          { key: 'Machine_Code', label: 'Code', render: (m) => <b>{m.Machine_Code}</b> }, { key: 'Machine_Name', label: 'Name' }, { key: 'Plant_Name', label: 'Plant' },
          { key: 'Status', label: 'Status', render: (m) => <Badge v={m.Status} /> }, { key: 'Criticality', label: 'Criticality' },
          { key: 'Machine_Age', label: 'Age (yrs)', align: 'right' }, { key: 'Sensor_Count', label: 'Sensors', align: 'right' },
          { key: 'Open_Alerts', label: 'Open alerts', align: 'right', render: (m) => (m.Open_Alerts ? <b style={{ color: 'var(--bad)' }}>{m.Open_Alerts}</b> : 0) },
          { key: 'Open_Work_Orders', label: 'Open WOs', align: 'right' },
        ]} /></Card>
      )}
      <Modal open={open} title="Add machine" onClose={() => setOpen(false)}>
        <form className="form" onSubmit={create}>
          <Field label="Code *"><input required value={form.Machine_Code} onChange={(e) => setForm({ ...form, Machine_Code: e.target.value })} /></Field>
          <Field label="Name *"><input required value={form.Machine_Name} onChange={(e) => setForm({ ...form, Machine_Name: e.target.value })} /></Field>
          <Field label="Model"><input value={form.Model} onChange={(e) => setForm({ ...form, Model: e.target.value })} /></Field>
          <Field label="Manufacturer"><input value={form.Manufacturer} onChange={(e) => setForm({ ...form, Manufacturer: e.target.value })} /></Field>
          <Field label="Installed on"><input type="date" value={form.Installation_Date} onChange={(e) => setForm({ ...form, Installation_Date: e.target.value })} /></Field>
          <Field label="Criticality"><select value={form.Criticality} onChange={(e) => setForm({ ...form, Criticality: e.target.value })}>{['Low', 'Medium', 'High'].map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Plant *"><select required value={form.Plant_ID} onChange={(e) => setForm({ ...form, Plant_ID: e.target.value })}><option value="">Select…</option>{lk?.plants.map((p) => <option key={p.Plant_ID} value={p.Plant_ID}>{p.Plant_Name}</option>)}</select></Field>
          <div className="full row"><button className="btn">Add</button><button type="button" className="btn sec" onClick={() => setOpen(false)}>Cancel</button></div>
        </form>
      </Modal>
    </>
  );
}
