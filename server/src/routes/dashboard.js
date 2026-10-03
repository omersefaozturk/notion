import { Router } from 'express';
import { z, parse, scope, dateStr, tz } from '../lib/validate.js';
import { today, addDays, startOfWeek, startOfMonth } from '../lib/dates.js';
import { listEvents } from '../services/events.js';
import { listTasks, taskCounts } from '../services/tasks.js';
import { listGoals } from '../services/goals.js';
import { listPages } from '../services/pages.js';

const schema = z.object({ scope, tz, date: dateStr.optional() });

export default function dashboardRoutes(db) {
  const r = Router();
  r.get('/', (req, res) => {
    const q = parse(schema, req.query);
    const date = q.date ?? today(q.tz);
    const sc = q.scope;
    const user = req.user;
    const weekStart = startOfWeek(date);
    const weekEnd = addDays(weekStart, 6);
    const monthStart = startOfMonth(date);

    res.json({
      date,
      today: {
        events: listEvents(db, user, { scope: sc, from: date, to: date, tz: q.tz }),
        // due today, plus overdue tasks that are not done yet
        tasks: listTasks(db, user, {
          scope: sc,
          extraSql: `t.due_date IS NOT NULL AND (t.due_date = ? OR (t.due_date < ? AND t.status <> 'done'))`,
          extraParams: [date, date],
        }),
        goals: listGoals(db, user, { scope: sc, period: 'daily', from: date, to: date }),
        plans: listPages(db, user, { scope: sc, period: 'daily', from: date, to: date }),
      },
      week: {
        goals: listGoals(db, user, { scope: sc, period: 'weekly', from: weekStart, to: weekStart }),
        plans: listPages(db, user, { scope: sc, period: 'weekly', from: weekStart, to: weekStart }),
        tasks: listTasks(db, user, { scope: sc, dueFrom: weekStart, dueTo: weekEnd }),
      },
      month: {
        goals: listGoals(db, user, { scope: sc, period: 'monthly', from: monthStart, to: monthStart }),
        plans: listPages(db, user, { scope: sc, period: 'monthly', from: monthStart, to: monthStart }),
      },
      taskCounts: taskCounts(db, user, sc),
    });
  });
  return r;
}
