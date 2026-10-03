import { Router } from 'express';
import { z, parse, scope, dateStr, tz } from '../lib/validate.js';
import { badRequest } from '../lib/errors.js';
import { today, startOfMonth, endOfMonth } from '../lib/dates.js';
import { listEvents } from '../services/events.js';
import { listTasks } from '../services/tasks.js';
import { listGoals } from '../services/goals.js';
import { listPages } from '../services/pages.js';

const schema = z.object({ scope, tz, from: dateStr.optional(), to: dateStr.optional() });

export function calendarData(db, user, { scope: sc, from, to, tz: tzName }) {
  return {
    events: listEvents(db, user, { scope: sc, from, to, tz: tzName }),
    tasks: listTasks(db, user, { scope: sc, dueFrom: from, dueTo: to }),
    goals: listGoals(db, user, { scope: sc, overlapFrom: from, overlapTo: to }),
    plans: listPages(db, user, { scope: sc, overlapFrom: from, overlapTo: to }),
  };
}

export default function calendarRoutes(db) {
  const r = Router();
  r.get('/', (req, res) => {
    const q = parse(schema, req.query);
    const from = q.from ?? startOfMonth(today(q.tz));
    const to = q.to ?? endOfMonth(from);
    if (to < from) throw badRequest('Bitiş tarihi başlangıçtan önce olamaz');
    res.json(calendarData(db, req.user, { scope: q.scope, from, to, tz: q.tz }));
  });
  return r;
}
