import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  addMonths,
  addWeeks,
  differenceInMinutes,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { calendarApi, type CalendarData, type CalendarEvent, type Goal, type PageSummary, type Task } from '../api';
import { EventModal, type EventDefaults } from '../components/EventModal';
import { GoalModal } from '../components/GoalModal';
import { EventChip, GoalChip, GoalRow, hexToTint, PlanChip, PlanRow, TaskChip } from '../components/items';
import { Modal } from '../components/Modal';
import { OwnerBadge } from '../components/OwnerBadge';
import { TaskModal } from '../components/TaskModal';
import { Button, Empty, ErrorBox, PrivateTag, SegmentedControl, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { SCOPE_LABELS, useScope } from '../context/ScopeContext';
import { capitalize, eventOnDay, fmt, periodLabel, timeOf, toDateStr, WEEK_OPTS } from '../lib/dates';
import { useAsync } from '../lib/useAsync';
import { cx } from '../lib/util';

type View = 'month' | 'week' | 'day';
const VIEW_KEY = 'ortakplan.calendarView';
const HOUR_PX = 48;
const MAX_CELL_ITEMS = 4;
const MAX_COMPACT_ITEMS = 6;

/** True below Tailwind's `sm` breakpoint (phones). */
function useIsNarrow(): boolean {
  const query = '(max-width: 639px)';
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return !!narrow;
}

type DayItem =
  | { kind: 'event'; key: string; event: CalendarEvent }
  | { kind: 'task'; key: string; task: Task }
  | { kind: 'goal'; key: string; goal: Goal }
  | { kind: 'plan'; key: string; plan: PageSummary };

function readView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === 'month' || v === 'week' || v === 'day') return v;
  } catch {
    /* ignore */
  }
  return 'month';
}

function rangeFor(view: View, cursor: Date): { from: Date; to: Date } {
  if (view === 'month') {
    return { from: startOfWeek(startOfMonth(cursor), WEEK_OPTS), to: endOfWeek(endOfMonth(cursor), WEEK_OPTS) };
  }
  if (view === 'week') return { from: startOfWeek(cursor, WEEK_OPTS), to: endOfWeek(cursor, WEEK_OPTS) };
  return { from: cursor, to: cursor };
}

function sortEvents(a: CalendarEvent, b: CalendarEvent) {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return a.start.localeCompare(b.start);
}

/** Items for a given day: events (all-day + timed), due tasks, daily goals, daily plans. */
function itemsForDay(data: CalendarData | null, day: Date, opts: { timed: boolean }): DayItem[] {
  if (!data) return [];
  const ds = toDateStr(day);
  const items: DayItem[] = [];
  data.events
    .filter((e) => eventOnDay(e, day) && (opts.timed || e.allDay))
    .sort(sortEvents)
    .forEach((e) => items.push({ kind: 'event', key: `e${e.id}`, event: e }));
  data.tasks.filter((t) => t.dueDate === ds).forEach((t) => items.push({ kind: 'task', key: `t${t.id}`, task: t }));
  data.goals.filter((g) => g.period === 'daily' && g.periodStart === ds).forEach((g) => items.push({ kind: 'goal', key: `g${g.id}`, goal: g }));
  data.plans.filter((p) => p.period === 'daily' && p.periodStart === ds).forEach((p) => items.push({ kind: 'plan', key: `p${p.id}`, plan: p }));
  return items;
}

interface Handlers {
  onEvent: (e: CalendarEvent) => void;
  onTask: (t: Task) => void;
  onGoal: (g: Goal) => void;
}

function ItemChip({ item, h, showTime = true }: { item: DayItem; h: Handlers; showTime?: boolean }) {
  switch (item.kind) {
    case 'event':
      return <EventChip event={item.event} onClick={() => h.onEvent(item.event)} showTime={showTime} />;
    case 'task':
      return <TaskChip task={item.task} onClick={() => h.onTask(item.task)} />;
    case 'goal':
      return <GoalChip goal={item.goal} onClick={() => h.onGoal(item.goal)} />;
    case 'plan':
      return <PlanChip plan={item.plan} />;
  }
}

