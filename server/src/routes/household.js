import { Router } from 'express';
import { z, parse } from '../lib/validate.js';
import { generateInviteCode, getHousehold } from '../lib/household.js';

const updateSchema = z.object({ name: z.string().trim().min(1).max(80) });

export default function householdRoutes(db) {
  const r = Router();

  r.get('/', async (req, res) => {
    res.json(await getHousehold(db, req.user.householdId));
  });

  r.patch('/', async (req, res) => {
    const { name } = parse(updateSchema, req.body);
    await db.query('UPDATE households SET name = ? WHERE id = ?', [name, req.user.householdId]);
    res.json(await getHousehold(db, req.user.householdId));
  });

  r.post('/invite-code', async (req, res) => {
    await db.query('UPDATE households SET invite_code = ? WHERE id = ?', [await generateInviteCode(db), req.user.householdId]);
    res.json(await getHousehold(db, req.user.householdId));
  });

  return r;
}
