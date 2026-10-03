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
export function listTasks(db, user, { scope = 'merged', status, dueFrom, dueTo, extraSql, extraParams = [] } = {}) {
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
  const rows = db
    .prepare(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY ${STATUS_ORDER}, t.position, t.id`)
    .all(...params);
  return rows.map(mapTask);
}

export function getTaskRow(db, user, id) {
  const v = visibleClause(user);
  return orNotFound(db.prepare(`${SELECT} WHERE t.id = ? AND ${v.sql}`).get(id, ...v.params), 'Görev bulunamadı');
}

export function taskCounts(db, user, scope = 'merged') {
  const sc = scopeClause(user, scope);
  const counts = { todo: 0, doing: 0, done: 0 };
  for (const r of db.prepare(`SELECT t.status, COUNT(*) AS n FROM tasks t WHERE ${sc.sql} GROUP BY t.status`).all(...sc.params)) {
    counts[r.status] = r.n;
  }
  return counts;
}

/** Position for appending at the end of a status column in the household. */
export function nextPosition(db, householdId, status) {
  const r = db
    .prepare('SELECT MAX(position) AS m FROM tasks WHERE household_id = ? AND status = ?')
    .get(householdId, status);
  return r.m == null ? 1024 : Math.floor(r.m) + 1024;
}
