// One place that turns any error into a safe JSON response:
// 400 bad input | 401 | 403 | 404 | 409 database rule violated | 413 | 429 | 503 database offline | 500 generic (details only in the log)
export const notFound = (req, res) => res.status(404).json({ error: 'Route not found' });

export function errorHandler(e, req, res, next) {           // eslint-disable-line no-unused-vars
  if (e.type === 'entity.parse.failed' || e instanceof SyntaxError) return res.status(400).json({ error: 'Request body must be valid JSON' });
  if (e.type === 'entity.too.large') return res.status(413).json({ error: 'Payload too large' });
  if (e.status && e.status < 500) return res.status(e.status).json({ error: e.message });

  const offline = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST'].includes(e.code)
    || e.name === 'MongoServerSelectionError' || e.name === 'MongoNetworkError';
  if (offline) {
    console.error('[db offline]', e.code || e.name, e.message);
    return res.status(503).json({ error: 'A database service is unavailable. Check that MySQL and MongoDB are running (npm run doctor).' });
  }
  const dbRule = e.sqlState === '45000'
    || ['ER_DUP_ENTRY', 'ER_NO_REFERENCED_ROW_2', 'ER_ROW_IS_REFERENCED_2', 'ER_CHECK_CONSTRAINT_VIOLATED', 'ER_CONSTRAINT_FAILED'].includes(e.code)
    || e.errno === 4025 || e.errno === 3819;
  if (dbRule) return res.status(409).json({ error: e.sqlMessage || e.message });   // constraint / trigger / procedure messages are meant for users

  console.error('[server error]', e);
  return res.status(500).json({ error: e.config ? e.message : 'Internal server error' });
}
