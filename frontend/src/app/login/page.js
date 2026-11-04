'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

const DEMO = [['Admin', 'admin@iiot.local'], ['Engineer', 'engineer@iiot.local'], ['Technician', 'tech1@iiot.local']];

export default function Login() {
  const [f, setF] = useState({ email: '', password: '' }), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await api('/api/auth/login', { method: 'POST', body: f }); window.location.href = '/'; }
    catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="login">
      <form className="card logincard" onSubmit={submit}>
        <h1>⚙ IIoT Engine</h1>
        <p className="mute" style={{ marginBottom: 16 }}>Predictive maintenance &amp; sensor alert engine</p>
        <div className="form" style={{ gridTemplateColumns: '1fr' }}>
          <label className="field"><span>Email</span><input type="email" autoComplete="username" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
          <label className="field"><span>Password</span><input type="password" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
          <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </div>
        {err && <div className="errbox" style={{ marginTop: 12 }}>{err}</div>}
        <div className="callout" style={{ marginTop: 16 }}>
          <b>Demo accounts</b> (development only) — password <code>Password@123</code>
          <div className="chips" style={{ marginTop: 8 }}>
            {DEMO.map(([role, email]) => <button type="button" key={role} className="chip" onClick={() => setF({ email, password: 'Password@123' })}>{role}</button>)}
          </div>
        </div>
      </form>
    </div>
  );
}
