import { scopeClause, visibleClause, ownerColumns, ownerFromRow, orNotFound } from '../lib/access.js';
import { addDays, isDateString } from '../lib/dates.js';

const SELECT = `SELECT t.*, ${ownerColumns()} FROM events t JOIN users o ON o.id = t.owner_id`;

export function mapEvent(r) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    start: r.start,
    end: r.end,
    allDay: !!r.all_day,
    location: r.location,
    color: r.color,
    visibility: r.visibility,
    owner: ownerFromRow(r),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Events overlapping [from, to]. Bounds may be dates (inclusive whole days) or ISO date-times.
 */
export function listEvents(db, user, { scope = 'merged', from, to } = {}) {
  const sc = scopeClause(user, scope);
  const where = [sc.sql];
  const params = [...sc.params];
  if (to) {
    if (isDateString(to)) {
      where.push('t.start < ?');
      params.push(addDays(to, 1));
    } else {
      where.push('(t.start <= ? OR (length(t.start) = 10 AND t.start <= ?))');
      params.push(to, to.slice(0, 10));
    }
  }
  if (from) {
    if (isDateString(from)) {
      where.push('t."end" >= ?');
      params.push(from);
    } else {
      where.push('(t."end" >= ? OR (length(t."end") = 10 AND t."end" >= ?))');
      params.push(from, from.slice(0, 10));
    }
  }
  const rows = db.prepare(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY t.start, t.id`).all(...params);
  return rows.map(mapEvent);
}

export function getEventRow(db, user, id) {
  const v = visibleClause(user);
  return orNotFound(
    db.prepare(`${SELECT} WHERE t.id = ? AND ${v.sql}`).get(id, ...v.params),
    'Etkinlik bulunamadı',
  );
}
