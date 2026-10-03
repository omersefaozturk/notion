import { useEffect, useRef, useState } from 'react';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { tasksApi, type Task, type TaskStatus } from '../api';
import { PriorityTag } from '../components/items';
import { PageContainer, PageHeader } from '../components/Layout';
import { OwnerBadge } from '../components/OwnerBadge';
import { TaskModal } from '../components/TaskModal';
import { Button, ErrorBox, Input, Loading, PrivateTag } from '../components/ui';
import { useScope } from '../context/ScopeContext';
import { fmt, toDateStr } from '../lib/dates';
import { useAsync } from '../lib/useAsync';
import { cx, errorMessage, STATUS_LABELS } from '../lib/util';

const STATUSES: TaskStatus[] = ['todo', 'doing', 'done'];
type Columns = Record<TaskStatus, Task[]>;

const COLUMN_STYLE: Record<TaskStatus, { dot: string; bg: string }> = {
  todo: { dot: 'bg-neutral-400', bg: 'bg-neutral-50' },
  doing: { dot: 'bg-blue-500', bg: 'bg-blue-50/50' },
  done: { dot: 'bg-green-500', bg: 'bg-green-50/50' },
};

function group(tasks: Task[]): Columns {
  const cols: Columns = { todo: [], doing: [], done: [] };
  for (const t of tasks) cols[t.status]?.push(t);
  for (const s of STATUSES) cols[s].sort((a, b) => a.position - b.position);
  return cols;
}

function findColumn(cols: Columns, id: string | number): TaskStatus | null {
  if (typeof id === 'string' && id.startsWith('col-')) return id.slice(4) as TaskStatus;
  for (const s of STATUSES) if (cols[s].some((t) => t.id === id)) return s;
  return null;
}

function computePosition(list: Task[], index: number): number {
  const prev = list[index - 1];
  const next = list[index + 1];
  if (prev && next) return (prev.position + next.position) / 2;
  if (prev) return prev.position + 1024;
  if (next) return next.position - 1024;
  return 1024;
}

function TaskCard({ task, onOpen, overlay }: { task: Task; onOpen?: () => void; overlay?: boolean }) {
  const today = toDateStr(new Date());
  const overdue = task.dueDate && task.status !== 'done' && task.dueDate < today;
  return (
    <div
      onClick={onOpen}
      className={cx(
        'cursor-grab rounded-lg border border-neutral-200 bg-white p-2.5 text-sm shadow-sm transition-shadow hover:shadow active:cursor-grabbing',
        overlay && 'rotate-1 shadow-lg ring-1 ring-neutral-300',
      )}
    >
      <div className="flex items-start gap-2">
        <OwnerBadge owner={task.owner} size="sm" className="mt-0.5" />
        <span className={cx('min-w-0 flex-1 break-words', task.status === 'done' && 'text-neutral-400 line-through')}>
          {task.title} {task.visibility === 'private' && <PrivateTag />}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
        <PriorityTag priority={task.priority} />
        {task.dueDate && (
          <span className={cx('rounded px-1.5 py-0.5 text-[10px]', overdue ? 'bg-red-50 text-red-600' : 'bg-neutral-100 text-neutral-600')}>
            📅 {fmt(task.dueDate, 'd MMM')}
          </span>
        )}
        {task.assignee && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-neutral-400" title={`Sorumlu: ${task.assignee.name}`}>
            Sorumlu <OwnerBadge owner={task.assignee} size="xs" />
          </span>
        )}
      </div>
    </div>
  );
}

function SortableTask({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx(isDragging && 'opacity-40')}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} onOpen={onOpen} />
    </div>
  );
}

function QuickAdd({ status, onAdded }: { status: TaskStatus; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function submit() {
    const t = title.trim();
    if (!t) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      await tasksApi.create({ title: t, status });
      setTitle('');
      onAdded();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full rounded-md px-2 py-1.5 text-left text-sm text-neutral-500 hover:bg-neutral-200/60">
        + Yeni görev
      </button>
    );
  }
  return (
    <div className="space-y-1.5">
      <Input
        ref={inputRef}
        value={title}
        disabled={busy}
        placeholder="Görev başlığı…"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit();
          if (e.key === 'Escape') {
            setTitle('');
            setOpen(false);
          }
        }}
      />
      <div className="flex gap-1">
        <Button size="sm" variant="primary" onClick={submit} disabled={busy}>
          Ekle
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setTitle(''); setOpen(false); }}>
          İptal
        </Button>
      </div>
    </div>
  );
}

