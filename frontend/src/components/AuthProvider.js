'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const Ctx = createContext({ me: null });
export const useAuth = () => useContext(Ctx);

export default function AuthProvider({ children }) {
  const [me, setMe] = useState(null), [ready, setReady] = useState(false);
  const path = usePathname(), router = useRouter();
  useEffect(() => {
    if (path === '/login') { setReady(true); return; }
    api('/api/auth/me').then((u) => { setMe(u); setReady(true); }).catch(() => router.replace('/login'));
  }, [path, router]);
  const logout = async () => { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); setMe(null); router.replace('/login'); };
  if (!ready) return <div className="boot">Loading…</div>;
  return <Ctx.Provider value={{ me, logout }}>{children}</Ctx.Provider>;
}
