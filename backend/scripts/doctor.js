// npm run doctor  -> READ-ONLY health check of configuration, MySQL schema and MongoDB. Changes nothing.
import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';

let failed = false;
const ok = (m) => console.log('\u2705 ' + m), warn = (m) => console.log('\u26a0\ufe0f  ' + m), bad = (m) => { console.log('\u274c ' + m); failed = true; };

for (const n of ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE', 'MONGODB_URI', 'MONGODB_DB', 'JWT_SECRET', 'INGEST_API_KEY']) process.env[n] ? ok(`${n} is set`) : bad(`${n} is missing`);
if ((process.env.JWT_SECRET || '').length < 32) bad('JWT_SECRET must be at least 32 characters');

const expected = { tables: 12, views: 4, procedures: 4, functions: 1, triggers: 4 };
try {
  const c = await mysql.createConnection({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE });
  ok(`MySQL reachable, database "${process.env.MYSQL_DATABASE}" selected`);
  const db = process.env.MYSQL_DATABASE;
  const n = async (sql) => Number((await c.query(sql, [db]))[0][0].n);
  const got = {
    tables: await n("SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE'"),
    views: await n('SELECT COUNT(*) n FROM information_schema.VIEWS WHERE TABLE_SCHEMA=?'),
    procedures: await n("SELECT COUNT(*) n FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=? AND ROUTINE_TYPE='PROCEDURE'"),
    functions: await n("SELECT COUNT(*) n FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=? AND ROUTINE_TYPE='FUNCTION'"),
    triggers: await n('SELECT COUNT(*) n FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=?'),
  };
  for (const k of Object.keys(expected)) got[k] === expected[k] ? ok(`${k}: ${got[k]}`) : bad(`${k}: found ${got[k]}, expected ${expected[k]}`);
  if (got.tables < expected.tables) warn('Fewer tables than expected: this database may still be the older Task-3 version. Build a NEW database with `npm run db:setup` (non-destructive) instead of resetting this one.');
  const [tbls] = await c.query("SELECT TABLE_NAME t FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE'", [db]);
  const rows = {};
  for (const { t } of tbls) rows[t] = Number((await c.query(`SELECT COUNT(*) n FROM \`${t}\``))[0][0].n);
  console.log('   row counts:', JSON.stringify(rows));
  if (tbls.length && Object.values(rows).every((v) => v === 0)) warn('All tables are empty (seed data not loaded).');
  const [[chk]] = await c.query("SELECT COUNT(*) n FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=? AND CONSTRAINT_TYPE='CHECK'", [db]);
  chk.n > 0 ? ok(`${chk.n} CHECK constraints present`) : bad('No CHECK constraints (run database/mysql/02 and use MySQL 8.0.16+)');
  await c.end();
} catch (e) { bad('MySQL: ' + (e.code || e.message) + '  (is MySQL running? are the .env credentials right?)'); }

const mc = new MongoClient(process.env.MONGODB_URI || '', { serverSelectionTimeoutMS: 4000 });
try {
  await mc.connect();
  const col = mc.db(process.env.MONGODB_DB).collection('sensor_readings');
  ok(`MongoDB reachable, ${await col.estimatedDocumentCount()} readings stored`);
  const names = (await col.indexes().catch(() => [])).map((i) => i.name);
  names.includes('idx_machine_sensor_ts') ? ok('compound index present') : warn('compound index missing: run  mongosh database/mongodb/01_setup.js');
  names.includes('ttl_ts_90d') ? ok('TTL index present') : warn('TTL index missing: run  mongosh database/mongodb/01_setup.js');
} catch (e) { bad('MongoDB: ' + e.message.split('\n')[0] + '  (is mongod running?)'); }
await mc.close();
process.exit(failed ? 1 : 0);
