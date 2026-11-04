'use client';
import { useState } from 'react';
import { useApi } from '@/lib/useApi';
import { Badge, Card, CodeBlock, DataTable, ErrorBox, Field, PageHeader, Spinner, Tabs } from '@/components/ui';
import { BarList } from '@/components/charts';

// Turns any row object into DataTable columns (used for "show me the raw data" views)
const cell = (v) => (v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
const autoCols = (rows) => Object.keys(rows[0] || {}).map((k) => ({ key: k, label: k, render: (r) => cell(r[k]) }));

function SqlTables() {
  const { data: tables, error } = useApi('/api/explorer/tables');
  const [name, setName] = useState('ALERT');
  const t = useApi(`/api/explorer/tables/${name}?limit=50`, { resetOnChange: true });
  return (
    <div className="split">
      <Card title="Tables & views" className="list">
        <ErrorBox error={error} />
        {!tables ? <Spinner /> : tables.map((x) => (<button key={x.name} className={name === x.name ? 'on' : ''} onClick={() => setName(x.name)}><span>{x.kind === 'view' ? '◧ ' : ''}{x.name}</span><span>{x.rows}</span></button>))}
      </Card>
      <Card title={`${name} (first 50 rows)`}>
        <ErrorBox error={t.error} />
        {t.loading && !t.data ? <Spinner /> : t.data && (<><CodeBlock title="SQL executed by the backend">{t.data.sql}</CodeBlock><DataTable rows={t.data.rows} columns={t.data.rows.length ? autoCols(t.data.rows) : []} empty="This table is empty." /></>)}
      </Card>
    </div>
  );
}

function SqlQueries() {
  const { data: list, error } = useApi('/api/explorer/queries');
  const [id, setId] = useState('open-alerts-join');
  const r = useApi(`/api/explorer/queries/${id}`, { resetOnChange: true });
  return (
    <div className="split">
      <Card title="Saved queries" className="list">
        <ErrorBox error={error} />
        {!list ? <Spinner /> : list.map((x) => <button key={x.id} className={id === x.id ? 'on' : ''} onClick={() => setId(x.id)}><span>{x.title}</span></button>)}
      </Card>
      <Card title={r.data?.title || 'Result'}>
        <ErrorBox error={r.error} />
        {r.loading && !r.data ? <Spinner /> : r.data && (<><CodeBlock title="SQL (copy into MySQL Workbench or the mysql CLI)">{r.data.sql}</CodeBlock><DataTable rows={r.data.rows} columns={r.data.rows.length ? autoCols(r.data.rows) : []} empty="Query returned no rows." /></>)}
      </Card>
    </div>
  );
}

function Mongo() {
  const ov = useApi('/api/explorer/mongo/overview');
  const [f, setF] = useState({ machine: '', sensor: '', status: '' });
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const docs = useApi(`/api/explorer/mongo/documents?limit=10&${qs}`);
  const [pm, setPm] = useState({ machine: 3, sensor: 1 });
  const pipe = useApi(`/api/explorer/mongo/pipeline?machine=${pm.machine}&sensor=${pm.sensor}`);
  const compassFilter = JSON.stringify(docs.data?.filter || {}, null, 2);
  if (ov.error) return <ErrorBox error={ov.error} onRetry={ov.reload} />;
  if (!ov.data) return <Spinner />;
  const o = ov.data;
  return (
    <>
      <div className="grid g2">
        <Card title={`Collection ${o.database}.${o.collection}`}>
          <p><b>{o.count}</b> documents</p>
          <h2 style={{ margin: '10px 0 6px' }}>Indexes</h2>
          <DataTable rows={o.indexes.map((i) => ({ id: i.name, ...i }))} columns={[{ key: 'name', label: 'Name' }, { key: 'key', label: 'Keys', render: (i) => JSON.stringify(i.key) }, { key: 'expireAfterSeconds', label: 'TTL (s)', render: (i) => i.expireAfterSeconds ?? '—' }]} />
          <h2 style={{ margin: '10px 0 6px' }}>Readings by status</h2>
          <BarList items={o.byStatus.map((s) => ({ label: s._id, value: s.n, color: { OK: '#16a34a', WARN: '#ea580c', ALERT: '#dc2626' }[s._id] }))} />
        </Card>
        <Card title="Schema validator ($jsonSchema)"><CodeBlock>{JSON.stringify(o.validator, null, 2) || 'No validator (run database/mongodb/01_setup.js)'}</CodeBlock></Card>
      </div>
      <Card title="Latest documents (what MongoDB Compass shows in the Documents tab)">
        <div className="row" style={{ marginBottom: 10 }}>
          <Field label="machine_id"><input style={{ width: 90 }} value={f.machine} onChange={(e) => setF({ ...f, machine: e.target.value })} /></Field>
          <Field label="sensor_no"><input style={{ width: 90 }} value={f.sensor} onChange={(e) => setF({ ...f, sensor: e.target.value })} /></Field>
          <Field label="status"><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">any</option><option>OK</option><option>WARN</option><option>ALERT</option></select></Field>
        </div>
        <ErrorBox error={docs.error} />
        {docs.data && (<div className="grid g2"><div><CodeBlock title="Compass → Filter box">{compassFilter}</CodeBlock><CodeBlock title="Compass → Options → Sort">{'{ "ts": -1 }'}</CodeBlock></div>
          <CodeBlock title={`${docs.data.docs.length} documents`}>{JSON.stringify(docs.data.docs, null, 2)}</CodeBlock></div>)}
      </Card>
      <Card title="Aggregation pipeline (Compass → Aggregations tab)">
        <div className="row" style={{ marginBottom: 10 }}>
          <Field label="machine_id"><input type="number" style={{ width: 90 }} value={pm.machine} onChange={(e) => setPm({ ...pm, machine: e.target.value })} /></Field>
          <Field label="sensor_no"><input type="number" style={{ width: 90 }} value={pm.sensor} onChange={(e) => setPm({ ...pm, sensor: e.target.value })} /></Field>
        </div>
        <ErrorBox error={pipe.error} />
        {pipe.data && (<><CodeBlock title="Pipeline (dates are shown as ISO strings: in Compass write new Date('…') or drop the $match date)">{JSON.stringify(pipe.data.pipeline, null, 2)}</CodeBlock>
          <DataTable rows={pipe.data.result.map((r) => ({ id: r._id, ...r }))} empty="No readings in the last 24 h for this sensor." columns={[{ key: '_id', label: 'Hour', render: (r) => String(r._id).slice(0, 16).replace('T', ' ') }, { key: 'avg', label: 'avg', render: (r) => Number(r.avg).toFixed(2) }, { key: 'min', label: 'min' }, { key: 'max', label: 'max' }, { key: 'sd', label: 'stddev', render: (r) => Number(r.sd).toFixed(2) }, { key: 'n', label: 'n' }]} /></>)}
      </Card>
    </>
  );
}

export default function Explorer() {
  const [tab, setTab] = useState('tables');
  return (
    <>
      <PageHeader title="Data explorer" subtitle="Read-only window onto both databases: use it to prove where the data lives (read docs/DEMO_GUIDE.md)" actions={<><Badge v="Open">MySQL</Badge><Badge v="Medium">MongoDB</Badge></>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'tables', label: 'MySQL tables & views' }, { id: 'queries', label: 'MySQL queries (JOIN, GROUP BY, window…)' }, { id: 'mongo', label: 'MongoDB telemetry' }]} />
      {tab === 'tables' && <SqlTables />}{tab === 'queries' && <SqlQueries />}{tab === 'mongo' && <Mongo />}
    </>
  );
}
