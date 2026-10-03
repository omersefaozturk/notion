import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { pagesApi, type Block, type Period } from '../api';
import { PageContainer, PageHeader } from '../components/Layout';
import { OwnerBadge } from '../components/OwnerBadge';
import { Button, Empty, ErrorBox, Loading, PrivateTag, SegmentedControl } from '../components/ui';
import { usePagesSignal } from '../context/PagesContext';
import { useScope } from '../context/ScopeContext';
import { useUser } from '../context/AuthContext';
import { fmt, PERIOD_LABELS, periodLabel, periodStartOf, shiftPeriod, toDateStr } from '../lib/dates';
import { useAsync } from '../lib/useAsync';
import { errorMessage, uid } from '../lib/util';

const TAB_KEY = 'ortakplan.plansTab';
const ICONS: Record<Period, string> = { daily: '🗓️', weekly: '📆', monthly: '🗒️' };

function readTab(): Period {
  try {
    const v = localStorage.getItem(TAB_KEY);
    if (v === 'daily' || v === 'weekly' || v === 'monthly') return v;
  } catch {
    /* ignore */
  }
  return 'weekly';
}

function template(period: Period): Block[] {
  const b = (type: Block['type'], text = '', extra: Partial<Block> = {}): Block => ({ id: uid(), type, text, ...extra });
  const focus = period === 'daily' ? 'Bugünün öncelikleri' : period === 'weekly' ? 'Bu haftanın öncelikleri' : 'Bu ayın öncelikleri';
  return [
    b('heading2', focus),
    b('todo', '', { checked: false }),
    b('todo', '', { checked: false }),
    b('todo', '', { checked: false }),
    b('heading2', 'Notlar'),
    b('paragraph', ''),
  ];
}

export function PlansPage() {
  const { scope } = useScope();
  const user = useUser();
  const { bump } = usePagesSignal();
  const navigate = useNavigate();
  const [period, setPeriodState] = useState<Period>(readTab);
  const [cursor, setCursor] = useState(() => new Date());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const setPeriod = (p: Period) => {
    setPeriodState(p);
    try {
      localStorage.setItem(TAB_KEY, p);
    } catch {
      /* ignore */
    }
  };

  const start = toDateStr(periodStartOf(period, cursor));
  const current = useAsync(() => pagesApi.list({ scope, period, from: start, to: start }), [scope, period, start]);
  const all = useAsync(() => pagesApi.list({ scope, period }), [scope, period]);

  const plans = current.data ?? [];
  const mineExists = plans.some((p) => p.owner.id === user.id);
  const isCurrent = start === toDateStr(periodStartOf(period, new Date()));

  async function createPlan() {
    setCreating(true);
    setCreateError(null);
    try {
      const page = await pagesApi.create({
        title: `${PERIOD_LABELS[period]} plan · ${periodLabel(period, start)}`,
        icon: ICONS[period],
        period,
        periodStart: start,
        content: template(period),
      });
      bump();
      navigate(`/pages/${page.id}`);
    } catch (e) {
      setCreateError(errorMessage(e));
    } finally {
      setCreating(false);
    }
  }

  const others = (all.data ?? []).filter((p) => p.periodStart !== start).sort((a, b) => (b.periodStart ?? '').localeCompare(a.periodStart ?? ''));

  return (
    <PageContainer>
      <PageHeader icon="🗒️" title="Planlar" subtitle="Günlük, haftalık ve aylık plan sayfaları" />
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

      <section className="rounded-xl border border-neutral-200 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-800">Bu dönemin planları</h2>
          {!mineExists && (
            <Button variant="primary" size="sm" onClick={createPlan} disabled={creating}>
              {creating ? 'Oluşturuluyor…' : '+ Plan oluştur'}
            </Button>
          )}
        </div>
        {createError && <ErrorBox message={createError} />}
        {current.error && <ErrorBox message={current.error} onRetry={current.reload} />}
        {current.loading && !current.data ? (
          <Loading />
        ) : plans.length === 0 ? (
          <Empty>Bu dönem için henüz plan yok.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {plans.map((p) => (
              <Link
                key={p.id}
                to={`/pages/${p.id}`}
                className="group rounded-lg border border-neutral-200 p-3 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{p.icon || '📄'}</span>
                  <OwnerBadge owner={p.owner} size="md" />
                  {p.visibility === 'private' && <PrivateTag />}
                </div>
                <div className="mt-2 truncate text-sm font-medium text-neutral-900">{p.title || 'Adsız'}</div>
                <div className="text-xs text-neutral-400">
                  {p.owner.name} · güncellendi {fmt(new Date(p.updatedAt), 'd MMM HH:mm')}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-neutral-800">Diğer {PERIOD_LABELS[period].toLocaleLowerCase('tr-TR')} planlar</h2>
        {all.loading && !all.data ? (
          <Loading />
        ) : others.length === 0 ? (
          <Empty>Başka plan yok.</Empty>
        ) : (
          <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
            {others.map((p) => (
              <Link key={p.id} to={`/pages/${p.id}`} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-50">
                <OwnerBadge owner={p.owner} size="sm" />
                <span>{p.icon || '📄'}</span>
                <span className="min-w-0 flex-1 truncate">{p.title || 'Adsız'}</span>
                {p.periodStart && <span className="text-xs text-neutral-400">{periodLabel(period, p.periodStart)}</span>}
              </Link>
            ))}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
