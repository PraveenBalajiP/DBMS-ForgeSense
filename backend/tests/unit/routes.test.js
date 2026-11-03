// Guards the API structure: each router file must define exactly these METHOD + path pairs.
// (Catches item-level code pasted into collection routes, e.g. a PATCH '/:id' inside alerts '/'.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const EXPECTED = {
  auth: ['POST /login', 'POST /logout', 'GET /me'],
  dashboard: ['GET /'],
  lookups: ['GET /'],
  ingest: ['POST /'],
  simulate: ['POST /', 'POST /reading'],
  ml: ['GET /forecast'],
  machines: ['GET /', 'POST /', 'GET /:id', 'PUT /:id', 'DELETE /:id', 'POST /:id/sensors', 'GET /:id/readings'],
  alerts: ['GET /', 'GET /:id', 'PATCH /:id'],
  workOrders: ['GET /', 'POST /', 'GET /:id', 'PATCH /:id', 'DELETE /:id', 'GET /:id/parts', 'POST /:id/parts'],
  parts: ['GET /', 'POST /', 'PATCH /', 'DELETE /'],
  users: ['GET /', 'POST /', 'PATCH /'],
  explorer: ['GET /tables', 'GET /tables/:name', 'GET /queries', 'GET /queries/:id', 'GET /mongo/overview', 'GET /mongo/documents', 'GET /mongo/pipeline'],
};
const defined = (f) => [...readFileSync(new URL(`../../src/routes/${f}.js`, import.meta.url), 'utf8')
  .matchAll(/router\.(get|post|put|patch|delete)\('([^']*)'/g)].map((m) => `${m[1].toUpperCase()} ${m[2]}`).sort();

for (const [file, want] of Object.entries(EXPECTED)) {
  test(`routes/${file}.js defines exactly: ${want.join(', ')}`, () => assert.deepEqual(defined(file), [...want].sort()));
}
test('collection routes never read an id param', () => {
  const src = readFileSync(new URL('../../src/routes/machines.js', import.meta.url), 'utf8');
  const root = src.split("router.get('/:id'")[0];
  assert.doesNotMatch(root, /req\.params\.id/);
});
test('users route never selects password hashes', () => {
  const src = readFileSync(new URL('../../src/routes/users.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src.split("router.post('/'")[0], /Password_Hash/);
});
test('every router is mounted in app.js', () => {
  const app = readFileSync(new URL('../../src/app.js', import.meta.url), 'utf8');
  for (const f of Object.keys(EXPECTED)) assert.match(app, new RegExp(`import ${f} from './routes/${f}.js'`));
});
