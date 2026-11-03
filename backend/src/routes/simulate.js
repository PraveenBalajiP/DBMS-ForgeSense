import { Router } from 'express';
import { guard } from '../middleware/auth.js';
import { ah } from '../utils/http.js';
import { simulate } from '../services/simulate.js';
import { ingestReading } from '../services/ingest.js';

const router = Router();

// bulk: generate readings for all sensors (optionally make one machine drift past its limit)
router.post('/', guard(['Admin']), ah(async (req, res) => {
  const b = req.body || {};
  res.json(await simulate({ machine_id: b.machine_id || null, points: Number(b.points) || 20, stepMinutes: Number(b.stepMinutes) || 1, injectMachine: b.inject ? b.machine_id : null }));
}));

// single reading through the REAL pipeline (MongoDB insert -> threshold check -> MySQL alert): ideal for a live demo
router.post('/reading', guard(['Admin']), ah(async (req, res) => {
  res.status(201).json(await ingestReading(req.body));
}));
export default router;
