import { Router } from 'express';
import { guard } from '../middleware/auth.js';
import { ah, ALL } from '../utils/http.js';
import { computeForecast } from '../services/forecast.js';

const router = Router();
// Regression forecast for every active sensor (see backend/src/ml/regression.js and ml/README.md)
router.get('/forecast', guard(ALL), ah(async (req, res) => {
  const hours = Math.min(Math.max(Number(req.query.hours) || 24, 4), 24 * 14);
  res.json({ hours, generated_at: new Date().toISOString(), items: await computeForecast(hours) });
}));
export default router;
