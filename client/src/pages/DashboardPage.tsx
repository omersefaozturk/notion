import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi, goalsApi, type CalendarEvent, type Goal, type Task } from '../api';
import { EventModal } from '../components/EventModal';
import { GoalModal } from '../components/GoalModal';
import { EventRow, GoalRow, PlanRow, TaskRow } from '../components/items';
import { PageContainer, PageHeader } from '../components/Layout';
import { TaskModal } from '../components/TaskModal';
import { Button, Empty, ErrorBox, Loading } from '../components/ui';
import { useUser } from '../context/AuthContext';
import { useScope } from '../context/ScopeContext';
import { addDays, eachDayOfInterval, endOfWeek, startOfDay } from 'date-fns';
import { capitalize, eventOnDay, fmt, toDateStr, WEEK_OPTS } from '../lib/dates';
import { useAsync } from '../lib/useAsync';

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-800">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DashboardPage() {
  const { scope } = useScope();
  const user = useUser();
  const today = toDateStr(new Date());
  const { data, loading, error, reload } = useAsync(() => dashboardApi.get({ date: today, scope }), [scope, today]);

  const [eventModal, setEventModal] = useState<{ open: boolean; event: CalendarEvent | null }>({ open: false, event: null });
  const [taskModal, setTaskModal] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null });
  const [goalModal, setGoalModal] = useState<{ open: boolean; goal: Goal | null }>({ open: false, goal: null });

  async function toggleGoal(goal: Goal, done: boolean) {
    try {
      await goalsApi.update(goal.id, { done });
      void reload();
    } catch {
      /* ignore */
    }
  }
  const canToggle = (g: Goal) => g.owner.id === user.id || g.visibility === 'shared';

  const goalList = (goals: Goal[], emptyText: string) =>
    goals.length === 0 ? (
      <Empty>{emptyText}</Empty>
    ) : (
      goals.map((g) => (
        <GoalRow key={g.id} goal={g} canToggle={canToggle(g)} onToggle={(d) => toggleGoal(g, d)} onClick={() => setGoalModal({ open: true, goal: g })} />
      ))
    );

  return (
    <PageContainer wide>
      <PageHeader
        icon="☀️"
        title="Bugün"
        subtitle={capitalize(fmt(new Date(), 'd MMMM yyyy, EEEE'))}
        actions={
          <>
            <Button size="sm" onClick={() => setEventModal({ open: true, event: null })}>+ Etkinlik</Button>
            <Button size="sm" onClick={() => setTaskModal({ open: true, task: null })}>+ Görev</Button>
            <Button size="sm" onClick={() => setGoalModal({ open: true, goal: null })}>+ Hedef</Button>
          </>
        }
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <Loading />}
      {data && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Section title="Bugünün etkinlikleri" action={<Link to="/calendar" className="text-xs text-neutral-400 hover:text-neutral-700">Takvim →</Link>}>
              {data.today.events.length === 0 ? (
                <Empty>Bugün için etkinlik yok.</Empty>
              ) : (
                data.today.events.map((e) => <EventRow key={e.id} event={e} onClick={() => setEventModal({ open: true, event: e })} />)
              )}
            </Section>
            <Section title="Bu haftanın etkinlikleri">
              {(() => {
                const from = startOfDay(addDays(new Date(), 1));
                const to = endOfWeek(new Date(), WEEK_OPTS);
                const days = from <= to ? eachDayOfInterval({ start: from, end: to }) : [];
                const groups = days
                  .map((d) => ({ d, events: (data.week.events ?? []).filter((e) => eventOnDay(e, d)) }))
                  .filter((g) => g.events.length > 0);
                if (groups.length === 0) return <Empty>Bu hafta için başka etkinlik yok.</Empty>;
                return groups.map((g) => (
                  <div key={g.d.toISOString()} className="mb-1">
                    <div className="px-2 pt-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">{capitalize(fmt(g.d, 'd MMMM EEEE'))}</div>
                    {g.events.map((e) => (
                      <EventRow key={e.id} event={e} onClick={() => setEventModal({ open: true, event: e })} />
                    ))}
                  </div>
                ));
              })()}
            </Section>
            <Section title="Bugünün görevleri" action={<Link to="/board" className="text-xs text-neutral-400 hover:text-neutral-700">Pano →</Link>}>
              {data.today.tasks.length === 0 ? (
                <Empty>Bugün teslimi olan görev yok.</Empty>
              ) : (
                data.today.tasks.map((t) => <TaskRow key={t.id} task={t} showStatus onClick={() => setTaskModal({ open: true, task: t })} />)
              )}
            </Section>
            <Section title="Bu haftanın görevleri">
              {data.week.tasks.length === 0 ? (
                <Empty>Bu hafta teslimi olan görev yok.</Empty>
              ) : (
                data.week.tasks.map((t) => <TaskRow key={t.id} task={t} showStatus onClick={() => setTaskModal({ open: true, task: t })} />)
              )}
            </Section>
            <Section title="Hedefler" action={<Link to="/goals" className="text-xs text-neutral-400 hover:text-neutral-700">Hedefler →</Link>}>
              <h3 className="mb-1 mt-1 text-xs font-medium uppercase tracking-wide text-neutral-400">Günlük</h3>
              {goalList(data.today.goals, 'Bugün için hedef yok.')}
              <h3 className="mb-1 mt-3 text-xs font-medium uppercase tracking-wide text-neutral-400">Haftalık</h3>
              {goalList(data.week.goals, 'Bu hafta için hedef yok.')}
              <h3 className="mb-1 mt-3 text-xs font-medium uppercase tracking-wide text-neutral-400">Aylık</h3>
              {goalList(data.month.goals, 'Bu ay için hedef yok.')}
            </Section>
          </div>
          <div className="space-y-4">
            <Section title="Görev durumu">
              <div className="grid grid-cols-3 gap-2 text-center">
                {(
                  [
                    ['Yapılacak', data.taskCounts.todo, 'text-neutral-700'],
                    ['Yapılıyor', data.taskCounts.doing, 'text-blue-600'],
                    ['Yapıldı', data.taskCounts.done, 'text-green-600'],
                  ] as const
                ).map(([label, n, cls]) => (
                  <div key={label} className="rounded-lg bg-neutral-50 py-3">
                    <div className={`text-2xl font-bold ${cls}`}>{n}</div>
                    <div className="text-xs text-neutral-500">{label}</div>
                  </div>
                ))}
              </div>
            </Section>
            <Section title="Planlar" action={<Link to="/plans" className="text-xs text-neutral-400 hover:text-neutral-700">Planlar →</Link>}>
              <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">Bugün</h3>
              {data.today.plans.length === 0 ? <Empty>Günlük plan yok.</Empty> : data.today.plans.map((p) => <PlanRow key={p.id} plan={p} />)}
              <h3 className="mb-1 mt-3 text-xs font-medium uppercase tracking-wide text-neutral-400">Bu hafta</h3>
              {data.week.plans.length === 0 ? <Empty>Haftalık plan yok.</Empty> : data.week.plans.map((p) => <PlanRow key={p.id} plan={p} />)}
              <h3 className="mb-1 mt-3 text-xs font-medium uppercase tracking-wide text-neutral-400">Bu ay</h3>
              {data.month.plans.length === 0 ? <Empty>Aylık plan yok.</Empty> : data.month.plans.map((p) => <PlanRow key={p.id} plan={p} />)}
            </Section>
          </div>
        </div>
      )}

      {eventModal.open && <EventModal open event={eventModal.event} defaults={{ date: today }} onClose={() => setEventModal({ open: false, event: null })} onSaved={reload} />}
      {taskModal.open && <TaskModal open task={taskModal.task} defaultDueDate={today} onClose={() => setTaskModal({ open: false, task: null })} onSaved={reload} />}
      {goalModal.open && <GoalModal open goal={goalModal.goal} defaultPeriod="daily" defaultDate={today} onClose={() => setGoalModal({ open: false, goal: null })} onSaved={reload} />}
    </PageContainer>
  );
}
