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
export async function listPages(db, user, { scope = 'merged', parentId, period, from, to, plansOnly, overlapFrom, overlapTo } = {}) {
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
  const rows = await db.many(`${base.sql} WHERE ${where.join(' AND ')} ORDER BY ${order}`, params);
  return rows.map(mapPageSummary);
}

export async function getPageRow(db, user, id) {
  const v = visibleClause(user);
  return orNotFound(
    await db.one(`SELECT t.*, ${ownerColumns()},
        EXISTS (SELECT 1 FROM pages c WHERE c.parent_id = t.id AND (c.owner_id = ? OR c.visibility = 'shared')) AS has_children
      FROM pages t JOIN users o ON o.id = t.owner_id WHERE t.id = ? AND ${v.sql}`, [user.id, id, ...v.params]),
    'Sayfa bulunamadı',
  );
}

/** Ancestors from the root down to the direct parent (the page itself excluded). */
/** Ancestor chain of a page, nearest first (one round trip; depth-capped against cycles). */
const ANCESTORS = `WITH RECURSIVE anc AS (
    SELECT id, parent_id, title, icon, owner_id, visibility, 1 AS depth FROM pages WHERE id = ?
    UNION ALL
    SELECT p.id, p.parent_id, p.title, p.icon, p.owner_id, p.visibility, anc.depth + 1
      FROM pages p JOIN anc ON p.id = anc.parent_id WHERE anc.depth < 200
  ) SELECT id, parent_id, title, icon, owner_id, visibility FROM anc ORDER BY depth`;

export async function breadcrumbs(db, user, row) {
  if (row.parent_id == null) return [];
  const rows = await db.many(ANCESTORS, [row.parent_id]);
  const trail = [];
  const seen = new Set([row.id]);
  for (const p of rows) {
    if (seen.has(p.id)) break;
    seen.add(p.id);
    if (p.owner_id === user.id || p.visibility === 'shared') trail.unshift({ id: p.id, title: p.title, icon: p.icon });
  }
  return trail;
}

export async function mapPage(db, user, r) {
  let content = r.content;
  if (typeof content === 'string') {
    try {
      content = JSON.parse(content);
    } catch {
      content = [];
    }
  }
  if (!Array.isArray(content)) content = [];
  return { ...mapPageSummary(r), content, breadcrumbs: await breadcrumbs(db, user, r) };
}

/** True if `candidateId` is `pageId` or one of its descendants. */
export async function isSelfOrDescendant(db, pageId, candidateId) {
  if (candidateId == null) return false;
  const rows = await db.many(ANCESTORS, [candidateId]);
  return rows.some((r) => r.id === pageId);
}

export async function nextPagePosition(db, householdId, parentId) {
  const r = parentId == null
    ? await db.one('SELECT MAX(position) AS m FROM pages WHERE household_id = ? AND parent_id IS NULL', [householdId])
    : await db.one('SELECT MAX(position) AS m FROM pages WHERE household_id = ? AND parent_id = ?', [householdId, parentId]);
  return r.m == null ? 1024 : Math.floor(r.m) + 1024;
}
