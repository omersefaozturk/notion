import { useState } from 'react';
import { goalsApi, type Goal, type Period } from '../api';
import { GoalModal } from '../components/GoalModal';
import { PageContainer, PageHeader } from '../components/Layout';
import { OwnerBadge } from '../components/OwnerBadge';
import { Button, Checkbox, Empty, ErrorBox, Input, Loading, PrivateTag, SegmentedControl } from '../components/ui';
import { useUser } from '../context/AuthContext';
import { useScope } from '../context/ScopeContext';
import { PERIOD_LABELS, periodEndOf, periodLabel, periodStartOf, shiftPeriod, toDateStr } from '../lib/dates';
import { useAsync } from '../lib/useAsync';
import { cx, errorMessage } from '../lib/util';

const TAB_KEY = 'ortakplan.goalsTab';

function readTab(): Period {
  try {
    const v = localStorage.getItem(TAB_KEY);
    if (v === 'daily' || v === 'weekly' || v === 'monthly') return v;
  } catch {
    /* ignore */
  }
  return 'weekly';
}

function GoalCard({ goal, canEdit, onChange, onOpen }: { goal: Goal; canEdit: boolean; onChange: (patch: { progress?: number; done?: boolean }) => void; onOpen: () => void }) {
  const [progress, setProgress] = useState(goal.progress);
  const [prevGoal, setPrevGoal] = useState(goal);
  if (prevGoal !== goal) {
    setPrevGoal(goal);
    setProgress(goal.progress);
  }
  const commit = () => {
    if (progress === goal.progress) return;
    onChange({ progress });
  };
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3" data-testid="goal-card">
      <div className="flex items-start gap-2">
        <Checkbox
          className="mt-0.5"
          checked={goal.done}
          disabled={!canEdit}
          label="Tamamlandı"
          onChange={(v) => onChange({ done: v })}
        />
        <OwnerBadge owner={goal.owner} size="sm" className="mt-0.5" />
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <div className={cx('text-sm font-medium', goal.done ? 'text-neutral-400 line-through' : 'text-neutral-900')}>
            {goal.title} {goal.visibility === 'private' && <PrivateTag />}
          </div>
          {goal.description && <div className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{goal.description}</div>}
        </button>
        <span className="text-sm font-semibold tabular-nums text-neutral-600">%{progress}</span>
      </div>
      <div className="mt-2 flex items-center gap-2 pl-12">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={progress}
          disabled={!canEdit}
          aria-label="İlerleme"
          onChange={(e) => setProgress(Number(e.target.value))}
          onPointerUp={commit}
          onKeyUp={commit}
          className="h-1.5 w-full cursor-pointer disabled:cursor-not-allowed"
          style={{ accentColor: goal.done ? '#16a34a' : goal.owner.color }}
        />
      </div>
    </div>
  );
}

export function GoalsPage() {
  const { scope } = useScope();
  const user = useUser();
  const [period, setPeriodState] = useState<Period>(readTab);
  const [cursor, setCursor] = useState(() => new Date());
  const [modal, setModal] = useState<{ goal: Goal | null } | null>(null);
  const [quick, setQuick] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const setPeriod = (p: Period) => {
    setPeriodState(p);
    try {
      localStorage.setItem(TAB_KEY, p);
    } catch {
      /* ignore */
    }
  };

  const start = toDateStr(periodStartOf(period, cursor));
  const end = toDateStr(periodEndOf(period, cursor));
  const { data, loading, error, reload, setData } = useAsync(() => goalsApi.list({ scope, period, from: start, to: start }), [scope, period, start]);

  async function patch(goal: Goal, body: { progress?: number; done?: boolean }) {
    setActionError(null);
    const optimistic = { ...body };
    if (body.done === true) optimistic.progress = 100;
    if (body.done === false && goal.progress === 100) optimistic.progress = 0;
    if (body.progress !== undefined) optimistic.done = body.progress === 100;
    setData((list) => list?.map((g) => (g.id === goal.id ? { ...g, ...optimistic } : g)) ?? list);
    try {
      const updated = await goalsApi.update(goal.id, body);
      setData((list) => list?.map((g) => (g.id === updated.id ? updated : g)) ?? list);
    } catch (e) {
      setActionError(errorMessage(e));
      void reload();
    }
  }

  async function quickAdd() {
    const title = quick.trim();
    if (!title) return;
    try {
      await goalsApi.create({ title, period, periodStart: start });
      setQuick('');
      void reload();
    } catch (e) {
      setActionError(errorMessage(e));
    }
  }

  const goals = data ?? [];
  const doneCount = goals.filter((g) => g.done).length;
  const avg = goals.length ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length) : 0;
  const isCurrent = start === toDateStr(periodStartOf(period, new Date()));

  return (
    <PageContainer>
      <PageHeader
        icon="🎯"
        title="Hedefler"
        actions={
          <Button variant="primary" size="sm" onClick={() => setModal({ goal: null })}>
            + Hedef
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SegmentedControl<Period>
          value={period}
          onChange={setPeriod}
          options={(['daily', 'weekly', 'monthly'] as Period[]).map((p) => ({ value: p, label: PERIOD_LABELS[p] }))}
        />
        <div className="flex items-center gap-1">
          <Button size="sm" onClick={() => setCursor((c) => shiftPeriod(period, c, -1))} aria-label="Önceki">
            ‹
          </Button>
          <Button size="sm" onClick={() => setCursor(new Date())} disabled={isCurrent}>
            {period === 'daily' ? 'Bugün' : period === 'weekly' ? 'Bu hafta' : 'Bu ay'}
          </Button>
          <Button size="sm" onClick={() => setCursor((c) => shiftPeriod(period, c, 1))} aria-label="Sonraki">
            ›
          </Button>
        </div>
        <span className="text-sm font-semibold text-neutral-800">{periodLabel(period, start)}</span>
      </div>

      {goals.length > 0 && (
        <div className="mb-4 flex gap-4 text-sm text-neutral-500">
          <span>
            <b className="text-neutral-800">{doneCount}</b>/{goals.length} tamamlandı
          </span>
          <span>
            Ortalama ilerleme <b className="text-neutral-800">%{avg}</b>
          </span>
        </div>
      )}

      {error && <ErrorBox message={error} onRetry={reload} />}
      {actionError && (
        <div className="mb-3">
          <ErrorBox message={actionError} />
        </div>
      )}
      {loading && !data ? (
        <Loading />
      ) : (
        <div className="space-y-2">
          {goals.length === 0 && <Empty>Bu dönem için hedef yok. Aşağıdan ekleyebilirsin.</Empty>}
          {goals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              canEdit={g.owner.id === user.id || g.visibility === 'shared'}
              onChange={(b) => patch(g, b)}
              onOpen={() => setModal({ goal: g })}
            />
          ))}
          <div className="flex gap-2 pt-2">
            <Input
              value={quick}
              placeholder={`Yeni ${PERIOD_LABELS[period].toLocaleLowerCase('tr-TR')} hedef ekle… (Enter)`}
              onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void quickAdd()}
            />
            <Button onClick={quickAdd} disabled={!quick.trim()}>
              Ekle
            </Button>
          </div>
          <div className="pt-1 text-xs text-neutral-400">
            Dönem: {start} – {end}
          </div>
        </div>
      )}
      {modal && <GoalModal open goal={modal.goal} defaultPeriod={period} defaultDate={start} onClose={() => setModal(null)} onSaved={reload} />}
    </PageContainer>
  );
}
