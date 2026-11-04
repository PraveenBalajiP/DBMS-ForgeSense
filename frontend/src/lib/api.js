// All browser requests go to Next.js (same origin); next.config.mjs forwards /api/* to the Express backend.
export async function api(url, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method, credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) { const e = new Error(data?.error || `Request failed (${res.status})`); e.status = res.status; throw e; }
  return data;
}

export const fmtDate = (s) => (s ? String(s).replace('T', ' ').slice(0, 16) : '—');
export const fmtNum = (n, d = 2) => (n == null || Number.isNaN(Number(n)) ? '—' : Number(n).toLocaleString(undefined, { maximumFractionDigits: d }));
export const fmtMoney = (n) => `₹${fmtNum(n, 2)}`;
export const fmtHours = (h) => (h == null ? '—' : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${fmtNum(h, 1)} h` : `${fmtNum(h / 24, 1)} d`);
