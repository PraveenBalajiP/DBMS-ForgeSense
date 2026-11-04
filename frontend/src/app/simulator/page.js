'use client';
import { useState } from 'react';
import { useApi } from '@/lib/useApi';
import { api } from '@/lib/api';
import { Card, CodeBlock, Field, PageHeader, useAction } from '@/components/ui';

export default function Simulator() {
  const run = useAction();
  const { data: lk } = useApi('/api/lookups');
  const [one, setOne] = useState({ machine_id: 1, sensor_no: 1, value: 90 }), [out, setOut] = useState(null);
  const [bulk, setBulk] = useState({ machine_id: '', inject: true }), [bulkOut, setBulkOut] = useState(null), [busy, setBusy] = useState(false);
  const sendOne = async (e) => {
    e.preventDefault();
    await run(async () => { const r = await api('/api/simulate/reading', { method: 'POST', body: { machine_id: Number(one.machine_id), sensor_no: Number(one.sensor_no), value: Number(one.value) } }); setOut(r); return r; }, (r) => `Stored · status ${r.status}${r.alert ? ' · alert raised' : ''}`);
  };
  const sendBulk = async () => {
    setBusy(true);
    await run(async () => { const r = await api('/api/simulate', { method: 'POST', body: { machine_id: bulk.machine_id || null, inject: bulk.inject && !!bulk.machine_id, points: 20, stepMinutes: 1 } }); setBulkOut(r); return r; }, (r) => `${r.readings} readings sent · ${r.new_alerts} new alerts`);
    setBusy(false);
  };
  return (
    <>
      <PageHeader title="Sensor simulator" subtitle="Admin only. Pushes readings through the same pipeline a real device would use" />
      <div className="callout" style={{ marginBottom: 16 }}><b>Pipeline:</b> reading → MongoDB <code>sensor_readings</code> → threshold check against MySQL <code>SENSOR_TYPE</code> → <code>sp_raise_alert</code> (transaction: alert + machine status + auto work order) → dashboard, alerts, forecast.</div>
      <div className="grid g2">
        <Card title="1 · Send ONE reading (best for a live demo)">
          <form className="form" onSubmit={sendOne}>
            <Field label="Machine"><select value={one.machine_id} onChange={(e) => setOne({ ...one, machine_id: e.target.value })}>{lk?.machines.map((m) => <option key={m.Machine_ID} value={m.Machine_ID}>{m.Machine_Code}</option>)}</select></Field>
            <Field label="Sensor #"><input type="number" min="1" value={one.sensor_no} onChange={(e) => setOne({ ...one, sensor_no: e.target.value })} /></Field>
            <Field label="Value"><input type="number" step="0.01" value={one.value} onChange={(e) => setOne({ ...one, value: e.target.value })} /></Field>
            <div className="full row"><button className="btn">Send reading</button><span className="mute">Sensor 1 = temperature (limit 85 °C), 2 = vibration (7.1 mm/s), 3 = pressure / current</span></div>
          </form>
          {out && <CodeBlock title="Backend response">{JSON.stringify(out, null, 2)}</CodeBlock>}
        </Card>
        <Card title="2 · Generate a burst of readings">
          <div className="form">
            <Field label="Machine"><select value={bulk.machine_id} onChange={(e) => setBulk({ ...bulk, machine_id: e.target.value })}><option value="">All machines (normal readings)</option>{lk?.machines.map((m) => <option key={m.Machine_ID} value={m.Machine_ID}>{m.Machine_Code}</option>)}</select></Field>
            <label className="row"><input type="checkbox" checked={bulk.inject} onChange={(e) => setBulk({ ...bulk, inject: e.target.checked })} /> Make sensor #1 drift past its limit</label>
            <div className="full"><button className="btn" disabled={busy} onClick={sendBulk}>{busy ? 'Sending…' : 'Send 20 readings per sensor'}</button></div>
          </div>
          {bulkOut && <CodeBlock title="Result">{JSON.stringify(bulkOut, null, 2)}</CodeBlock>}
        </Card>
      </div>
    </>
  );
}