function Column({ status, tasks, onOpen, onAdded }: { status: TaskStatus; tasks: Task[]; onOpen: (t: Task) => void; onAdded: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}` });
  const st = COLUMN_STYLE[status];
  return (
    <div className={cx('flex w-full min-w-[260px] flex-col rounded-xl p-2 md:w-auto', st.bg, isOver && 'ring-2 ring-blue-200')}>
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className={cx('h-2 w-2 rounded-full', st.dot)} />
        <h2 className="text-sm font-semibold text-neutral-700">{STATUS_LABELS[status]}</h2>
        <span className="text-xs text-neutral-400">{tasks.length}</span>
      </div>
      <SortableContext id={status} items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-[60px] flex-1 flex-col gap-2">
          {tasks.map((t) => (
            <SortableTask key={t.id} task={t} onOpen={() => onOpen(t)} />
          ))}
        </div>
      </SortableContext>
      <div className="mt-2">
        <QuickAdd status={status} onAdded={onAdded} />
      </div>
    </div>
  );
}

export function BoardPage() {
  const { scope } = useScope();
  const { data, loading, error, reload } = useAsync(() => tasksApi.list({ scope }), [scope]);
  const [cols, setCols] = useState<Columns>({ todo: [], doing: [], done: [] });
  const [activeId, setActiveId] = useState<number | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ task: Task | null; status?: TaskStatus } | null>(null);
  const dragOrigin = useRef<TaskStatus | null>(null);

  useEffect(() => {
    if (data) setCols(group(data));
  }, [data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeTask = activeId != null ? STATUSES.flatMap((s) => cols[s]).find((t) => t.id === activeId) ?? null : null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(Number(e.active.id));
    dragOrigin.current = findColumn(cols, e.active.id);
    setMoveError(null);
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    setCols((prev) => {
      const from = findColumn(prev, active.id);
      const to = findColumn(prev, over.id);
      if (!from || !to || from === to) return prev;
      const fromList = [...prev[from]];
      const idx = fromList.findIndex((t) => t.id === active.id);
      if (idx < 0) return prev;
      const [moved] = fromList.splice(idx, 1);
      const toList = [...prev[to]];
      const overIdx = toList.findIndex((t) => t.id === over.id);
      const insertAt = overIdx >= 0 ? overIdx : toList.length;
      toList.splice(insertAt, 0, { ...moved, status: to });
      return { ...prev, [from]: fromList, [to]: toList };
    });
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    const origin = dragOrigin.current;
    dragOrigin.current = null;
    if (!over) {
      if (data) setCols(group(data));
      return;
    }
    const col = findColumn(cols, active.id);
    if (!col) return;
    let list = cols[col];
    const oldIdx = list.findIndex((t) => t.id === active.id);
    const overIdx = list.findIndex((t) => t.id === over.id);
    if (overIdx >= 0 && overIdx !== oldIdx) list = arrayMove(list, oldIdx, overIdx);
    const newIdx = list.findIndex((t) => t.id === active.id);
    const task = list[newIdx];
    if (!task) return;
    if (origin === col && newIdx === oldIdx && overIdx === oldIdx) {
      // Dropped in place
      return;
    }
    const position = computePosition(list, newIdx);
    const updated = list.map((t) => (t.id === task.id ? { ...t, position, status: col } : t));
    setCols((prev) => ({ ...prev, [col]: updated }));
    try {
      await tasksApi.move(task.id, { status: col, position });
      void reload();
    } catch (err) {
      setMoveError(errorMessage(err));
      void reload();
    }
  }

  return (
    <PageContainer wide>
      <PageHeader
        icon="🗂️"
        title="Pano"
        subtitle="Görevleri sürükleyip bırakarak taşı"
        actions={
          <Button variant="primary" size="sm" onClick={() => setModal({ task: null, status: 'todo' })}>
            + Görev
          </Button>
        }
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {moveError && (
        <div className="mb-3">
          <ErrorBox message={moveError} />
        </div>
      )}
      {loading && !data ? (
        <Loading />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setActiveId(null);
            if (data) setCols(group(data));
          }}
        >
          <div className="flex flex-col gap-4 md:grid md:grid-cols-3">
            {STATUSES.map((s) => (
              <Column key={s} status={s} tasks={cols[s]} onOpen={(t) => setModal({ task: t })} onAdded={reload} />
            ))}
          </div>
          <DragOverlay>{activeTask ? <TaskCard task={activeTask} overlay /> : null}</DragOverlay>
        </DndContext>
      )}
      {modal && <TaskModal open task={modal.task} defaultStatus={modal.status} onClose={() => setModal(null)} onSaved={reload} />}
    </PageContainer>
  );
}
