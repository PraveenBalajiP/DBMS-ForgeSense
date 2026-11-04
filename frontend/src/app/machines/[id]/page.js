'use client';
import Link from 'next/link';
import { use, useState } from 'react';
import { useApi } from '@/lib/useApi';
import { api, fmtDate, fmtHours, fmtMoney, fmtNum } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { Badge, Card, DataTable, ErrorBox, Field, Modal, PageHeader, Spinner, Stat, Tabs, useAction } from '@/components/ui';
import { LineChart } from '@/components/charts';

const STATUSES = ['Operational', 'Warning', 'Faulted', 'Maintenance', 'Decommissioned'];
const timeFmt = (span) => (x) => new Date(x).toLocaleString([], span > 36 * 3600000 ? { month: 'short', day: 'numeric', hour: '2-digit' } : { hour: '2-digit', minute: '2-digit' });

export default function MachineDetail({ params }) {
  const { id } = use(params);
  const { me } = useAuth(), run = useAction();
  const [tab, setTab] = useState('telemetry'), [sensor, setSensor] = useState(1), [hours, setHours] = useState(24);
  const [open, setOpen] = useState(false), [sf, setSf] = useState({ Sensor_Code: '', Sensor_Type_ID: '' });
  const { data: d, error, loading, reload } = useApi(`/api/machines/${id}`);
  const tel = useApi(tab === 'telemetry' ? `/api/machines/${id}/readings?sensor=${sensor}&hours=${hours}` : null, { resetOnChange: true });
  const { data: lk } = useApi(open ? '/api/lookups' : null);
  if (loading && !d) return <Spinner />;
  if (error && !d) return <ErrorBox error={error} onRetry={reload} />;
  const m = d.machine, manage = me.role !== 'Technician';
  const setStatus = async (Status) => { if (await run(() => api(`/api/machines/${id}`, { method: 'PUT', body: { Status } }), 'Status updated')) reload(); };
  const addSensor = async (e) => { e.preventDefault(); if (await run(() => api(`/api/machines/${id}/sensors`, { method: 'POST', body: sf }), (r) => `Sensor #${r.Sensor_No} added`)) { setOpen(false); setSf({ Sensor_Code: '', Sensor_Type_ID: '' }); reload(); } };

  // ---- telemetry chart data: raw readings, hourly averages, regression line and projection to the limit
  const T = tel.data, fc = T?.forecast, lim = T?.sensor;
  let chart = null;
  if (T) {
    const raw = T.raw.map((r) => ({ x: new Date(r.ts).getTime(), y: r.value, bad: r.status === 'ALERT' }));
    const hourly = T.hourly.map((h) => ({ x: new Date(h._id).getTime(), y: h.avg }));
    const series = [{ label: 'Reading', color: '#2563eb', points: raw, dots: true, width: 1.2, faint: true }, { label: 'Hourly avg', color: '#f59e0b', points: hourly, dots: true }];
    if (fc) {
      series.push({ label: 'Regression fit', color: '#16a34a', points: fc.fitted.map((p) => ({ x: p.t, y: p.v })), dashed: true });
      if (fc.hours_to_breach != null && fc.hours_to_breach < 96) {
        const lastF = fc.fitted[fc.fitted.length - 1];
        series.push({ label: 'Projection', color: '#dc2626', dashed: true, points: [{ x: lastF.t, y: lastF.v }, { x: lastF.t + fc.hours_to_breach * 3600000, y: fc.slope_per_hour > 0 ? lim.Max_Threshold : lim.Min_Threshold }] });
      }
    }
    const span = Math.max(...series.flatMap((s) => s.points.map((p) => p.x))) - Math.min(...series.flatMap((s) => s.points.map((p) => p.x)));
    chart = { series, span };
  }
  return (
    <>
      <PageHeader title={`${m.Machine_Code} — ${m.Machine_Name}`} subtitle={`${m.Plant_Name} · ${m.Manufacturer || 'unknown make'} ${m.Model || ''}`}
        actions={<><Badge v={m.Status} />{manage && <select value={m.Status} onChange={(e) => setStatus(e.target.value)} aria-label="Set status">{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>}<Link className="btn sec sm" href="/machines">← All machines</Link></>} />
      <div className="grid kpis">
        <Stat label="Age (derived attribute)" value={`${m.Machine_Age ?? '—'} yrs`} /><Stat label="Criticality" value={m.Criticality} />
        <Stat label="Open alerts" value={m.Open_Alerts} tone={m.Open_Alerts ? 'bad' : 'ok'} /><Stat label="Open work orders" value={m.Open_Work_Orders} tone={m.Open_Work_Orders ? 'warn' : 'ok'} />
        <Stat label="Operating modes" value={d.modes.length || '—'} hint={d.modes.join(', ')} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'telemetry', label: 'Telemetry & forecast' }, { id: 'alerts', label: `Alerts (${d.alerts.length})` }, { id: 'wo', label: `Work orders (${d.workOrders.length})` }, { id: 'history', label: 'Maintenance history' }, { id: 'sensors', label: `Sensors (${d.sensors.length})` }]} />

      {tab === 'telemetry' && (
        <Card title="MongoDB telemetry + regression model" actions={<>
          <select value={sensor} onChange={(e) => setSensor(Number(e.target.value))} aria-label="Sensor">{d.sensors.map((s) => <option key={s.Sensor_No} value={s.Sensor_No}>#{s.Sensor_No} {s.Type_Name}</option>)}</select>
          <select value={hours} onChange={(e) => setHours(Number(e.target.value))} aria-label="Window"><option value={6}>6 h</option><option value={24}>24 h</option><option value={72}>72 h</option></select></>}>
          <ErrorBox error={tel.error} onRetry={tel.reload} />
          {tel.loading && !T ? <Spinner /> : T && (<>
            <LineChart series={chart.series} unit={` ${lim.Unit}`} xFormat={timeFmt(chart.span)}
              thresholds={[lim.Max_Threshold != null && { value: lim.Max_Threshold, label: 'max', color: '#dc2626' }, lim.Min_Threshold != null && { value: lim.Min_Threshold, label: 'min', color: '#ea580c' }].filter(Boolean)} />
            {fc ? (
              <div className="grid kpis" style={{ marginTop: 12, marginBottom: 0 }}>
                <Stat label="Slope per hour" value={`${fc.slope_per_hour > 0 ? '+' : ''}${fmtNum(fc.slope_per_hour, 3)} ${lim.Unit}`} />
                <Stat label="R² (fit quality)" value={fmtNum(fc.r2, 2)} hint={`confidence ${fc.confidence}, n=${fc.n}`} tone={fc.confidence === 'High' ? 'ok' : 'warn'} />
                <Stat label="Time to limit" value={fmtHours(fc.hours_to_breach)} hint={fc.eta ? `ETA ${fmtDate(fc.eta)}` : 'trend not moving towards a limit'} tone={fc.risk === 'Critical' || fc.risk === 'High' ? 'bad' : undefined} />
                <Stat label="Risk class" value={<Badge v={fc.risk} />} />
              </div>) : <p className="mute">Not enough hourly data yet (need at least 4 hours of readings) for a regression forecast.</p>}
            <details style={{ marginTop: 12 }}><summary>Hourly aggregation (MongoDB $group)</summary>
              <DataTable rows={T.hourly.map((h) => ({ id: h._id, ...h }))} columns={[{ key: '_id', label: 'Hour', render: (h) => fmtDate(h._id) }, { key: 'avg', label: 'Avg', render: (h) => fmtNum(h.avg) }, { key: 'min', label: 'Min' }, { key: 'max', label: 'Max' }, { key: 'sd', label: 'σ', render: (h) => fmtNum(h.sd) }, { key: 'n', label: 'n' }]} /></details>
          </>)}
        </Card>)}

      {tab === 'alerts' && <Card><DataTable rows={d.alerts} empty="No alerts for this machine." columns={[
        { key: 'Severity', label: 'Severity', render: (a) => <Badge v={a.Severity} /> }, { key: 'Type_Name', label: 'Sensor' }, { key: 'Message', label: 'Message' },
        { key: 'Actual_Value', label: 'Value', render: (a) => `${fmtNum(a.Actual_Value)} / ${fmtNum(a.Threshold_Value)} ${a.Unit}` }, { key: 'Status', label: 'Status', render: (a) => <Badge v={a.Status} /> }, { key: 'Created_At', label: 'Raised', render: (a) => fmtDate(a.Created_At) }]} /></Card>}

      {tab === 'wo' && <Card><DataTable rows={d.workOrders} empty="No work orders." columns={[
        { key: 'Work_Order_ID', label: '#', render: (w) => <Link href="/work-orders">#{w.Work_Order_ID}</Link> }, { key: 'Priority', label: 'Priority', render: (w) => <Badge v={w.Priority} /> }, { key: 'Description', label: 'Description' },
        { key: 'Status', label: 'Status', render: (w) => <Badge v={w.Status} /> }, { key: 'Assigned_To', label: 'Assigned to', render: (w) => w.Assigned_To || 'Unassigned' }, { key: 'Due_Date', label: 'Due', render: (w) => fmtDate(w.Due_Date) }]} /></Card>}

      {tab === 'history' && <Card><DataTable rows={d.history.map((h) => ({ id: h.Maintenance_ID, ...h }))} empty="No maintenance recorded yet." columns={[
        { key: 'Maintenance_Type', label: 'Type' }, { key: 'Description', label: 'Description' }, { key: 'Cost', label: 'Cost', render: (h) => fmtMoney(h.Cost), align: 'right' }, { key: 'Completed_Date', label: 'Completed' }]} /></Card>}

      {tab === 'sensors' && <Card title="Sensors (weak entity: Machine_ID + Sensor_No)" actions={manage && <button className="btn sm" onClick={() => setOpen(true)}>+ Add sensor</button>}>
        <DataTable rows={d.sensors.map((s) => ({ id: s.Sensor_No, ...s }))} columns={[{ key: 'Sensor_No', label: '#' }, { key: 'Sensor_Code', label: 'Code' }, { key: 'Type_Name', label: 'Type', render: (s) => `${s.Type_Name} (${s.Unit})` },
          { key: 'Min_Threshold', label: 'Min limit', render: (s) => s.Min_Threshold ?? '—' }, { key: 'Max_Threshold', label: 'Max limit', render: (s) => s.Max_Threshold ?? '—' }, { key: 'Status', label: 'Status', render: (s) => <Badge v={s.Status} /> }]} /></Card>}

      <Modal open={open} title="Add sensor" onClose={() => setOpen(false)}>
        <form className="form" onSubmit={addSensor}>
          <Field label="Sensor code *"><input required value={sf.Sensor_Code} onChange={(e) => setSf({ ...sf, Sensor_Code: e.target.value })} /></Field>
          <Field label="Type *"><select required value={sf.Sensor_Type_ID} onChange={(e) => setSf({ ...sf, Sensor_Type_ID: e.target.value })}><option value="">Select…</option>{lk?.sensorTypes.map((t) => <option key={t.Sensor_Type_ID} value={t.Sensor_Type_ID}>{t.Type_Name} ({t.Unit})</option>)}</select></Field>
          <div className="full row"><button className="btn">Add</button></div>
        </form>
      </Modal>
    </>
  );
}
