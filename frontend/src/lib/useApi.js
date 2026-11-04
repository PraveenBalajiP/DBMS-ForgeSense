'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

// const { data, error, loading, reload } = useApi('/api/machines', { every: 15000 })
// url = null skips the request. `every` (ms) enables polling. resetOnChange clears old data when the url changes.
export function useApi(url, { every = 0, resetOnChange = false } = {}) {
  const [state, setState] = useState({ data: null, error: '', loading: !!url });
  const alive = useRef(true);
  const load = useCallback(async (quiet = false) => {
    if (!url) return;
    if (!quiet) setState((s) => ({ ...s, loading: true, error: '' }));
    try { const data = await api(url); if (alive.current) setState({ data, error: '', loading: false }); }
    catch (e) { if (alive.current) setState((s) => ({ data: quiet ? s.data : null, error: e.message, loading: false })); }
  }, [url]);
  useEffect(() => {
    alive.current = true;
    if (resetOnChange) setState({ data: null, error: '', loading: !!url });   // detail views: never show the previous record
    load();
    return () => { alive.current = false; };
  }, [load]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!every || !url) return undefined; const t = setInterval(() => load(true), every); return () => clearInterval(t); }, [every, url, load]);
  return { ...state, reload: () => load() };
}
