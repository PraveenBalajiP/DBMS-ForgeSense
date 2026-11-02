// MySQL setup / reset. SQL files live in ../database/mysql
//   npm run db:setup                           first-time build (NON-destructive: stops if tables already exist)
//   npm run db:reset -- --confirm-destroy      DROPS the database named in .env, then rebuilds + seeds it
//   npm run db:setup:test / db:reset:test      same against the dedicated *_test database (.env.test)
// Safety: a database whose name does not end in "_test" is never dropped without --confirm-destroy.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const dir = new URL('../../database/mysql/', import.meta.url);
const mode = process.argv[2] === 'reset' ? 'reset' : 'setup';
const confirmed = process.argv.includes('--confirm-destroy');
const db = process.env.MYSQL_DATABASE;
if (!db || !/^[A-Za-z0-9_]+$/.test(db)) { console.error('MYSQL_DATABASE is missing or has unsafe characters.'); process.exit(1); }
if (mode === 'reset' && !db.endsWith('_test') && !confirmed) {
  console.error(`Refusing to DROP database "${db}" without --confirm-destroy.\nThis deletes ALL data in it. If you really mean it:\n  npm run db:reset -- --confirm-destroy`);
  process.exit(1);
}

const env = { ...process.env, MYSQL_PWD: process.env.MYSQL_PASSWORD || '' };
const run = (label, sql) => {
  const r = spawnSync('mysql', ['-h', process.env.MYSQL_HOST || 'localhost', '-P', process.env.MYSQL_PORT || '3306', '-u', process.env.MYSQL_USER], { input: sql, env, encoding: 'utf8' });
  if (r.error) { console.error('Could not run `mysql` - is the MySQL client on your PATH?', r.error.message); process.exit(1); }
  if (r.status !== 0) { console.error(`FAILED ${label}\n${r.stderr}`); process.exit(1); }
  console.log('ok  ' + label);
};

if (mode === 'reset') run(`DROP DATABASE ${db}`, `DROP DATABASE IF EXISTS \`${db}\`;`);
for (const f of ['01_schema', '02_alter_constraints_indexes', '03_views', '04_routines_triggers', '05_seed']) {
  run(`database/mysql/${f}.sql`, readFileSync(new URL(`${f}.sql`, dir), 'utf8').replaceAll('Industrial_IoT', db));
}
console.log(mode === 'reset' ? `Database ${db} dropped, rebuilt and seeded.` : `Database ${db} created and seeded.`);
