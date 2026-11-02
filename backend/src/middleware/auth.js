import { SignJWT, jwtVerify } from 'jose';
import { requireAuthEnv } from '../config/env.js';
import { HttpError, ah } from '../utils/http.js';

const key = () => { requireAuthEnv(); return new TextEncoder().encode(process.env.JWT_SECRET); };

export const signToken = (payload) =>
  new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('8h').sign(key());

// Reads the httpOnly "token" cookie, verifies it and puts { uid, role, name } on req.user
export const authenticate = ah(async (req, res, next) => {
  const secret = key();                                       // a config error here is a 500, not a 401
  const token = req.cookies?.token;
  if (!token) throw new HttpError(401, 'Not authenticated');
  try {
    const { payload } = await jwtVerify(token, secret);
    req.user = { uid: payload.uid, role: payload.role, name: payload.name };
  } catch { throw new HttpError(401, 'Not authenticated'); }  // expired, tampered, malformed
  next();
});

// Server-side role check (hiding a button in the UI is NOT authorisation)
export const requireRole = (roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new HttpError(403, 'Forbidden: your role cannot do this'));

// shorthand: [authenticate, requireRole(roles)]
export const guard = (roles) => [authenticate, requireRole(roles)];
