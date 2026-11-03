import { Router } from 'express';
import { q, callProc } from '../db/mysql.js';
import { guard } from '../middleware/auth.js';
import { ah, HttpError, intId, ALL, MANAGE } from '../utils/http.js';

const router = Router();

// Technicians may only touch work orders assigned to them (checked on the server, not just hidden in the UI)
async function loadOwned(id, user) {
  const [wo] = await q('SELECT Work_Order_ID, Assigned_To_User_ID, Status FROM WORK_ORDER WHERE Work_Order_ID = ?', [id]);
  if (!wo) throw new HttpError(404, 'Work order not found');
  if (user.role === 'Technician' && wo.Assigned_To_User_ID !== user.uid) throw new HttpError(403, 'This work order is not assigned to you');
  return wo;
}

router.get('/', guard(ALL), ah(async (req, res) => {
  const { status, priority, q: search } = req.query;
  const where = [], args = [];
  if (req.user.role === 'Technician') { where.push('Assigned_To_User_ID = ?'); args.push(req.user.uid); }
  if (status) { where.push('Status = ?'); args.push(status); }
  if (priority) { where.push('Priority = ?'); args.push(priority); }
  if (search) { where.push('Work_Order_ID IN (SELECT Work_Order_ID FROM WORK_ORDER WHERE MATCH(Description) AGAINST (? IN NATURAL LANGUAGE MODE))'); args.push(search); }
  res.json(await q(`SELECT * FROM v_work_order_detail ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY FIELD(Status,'In Progress','Open','Completed','Cancelled'), FIELD(Priority,'Critical','High','Medium','Low'), Due_Date LIMIT 200`, args));
}));

router.post('/', guard(MANAGE), ah(async (req, res) => {
  const b = req.body || {};
  if (!b.Machine_ID || !b.Description) throw new HttpError(400, 'Machine and description are required');
  const r = await q(
    'INSERT INTO WORK_ORDER (Priority, Description, Due_Date, Machine_ID, Created_By_User_ID, Assigned_To_User_ID, Expected_Hours) VALUES (?,?,?,?,?,?,?)',
    [b.Priority || 'Medium', b.Description, b.Due_Date || null, b.Machine_ID, req.user.uid, b.Assigned_To_User_ID || null, b.Expected_Hours || null]);
  res.status(201).json({ Work_Order_ID: r.insertId });
}));

router.get('/:id', guard(ALL), ah(async (req, res) => {
  const id = intId(req.params.id);
  await loadOwned(id, req.user);
  const [w] = await q('SELECT * FROM v_work_order_detail WHERE Work_Order_ID = ?', [id]);
  const parts = await q(`SELECT p.Part_ID, p.Part_Name, wp.Quantity_Used, p.Unit_Cost FROM WORK_ORDER_PART wp
                          JOIN PART p ON p.Part_ID = wp.Part_ID WHERE wp.Work_Order_ID = ?`, [id]);
  res.json({ ...w, parts });
}));

// PATCH { action: 'assign' | 'start' | 'complete' | 'cancel' }
// Transitions:  Open -> In Progress -> Completed ;  Open|In Progress -> Cancelled ;  Completed/Cancelled are final.
router.patch('/:id', guard(ALL), ah(async (req, res) => {
  const id = intId(req.params.id);
  const b = req.body || {};
  await loadOwned(id, req.user);

  if (b.action === 'assign') {
    if (req.user.role === 'Technician') throw new HttpError(403, 'Forbidden');
    if (!Number.isInteger(Number(b.user_id))) throw new HttpError(400, 'user_id is required');
    const r = await q(`UPDATE WORK_ORDER SET Assigned_To_User_ID = ?, Expected_Hours = COALESCE(?, Expected_Hours)
                        WHERE Work_Order_ID = ? AND Status IN ('Open','In Progress')`, [b.user_id, b.Expected_Hours || null, id]);   // trigger sets Assigned_Date/Assignment_Status
    if (!r.affectedRows) throw new HttpError(409, 'Closed work orders cannot be reassigned');
    return res.json({ ok: true });
  }
  if (b.action === 'start') {
    const r = await q("UPDATE WORK_ORDER SET Status = 'In Progress', Assignment_Status = IF(Assigned_To_User_ID IS NULL, Assignment_Status, 'Accepted') WHERE Work_Order_ID = ? AND Status = 'Open'", [id]);
    if (!r.affectedRows) throw new HttpError(409, 'Only open work orders can be started');
    return res.json({ ok: true });
  }
  if (b.action === 'complete') return res.json(await callProc('sp_complete_work_order', [id, req.user.uid]));
  if (b.action === 'cancel') {
    if (req.user.role === 'Technician') throw new HttpError(403, 'Forbidden');
    const r = await q("UPDATE WORK_ORDER SET Status = 'Cancelled' WHERE Work_Order_ID = ? AND Status IN ('Open','In Progress')", [id]);
    if (!r.affectedRows) throw new HttpError(409, 'Work order is already closed');
    return res.json({ ok: true });
  }
  throw new HttpError(400, 'Unknown action (use assign, start, complete or cancel)');
}));

router.delete('/:id', guard(['Admin']), ah(async (req, res) => {
  const r = await q('DELETE FROM WORK_ORDER WHERE Work_Order_ID = ?', [intId(req.params.id)]);   // WORK_ORDER_PART rows cascade
  if (!r.affectedRows) throw new HttpError(404, 'Work order not found');
  res.json({ ok: true });
}));

router.get('/:id/parts', guard(ALL), ah(async (req, res) => {
  res.json(await q(`SELECT p.Part_ID, p.Part_Name, wp.Quantity_Used, p.Unit_Cost, wp.Quantity_Used * p.Unit_Cost AS Line_Cost
      FROM WORK_ORDER_PART wp JOIN PART p ON p.Part_ID = wp.Part_ID WHERE wp.Work_Order_ID = ?`, [intId(req.params.id)]));
}));

// transaction + row locks inside sp_use_part
router.post('/:id/parts', guard(ALL), ah(async (req, res) => {
  const id = intId(req.params.id);
  const b = req.body || {};
  await loadOwned(id, req.user);
  if (!Number.isInteger(Number(b.part_id)) || !Number.isInteger(Number(b.quantity))) throw new HttpError(400, 'part_id and quantity must be integers');
  res.json(await callProc('sp_use_part', [id, b.part_id, Number(b.quantity)]));
}));

export default router;
