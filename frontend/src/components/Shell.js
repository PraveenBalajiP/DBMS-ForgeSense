'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from './AuthProvider';

const NAV = [
  { group: 'Monitor', items: [['/', 'Dashboard', '▦'], ['/forecast', 'Forecast (ML)', '↗'], ['/machines', 'Machines', '⚙'], ['/alerts', 'Alerts', '⚠']] },
  { group: 'Maintenance', items: [['/work-orders', 'Work orders', '🛠'], ['/parts', 'Spare parts', '▤']] },
  { group: 'Data', items: [['/explorer', 'Data explorer', '⛁', ['Admin', 'Engineer']]] },
  { group: 'Administration', items: [['/users', 'Users', '☺', ['Admin']], ['/simulator', 'Simulator', '≈', ['Admin']]] },
];

export default function Shell({ children }) {
  const { me, logout } = useAuth();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  if (path === '/login' || !me) return children;
  const active = (href) => (href === '/' ? path === '/' : path.startsWith(href));
  return (
    <div className="shell">
      <aside className={`side ${open ? 'open' : ''}`}>
        <div className="brand">⚙ IIoT Engine<small>Predictive maintenance</small></div>
        {NAV.map((g) => {
          const items = g.items.filter((i) => !i[3] || i[3].includes(me.role));
          return items.length ? (<div key={g.group}><div className="navgroup">{g.group}</div>
            {items.map(([href, label, icon]) => <Link key={href} href={href} onClick={() => setOpen(false)} className={`navlink ${active(href) ? 'on' : ''}`}><span className="ico">{icon}</span>{label}</Link>)}</div>) : null;
        })}
        <div className="sidefoot"><div className="who"><b>{me.name}</b><span>{me.role}</span></div><button className="btn sec sm" onClick={logout}>Log out</button></div>
      </aside>
      <div className="main">
        <header className="topbar"><button className="btn sec sm burger" onClick={() => setOpen(!open)} aria-label="Menu">☰</button><span className="mute">Industrial IoT Predictive Maintenance &amp; Sensor Alert Engine</span></header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
