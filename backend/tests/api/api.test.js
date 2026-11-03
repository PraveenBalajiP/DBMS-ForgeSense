// Tests the BACKEND directly (port 4100). Needs: test DB (npm run db:reset:test) and the API running (npm run start:test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT } from 'jose';
import { BASE } from '../helpers/guard.js';

const H = { 'Content-Type': 'application/json' };
const call = (method, path, cookie, body, extra = {}) => fetch(BASE + path, { method, headers: { ...H, ...(cookie ? { cookie } : {}), ...extra }, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
async function login(email, password = 'Password@123') {
  const r = await call('POST', '/api/auth/login', null, { email, password });
  const cookie = (r.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
  return { status: r.status, cookie };
}
const as = async (email) => (await login(email)).cookie;

// ---------- authentication ----------
test('T1 wrong password -> 401', async () => assert.equal((await login('admin@iiot.local', 'wrong')).status, 401));
test('T2 inactive user cannot log in', async () => assert.equal((await login('former@iiot.local')).status, 401));
test('T3 API without login -> 401', async () => assert.equal((await call('GET', '/api/machines')).status, 401));
test('tampered token -> 401', async () => assert.equal((await call('GET', '/api/machines', 'token=abc.def.ghi')).status, 401));
test('expired token -> 401', async () => {
  const t = await new SignJWT({ uid: 1, role: 'Admin', name: 'x' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime(Math.floor(Date.now() / 1000) - 60)
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
  assert.equal((await call('GET', '/api/machines', `token=${t}`)).status, 401);
});
test('login with missing fields -> 400; malformed JSON -> 400', async () => {
  assert.equal((await call('POST', '/api/auth/login', null, {})).status, 400);
  assert.equal((await call('POST', '/api/auth/login', null, '{not json')).status, 400);
});
test('login response never contains a password hash', async () => {
  const r = await call('POST', '/api/auth/login', null, { email: 'admin@iiot.local', password: 'Password@123' });
  assert.doesNotMatch(await r.text(), /\$2[aby]\$/);
});
test('unknown route -> 404 JSON', async () => assert.equal((await call('GET', '/api/nope', await as('admin@iiot.local'))).status, 404));

// ---------- collection routes ----------
test('GET /api/machines returns the 6 seeded machines', async () => {
  const r = await call('GET', '/api/machines', await as('admin@iiot.local'));
  assert.equal(r.status, 200); assert.equal((await r.json()).length, 6);
});
test('GET /api/alerts returns a list, filterable by severity', async () => {
  const c = await as('admin@iiot.local');
  const all = await (await call('GET', '/api/alerts', c)).json();
  const crit = await (await call('GET', '/api/alerts?severity=Critical', c)).json();
  assert.ok(Array.isArray(all) && all.length >= 5); assert.ok(crit.every((a) => a.Severity === 'Critical'));
});
test('T6 technician sees only their own work orders (valid JSON)', async () => {
  const r = await call('GET', '/api/work-orders', await as('tech1@iiot.local'));
  assert.equal(r.status, 200);
  const rows = await r.json();
  assert.ok(rows.length >= 1 && rows.every((w) => w.Assigned_To === 'Tara Technician'));
});
test('dashboard returns KPIs even without MongoDB', async () => {
  const j = await (await call('GET', '/api/dashboard', await as('admin@iiot.local'))).json();
  assert.equal(j.kpi.machines, 6); assert.ok(Array.isArray(j.bySeverity) && Array.isArray(j.alertsByDay));
});

// ---------- item routes ----------
test('GET item routes: found, not found, bad id', async () => {
  const c = await as('admin@iiot.local');
  assert.equal((await call('GET', '/api/machines/1', c)).status, 200);
  assert.equal((await call('GET', '/api/machines/99999', c)).status, 404);
  assert.equal((await call('GET', '/api/machines/abc', c)).status, 400);
  assert.equal((await call('GET', '/api/alerts/1', c)).status, 200);
  assert.equal((await call('GET', '/api/alerts/99999', c)).status, 404);
  assert.equal((await call('GET', '/api/work-orders/2', c)).status, 200);
  assert.equal((await call('GET', '/api/work-orders/99999', c)).status, 404);
});
test('PATCH with unknown action -> 400; malformed JSON -> 400', async () => {
  const c = await as('admin@iiot.local');
  assert.equal((await call('PATCH', '/api/alerts/4', c, { action: 'explode' })).status, 400);
  assert.equal((await call('PATCH', '/api/work-orders/2', c, '{oops')).status, 400);
});

// ---------- authorization ----------
test('T5 technician cannot create machines, list users, simulate or use the explorer', async () => {
  const c = await as('tech1@iiot.local');
  assert.equal((await call('POST', '/api/machines', c, {})).status, 403);
  assert.equal((await call('GET', '/api/users', c)).status, 403);
  assert.equal((await call('POST', '/api/simulate', c, {})).status, 403);
  assert.equal((await call('GET', '/api/explorer/tables', c)).status, 403);
});
test('T7 technician cannot read, modify or add parts to another technician\'s order', async () => {
  const c = await as('tech1@iiot.local');          // order 4 belongs to tech2
  assert.equal((await call('GET', '/api/work-orders/4', c)).status, 403);
  assert.equal((await call('PATCH', '/api/work-orders/4', c, { action: 'complete' })).status, 403);
  assert.equal((await call('POST', '/api/work-orders/4/parts', c, { part_id: 1, quantity: 1 })).status, 403);
});
test('engineer cannot delete work orders or use the users API', async () => {
  const c = await as('engineer@iiot.local');
  assert.equal((await call('DELETE', '/api/work-orders/4', c)).status, 403);
  assert.equal((await call('GET', '/api/users', c)).status, 403);
});
test('users list never exposes password hashes', async () => {
  assert.doesNotMatch(await (await call('GET', '/api/users', await as('admin@iiot.local'))).text(), /Password_Hash|\$2[aby]\$/);
});
test('explorer: table allow-list and no password column', async () => {
  const c = await as('engineer@iiot.local');
  assert.equal((await call('GET', '/api/explorer/tables/USER', c)).status, 200);
  assert.doesNotMatch(await (await call('GET', '/api/explorer/tables/USER', c)).text(), /Password_Hash|\$2[aby]\$/);
  assert.equal((await call('GET', '/api/explorer/tables/mysql.user', c)).status, 404);
  assert.equal((await call('GET', '/api/explorer/queries/open-alerts-join', c)).status, 200);
});

// ---------- validation / integrity through the API ----------
test('T9 DB-level validation surfaces through the API (bad e-mail -> 409)', async () => {
  const r = await call('POST', '/api/users', await as('admin@iiot.local'), { Email: 'bad', Password: '12345678', First_Name: 'a', Last_Name: 'b', Role_ID: 3 });
  assert.equal(r.status, 409); assert.match((await r.json()).error, /chk_user_email/);
});
test('missing required fields -> 400', async () => {
  const c = await as('admin@iiot.local');
  assert.equal((await call('POST', '/api/machines', c, {})).status, 400);
  assert.equal((await call('POST', '/api/work-orders', c, {})).status, 400);
});
test('duplicate machine code -> 409', async () => {
  const r = await call('POST', '/api/machines', await as('admin@iiot.local'), { Machine_Code: 'CNC-001', Machine_Name: 'dup', Plant_ID: 1 });
  assert.equal(r.status, 409);
});
test('T11 insufficient stock -> 409 and stock unchanged', async () => {
  const c = await as('engineer@iiot.local');
  const before = (await (await call('GET', '/api/parts', c)).json()).find((p) => p.Part_ID === 1).Quantity_In_Stock;
  const r = await call('POST', '/api/work-orders/2/parts', c, { part_id: 1, quantity: 99999 });
  assert.equal(r.status, 409); assert.match((await r.json()).error, /Insufficient stock/);
  assert.equal((await (await call('GET', '/api/parts', c)).json()).find((p) => p.Part_ID === 1).Quantity_In_Stock, before);
});
test('T10 assigning to an inactive user is rejected by the DB trigger', async () => {
  const r = await call('PATCH', '/api/work-orders/3', await as('engineer@iiot.local'), { action: 'assign', user_id: 5 });
  assert.equal(r.status, 409); assert.match((await r.json()).error, /inactive user/);
});

// ---------- ingestion API protection (no MongoDB needed for these) ----------
const ing = (body, key = process.env.INGEST_API_KEY) => call('POST', '/api/ingest', null, body, key === null ? {} : { 'x-api-key': key });
test('T16 ingest without / with wrong key -> 401', async () => {
  assert.equal((await ing({ machine_id: 1, sensor_no: 1, value: 50 }, null)).status, 401);
  assert.equal((await ing({ machine_id: 1, sensor_no: 1, value: 50 }, 'nope')).status, 401);
});
test('ingest rejects invalid payloads -> 400', async () => {
  for (const b of [{}, { machine_id: 'x', sensor_no: 1, value: 5 }, { machine_id: 1, sensor_no: 1, value: 'abc' }, { machine_id: 1, sensor_no: 1, value: null },
    { machine_id: 1, sensor_no: 1, value: 5, ts: 'not-a-date' }, { machine_id: 1, sensor_no: 1, value: 5, ts: '2999-01-01' }])
    assert.equal((await ing(b)).status, 400, JSON.stringify(b));
  assert.equal((await ing('{bad json')).status, 400);
});
test('ingest payload over 10 kB -> 413', async () => assert.equal((await ing({ machine_id: 1, sensor_no: 1, value: 5, pad: 'x'.repeat(11000) })).status, 413));
test('T17 ingest for an unknown sensor -> 404', async () => assert.equal((await ing({ machine_id: 999, sensor_no: 1, value: 50 })).status, 404));
