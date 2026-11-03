// npm run verify  -> run before EVERY push (the .githooks/pre-push hook runs it automatically).
// Fails (exit 1) if something unsafe or broken is about to be pushed.
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

let failed = false;
const fail = (m) => { console.error('\u274c ' + m); failed = true; };
const ok = (m) => console.log('\u2705 ' + m);
const sh = (c) => execSync(c, { encoding: 'utf8' }).trim();

// 1. forbidden files must not be tracked
const tracked = sh('git ls-files').split('\n').filter(Boolean);
const forbidden = tracked.filter((f) => (/(^|\/)\.env($|\.)/.test(f) && !f.endsWith('.example'))
  || /(^|\/)(node_modules|\.next|\.venv|__pycache__)\//.test(f) || /\.(log|zip)$/.test(f));
forbidden.length ? fail('Forbidden files are tracked:\n   ' + forbidden.join('\n   ') + '\n   Fix: git rm --cached <file>') : ok('No env / node_modules / build / venv / log / zip files tracked');

// 2. secret scan on tracked text files
const patterns = [[/MYSQL_PASSWORD\s*=\s*(?!your_mysql_password|\s*$)\S+/, 'MYSQL_PASSWORD value'], [/JWT_SECRET\s*=\s*(?!change-me|test-only)\S+/, 'JWT_SECRET value'],
  [/INGEST_API_KEY\s*=\s*(?!device-key-change-me|test-ingest-key)\S+/, 'INGEST_API_KEY value'], [/mongodb(\+srv)?:\/\/[^\s:@/]+:[^\s@/]+@/, 'MongoDB URI with password'],
  [/ghp_[A-Za-z0-9]{30,}/, 'GitHub token'], [/-----BEGIN (RSA |EC )?PRIVATE KEY-----/, 'private key']];
let leaks = 0;
for (const f of tracked.filter((f) => !/\.(png|jpg|jpeg|pdf|zip)$/.test(f) && !/package-lock\.json$/.test(f) && f !== 'scripts/pre-push-check.js' && existsSync(f))) {
  const t = readFileSync(f, 'utf8');
  for (const [re, name] of patterns) if (re.test(t)) { fail(`Possible secret (${name}) in ${f}`); leaks++; }
}
if (!leaks) ok('No secrets found in tracked files');

// 3. .gitignore protects env files
const gi = existsSync('.gitignore') ? readFileSync('.gitignore', 'utf8') : '';
/^\.env$/m.test(gi) && /node_modules/.test(gi) ? ok('.gitignore covers .env files and node_modules') : fail('.gitignore must list .env and node_modules');

// 4. backend unit tests + frontend production build
for (const [label, cmd] of [['backend unit tests', 'npm --prefix backend run test:unit'], ['frontend production build', 'npm --prefix frontend run build']]) {
  const r = spawnSync(cmd, { shell: true, stdio: 'inherit' });
  r.status === 0 ? ok(label + ' passed') : fail(label + ' FAILED');
}
console.log(failed ? '\n\u26d4 Do NOT push. Fix the items above.' : '\n\ud83d\ude80 Safe to push. (Run the DB/API tests too: see docs/GIT_GUIDE.md section F.)');
process.exit(failed ? 1 : 0);
