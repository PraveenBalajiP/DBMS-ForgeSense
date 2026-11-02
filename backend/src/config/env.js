// Central environment validation. Fails with a readable message and never prints secret VALUES.
export function requireEnv(names, { minLength = {} } = {}) {
  const problems = [];
  for (const n of names) {
    const v = process.env[n];
    if (v === undefined || v === '') problems.push(`${n} is missing`);
    else if (minLength[n] && v.length < minLength[n]) problems.push(`${n} is too short (need at least ${minLength[n]} characters)`);
  }
  if (problems.length) {
    const e = new Error(`Server configuration error: ${problems.join('; ')}. Copy backend/.env.example to backend/.env and fill it in.`);
    e.config = true;
    throw e;
  }
}
export const requireMysqlEnv = () => requireEnv(['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE']);
export const requireMongoEnv = () => requireEnv(['MONGODB_URI', 'MONGODB_DB']);
export const requireAuthEnv = () => requireEnv(['JWT_SECRET'], { minLength: { JWT_SECRET: 32 } });
export const requireAllEnv = () => { requireMysqlEnv(); requireMongoEnv(); requireAuthEnv(); requireEnv(['INGEST_API_KEY']); };
