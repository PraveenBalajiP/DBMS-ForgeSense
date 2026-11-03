// End-to-end telemetry: reading -> MongoDB -> threshold check -> MySQL alert.
// Needs MongoDB + the API running on the TEST environment. Skips itself when MongoDB is unreachable.
// (create the test collection first:  mongosh --eval "process.env.MONGODB_DB='industrial_iot_test'" database/mongodb/01_setup.js  - see docs/SETUP_GUIDE.md)
import { BASE } from '../helpers/guard.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient } from 'mongodb';
import { q, endPool } from '../../src/db/mysql.js';

const mc = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 3000 });
let col, up = true;
before(async () => { try { await mc.connect(); col = mc.db(process.env.MONGODB_DB).collection('sensor_readings'); } catch { up = false; } });
after(async () => { await mc.close(); await endPool(); });

const ingest = (body) => fetch(BASE + '/api/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.INGEST_API_KEY }, body: JSON.stringify(body) });
// machine 6 / sensor 1 = temperature, max 85 C

test('normal reading is stored in MongoDB with status OK and raises no alert', async (t) => {
  if (!up) return t.skip('MongoDB not reachable');
  const before_ = (await q('SELECT COUNT(*) n FROM ALERT'))[0].n;
  const r = await ingest({ machine_id: 6, sensor_no: 1, value: 50 });
  assert.equal(r.status, 201); const j = await r.json(); assert.equal(j.status, 'OK'); assert.equal(j.alert, null);
  const doc = await col.find({ machine_id: 6, sensor_no: 1 }).sort({ ts: -1 }).limit(1).next();
  assert.equal(doc.value, 50); assert.equal(doc.status, 'OK');
  assert.equal((await q('SELECT COUNT(*) n FROM ALERT'))[0].n, before_);
});
test('threshold breach creates ONE alert; repeating it does not duplicate', async (t) => {
  if (!up) return t.skip('MongoDB not reachable');
  const n0 = (await q('SELECT COUNT(*) n FROM ALERT WHERE Machine_ID = 6'))[0].n;
  const a = await (await ingest({ machine_id: 6, sensor_no: 1, value: 99 })).json();
  assert.equal(a.status, 'ALERT'); assert.equal(Number(a.alert.Is_New), 1);
  const b = await (await ingest({ machine_id: 6, sensor_no: 1, value: 101 })).json();
  assert.equal(Number(b.alert.Is_New), 0); assert.equal(b.alert.Alert_ID, a.alert.Alert_ID);
  assert.equal((await q('SELECT COUNT(*) n FROM ALERT WHERE Machine_ID = 6'))[0].n, n0 + 1);
  const [row] = await q('SELECT Actual_Value, Severity FROM ALERT WHERE Alert_ID = ?', [a.alert.Alert_ID]);
  assert.equal(row.Actual_Value, 101); assert.ok(['High', 'Critical'].includes(row.Severity));
});
test('breach is also visible in MongoDB (status ALERT)', async (t) => {
  if (!up) return t.skip('MongoDB not reachable');
  assert.ok(await col.countDocuments({ machine_id: 6, sensor_no: 1, status: 'ALERT' }) >= 2);
});
test('unknown sensor stores nothing in MongoDB', async (t) => {
  if (!up) return t.skip('MongoDB not reachable');
  const n = await col.countDocuments({ machine_id: 999 });
  assert.equal((await ingest({ machine_id: 999, sensor_no: 1, value: 50 })).status, 404);
  assert.equal(await col.countDocuments({ machine_id: 999 }), n);
});
test('MongoDB schema validator rejects a malformed document', async (t) => {
  if (!up) return t.skip('MongoDB not reachable');
  await assert.rejects(() => col.insertOne({ machine_id: 6, sensor_no: 1, sensor_type: 'T', value: 1, unit: 'C', ts: new Date(), status: 'BAD' }), /validation/i);
});
test('regression forecast endpoint responds for a logged-in user', async (t) => {
  if (!up) return t.skip('MongoDB not reachable');
  const l = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@iiot.local', password: 'Password@123' }) });
  const cookie = (l.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
  const r = await fetch(BASE + '/api/ml/forecast', { headers: { cookie } });
  assert.equal(r.status, 200); assert.ok(Array.isArray((await r.json()).items));
});
