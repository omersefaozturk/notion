import { scopeClause, visibleClause, ownerColumns, ownerFromRow, orNotFound } from '../lib/access.js';

function selectSummary(user) {
  return {
    sql: `SELECT t.id, t.household_id, t.owner_id, t.parent_id, t.title, t.icon, t.period, t.period_start,
        t.period_end, t.visibility, t.position, t.created_at, t.updated_at, ${ownerColumns()},
        EXISTS (SELECT 1 FROM pages c WHERE c.parent_id = t.id AND (c.owner_id = ? OR c.visibility = 'shared')) AS has_children
      FROM pages t JOIN users o ON o.id = t.owner_id`,
    params: [user.id],
  };
}

export function mapPageSummary(r) {
  return {
    id: r.id,
    title: r.title,
    icon: r.icon,
    parentId: r.parent_id,
    period: r.period,
    periodStart: r.period_start,
    visibility: r.visibility,
    owner: ownerFromRow(r),
    position: r.position,
    hasChildren: !!r.has_children,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * filters: scope, parentId ('root' | number), period, from/to (periodStart in range),
 * plansOnly, overlapFrom/overlapTo (plan period overlaps range).
 */
export function listPages(db, user, { scope = 'merged', parentId, period, from, to, plansOnly, overlapFrom, overlapTo } = {}) {
  const base = selectSummary(user);
  const sc = scopeClause(user, scope);
  const where = [sc.sql];
  const params = [...base.params, ...sc.params];
  if (parentId === 'root') where.push('t.parent_id IS NULL');
  else if (parentId != null) {
    where.push('t.parent_id = ?');
    params.push(parentId);
  }
  if (period) {
    where.push('t.period = ?');
    params.push(period);
  }
  if (plansOnly || overlapFrom || overlapTo) where.push('t.period IS NOT NULL');
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
  const order = period || plansOnly || overlapFrom || overlapTo || from || to
    ? 't.period_start, t.position, t.id'
    : 't.position, t.id';
  return db.prepare(`${base.sql} WHERE ${where.join(' AND ')} ORDER BY ${order}`).all(...params).map(mapPageSummary);
}

export function getPageRow(db, user, id) {
  const v = visibleClause(user);
  return orNotFound(
    db.prepare(`SELECT t.*, ${ownerColumns()},
        EXISTS (SELECT 1 FROM pages c WHERE c.parent_id = t.id AND (c.owner_id = ? OR c.visibility = 'shared')) AS has_children
      FROM pages t JOIN users o ON o.id = t.owner_id WHERE t.id = ? AND ${v.sql}`).get(user.id, id, ...v.params),
    'Sayfa bulunamadı',
  );
}

/** Ancestors from the root down to the direct parent (the page itself excluded). */
export function breadcrumbs(db, user, row) {
  const stmt = db.prepare('SELECT id, parent_id, title, icon, owner_id, visibility FROM pages WHERE id = ?');
  const trail = [];
  const seen = new Set([row.id]);
  let parentId = row.parent_id;
  while (parentId != null && !seen.has(parentId)) {
    seen.add(parentId);
    const p = stmt.get(parentId);
    if (!p) break;
    if (p.owner_id === user.id || p.visibility === 'shared') trail.unshift({ id: p.id, title: p.title, icon: p.icon });
    parentId = p.parent_id;
  }
  return trail;
}

export function mapPage(db, user, r) {
  let content = [];
  try {
    content = JSON.parse(r.content);
  } catch {
    content = [];
  }
  return { ...mapPageSummary(r), content, breadcrumbs: breadcrumbs(db, user, r) };
}

/** True if `candidateId` is `pageId` or one of its descendants. */
export function isSelfOrDescendant(db, pageId, candidateId) {
  const stmt = db.prepare('SELECT parent_id FROM pages WHERE id = ?');
  let cur = candidateId;
  const seen = new Set();
  while (cur != null && !seen.has(cur)) {
    if (cur === pageId) return true;
    seen.add(cur);
    cur = stmt.get(cur)?.parent_id ?? null;
  }
  return false;
}

export function nextPagePosition(db, householdId, parentId) {
  const r = parentId == null
    ? db.prepare('SELECT MAX(position) AS m FROM pages WHERE household_id = ? AND parent_id IS NULL').get(householdId)
    : db.prepare('SELECT MAX(position) AS m FROM pages WHERE household_id = ? AND parent_id = ?').get(householdId, parentId);
  return r.m == null ? 1024 : Math.floor(r.m) + 1024;
}
