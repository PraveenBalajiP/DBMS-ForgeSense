import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { q } from '../db/mysql.js';
import { signToken, authenticate } from '../middleware/auth.js';
import { tooManyFailures, recordFailure, clearFailures } from '../middleware/rateLimit.js';
import { ah, HttpError } from '../utils/http.js';

const router = Router();
const cookieOpts = () => ({ httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', path: '/' });

router.post('/login', ah(async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) throw new HttpError(400, 'Email and password required');
  const key = `${req.ip}|${email.toLowerCase()}`;
  if (tooManyFailures(key)) throw new HttpError(429, 'Too many failed attempts. Try again in 15 minutes.');

  const [u] = await q(
    'SELECT u.User_ID, u.First_Name, u.Last_Name, u.Password_Hash, u.Status, r.Role_Name FROM `USER` u JOIN ROLE r ON r.Role_ID = u.Role_ID WHERE u.Email = ?', [email]);
  const ok = u && u.Status === 'Active' && (await bcrypt.compare(password, u.Password_Hash));
  if (!ok) { recordFailure(key); throw new HttpError(401, 'Invalid credentials or inactive account'); }
  clearFailures(key);
  const token = await signToken({ uid: u.User_ID, role: u.Role_Name, name: `${u.First_Name} ${u.Last_Name}` });
  res.cookie('token', token, { ...cookieOpts(), maxAge: 8 * 60 * 60 * 1000 });
  res.json({ ok: true, role: u.Role_Name });
}));

router.post('/logout', (req, res) => { res.clearCookie('token', cookieOpts()); res.json({ ok: true }); });
router.get('/me', authenticate, (req, res) => res.json(req.user));

export default router;
