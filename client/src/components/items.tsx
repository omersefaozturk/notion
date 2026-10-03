import { Link } from 'react-router-dom';
import type { CalendarEvent, Goal, PageSummary, Task } from '../api/types';
import { fmt, PERIOD_LABELS, periodLabel, timeOf } from '../lib/dates';
import { cx, PRIORITY_LABELS, STATUS_LABELS } from '../lib/util';
import { OwnerBadge } from './OwnerBadge';
import { Checkbox, PrivateTag, ProgressBar } from './ui';

/* ---------- Compact chips (calendar cells) ---------- */

export function EventChip({ event, onClick, showTime = true }: { event: CalendarEvent; onClick?: () => void; showTime?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      title={event.title}
      className="flex w-full min-w-0 items-center gap-1 rounded px-1 py-0.5 text-left text-xs text-neutral-800 hover:brightness-95"
      style={{ background: hexToTint(event.color ?? event.owner.color, 0.14) }}
    >
      <OwnerBadge owner={event.owner} size="xs" />
      {showTime && !event.allDay && <span className="hidden shrink-0 tabular-nums text-neutral-500 sm:inline">{timeOf(event.start)}</span>}
      <span className="truncate">{event.title}</span>
      {event.visibility === 'private' && <PrivateTag />}
    </button>
  );
}

export function TaskChip({ task, onClick }: { task: Task; onClick?: () => void }) {
  const done = task.status === 'done';
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      title={`Görev: ${task.title}`}
      className="flex w-full min-w-0 items-center gap-1 rounded border border-dashed border-amber-300 bg-amber-50/60 px-1 py-0.5 text-left text-xs text-neutral-800 hover:bg-amber-100"
    >
      <OwnerBadge owner={task.owner} size="xs" />
      <span className={cx('shrink-0', done ? 'text-green-600' : 'text-amber-600')}>{done ? '☑' : '☐'}</span>
      <span className={cx('truncate', done && 'text-neutral-400 line-through')}>{task.title}</span>
    </button>
  );
}

export function GoalChip({ goal, onClick }: { goal: Goal; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      title={`Hedef: ${goal.title} (%${goal.progress})`}
      className="flex w-full min-w-0 items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1 py-0.5 text-left text-xs text-neutral-800 hover:bg-emerald-100"
    >
      <OwnerBadge owner={goal.owner} size="xs" />
      <span className="shrink-0">🎯</span>
      <span className={cx('truncate', goal.done && 'text-neutral-400 line-through')}>{goal.title}</span>
    </button>
  );
}

export function PlanChip({ plan }: { plan: PageSummary }) {
  return (
    <Link
      to={`/pages/${plan.id}`}
      onClick={(e) => e.stopPropagation()}
      className="flex w-full min-w-0 items-center gap-1 rounded border border-violet-200 bg-violet-50 px-1 py-0.5 text-xs text-neutral-800 hover:bg-violet-100"
      title={`Plan: ${plan.title}`}
    >
      <OwnerBadge owner={plan.owner} size="xs" />
      <span className="shrink-0">{plan.icon || '📄'}</span>
      <span className="truncate">{plan.title || 'Adsız'}</span>
    </Link>
  );
}

/* ---------- Rows (dashboard, lists) ---------- */

export function EventRow({ event, onClick }: { event: CalendarEvent; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-start gap-3 rounded-md px-2 py-1.5 text-left hover:bg-neutral-50">
      <span className="w-14 shrink-0 pt-0.5 text-xs tabular-nums text-neutral-500">{event.allDay ? 'Tüm gün' : timeOf(event.start)}</span>
      <OwnerBadge owner={event.owner} size="sm" className="mt-0.5" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-neutral-900">
          {event.title} {event.visibility === 'private' && <PrivateTag />}
        </span>
        {event.location && <span className="block truncate text-xs text-neutral-500">📍 {event.location}</span>}
      </span>
    </button>
  );
}

const PRIORITY_COLORS = { low: 'bg-neutral-100 text-neutral-600', medium: 'bg-amber-100 text-amber-700', high: 'bg-red-100 text-red-700' } as const;

export function PriorityTag({ priority }: { priority: Task['priority'] }) {
  return <span className={cx('rounded px-1.5 py-0.5 text-[10px] font-medium', PRIORITY_COLORS[priority])}>{PRIORITY_LABELS[priority]}</span>;
}

export function TaskRow({ task, onClick, showStatus }: { task: Task; onClick?: () => void; showStatus?: boolean }) {
  const done = task.status === 'done';
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-neutral-50">
      <OwnerBadge owner={task.owner} size="sm" />
      <span className={cx('min-w-0 flex-1 truncate text-sm', done ? 'text-neutral-400 line-through' : 'text-neutral-900')}>
        {task.title} {task.visibility === 'private' && <PrivateTag />}
      </span>
      {showStatus && <span className="text-[10px] text-neutral-500">{STATUS_LABELS[task.status]}</span>}
      <PriorityTag priority={task.priority} />
      {task.dueDate && <span className="text-xs text-neutral-500">{fmt(task.dueDate, 'd MMM')}</span>}
      {task.assignee && (
        <span className="flex items-center gap-0.5 text-[10px] text-neutral-400" title={`Sorumlu: ${task.assignee.name}`}>
          →<OwnerBadge owner={task.assignee} size="xs" />
        </span>
      )}
    </button>
  );
}

export function GoalRow({
  goal,
  onClick,
  onToggle,
  canToggle,
  showPeriod,
}: {
  goal: Goal;
  onClick?: () => void;
  onToggle?: (done: boolean) => void;
  canToggle?: boolean;
  showPeriod?: boolean;
}) {
  return (
    <div className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-neutral-50">
      <Checkbox checked={goal.done} onChange={(v) => onToggle?.(v)} disabled={!canToggle || !onToggle} label="Tamamlandı" />
      <OwnerBadge owner={goal.owner} size="sm" />
      <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
        <span className={cx('block truncate text-sm', goal.done ? 'text-neutral-400 line-through' : 'text-neutral-900')}>
          {goal.title} {goal.visibility === 'private' && <PrivateTag />}
        </span>
        {showPeriod && (
          <span className="block text-[11px] text-neutral-400">
            {PERIOD_LABELS[goal.period]} · {periodLabel(goal.period, goal.periodStart)}
          </span>
        )}
      </button>
      <div className="w-20 shrink-0">
        <ProgressBar value={goal.progress} color={goal.done ? '#16a34a' : goal.owner.color} />
      </div>
      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-neutral-500">%{goal.progress}</span>
    </div>
  );
}

export function PlanRow({ plan }: { plan: PageSummary }) {
  return (
    <Link to={`/pages/${plan.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-neutral-50">
      <OwnerBadge owner={plan.owner} size="sm" />
      <span className="text-base leading-none">{plan.icon || '📄'}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-neutral-900">
        {plan.title || 'Adsız'} {plan.visibility === 'private' && <PrivateTag />}
      </span>
      {plan.period && <span className="text-[10px] text-neutral-400">{PERIOD_LABELS[plan.period]}</span>}
    </Link>
  );
}

/** Convert #rrggbb to rgba() tint. */
export function hexToTint(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return `rgba(37,99,235,${alpha})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
}
