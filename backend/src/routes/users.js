import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { q } from '../db/mysql.js';
import { guard } from '../middleware/auth.js';
import { ah, HttpError } from '../utils/http.js';

const router = Router();
const ADMIN = ['Admin'];

// password hashes are never selected
router.get('/', guard(ADMIN), ah(async (req, res) => {
  res.json(await q('SELECT u.User_ID, u.First_Name, u.Last_Name, u.Email, u.Phone, u.Status, r.Role_Name FROM `USER` u JOIN ROLE r ON r.Role_ID = u.Role_ID ORDER BY u.User_ID'));
}));

router.post('/', guard(ADMIN), ah(async (req, res) => {
  const b = req.body || {};
  if (!b.Email || !b.Password || !b.First_Name || !b.Last_Name || !b.Role_ID) throw new HttpError(400, 'All fields except phone are required');
  if (String(b.Password).length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  const hash = await bcrypt.hash(String(b.Password), 10);
  const r = await q('INSERT INTO `USER` (Email, Password_Hash, Phone, First_Name, Last_Name, Role_ID) VALUES (?,?,?,?,?,?)',
    [b.Email, hash, b.Phone || null, b.First_Name, b.Last_Name, b.Role_ID]);
  res.status(201).json({ User_ID: r.insertId });
}));

router.patch('/', guard(ADMIN), ah(async (req, res) => {
  const { user_id, status } = req.body || {};
  if (user_id === req.user.uid) throw new HttpError(400, 'You cannot change your own status');
  const r = await q('UPDATE `USER` SET Status = ? WHERE User_ID = ?', [status, user_id]);
  if (!r.affectedRows) throw new HttpError(404, 'User not found');
  res.json({ ok: true });
}));

export default router;
