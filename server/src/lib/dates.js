// Date helpers working on 'YYYY-MM-DD' strings in UTC arithmetic (timezone-safe).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateString(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function isIsoString(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s) && !Number.isNaN(Date.parse(s));
}

function toUtc(s) {
  return new Date(`${s}T00:00:00Z`);
}
function fmt(d) {
  return d.toISOString().slice(0, 10);
}

export function addDays(s, n) {
  const d = toUtc(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

/* ------------------------------------------------------------------------ */
/* Time zones                                                                */
/* ------------------------------------------------------------------------ */

/**
 * The household's default IANA time zone. Used when a request does not send `tz`
 * (and by the seed). Overridable with APP_TIMEZONE.
 */
export const DEFAULT_TZ = process.env.APP_TIMEZONE || 'Europe/Istanbul';

const dtfCache = new Map();
function dtf(tz) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    dtfCache.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    dtf(tz);
    return true;
  } catch {
    return false;
  }
}

/** Wall-clock parts of an instant in a time zone. */
function zonedParts(ms, tz) {
  const parts = {};
  for (const p of dtf(tz).formatToParts(new Date(ms))) parts[p.type] = p.value;
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
    h: Number(parts.hour) % 24,
    mi: Number(parts.minute),
    s: Number(parts.second),
  };
}

function offsetMs(ms, tz) {
  const p = zonedParts(ms, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** The instant (Date) of wall-clock `date hh:mm` in `tz`. */
export function zonedToUtc(date, hh = 0, mm = 0, tz = DEFAULT_TZ) {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = offsetMs(guess, tz);
  let t = guess - off1;
  const off2 = offsetMs(t, tz);
  if (off2 !== off1) t = guess - off2;
  return new Date(t);
}

/** Calendar date ('YYYY-MM-DD') of an instant in `tz`. */
export function dateInTz(instant, tz = DEFAULT_TZ) {
  const ms = instant instanceof Date ? instant.getTime() : Date.parse(instant);
  const p = zonedParts(ms, tz);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** Today's date in the given time zone (default: household time zone). */
export function today(tz = DEFAULT_TZ) {
  return dateInTz(new Date(), tz);
}

export function startOfWeek(s) {
  const d = toUtc(s);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return fmt(d);
}

export function startOfMonth(s) {
  return `${s.slice(0, 7)}-01`;
}

export function endOfMonth(s) {
  const d = toUtc(startOfMonth(s));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return fmt(d);
}

/** Normalise a date to the start of its period. */
export function normalizePeriodStart(period, s) {
  if (period === 'weekly') return startOfWeek(s);
  if (period === 'monthly') return startOfMonth(s);
  return s;
}

/** Last day of the period that starts at (normalised) s. */
export function periodEnd(period, s) {
  const start = normalizePeriodStart(period, s);
  if (period === 'weekly') return addDays(start, 6);
  if (period === 'monthly') return endOfMonth(start);
  return start;
}

export function nowIso() {
  return new Date().toISOString();
}
