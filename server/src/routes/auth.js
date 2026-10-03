import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z, parse, color } from '../lib/validate.js';
import { badRequest, conflict, unauthorized } from '../lib/errors.js';
import { signToken, userFromRow, requireAuth } from '../auth.js';
import { generateInviteCode, getHousehold, pickColor, toInitial } from '../lib/household.js';
import { nowIso } from '../lib/dates.js';
import { buildUpdate } from '../lib/access.js';

const initial = z
  .string()
  .trim()
  .refine((s) => Array.from(s).length === 1, { error: 'Baş harf tek bir karakter olmalıdır' });
const emptyToUndef = (v) => (v === '' || v === null ? undefined : v);

const registerSchema = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(6),
  initial: z.preprocess(emptyToUndef, initial.optional()),
  color: z.preprocess(emptyToUndef, color.optional()),
  inviteCode: z.preprocess(emptyToUndef, z.string().trim().toUpperCase().optional()),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});

const updateMeSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  initial: initial.optional(),
  color: color.optional(),
  password: z.preprocess(emptyToUndef, z.string().min(6).optional()),
});

export default function authRoutes(db) {
  const r = Router();

  r.post('/register', async (req, res) => {
    const data = parse(registerSchema, req.body);
    if (await db.one('SELECT 1 FROM users WHERE lower(email) = lower(?)', [data.email])) {
      throw conflict('Bu e-posta adresi zaten kayıtlı');
    }
    let householdId = null;
    if (data.inviteCode) {
      const h = await db.one('SELECT id FROM households WHERE invite_code = ?', [data.inviteCode]);
      if (!h) throw badRequest('Davet kodu geçersiz');
      householdId = h.id;
    }
    const now = nowIso();
    const hash = await bcrypt.hash(data.password, 10);
    const row = await db.tx(async (t) => {
      if (householdId == null) {
        householdId = (
          await t.one('INSERT INTO households (name, invite_code, created_at) VALUES (?, ?, ?) RETURNING id', [
            `${data.name} ailesi`,
            await generateInviteCode(t),
            now,
          ])
        ).id;
      }
      return t.one(
        `INSERT INTO users (household_id, name, email, password_hash, initial, color, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
        [
          householdId,
          data.name,
          data.email,
          hash,
          toInitial(data.initial || data.name),
          data.color || (await pickColor(t, householdId)),
          now,
        ],
      );
    });
    const user = userFromRow(row);
    res.status(201).json({ token: signToken(user.id), user });
  });

  r.post('/login', async (req, res) => {
    const data = parse(loginSchema, req.body);
    const row = await db.one('SELECT * FROM users WHERE lower(email) = lower(?)', [data.email]);
    if (!row || !(await bcrypt.compare(data.password, row.password_hash))) {
      throw unauthorized('E-posta veya şifre hatalı');
    }
    res.json({ token: signToken(row.id), user: userFromRow(row) });
  });

  r.get('/me', requireAuth(db), async (req, res) => {
    res.json({ user: req.user, household: await getHousehold(db, req.user.householdId) });
  });

  r.patch('/me', requireAuth(db), async (req, res) => {
    const data = parse(updateMeSchema, req.body);
    const upd = buildUpdate('users', req.user.id, {
      name: data.name,
      initial: data.initial === undefined ? undefined : toInitial(data.initial),
      color: data.color,
      password_hash: data.password === undefined ? undefined : await bcrypt.hash(data.password, 10),
    });
    if (upd) await db.query(upd.sql, upd.params);
    res.json({ user: userFromRow(await db.one('SELECT * FROM users WHERE id = ?', [req.user.id])) });
  });

  return r;
}
