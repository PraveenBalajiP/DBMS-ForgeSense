'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useApi } from '@/lib/useApi';
import { fmtDate, fmtHours, fmtNum } from '@/lib/api';
import { Badge, Card, DataTable, ErrorBox, PageHeader, Spinner } from '@/components/ui';
import { Sparkline } from '@/components/charts';

const RISKS = ['All', 'Critical', 'High', 'Medium', 'Low', 'None'];
export default function Forecast() {
  const [hours, setHours] = useState(24), [risk, setRisk] = useState('All');
  const { data, error, loading, reload } = useApi(`/api/ml/forecast?hours=${hours}`);
  const items = (data?.items || []).filter((i) => risk === 'All' || (i.forecast?.risk || 'None') === risk);
  return (
    <>
      <PageHeader title="Failure-risk forecast" subtitle="Linear regression (OLS) on hourly averages of every active sensor, read from MongoDB"
        actions={<><select value={hours} onChange={(e) => setHours(Number(e.target.value))} aria-label="History window"><option value={12}>last 12 h</option><option value={24}>last 24 h</option><option value={48}>last 48 h</option><option value={72}>last 72 h</option></select><button className="btn sec sm" onClick={reload}>Refresh</button></>} />
      <div className="callout" style={{ marginBottom: 14 }}>
        <b>How to read this.</b> For each sensor a straight line is fitted to the hourly average readings. If the line heads towards the limit, <i>time to limit</i> is the distance left divided by the slope.
        <b> R²</b> says how well a straight line explains the data (close to 1 = trustworthy, low = noisy: treat the estimate as a hint). Risk: ≤ 6 h Critical · ≤ 24 h High · ≤ 72 h Medium. It is a trend estimate, not a guarantee.
      </div>
      <div className="chips" style={{ marginBottom: 12 }}>{RISKS.map((r) => <button key={r} className={`chip ${risk === r ? 'on' : ''}`} onClick={() => setRisk(r)}>{r}</button>)}</div>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Spinner text="Running the model…" /> : (
        <Card title={`${items.length} sensors`} actions={data && <span className="mute">generated {fmtDate(data.generated_at)}</span>}>
          <DataTable empty="No sensors match. Load telemetry first (Simulator, or npm run load:sample)." rows={items.map((i) => ({ ...i, id: `${i.machine_id}-${i.sensor_no}` }))} columns={[
            { key: 'machine_code', label: 'Machine', render: (i) => <Link href={`/machines/${i.machine_id}`}>{i.machine_code}</Link> },
            { key: 'sensor_type', label: 'Sensor' },
            { key: 'last', label: 'Last (hourly avg)', render: (i) => (i.forecast ? `${fmtNum(i.forecast.last)} ${i.unit}` : '—') },
            { key: 'limit', label: 'Limit', render: (i) => [i.min != null ? `min ${i.min}` : null, i.max != null ? `max ${i.max}` : null].filter(Boolean).join(' · ') },
            { key: 'trend', label: 'Trend (24 h)', render: (i) => <Sparkline values={i.spark} /> },
            { key: 'slope', label: 'Slope / h', render: (i) => (i.forecast ? fmtNum(i.forecast.slope_per_hour, 3) : '—') },
            { key: 'r2', label: 'R²', render: (i) => (i.forecast ? fmtNum(i.forecast.r2, 2) : '—') },
            { key: 'conf', label: 'Confidence', render: (i) => (i.forecast ? <Badge v={i.forecast.confidence}>{i.forecast.confidence}</Badge> : <span className="mute">too few points ({i.points})</span>) },
            { key: 'ttl', label: 'Time to limit', render: (i) => <b>{fmtHours(i.forecast?.hours_to_breach)}</b> },
            { key: 'risk', label: 'Risk', render: (i) => <Badge v={i.forecast?.risk || 'None'} /> },
          ]} />
        </Card>
      )}
    </>
  );
}
