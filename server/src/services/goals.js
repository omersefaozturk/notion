import { scopeClause, visibleClause, ownerColumns, ownerFromRow, orNotFound } from '../lib/access.js';

const SELECT = `SELECT t.*, ${ownerColumns()} FROM goals t JOIN users o ON o.id = t.owner_id`;
const PERIOD_ORDER = `CASE t.period WHEN 'daily' THEN 0 WHEN 'weekly' THEN 1 ELSE 2 END`;

export function mapGoal(r) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    period: r.period,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    progress: r.progress,
    done: !!r.done,
    visibility: r.visibility,
    owner: ownerFromRow(r),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * filters: scope, period, from/to (periodStart in range) or overlapFrom/overlapTo (period overlaps range).
 */
export async function listGoals(db, user, { scope = 'merged', period, from, to, overlapFrom, overlapTo } = {}) {
  const sc = scopeClause(user, scope);
  const where = [sc.sql];
  const params = [...sc.params];
  if (period) {
    where.push('t.period = ?');
    params.push(period);
  }
  if (from) {
    where.push('t.period_start >= ?');
    params.push(from);
  }
  if (to) {
    where.push('t.period_start <= ?');
    params.push(to);
  }
  if (overlapFrom) {
    where.push('t.period_end >= ?');
    params.push(overlapFrom);
  }
  if (overlapTo) {
    where.push('t.period_start <= ?');
    params.push(overlapTo);
  }
  const rows = await db.many(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY t.period_start, ${PERIOD_ORDER}, t.id`, params);
  return rows.map(mapGoal);
}

export async function getGoalRow(db, user, id) {
  const v = visibleClause(user);
  return orNotFound(await db.one(`${SELECT} WHERE t.id = ? AND ${v.sql}`, [id, ...v.params]), 'Hedef bulunamadı');
}
