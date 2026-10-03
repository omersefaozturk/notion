import { scopeClause, visibleClause, ownerColumns, ownerFromRow, orNotFound } from '../lib/access.js';

const SELECT = `SELECT t.*, ${ownerColumns()}, ${ownerColumns('a', 'a')}
  FROM tasks t JOIN users o ON o.id = t.owner_id LEFT JOIN users a ON a.id = t.assignee_id`;

export const STATUS_ORDER = `CASE t.status WHEN 'todo' THEN 0 WHEN 'doing' THEN 1 ELSE 2 END`;

export function mapTask(r) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status,
    priority: r.priority,
    dueDate: r.due_date,
    position: r.position,
    visibility: r.visibility,
    owner: ownerFromRow(r),
    assignee: ownerFromRow(r, 'a'),
    completedAt: r.completed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** filters: scope, status, dueFrom/dueTo (inclusive dates), extraSql/extraParams (additional condition). */
export async function listTasks(db, user, { scope = 'merged', status, dueFrom, dueTo, extraSql, extraParams = [] } = {}) {
  const sc = scopeClause(user, scope);
  const where = [sc.sql];
  const params = [...sc.params];
  if (status) {
    where.push('t.status = ?');
    params.push(status);
  }
  if (dueFrom) {
    where.push('t.due_date IS NOT NULL AND t.due_date >= ?');
    params.push(dueFrom);
  }
  if (dueTo) {
    where.push('t.due_date IS NOT NULL AND t.due_date <= ?');
    params.push(dueTo);
  }
  if (extraSql) {
    where.push(extraSql);
    params.push(...extraParams);
  }
  const rows = await db.many(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY ${STATUS_ORDER}, t.position, t.id`, params);
  return rows.map(mapTask);
}

export async function getTaskRow(db, user, id) {
  const v = visibleClause(user);
  return orNotFound(await db.one(`${SELECT} WHERE t.id = ? AND ${v.sql}`, [id, ...v.params]), 'Görev bulunamadı');
}

export async function taskCounts(db, user, scope = 'merged') {
  const sc = scopeClause(user, scope);
  const counts = { todo: 0, doing: 0, done: 0 };
  const rows = await db.many(`SELECT t.status, COUNT(*)::int AS n FROM tasks t WHERE ${sc.sql} GROUP BY t.status`, sc.params);
  for (const r of rows) {
    counts[r.status] = r.n;
  }
  return counts;
}

/** Position for appending at the end of a status column in the household. */
export async function nextPosition(db, householdId, status) {
  const r = await db.one('SELECT MAX(position) AS m FROM tasks WHERE household_id = ? AND status = ?', [householdId, status]);
  return r.m == null ? 1024 : Math.floor(r.m) + 1024;
}
