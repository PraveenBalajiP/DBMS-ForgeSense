import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { ah, HttpError } from '../utils/http.js';
import { ingestReading } from '../services/ingest.js';

// Device endpoint, authenticated with an API key header (NOT a user session):
// curl -X POST http://localhost:4000/api/ingest -H "x-api-key: $INGEST_API_KEY" -H "Content-Type: application/json" \
//      -d '{"machine_id":1,"sensor_no":1,"value":91.2}'
const router = Router();
const keyOk = (given) => {
  const expected = process.env.INGEST_API_KEY;
  if (!expected || typeof given !== 'string') return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);          // constant-time comparison
};

router.post('/', ah(async (req, res) => {
  if (!keyOk(req.get('x-api-key'))) throw new HttpError(401, 'Invalid API key');
  res.status(201).json(await ingestReading(req.body));
}));
export default router;
