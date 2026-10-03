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
  r.get('/', async (req, res) => {
    const q = parse(schema, req.query);
    const date = q.date ?? today(q.tz);
    const sc = q.scope;
    const user = req.user;
    const weekStart = startOfWeek(date);
    const weekEnd = addDays(weekStart, 6);
    const monthStart = startOfMonth(date);

    const [
      todayEvents, todayTasks, todayGoals, todayPlans,
      weekEvents, weekGoals, weekPlans, weekTasks,
      monthGoals, monthPlans, counts,
    ] = await Promise.all([
      listEvents(db, user, { scope: sc, from: date, to: date, tz: q.tz }),
      // due today, plus overdue tasks that are not done yet
      listTasks(db, user, {
        scope: sc,
        extraSql: `t.due_date IS NOT NULL AND (t.due_date = ? OR (t.due_date < ? AND t.status <> 'done'))`,
        extraParams: [date, date],
      }),
      listGoals(db, user, { scope: sc, period: 'daily', from: date, to: date }),
      listPages(db, user, { scope: sc, period: 'daily', from: date, to: date }),
      listEvents(db, user, { scope: sc, from: weekStart, to: weekEnd, tz: q.tz }),
      listGoals(db, user, { scope: sc, period: 'weekly', from: weekStart, to: weekStart }),
      listPages(db, user, { scope: sc, period: 'weekly', from: weekStart, to: weekStart }),
      listTasks(db, user, { scope: sc, dueFrom: weekStart, dueTo: weekEnd }),
      listGoals(db, user, { scope: sc, period: 'monthly', from: monthStart, to: monthStart }),
      listPages(db, user, { scope: sc, period: 'monthly', from: monthStart, to: monthStart }),
      taskCounts(db, user, sc),
    ]);

    res.json({
      date,
      today: { events: todayEvents, tasks: todayTasks, goals: todayGoals, plans: todayPlans },
      week: { events: weekEvents, goals: weekGoals, plans: weekPlans, tasks: weekTasks },
      month: { goals: monthGoals, plans: monthPlans },
      taskCounts: counts,
    });
  });
  return r;
}
