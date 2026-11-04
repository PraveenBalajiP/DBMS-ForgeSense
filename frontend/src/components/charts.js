'use client';
import { useState } from 'react';

const PALETTE = ['#2563eb', '#f59e0b', '#16a34a', '#dc2626', '#7c3aed', '#0891b2'];

// Multi-series line/scatter chart with threshold lines and hover tooltip. Pure SVG, no libraries.
// series: [{ label, color, points:[{x,y}], dots?:bool, dashed?:bool, width?:number, faint?:bool }]
// thresholds: [{ value, label, color }]   xFormat(x) -> string
export function LineChart({ series, thresholds = [], xFormat = (x) => x, unit = '', height = 260 }) {
  const [hover, setHover] = useState(null);
  const all = series.flatMap((s) => s.points);
  if (!all.length) return <div className="empty">No data points yet.</div>;
  const W = 760, H = height, L = 46, R = 14, T = 12, B = 28;
  const xs = all.map((p) => p.x), ys = [...all.map((p) => p.y), ...thresholds.map((t) => t.value)];
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0r = Math.min(...ys), y1r = Math.max(...ys);
  const pad = (y1r - y0r) * 0.1 || 1, y0 = y0r - pad, y1 = y1r + pad;
  const sx = (x) => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - R);
  const sy = (y) => H - B - ((y - y0) / (y1 - y0 || 1)) * (H - T - B);
  const yTicks = [0, 1, 2, 3, 4].map((i) => y0 + ((y1 - y0) * i) / 4);
  const xTicks = [0, 1, 2, 3].map((i) => x0 + ((x1 - x0) * i) / 3);
  const nearest = (evt) => {
    const r = evt.currentTarget.getBoundingClientRect();
    const px = ((evt.clientX - r.left) / r.width) * W;
    let best = null, d = Infinity;
    series.forEach((s, si) => !s.faint && s.points.forEach((p) => { const dd = Math.abs(sx(p.x) - px); if (dd < d) { d = dd; best = { si, p }; } }));
    setHover(best);
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" onMouseMove={nearest} onMouseLeave={() => setHover(null)} role="img" aria-label="line chart">
      {yTicks.map((t, i) => (<g key={i}><line x1={L} x2={W - R} y1={sy(t)} y2={sy(t)} className="grid" /><text x={L - 6} y={sy(t) + 3} textAnchor="end" className="tick">{Number(t.toFixed(1))}</text></g>))}
      {xTicks.map((t, i) => <text key={i} x={sx(t)} y={H - 8} textAnchor="middle" className="tick">{xFormat(t)}</text>)}
      {thresholds.map((t) => (<g key={t.label}><line x1={L} x2={W - R} y1={sy(t.value)} y2={sy(t.value)} stroke={t.color} strokeDasharray="6 4" strokeWidth="1.5" /><text x={W - R - 2} y={sy(t.value) - 4} textAnchor="end" className="tick" fill={t.color}>{t.label} {t.value}{unit}</text></g>))}
      {series.map((s, i) => {
        const c = s.color || PALETTE[i % PALETTE.length];
        const d = s.points.map((p, j) => `${j ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
        return (<g key={s.label} opacity={s.faint ? 0.45 : 1}>
          {!s.dotsOnly && <path d={d} fill="none" stroke={c} strokeWidth={s.width || 2} strokeDasharray={s.dashed ? '7 5' : undefined} />}
          {s.dots && s.points.map((p, j) => <circle key={j} cx={sx(p.x)} cy={sy(p.y)} r={p.bad ? 4 : 3} fill={p.bad ? '#dc2626' : c} />)}
        </g>);
      })}
      {hover && (() => { const { si, p } = hover; const X = sx(p.x), Y = sy(p.y); const label = `${series[si].label}: ${Number(p.y.toFixed(2))}${unit} · ${xFormat(p.x)}`; const w = label.length * 6.2 + 12; const bx = Math.min(Math.max(X - w / 2, L), W - R - w);
        return (<g pointerEvents="none"><line x1={X} x2={X} y1={T} y2={H - B} className="grid" /><circle cx={X} cy={Y} r="5" fill="none" stroke="#111" /><rect x={bx} y={Math.max(Y - 32, 2)} width={w} height="20" rx="4" className="tip" /><text x={bx + 6} y={Math.max(Y - 18, 16)} className="tiptext">{label}</text></g>); })()}
    </svg>
  );
}

// horizontal bars: items = [{ label, value, color? }]
export function BarList({ items, max, unit = '' }) {
  if (!items?.length) return <div className="empty">No data.</div>;
  const m = max ?? Math.max(...items.map((i) => i.value), 1);
  return (<div className="bars">{items.map((it, i) => (
    <div key={it.label} className="barrow"><span className="barlabel">{it.label}</span>
      <span className="bartrack"><span className="barfill" style={{ width: `${(it.value / m) * 100}%`, background: it.color || PALETTE[i % PALETTE.length] }} /></span>
      <span className="barval">{it.value}{unit}</span></div>))}</div>);
}

// vertical columns: items = [{ label, value }]
export function Columns({ items, color = '#2563eb', height = 150 }) {
  if (!items?.length) return <div className="empty">No data.</div>;
  const m = Math.max(...items.map((i) => i.value), 1), W = 520, bw = W / items.length;
  return (<svg viewBox={`0 0 ${W} ${height + 22}`} className="chart" role="img" aria-label="column chart">
    {items.map((it, i) => { const h = (it.value / m) * (height - 18); return (<g key={it.label}>
      <rect x={i * bw + 6} y={height - h} width={bw - 12} height={h} rx="3" fill={color}><title>{it.label}: {it.value}</title></rect>
      <text x={i * bw + bw / 2} y={height - h - 4} textAnchor="middle" className="tick">{it.value}</text>
      <text x={i * bw + bw / 2} y={height + 14} textAnchor="middle" className="tick">{it.label}</text></g>); })}
  </svg>);
}

export function Sparkline({ values, color = '#2563eb', w = 110, h = 28 }) {
  if (!values || values.length < 2) return <span className="mute">—</span>;
  const lo = Math.min(...values), hi = Math.max(...values), d = values.map((v, i) => `${i ? 'L' : 'M'}${(i / (values.length - 1)) * w},${h - 2 - ((v - lo) / (hi - lo || 1)) * (h - 4)}`).join(' ');
  return <svg width={w} height={h} aria-hidden="true"><path d={d} fill="none" stroke={color} strokeWidth="1.8" /></svg>;
}
