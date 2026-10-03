import { scopeClause, visibleClause, ownerColumns, ownerFromRow, orNotFound } from '../lib/access.js';
import { addDays, isDateString, zonedToUtc, dateInTz, DEFAULT_TZ } from '../lib/dates.js';
import { badRequest } from '../lib/errors.js';

const SELECT = `SELECT t.*, ${ownerColumns()} FROM events t JOIN users o ON o.id = t.owner_id`;

/*
 * Storage format (normalised on every write, see normalizeEventTimes):
 *   - all-day events: start/end are calendar dates 'YYYY-MM-DD', end inclusive.
 *   - timed events:   start/end are UTC instants 'YYYY-MM-DDTHH:MM:SS.sssZ'.
 * Within each kind the strings sort lexicographically == chronologically, so range
 * queries compare like with like and never mix the two formats.
 */

const LOCAL_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

/** Any accepted input → UTC ISO instant. Inputs without offset are wall-clock times in `tz`. */
export function toInstant(s, tz = DEFAULT_TZ) {
  if (isDateString(s)) return zonedToUtc(s, 0, 0, tz).toISOString();
  if (LOCAL_DATETIME_RE.test(s)) {
    const [date, time] = s.split('T');
    const [hh, mm, ss = '0'] = time.split(':');
    const d = zonedToUtc(date, Number(hh), Number(mm), tz);
    return new Date(d.getTime() + Math.round(Number(ss) * 1000)).toISOString();
  }
  return new Date(s).toISOString();
}

/** Any accepted input → calendar date in `tz`. */
export function toDate(s, tz = DEFAULT_TZ) {
  if (isDateString(s)) return s;
  if (LOCAL_DATETIME_RE.test(s)) return s.slice(0, 10);
  return dateInTz(s, tz);
}

/** Normalise start/end for storage. Throws 400 if end is before start. */
export function normalizeEventTimes({ start, end, allDay }, tz = DEFAULT_TZ) {
  if (allDay) {
    const s = toDate(start, tz);
    let e = end ? toDate(end, tz) : s;
    if (e < s) throw badRequest('Bitiş zamanı başlangıçtan önce olamaz');
    return { start: s, end: e };
  }
  const s = toInstant(start, tz);
  const e = end ? toInstant(end, tz) : s;
  if (e < s) throw badRequest('Bitiş zamanı başlangıçtan önce olamaz');
  return { start: s, end: e };
}

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
 * Events overlapping [from, to]. Bounds may be dates (inclusive whole days in `tz`) or
 * ISO date-times (instants). All-day events are matched by calendar date, timed events
 * by instant, so an all-day event shows on its date in any time zone and a timed event
 * spanning several days matches each of them.
 */
export function listEvents(db, user, { scope = 'merged', from, to, tz = DEFAULT_TZ } = {}) {
  const sc = scopeClause(user, scope);
  const where = [sc.sql];
  const params = [...sc.params];

  const allDay = ['t.all_day = 1'];
  const timed = ['t.all_day = 0'];
  const allDayParams = [];
  const timedParams = [];
  if (to) {
    const toDateBound = isDateString(to) ? to : toDate(to, tz);
    allDay.push('t.start <= ?');
    allDayParams.push(toDateBound);
    if (isDateString(to)) {
      timed.push('t.start < ?');
      timedParams.push(zonedToUtc(addDays(to, 1), 0, 0, tz).toISOString());
    } else {
      timed.push('t.start <= ?');
      timedParams.push(toInstant(to, tz));
    }
  }
  if (from) {
    const fromDateBound = isDateString(from) ? from : toDate(from, tz);
    allDay.push('t."end" >= ?');
    allDayParams.push(fromDateBound);
    const fromInstant = toInstant(from, tz);
    // an event ending exactly at the range start does not overlap it, unless it is instantaneous
    timed.push('(t."end" > ? OR t.start >= ?)');
    timedParams.push(fromInstant, fromInstant);
  }
  where.push(`((${allDay.join(' AND ')}) OR (${timed.join(' AND ')}))`);
  params.push(...allDayParams, ...timedParams);

  const rows = db
    .prepare(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY t.start, t.id`)
    .all(...params);
  return rows.map(mapEvent);
}

export function getEventRow(db, user, id) {
  const v = visibleClause(user);
  return orNotFound(
    db.prepare(`${SELECT} WHERE t.id = ? AND ${v.sql}`).get(id, ...v.params),
    'Etkinlik bulunamadı',
  );
}

/** Rewrite legacy rows (mixed formats) into the normalised storage format. */
export function migrateEventTimes(db, tz = DEFAULT_TZ) {
  const rows = db.prepare('SELECT id, start, "end", all_day FROM events').all();
  const upd = db.prepare('UPDATE events SET start = ?, "end" = ? WHERE id = ?');
  for (const r of rows) {
    let n;
    try {
      n = normalizeEventTimes({ start: r.start, end: r.end, allDay: !!r.all_day }, tz);
    } catch {
      n = normalizeEventTimes({ start: r.start, end: r.start, allDay: !!r.all_day }, tz);
    }
    if (n.start !== r.start || n.end !== r.end) upd.run(n.start, n.end, r.id);
  }
}
