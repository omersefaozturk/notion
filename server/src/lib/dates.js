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

/** Today's date in the server's local timezone. */
export function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
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
