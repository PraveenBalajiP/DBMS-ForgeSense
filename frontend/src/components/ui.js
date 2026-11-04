'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export const Badge = ({ v, children }) => <span className={`badge b-${String(v).replace(/\s+/g, '-')}`}>{children ?? v}</span>;
export const Spinner = ({ text = 'Loading…' }) => <div className="empty"><span className="spin" /> {text}</div>;
export const Empty = ({ text = 'Nothing to show.' }) => <div className="empty">{text}</div>;
export const ErrorBox = ({ error, onRetry }) => error ? <div className="errbox">{error} {onRetry && <button className="btn sec sm" onClick={onRetry}>Retry</button>}</div> : null;

export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="pagehead"><div><h1>{title}</h1>{subtitle && <p className="mute">{subtitle}</p>}</div><div className="row">{actions}</div></div>
);
export const Card = ({ title, actions, children, className = '' }) => (
  <section className={`card ${className}`}>{(title || actions) && <div className="cardhead"><h2>{title}</h2><div className="row">{actions}</div></div>}{children}</section>
);
export const Stat = ({ label, value, tone, hint }) => (
  <div className={`stat ${tone ? 't-' + tone : ''}`}><div className="statv">{value ?? '—'}</div><div className="statl">{label}</div>{hint && <div className="stath">{hint}</div>}</div>
);
export const Tabs = ({ tabs, value, onChange }) => (
  <div className="tabs" role="tablist">{tabs.map((t) => <button key={t.id} role="tab" aria-selected={value === t.id} className={value === t.id ? 'on' : ''} onClick={() => onChange(t.id)}>{t.label}</button>)}</div>
);

export function Modal({ open, title, onClose, children, wide }) {
  useEffect(() => { if (!open) return undefined; const h = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="cardhead"><h2>{title}</h2><button className="btn sec sm" onClick={onClose} aria-label="Close">✕</button></div>{children}
      </div>
    </div>
  );
}

// generic table: columns = [{ key, label, render?(row), align? }]
export function DataTable({ columns, rows, empty = 'No records.', onRowClick }) {
  if (!rows?.length) return <Empty text={empty} />;
  return (
    <div className="tablewrap"><table className="table">
      <thead><tr>{columns.map((c) => <th key={c.key} style={{ textAlign: c.align }}>{c.label}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => (
        <tr key={r.id ?? i} onClick={onRowClick ? () => onRowClick(r) : undefined} className={onRowClick ? 'click' : ''}>
          {columns.map((c) => <td key={c.key} style={{ textAlign: c.align }}>{c.render ? c.render(r) : (r[c.key] ?? '—')}</td>)}
        </tr>))}</tbody>
    </table></div>
  );
}

// ---- toasts
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((kind, text) => {
    const id = Math.random().toString(36).slice(2);
    setItems((s) => [...s, { id, kind, text }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 4500);
  }, []);
  const api = { ok: (t) => push('ok', t), err: (t) => push('err', t) };
  return <ToastCtx.Provider value={api}>{children}<div className="toasts" aria-live="polite">{items.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}</div></ToastCtx.Provider>;
}

// run an async action with toast feedback; returns true on success
export function useAction() {
  const toast = useToast();
  return async (fn, okText) => {
    try { const r = await fn(); if (okText) toast.ok(typeof okText === 'function' ? okText(r) : okText); return true; }
    catch (e) { toast.err(e.message); return false; }
  };
}

export const Field = ({ label, children }) => <label className="field"><span>{label}</span>{children}</label>;
export const CodeBlock = ({ children, title }) => {
  const [done, setDone] = useState(false);
  return (<div className="code">{title && <div className="codehead"><span>{title}</span>
    <button className="btn sec sm" onClick={() => { navigator.clipboard?.writeText(String(children)); setDone(true); setTimeout(() => setDone(false), 1500); }}>{done ? 'Copied' : 'Copy'}</button></div>}
    <pre>{children}</pre></div>);
};
