import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { tr } from 'date-fns/locale';
import type { Period } from '../api/types';

export const WEEK_OPTS = { weekStartsOn: 1 as const, locale: tr };

/** Format a Date as YYYY-MM-DD in local time. */
export function toDateStr(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Parse a YYYY-MM-DD (or ISO) string into a local Date. */
export function parseDate(s: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return parseISO(s);
}

export function fmt(d: Date | string, pattern: string): string {
  const date = typeof d === 'string' ? parseDate(d) : d;
  return format(date, pattern, { locale: tr });
}

export function periodStartOf(period: Period, d: Date): Date {
  if (period === 'weekly') return startOfWeek(d, WEEK_OPTS);
  if (period === 'monthly') return startOfMonth(d);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function periodEndOf(period: Period, d: Date): Date {
  if (period === 'weekly') return endOfWeek(d, WEEK_OPTS);
  if (period === 'monthly') return endOfMonth(d);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function shiftPeriod(period: Period, d: Date, n: number): Date {
  if (period === 'weekly') return addWeeks(d, n);
  if (period === 'monthly') return addMonths(d, n);
  return addDays(d, n);
}

export function periodLabel(period: Period, start: Date | string): string {
  const s = typeof start === 'string' ? parseDate(start) : start;
  if (period === 'daily') return fmt(s, 'd MMMM yyyy, EEEE');
  if (period === 'weekly') {
    const ws = startOfWeek(s, WEEK_OPTS);
    const we = endOfWeek(s, WEEK_OPTS);
    const sameMonth = ws.getMonth() === we.getMonth();
    return `${fmt(ws, sameMonth ? 'd' : 'd MMM')} – ${fmt(we, 'd MMM yyyy')}`;
  }
  const label = fmt(s, 'LLLL yyyy');
  return label.charAt(0).toLocaleUpperCase('tr-TR') + label.slice(1);
}

export const PERIOD_LABELS: Record<Period, string> = {
  daily: 'Günlük',
  weekly: 'Haftalık',
  monthly: 'Aylık',
};

export const PERIOD_NOUN: Record<Period, string> = {
  daily: 'Gün',
  weekly: 'Hafta',
  monthly: 'Ay',
};

export function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1);
}

/** Time "HH:mm" of an ISO timestamp, in local time. */
export function timeOf(iso: string): string {
  return format(parseISO(iso), 'HH:mm');
}

/** Combine YYYY-MM-DD and HH:mm into a local Date. */
export function combineDateTime(date: string, time: string): Date {
  const d = parseDate(date);
  const [h, m] = (time || '00:00').split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

/** Whether an event [start,end] overlaps the given local day. All-day events are inclusive by date. */
export function eventOnDay(ev: { start: string; end: string | null; allDay?: boolean }, day: Date): boolean {
  const s = parseISO(ev.start);
  const e = ev.end ? parseISO(ev.end) : s;
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  if (ev.allDay) {
    const sd = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const ed = e > s ? new Date(e.getFullYear(), e.getMonth(), e.getDate()) : sd;
    return sd <= dayStart && ed >= dayStart;
  }
  if (e.getTime() <= s.getTime()) return s >= dayStart && s < dayEnd;
  return s < dayEnd && e > dayStart;
}