/** Phone-size month cell item: just the owner's letter, framed by item kind. */
function CompactItem({ item }: { item: DayItem }) {
  const owner =
    item.kind === 'event' ? item.event.owner : item.kind === 'task' ? item.task.owner : item.kind === 'goal' ? item.goal.owner : item.plan.owner;
  const title =
    item.kind === 'event' ? item.event.title : item.kind === 'task' ? item.task.title : item.kind === 'goal' ? item.goal.title : item.plan.title;
  const frame =
    item.kind === 'event'
      ? ''
      : item.kind === 'task'
        ? 'outline-dashed outline-1 outline-offset-1 outline-amber-500'
        : item.kind === 'goal'
          ? 'outline outline-1 outline-offset-1 outline-emerald-500'
          : 'outline outline-1 outline-offset-1 outline-violet-500';
  return (
    <span title={`${owner.name}: ${title}`} className={cx('inline-flex rounded-full', frame)}>
      <OwnerBadge owner={owner} size="sm" />
    </span>
  );
}

/* ------------------------------ Month view ------------------------------ */

function MonthView({
  cursor,
  data,
  h,
  onCreate,
  onMore,
  onOpenDay,
  compact,
}: {
  cursor: Date;
  data: CalendarData | null;
  h: Handlers;
  onCreate: (d: EventDefaults) => void;
  onMore: (day: Date) => void;
  onOpenDay: (day: Date) => void;
  compact: boolean;
}) {
  const { from, to } = rangeFor('month', cursor);
  const days = eachDayOfInterval({ start: from, end: to });
  const weekdays = days.slice(0, 7).map((d) => fmt(d, 'EEEEEE'));
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200">
      <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50">
        {weekdays.map((w) => (
          <div key={w} className="px-2 py-1.5 text-xs font-medium text-neutral-500">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const items = itemsForDay(data, day, { timed: true });
          const visible = items.slice(0, compact ? MAX_COMPACT_ITEMS : MAX_CELL_ITEMS);
          const hidden = items.length - visible.length;
          const inMonth = isSameMonth(day, cursor);
          // On phones a tap opens the day's agenda (with an add button); on larger screens it adds an event.
          const activate = () => (compact ? onMore(day) : onCreate({ date: toDateStr(day), allDay: true }));
          return (
            <div
              key={day.toISOString()}
              role="button"
              tabIndex={0}
              data-date={toDateStr(day)}
              aria-label={capitalize(fmt(day, 'd MMMM EEEE'))}
              onClick={activate}
              onKeyDown={(e) => {
                if (e.key === 'Enter') activate();
              }}
              className={cx(
                'group min-h-[72px] min-w-0 overflow-hidden cursor-pointer border-neutral-100 p-1 transition-colors hover:bg-neutral-50 sm:min-h-[120px]',
                i % 7 !== 6 && 'border-r',
                i < days.length - 7 && 'border-b',
                !inMonth && 'bg-neutral-50/60',
              )}
            >
              <div className="mb-0.5 flex items-center justify-between px-0.5">
                <button
                  type="button"
                  title="Gün görünümünde aç"
                  aria-label={`${fmt(day, 'd MMMM')} gününü aç`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDay(day);
                  }}
                  className={cx(
                    'flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs hover:ring-1 hover:ring-neutral-300',
                    isToday(day) ? 'bg-red-500 font-semibold text-white' : inMonth ? 'text-neutral-700' : 'text-neutral-300',
                  )}
                >
                  {fmt(day, 'd')}
                </button>
                <span className="hidden text-xs text-neutral-300 group-hover:inline">+</span>
              </div>
              {compact ? (
                <div className="flex flex-wrap gap-1 px-0.5">
                  {visible.map((it) => (
                    <CompactItem key={it.key} item={it} />
                  ))}
                  {hidden > 0 && <span className="text-[10px] leading-4 text-neutral-500">+{hidden}</span>}
                </div>
              ) : (
              <div className="space-y-0.5">
                {visible.map((it) => (
                  <ItemChip key={it.key} item={it} h={h} />
                ))}
                {hidden > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMore(day);
                    }}
                    className="w-full rounded px-1 text-left text-xs font-medium text-neutral-500 hover:bg-neutral-200/60"
                  >
                    +{hidden} daha
                  </button>
                )}
              </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------- Week / Day time grid --------------------------- */

interface Placed {
  event: CalendarEvent;
  top: number;
  height: number;
  col: number;
  cols: number;
}

function layoutDay(events: CalendarEvent[], day: Date): Placed[] {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = addDays(dayStart, 1);
  const segs = events
    .map((ev) => {
      const s = parseISO(ev.start);
      let e = ev.end ? parseISO(ev.end) : s;
      if (e <= s) e = new Date(s.getTime() + 30 * 60000);
      const cs = s < dayStart ? dayStart : s;
      const ce = e > dayEnd ? dayEnd : e;
      return { ev, s: cs, e: ce };
    })
    .sort((a, b) => a.s.getTime() - b.s.getTime() || b.e.getTime() - a.e.getTime());

  const placed: Placed[] = [];
  let cluster: { item: (typeof segs)[number]; col: number }[] = [];
  let clusterEnd = 0;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((c) => c.col + 1));
    for (const c of cluster) {
      const top = (differenceInMinutes(c.item.s, dayStart) / 60) * HOUR_PX;
      const height = Math.max(20, (differenceInMinutes(c.item.e, c.item.s) / 60) * HOUR_PX);
      placed.push({ event: c.item.ev, top, height, col: c.col, cols });
    }
    cluster = [];
  };
  for (const seg of segs) {
    if (cluster.length && seg.s.getTime() >= clusterEnd) flush();
    const colEnds: number[] = [];
    for (const c of cluster) colEnds[c.col] = Math.max(colEnds[c.col] ?? 0, c.item.e.getTime());
    let col = 0;
    while (colEnds[col] !== undefined && colEnds[col] > seg.s.getTime()) col++;
    cluster.push({ item: seg, col });
    clusterEnd = Math.max(clusterEnd, seg.e.getTime());
  }
  if (cluster.length) flush();
  return placed;
}

function TimeGridView({
  days,
  data,
  h,
  onCreate,
}: {
  days: Date[];
  data: CalendarData | null;
  h: Handlers;
  onCreate: (d: EventDefaults) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_PX;
  }, []);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const gridCols = { gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` };

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200">
      {/* Header */}
      <div className="grid border-b border-neutral-200 bg-neutral-50" style={gridCols}>
        <div />
        {days.map((d) => (
          <div key={d.toISOString()} className="border-l border-neutral-100 px-2 py-1.5 text-center">
            <div className="text-xs text-neutral-500">{fmt(d, 'EEE')}</div>
            <div className={cx('mx-auto flex h-7 w-7 items-center justify-center rounded-full text-sm', isToday(d) ? 'bg-red-500 font-semibold text-white' : 'text-neutral-800')}>
              {fmt(d, 'd')}
            </div>
          </div>
        ))}
      </div>
      {/* All-day row */}
      <div className="grid border-b border-neutral-200" style={gridCols}>
        <div className="px-1 py-1 text-right text-[10px] leading-tight text-neutral-400">Tüm gün</div>
        {days.map((d) => {
          const items = itemsForDay(data, d, { timed: false });
          return (
            <div
              key={d.toISOString()}
              className="min-h-[32px] cursor-pointer space-y-0.5 border-l border-neutral-100 p-1 hover:bg-neutral-50"
              onClick={() => onCreate({ date: toDateStr(d), allDay: true })}
            >
              {items.map((it) => (
                <ItemChip key={it.key} item={it} h={h} />
              ))}
            </div>
          );
        })}
      </div>
      {/* Time grid */}
      <div ref={scrollRef} className="max-h-[65vh] overflow-y-auto">
        <div className="grid" style={gridCols}>
          <div className="relative" style={{ height: 24 * HOUR_PX }}>
            {hours.map((hr) => (
              <div key={hr} className="absolute right-1 -translate-y-1/2 text-[10px] tabular-nums text-neutral-400" style={{ top: hr * HOUR_PX }}>
                {hr === 0 ? '' : `${String(hr).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>
          {days.map((d) => {
            const timed = (data?.events ?? []).filter((e) => !e.allDay && eventOnDay(e, d));
            const placed = layoutDay(timed, d);
            const showNow = isSameDay(d, now);
            return (
              <div key={d.toISOString()} className="relative border-l border-neutral-100" style={{ height: 24 * HOUR_PX }}>
                {hours.map((hr) => (
                  <div key={hr} className="absolute inset-x-0 border-t border-neutral-100" style={{ top: hr * HOUR_PX, height: HOUR_PX }}>
                    <button
                      type="button"
                      aria-label={`${fmt(d, 'd MMMM')} ${hr}:00 etkinlik ekle`}
                      className="block h-1/2 w-full hover:bg-blue-50/60"
                      onClick={() => onCreate({ date: toDateStr(d), time: `${String(hr).padStart(2, '0')}:00` })}
                    />
                    <button
                      type="button"
                      aria-label={`${fmt(d, 'd MMMM')} ${hr}:30 etkinlik ekle`}
                      className="block h-1/2 w-full hover:bg-blue-50/60"
                      onClick={() => onCreate({ date: toDateStr(d), time: `${String(hr).padStart(2, '0')}:30` })}
                    />
                  </div>
                ))}
                {placed.map((p) => {
                  const c = p.event.color ?? p.event.owner.color;
                  return (
                    <button
                      key={p.event.id}
                      type="button"
                      onClick={() => h.onEvent(p.event)}
                      className="absolute flex flex-col justify-start overflow-hidden rounded-md border-l-[3px] px-1 py-0.5 text-left text-xs text-neutral-800 shadow-sm hover:brightness-95"
                      style={{
                        top: p.top,
                        height: p.height - 2,
                        left: `calc(${(p.col / p.cols) * 100}% + 2px)`,
                        width: `calc(${100 / p.cols}% - 4px)`,
                        background: hexToTint(c, 0.16),
                        borderLeftColor: c,
                      }}
                      title={p.event.title}
                    >
                      <div className="flex items-center gap-1">
                        <OwnerBadge owner={p.event.owner} size="xs" />
                        <span className="truncate font-medium">{p.event.title}</span>
                        {p.event.visibility === 'private' && <PrivateTag />}
                      </div>
                      {p.height > 32 && (
                        <div className="truncate text-[10px] text-neutral-500">
                          {timeOf(p.event.start)}–{timeOf(p.event.end || p.event.start)}
                          {p.event.location ? ` · ${p.event.location}` : ''}
                        </div>
                      )}
                    </button>
                  );
                })}
                {showNow && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-red-500"
                    style={{ top: ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_PX }}
                  >
                    <div className="-ml-1 -mt-[5px] h-2 w-2 rounded-full bg-red-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Goals panel ------------------------------ */

function PeriodPanel({ data, view, cursor, h }: { data: CalendarData | null; view: View; cursor: Date; h: Handlers }) {
  const goals = data?.goals ?? [];
  const plans = data?.plans ?? [];
  const monthStart = toDateStr(startOfMonth(cursor));
  const monthly = goals.filter((g) => g.period === 'monthly');
  const weekly = goals.filter((g) => g.period === 'weekly');
  const monthlyPlans = plans.filter((p) => p.period === 'monthly');
  const weeklyPlans = plans.filter((p) => p.period === 'weekly');

  const weekGroups = useMemo(() => {
    const map = new Map<string, Goal[]>();
    for (const g of weekly) {
      const arr = map.get(g.periodStart) ?? [];
      arr.push(g);
      map.set(g.periodStart, arr);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [weekly]);

  return (
    <aside className="space-y-4">
      <section className="rounded-xl border border-neutral-200 p-3">
        <h3 className="mb-1 text-sm font-semibold text-neutral-800">
          Aylık hedefler <span className="font-normal text-neutral-400">· {periodLabel('monthly', view === 'month' ? monthStart : cursor)}</span>
        </h3>
        {monthly.length === 0 ? <Empty>Hedef yok.</Empty> : monthly.map((g) => <GoalRow key={g.id} goal={g} onClick={() => h.onGoal(g)} />)}
      </section>
      <section className="rounded-xl border border-neutral-200 p-3">
        <h3 className="mb-1 text-sm font-semibold text-neutral-800">Haftalık hedefler</h3>
        {weekGroups.length === 0 ? (
          <Empty>Hedef yok.</Empty>
        ) : (
          weekGroups.map(([start, gs]) => (
            <div key={start} className="mb-2">
              <div className="px-2 text-[11px] font-medium text-neutral-400">{periodLabel('weekly', start)}</div>
              {gs.map((g) => (
                <GoalRow key={g.id} goal={g} onClick={() => h.onGoal(g)} />
              ))}
            </div>
          ))
        )}
      </section>
      {(monthlyPlans.length > 0 || weeklyPlans.length > 0) && (
        <section className="rounded-xl border border-neutral-200 p-3">
          <h3 className="mb-1 text-sm font-semibold text-neutral-800">Planlar</h3>
          {[...monthlyPlans, ...weeklyPlans].map((p) => (
            <PlanRow key={p.id} plan={p} />
          ))}
        </section>
      )}
      <section className="rounded-xl border border-neutral-200 p-3 text-xs text-neutral-500">
        <div className="mb-1.5 font-semibold text-neutral-700">Gösterim</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2"><span className="h-3 w-5 rounded bg-blue-100" /> Etkinlik</div>
          <div className="flex items-center gap-2"><span className="h-3 w-5 rounded border border-dashed border-amber-300 bg-amber-50" /> Son tarihli görev</div>
          <div className="flex items-center gap-2"><span className="h-3 w-5 rounded border border-emerald-200 bg-emerald-50" /> Günlük hedef</div>
          <div className="flex items-center gap-2"><span className="h-3 w-5 rounded border border-violet-200 bg-violet-50" /> Plan</div>
        </div>
      </section>
    </aside>
  );
}

/* --------------------------------- Page --------------------------------- */

/** Who is who: the household members' letters, plus the active scope. */
function MemberLegend() {
  const { household } = useAuth();
  const { scope } = useScope();
  if (!household) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500" data-testid="member-legend">
      {household.members.map((m) => (
        <span key={m.id} className="inline-flex items-center gap-1">
          <OwnerBadge owner={m} size="sm" /> {m.name}
        </span>
      ))}
      <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-600">
        Görünüm: {SCOPE_LABELS[scope]}
        {scope === 'merged' ? ' (hepimiz)' : scope === 'mine' ? ' (yalnızca ben)' : ' (eşimin paylaştıkları)'}
      </span>
    </div>
  );
}

export function CalendarPage() {
  const { scope } = useScope();
  const narrow = useIsNarrow();
  const [view, setViewState] = useState<View>(readView);
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  };

  const { from, to } = rangeFor(view, cursor);
  const fromStr = toDateStr(from);
  const toStr = toDateStr(to);
  const { data, loading, error, reload } = useAsync(() => calendarApi.get({ from: fromStr, to: toStr, scope }), [fromStr, toStr, scope]);

  const [eventModal, setEventModal] = useState<{ event: CalendarEvent | null; defaults?: EventDefaults } | null>(null);
  const [taskModal, setTaskModal] = useState<Task | null>(null);
  const [goalModal, setGoalModal] = useState<Goal | null>(null);
  const [moreDay, setMoreDay] = useState<Date | null>(null);

  const h: Handlers = {
    onEvent: (e) => setEventModal({ event: e }),
    onTask: (t) => setTaskModal(t),
    onGoal: (g) => setGoalModal(g),
  };
  const onCreate = (d: EventDefaults) => setEventModal({ event: null, defaults: d });

  function shift(n: number) {
    setCursor((c) => (view === 'month' ? addMonths(c, n) : view === 'week' ? addWeeks(c, n) : addDays(c, n)));
  }

  const title =
    view === 'month'
      ? capitalize(fmt(cursor, 'LLLL yyyy'))
      : view === 'week'
        ? periodLabel('weekly', cursor)
        : capitalize(fmt(cursor, 'd MMMM yyyy, EEEE'));

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 py-5 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 flex items-center gap-2 text-2xl font-bold text-neutral-900">📅 Takvim</h1>
        <div className="flex items-center gap-1">
          <Button size="sm" onClick={() => shift(-1)} aria-label="Önceki">
            ‹
          </Button>
          <Button size="sm" onClick={() => setCursor(new Date())}>
            Bugün
          </Button>
          <Button size="sm" onClick={() => shift(1)} aria-label="Sonraki">
            ›
          </Button>
        </div>
        <span className="text-base font-semibold text-neutral-800">{title}</span>
        {loading && <Spinner />}
        <div className="ml-auto flex items-center gap-2">
          <SegmentedControl<View>
            value={view}
            onChange={setView}
            size="sm"
            options={[
              { value: 'month', label: 'Ay' },
              { value: 'week', label: 'Hafta' },
              { value: 'day', label: 'Gün' },
            ]}
          />
          <Button size="sm" variant="primary" onClick={() => onCreate({ date: toDateStr(view === 'month' ? new Date() : cursor), allDay: false, time: '09:00' })}>
            + Etkinlik
          </Button>
        </div>
      </div>
      <div className="-mt-2 mb-3">
        <MemberLegend />
      </div>
      {error && (
        <div className="mb-3">
          <ErrorBox message={error} onRetry={reload} />
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 overflow-x-auto">
          <div className={cx(view === 'week' && 'min-w-[640px]')}>
            {view === 'month' && <MonthView cursor={cursor} data={data} h={h} onCreate={onCreate} onMore={setMoreDay}
                onOpenDay={(d) => {
                  setCursor(d);
                  setView('day');
                }}
                compact={narrow}
              />}
            {view === 'week' && (
              <TimeGridView days={eachDayOfInterval({ start: from, end: to })} data={data} h={h} onCreate={onCreate} />
            )}
            {view === 'day' && <TimeGridView days={[cursor]} data={data} h={h} onCreate={onCreate} />}
          </div>
        </div>
        <PeriodPanel data={data} view={view} cursor={cursor} h={h} />
      </div>

      {moreDay && (
        <Modal open onClose={() => setMoreDay(null)} title={capitalize(fmt(moreDay, 'd MMMM yyyy, EEEE'))} size="sm"
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setCursor(moreDay);
                  setView('day');
                  setMoreDay(null);
                }}
              >
                Gün görünümü
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const d = moreDay;
                  setMoreDay(null);
                  onCreate({ date: toDateStr(d), allDay: true });
                }}
              >
                + Etkinlik
              </Button>
            </>
          }
        >
          <div className="space-y-1">
            {itemsForDay(data, moreDay, { timed: true }).length === 0 && <Empty>Bu gün için kayıt yok.</Empty>}
            {itemsForDay(data, moreDay, { timed: true }).map((it) => (
              <div key={it.key} onClickCapture={() => setMoreDay(null)}>
                <ItemChip item={it} h={h} />
              </div>
            ))}
          </div>
        </Modal>
      )}
      {eventModal && (
        <EventModal open event={eventModal.event} defaults={eventModal.defaults} onClose={() => setEventModal(null)} onSaved={reload} />
      )}
      {taskModal && <TaskModal open task={taskModal} onClose={() => setTaskModal(null)} onSaved={reload} />}
      {goalModal && <GoalModal open goal={goalModal} onClose={() => setGoalModal(null)} onSaved={reload} />}
    </div>
  );
}

