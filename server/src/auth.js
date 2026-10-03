import jwt from 'jsonwebtoken';
import { unauthorized } from './lib/errors.js';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET ortam değişkeni production ortamında zorunludur (ör. `openssl rand -hex 32`)');
}
export const JWT_SECRET = process.env.JWT_SECRET || 'ortak-plan-dev-secret-change-me';
const EXPIRES_IN = '30d';

export function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, JWT_SECRET, { expiresIn: EXPIRES_IN });
}

export function userFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    initial: row.initial,
    color: row.color,
    householdId: row.household_id,
  };
}

/** Express middleware: requires a valid Bearer token, sets req.user. */
export function requireAuth(db) {
  return async (req, _res, next) => {
    const header = req.get('authorization') || '';
    const [type, token] = header.split(' ');
    if (type !== 'Bearer' || !token) return next(unauthorized());
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return next(unauthorized('Oturumunuzun süresi doldu, lütfen tekrar giriş yapın'));
    }
    const row = await db.one('SELECT * FROM users WHERE id = ?', [Number(payload.sub)]);
    if (!row) return next(unauthorized('Kullanıcı bulunamadı'));
    req.user = userFromRow(row);
    next();
  };
}
