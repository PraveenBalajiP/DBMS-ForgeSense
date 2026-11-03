import { Router } from 'express';
import { q } from '../db/mysql.js';
import { guard } from '../middleware/auth.js';
import { ah, HttpError, ALL, MANAGE } from '../utils/http.js';

const router = Router();

router.get('/', guard(ALL), ah(async (req, res) => {
  const { low, q: search } = req.query;
  res.json(await q(`SELECT *, (Quantity_In_Stock <= Reorder_Level) AS Low_Stock FROM PART
     WHERE 1=1 ${low === '1' ? 'AND Quantity_In_Stock <= Reorder_Level' : ''} ${search ? 'AND (Part_Name LIKE ? OR Part_Number LIKE ?)' : ''}
     ORDER BY Part_Name`, search ? [`%${search}%`, `%${search}%`] : []));
}));

router.post('/', guard(MANAGE), ah(async (req, res) => {
  const b = req.body || {};
  if (!b.Part_Name) throw new HttpError(400, 'Part name is required');
  const r = await q('INSERT INTO PART (Part_Name, Part_Number, Quantity_In_Stock, Reorder_Level, Unit_Cost) VALUES (?,?,?,?,?)',
    [b.Part_Name, b.Part_Number || null, b.Quantity_In_Stock ?? 0, b.Reorder_Level ?? 0, b.Unit_Cost ?? 0]);
  res.status(201).json({ Part_ID: r.insertId });
}));

// restock: PATCH { part_id, add }
router.patch('/', guard(MANAGE), ah(async (req, res) => {
  const b = req.body || {};
  const r = await q('UPDATE PART SET Quantity_In_Stock = Quantity_In_Stock + ? WHERE Part_ID = ?', [Number(b.add), b.part_id]);
  if (!r.affectedRows) throw new HttpError(404, 'Part not found');
  res.json({ ok: true });
}));

router.delete('/', guard(['Admin']), ah(async (req, res) => {
  const r = await q('DELETE FROM PART WHERE Part_ID = ?', [(req.body || {}).part_id]);   // fails (FK) if the part was used
  if (!r.affectedRows) throw new HttpError(404, 'Part not found');
  res.json({ ok: true });
}));

export default router;
