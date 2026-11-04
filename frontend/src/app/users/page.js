'use client';
import { useState } from 'react';
import { useApi } from '@/lib/useApi';
import { api } from '@/lib/api';
import { Badge, Card, DataTable, ErrorBox, Field, Modal, PageHeader, Spinner, useAction } from '@/components/ui';

const blank = { First_Name: '', Last_Name: '', Email: '', Phone: '', Password: '', Role_ID: '' };
export default function Users() {
  const run = useAction();
  const { data: rows, error, loading, reload } = useApi('/api/users');
  const { data: lk } = useApi('/api/lookups');
  const [open, setOpen] = useState(false), [form, setForm] = useState(blank);
  const create = async (e) => { e.preventDefault(); if (await run(() => api('/api/users', { method: 'POST', body: form }), 'User created')) { setOpen(false); setForm(blank); reload(); } };
  const toggle = async (u) => { if (await run(() => api('/api/users', { method: 'PATCH', body: { user_id: u.User_ID, status: u.Status === 'Active' ? 'Inactive' : 'Active' } }), 'Status changed')) reload(); };
  return (
    <>
      <PageHeader title="Users" subtitle="Admin only. Passwords are bcrypt-hashed and never returned by the API." actions={<button className="btn" onClick={() => setOpen(true)}>+ New user</button>} />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !rows ? <Spinner /> : (
        <Card><DataTable rows={(rows || []).map((u) => ({ id: u.User_ID, ...u }))} columns={[
          { key: 'name', label: 'Name', render: (u) => `${u.First_Name} ${u.Last_Name}` }, { key: 'Email', label: 'Email' }, { key: 'Phone', label: 'Phone' },
          { key: 'Role_Name', label: 'Role', render: (u) => <Badge v="Open">{u.Role_Name}</Badge> }, { key: 'Status', label: 'Status', render: (u) => <Badge v={u.Status} /> },
          { key: 'act', label: '', render: (u) => <button className="btn sec sm" onClick={() => toggle(u)}>{u.Status === 'Active' ? 'Deactivate' : 'Activate'}</button> }]} /></Card>
      )}
      <Modal open={open} title="New user" onClose={() => setOpen(false)}>
        <form className="form" onSubmit={create}>
          <Field label="First name *"><input required value={form.First_Name} onChange={(e) => setForm({ ...form, First_Name: e.target.value })} /></Field>
          <Field label="Last name *"><input required value={form.Last_Name} onChange={(e) => setForm({ ...form, Last_Name: e.target.value })} /></Field>
          <Field label="Email *"><input type="email" required value={form.Email} onChange={(e) => setForm({ ...form, Email: e.target.value })} /></Field>
          <Field label="Phone"><input value={form.Phone} onChange={(e) => setForm({ ...form, Phone: e.target.value })} /></Field>
          <Field label="Password (8+) *"><input type="password" minLength={8} required value={form.Password} onChange={(e) => setForm({ ...form, Password: e.target.value })} /></Field>
          <Field label="Role *"><select required value={form.Role_ID} onChange={(e) => setForm({ ...form, Role_ID: e.target.value })}><option value="">Select…</option>{lk?.roles.map((r) => <option key={r.Role_ID} value={r.Role_ID}>{r.Role_Name}</option>)}</select></Field>
          <div className="full row"><button className="btn">Create</button></div>
        </form>
      </Modal>
    </>
  );
}
