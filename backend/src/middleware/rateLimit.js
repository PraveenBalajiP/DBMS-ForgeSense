// Tiny in-memory limiter for FAILED logins (per IP + e-mail). Fine for one process / a college demo;
// use Redis or a gateway limiter if ever deployed behind several instances.
const hits = (globalThis.__loginHits ??= new Map());
const WINDOW = 15 * 60 * 1000, MAX = 10;

export function tooManyFailures(key) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < WINDOW);
  hits.set(key, arr);
  return arr.length >= MAX;
}
export const recordFailure = (key) => hits.set(key, [...(hits.get(key) || []), Date.now()]);
export const clearFailures = (key) => hits.delete(key);
