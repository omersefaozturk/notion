import { Router } from 'express';
import { z, parse, parseId, scope, visibility, period, dateStr } from '../lib/validate.js';
import { assertCanEdit, assertOwner, buildUpdate } from '../lib/access.js';
import { nowIso, today, normalizePeriodStart, periodEnd } from '../lib/dates.js';
import { listGoals, getGoalRow, mapGoal } from '../services/goals.js';

const text = (max) => z.preprocess((v) => (v === null ? '' : v), z.string().trim().max(max));
const progress = z.coerce.number().int().min(0).max(100);

const listSchema = z.object({
  scope,
  period: period.optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
});

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: text(5000).default(''),
  period,
  periodStart: dateStr.optional(),
  progress: progress.optional(),
  done: z.boolean().optional(),
  visibility: visibility.default('shared'),
});

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: text(5000).optional(),
  period: period.optional(),
  periodStart: dateStr.optional(),
  progress: progress.optional(),
  done: z.boolean().optional(),
  visibility: visibility.optional(),
});

/** Fields a household member may change on someone else's shared goal. */
const MEMBER_KEYS = ['done', 'progress'];

/** Keep done/progress consistent: done ⇒ 100, progress 100 ⇒ done. */
function reconcile(progressIn, doneIn, current = { progress: 0, done: false }) {
  let p = progressIn;
  let d = doneIn;
  if (d === true && p === undefined) p = 100;
  if (d === false && p === undefined && current.progress === 100) p = 0;
  if (p !== undefined && d === undefined) d = p === 100;
  return { progress: p ?? current.progress, done: d ?? current.done };
}

export default function goalRoutes(db) {
  const r = Router();

  r.get('/', (req, res) => {
    res.json(listGoals(db, req.user, parse(listSchema, req.query)));
  });

  r.post('/', (req, res) => {
    const d = parse(createSchema, req.body);
    const start = normalizePeriodStart(d.period, d.periodStart ?? today());
    const pd = reconcile(d.progress, d.done);
    const now = nowIso();
    const id = Number(
      db
        .prepare(
          `INSERT INTO goals (household_id, owner_id, title, description, period, period_start, period_end, progress,
             done, visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(req.user.householdId, req.user.id, d.title, d.description, d.period, start, periodEnd(d.period, start),
          pd.progress, pd.done ? 1 : 0, d.visibility, now, now).lastInsertRowid,
    );
    res.status(201).json(mapGoal(getGoalRow(db, req.user, id)));
  });

  r.get('/:id', (req, res) => {
    res.json(mapGoal(getGoalRow(db, req.user, parseId(req.params.id))));
  });

  r.patch('/:id', (req, res) => {
    const row = getGoalRow(db, req.user, parseId(req.params.id));
    const d = parse(updateSchema, req.body);
    assertCanEdit(req.user, row, d, MEMBER_KEYS, {
      title: row.title,
      description: row.description,
      period: row.period,
      periodStart: row.period_start,
      visibility: row.visibility,
    });
    let start;
    let end;
    if (d.period !== undefined || d.periodStart !== undefined) {
      const p = d.period ?? row.period;
      start = normalizePeriodStart(p, d.periodStart ?? row.period_start);
      end = periodEnd(p, start);
    }
    const touchesProgress = d.progress !== undefined || d.done !== undefined;
    const pd = touchesProgress ? reconcile(d.progress, d.done, { progress: row.progress, done: !!row.done }) : {};
    const upd = buildUpdate('goals', row.id, {
      title: d.title,
      description: d.description,
      period: d.period,
      period_start: start,
      period_end: end,
      progress: pd.progress,
      done: pd.done === undefined ? undefined : pd.done ? 1 : 0,
      visibility: d.visibility,
      updated_at: nowIso(),
    });
    db.prepare(upd.sql).run(...upd.params);
    res.json(mapGoal(getGoalRow(db, req.user, row.id)));
  });

  r.delete('/:id', (req, res) => {
    const row = getGoalRow(db, req.user, parseId(req.params.id));
    assertOwner(req.user, row);
    db.prepare('DELETE FROM goals WHERE id = ?').run(row.id);
    res.json({ ok: true });
  });

  return r;
}
