'use client';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { useApi } from '@/lib/useApi';
import { api, fmtDate, fmtNum } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { Badge, Card, DataTable, ErrorBox, PageHeader, Spinner, useAction } from '@/components/ui';

const SEV = ['All', 'Critical', 'High', 'Medium', 'Low'];
export default function Alerts() {
  const { me } = useAuth(), run = useAction();
  const [sev, setSev] = useState('All'), [status, setStatus] = useState(''), [text, setText] = useState('');
  const search = useDeferredValue(text);
  const qs = new URLSearchParams(Object.entries({ severity: sev === 'All' ? '' : sev, status, q: search }).filter(([, v]) => v)).toString();
  const { data: rows, error, loading, reload } = useApi(`/api/alerts?${qs}`);
  const act = async (id, action) => { if (await run(() => api(`/api/alerts/${id}`, { method: 'PATCH', body: { action } }), action === 'resolve' ? 'Alert resolved' : 'Alert acknowledged')) reload(); };
  return (
    <>
      <PageHeader title="Alerts" subtitle="Raised automatically by threshold breaches (stored procedure sp_raise_alert). Search uses MySQL FULLTEXT." actions={<button className="btn sec sm" onClick={reload}>Refresh</button>} />
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="chips">{SEV.map((s) => <button key={s} className={`chip ${sev === s ? 'on' : ''}`} onClick={() => setSev(s)}>{s}</button>)}</div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">Any status</option>{['Open', 'Acknowledged', 'Resolved'].map((s) => <option key={s}>{s}</option>)}</select>
        <input placeholder="Search message (full-text)…" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !rows ? <Spinner /> : (
        <Card><DataTable rows={rows || []} empty="No alerts match the filters." columns={[
          { key: 'Severity', label: 'Severity', render: (a) => <Badge v={a.Severity} /> },
          { key: 'Machine_Code', label: 'Machine', render: (a) => <Link href={`/machines/${a.Machine_ID}`}>{a.Machine_Code}</Link> },
          { key: 'Type_Name', label: 'Sensor' }, { key: 'Message', label: 'Message' },
          { key: 'Threshold_Value', label: 'Limit', render: (a) => `${fmtNum(a.Threshold_Value)} ${a.Unit}` }, { key: 'Actual_Value', label: 'Observed', render: (a) => <b>{fmtNum(a.Actual_Value)} {a.Unit}</b> },
          { key: 'Status', label: 'Status', render: (a) => <Badge v={a.Status} /> }, { key: 'Created_At', label: 'Raised', render: (a) => fmtDate(a.Created_At) },
          { key: 'act', label: '', render: (a) => (<div className="row">
            {a.Status === 'Open' && <button className="btn sec sm" onClick={() => act(a.Alert_ID, 'acknowledge')}>Acknowledge</button>}
            {a.Status !== 'Resolved' && me.role !== 'Technician' && <button className="btn sm" onClick={() => act(a.Alert_ID, 'resolve')}>Resolve</button>}</div>) },
        ]} /></Card>
      )}
    </>
  );
}
