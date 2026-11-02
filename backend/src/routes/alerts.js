import { Router } from 'express';
import { q } from '../db/mysql.js';
import { guard } from '../middleware/auth.js';
import { ah, HttpError, intId, ALL } from '../utils/http.js';

const router = Router();

// Filters + MySQL FULLTEXT search (q) on the alert message
router.get('/', guard(ALL), ah(async (req, res) => {
  const { severity, status, machine, q: search } = req.query;
  let from = 'v_alert_detail v';
  const where = [], args = [];
  if (search) { from += ' JOIN ALERT a ON a.Alert_ID = v.Alert_ID'; where.push('MATCH(a.Message) AGAINST (? IN NATURAL LANGUAGE MODE)'); args.push(search); }
  if (severity) { where.push('v.Severity = ?'); args.push(severity); }
  if (status) { where.push('v.Status = ?'); args.push(status); }
  if (machine) { where.push('v.Machine_ID = ?'); args.push(machine); }
  res.json(await q(`SELECT v.* FROM ${from} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY FIELD(v.Severity,'Critical','High','Medium','Low'), v.Created_At DESC LIMIT 200`, args));
}));

router.get('/:id', guard(ALL), ah(async (req, res) => {
  const [a] = await q('SELECT * FROM v_alert_detail WHERE Alert_ID = ?', [intId(req.params.id)]);
  if (!a) throw new HttpError(404, 'Alert not found');
  res.json(a);
}));

// PATCH { action: 'acknowledge' | 'resolve' }   (trigger trg_alert_bu stamps Resolved_At)
// Lifecycle: Open -> Acknowledged -> Resolved. Resolved alerts are never re-opened; a new breach raises a new alert.
router.patch('/:id', guard(ALL), ah(async (req, res) => {
  const id = intId(req.params.id);
  const { action } = req.body || {};
  const [a] = await q('SELECT Status FROM ALERT WHERE Alert_ID = ?', [id]);
  if (!a) throw new HttpError(404, 'Alert not found');
  if (action === 'acknowledge') {
    const r = await q("UPDATE ALERT SET Status = 'Acknowledged' WHERE Alert_ID = ? AND Status = 'Open'", [id]);
    if (!r.affectedRows) throw new HttpError(409, 'Alert is not open');
    return res.json({ ok: true });
  }
  if (action === 'resolve') {
    if (req.user.role === 'Technician') throw new HttpError(403, 'Only Admin/Engineer can resolve alerts');
    const r = await q("UPDATE ALERT SET Status = 'Resolved', Resolved_By = ? WHERE Alert_ID = ? AND Status <> 'Resolved'", [req.user.uid, id]);
    if (!r.affectedRows) throw new HttpError(409, 'Alert already resolved');
    return res.json({ ok: true });
  }
  throw new HttpError(400, 'Unknown action (use acknowledge or resolve)');
}));

export default router;
