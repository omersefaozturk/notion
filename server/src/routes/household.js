import { Router } from 'express';
import { z, parse } from '../lib/validate.js';
import { generateInviteCode, getHousehold } from '../lib/household.js';

const updateSchema = z.object({ name: z.string().trim().min(1).max(80) });

export default function householdRoutes(db) {
  const r = Router();

  r.get('/', (req, res) => {
    res.json(getHousehold(db, req.user.householdId));
  });

  r.patch('/', (req, res) => {
    const { name } = parse(updateSchema, req.body);
    db.prepare('UPDATE households SET name = ? WHERE id = ?').run(name, req.user.householdId);
    res.json(getHousehold(db, req.user.householdId));
  });

  r.post('/invite-code', (req, res) => {
    db.prepare('UPDATE households SET invite_code = ? WHERE id = ?').run(generateInviteCode(db), req.user.householdId);
    res.json(getHousehold(db, req.user.householdId));
  });

  return r;
}
