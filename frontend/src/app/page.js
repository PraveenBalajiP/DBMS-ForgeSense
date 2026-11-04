'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useApi } from '@/lib/useApi';
import { fmtDate, fmtHours, fmtNum } from '@/lib/api';
import { Badge, Card, DataTable, ErrorBox, PageHeader, Spinner, Stat } from '@/components/ui';
import { BarList, Columns, Sparkline } from '@/components/charts';

const SEV = { Critical: '#dc2626', High: '#ea580c', Medium: '#ca8a04', Low: '#16a34a' };
const ST = { Operational: '#16a34a', Warning: '#ea580c', Faulted: '#dc2626', Maintenance: '#ca8a04', Decommissioned: '#64748b' };

export default function Dashboard() {
  const [auto, setAuto] = useState(false);
  const { data: d, error, loading, reload } = useApi('/api/dashboard', { every: auto ? 15000 : 0 });
  if (loading && !d) return <Spinner />;
  if (error && !d) return <ErrorBox error={error} onRetry={reload} />;
  const k = d.kpi;
  return (
    <>
      <PageHeader title="Plant health dashboard" subtitle="Live status from MySQL (operational data) and MongoDB (telemetry) · regression forecast"
        actions={<><label className="row mute"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto-refresh (15 s)</label><button className="btn sec sm" onClick={reload}>Refresh</button></>} />
      <div className="grid kpis">
        <Stat label="Machines" value={k.machines} tone="pri" />
        <Stat label="Machines at risk" value={k.machines_at_risk} tone={k.machines_at_risk ? 'warn' : 'ok'} />
        <Stat label="Unresolved alerts" value={k.open_alerts} tone={k.open_alerts ? 'warn' : 'ok'} />
        <Stat label="Critical alerts" value={k.critical_alerts} tone={k.critical_alerts ? 'bad' : 'ok'} />
        <Stat label="Open work orders" value={k.open_work_orders} tone="pri" />
        <Stat label="Low-stock parts" value={k.low_stock} tone={k.low_stock ? 'warn' : 'ok'} />
      </div>
      {!d.mongoOnline && <div className="errbox">MongoDB is not reachable: telemetry panels are empty. Start MongoDB and run <code>npm run doctor</code>.</div>}

      <div className="grid g2">
        <Card title="Unresolved alerts" actions={<Link href="/alerts">All alerts →</Link>}>
          <DataTable empty="No unresolved alerts 🎉" rows={d.recent} columns={[
            { key: 'Severity', label: 'Severity', render: (a) => <Badge v={a.Severity} /> },
            { key: 'Machine_Code', label: 'Machine', render: (a) => <Link href={`/machines/${a.Machine_ID}`}>{a.Machine_Code}</Link> },
            { key: 'Message', label: 'Message' },
            { key: 'Actual_Value', label: 'Value', render: (a) => `${fmtNum(a.Actual_Value)} ${a.Unit}` },
          ]} />
        </Card>
        <Card title="Next predicted limit breaches (regression)" actions={<Link href="/forecast">Full forecast →</Link>}>
          <DataTable empty={d.mongoOnline ? 'No sensor is trending towards its limit.' : 'Needs MongoDB.'} rows={d.forecastTop.map((f, i) => ({ ...f, id: i }))} columns={[
            { key: 'machine_code', label: 'Machine', render: (f) => <Link href={`/machines/${f.machine_id}`}>{f.machine_code}</Link> },
            { key: 'sensor_type', label: 'Sensor' },
            { key: 'trend', label: 'Trend', render: (f) => <Sparkline values={f.spark} /> },
            { key: 'eta', label: 'Time to limit', render: (f) => <b>{fmtHours(f.forecast.hours_to_breach)}</b> },
            { key: 'risk', label: 'Risk', render: (f) => <Badge v={f.forecast.risk} /> },
          ]} />
        </Card>
        <Card title="Alerts per day (last 14 days)"><Columns items={d.alertsByDay.map((x) => ({ label: String(x.d).slice(5, 10), value: Number(x.n) }))} /></Card>
        <Card title="Unresolved alerts by severity"><BarList items={d.bySeverity.map((s) => ({ label: s.Severity, value: Number(s.n), color: SEV[s.Severity] }))} /></Card>
        <Card title="Machine status"><BarList items={d.machineStatus.map((s) => ({ label: s.Status, value: Number(s.n), color: ST[s.Status] }))} /></Card>
        <Card title="Technician workload (open orders)"><BarList items={d.workload.map((w) => ({ label: w.name, value: Number(w.open_orders) }))} max={Math.max(3, ...d.workload.map((w) => Number(w.open_orders)))} /></Card>
        <Card title="Most alert-prone machines (30 days)"><BarList items={d.topMachines.map((m) => ({ label: m.Machine_Code, value: Number(m.alerts_30d) }))} /></Card>
        <Card title="Threshold breaches, last 24 h (MongoDB aggregation)">
          <DataTable empty="No breaches recorded." rows={d.breaches.map((b) => ({ id: b._id, ...b }))} columns={[
            { key: '_id', label: 'Machine #' }, { key: 'breaches', label: 'Breaching readings' }, { key: 'worst', label: 'Worst value', render: (b) => fmtNum(b.worst) },
          ]} />
        </Card>
      </div>
      <p className="mute">Last loaded {fmtDate(new Date().toISOString())}</p>
    </>
  );
}
