import { useEffect, useState, type FormEvent } from 'react';
import { tasksApi, type Priority, type Task, type TaskStatus, type Visibility } from '../api';
import { useAuth, useUser } from '../context/AuthContext';
import { errorMessage, PRIORITY_LABELS, STATUS_LABELS } from '../lib/util';
import { Modal } from './Modal';
import { OwnerBadge } from './OwnerBadge';
import { Button, ErrorBox, Field, Input, Select, Textarea } from './ui';
import { VisibilityToggle } from './VisibilityToggle';

interface Props {
  open: boolean;
  onClose: () => void;
  task?: Task | null;
  defaultStatus?: TaskStatus;
  defaultDueDate?: string;
  onSaved: () => void;
}

interface FormState {
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string;
  assigneeId: string;
  visibility: Visibility;
}

function initial(task: Task | null | undefined, status?: TaskStatus, due?: string): FormState {
  return {
    title: task?.title ?? '',
    description: task?.description ?? '',
    status: task?.status ?? status ?? 'todo',
    priority: task?.priority ?? 'medium',
    dueDate: task?.dueDate ?? due ?? '',
    assigneeId: task?.assignee ? String(task.assignee.id) : '',
    visibility: task?.visibility ?? 'shared',
  };
}

export function TaskModal({ open, onClose, task, defaultStatus, defaultDueDate, onSaved }: Props) {
  const user = useUser();
  const { household } = useAuth();
  const [form, setForm] = useState<FormState>(() => initial(task, defaultStatus, defaultDueDate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial(task, defaultStatus, defaultDueDate));
      setError(null);
      setConfirmDelete(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  const isOwner = !task || task.owner.id === user.id;
  // Non-owners may only change the status of a shared task.
  const canMove = isOwner || task?.visibility === 'shared';
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Başlık gerekli.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (task && !isOwner) {
        if (canMove && form.status !== task.status) {
          await tasksApi.move(task.id, { status: form.status });
        }
      } else {
        const body = {
          title: form.title.trim(),
          description: form.description,
          priority: form.priority,
          dueDate: form.dueDate || null,
          assigneeId: form.assigneeId ? Number(form.assigneeId) : null,
          visibility: form.visibility,
        };
        if (task) {
          await tasksApi.update(task.id, body);
          if (form.status !== task.status) {
            await tasksApi.move(task.id, { status: form.status });
          }
        } else {
          await tasksApi.create({ ...body, status: form.status });
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!task) return;
    setSaving(true);
    try {
      await tasksApi.remove(task.id);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const members = household?.members ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          {task && <OwnerBadge owner={task.owner} size="md" />}
          {task ? (isOwner ? 'Görevi düzenle' : 'Görev') : 'Yeni görev'}
        </span>
      }
      footer={
        <>
          {task && isOwner &&
            (confirmDelete ? (
              <>
                <span className="mr-auto text-sm text-red-600">Silinsin mi?</span>
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Vazgeç
                </Button>
                <Button variant="danger" onClick={handleDelete} disabled={saving}>
                  Evet, sil
                </Button>
              </>
            ) : (
              <Button variant="ghost" className="mr-auto text-red-600" onClick={() => setConfirmDelete(true)}>
                Sil
              </Button>
            ))}
          {!confirmDelete && (
            <>
              <Button variant="ghost" onClick={onClose}>
                {canMove ? 'İptal' : 'Kapat'}
              </Button>
              {canMove && (
                <Button variant="primary" type="submit" form="task-form" disabled={saving}>
                  {saving ? 'Kaydediliyor…' : 'Kaydet'}
                </Button>
              )}
            </>
          )}
        </>
      }
    >
      <form id="task-form" onSubmit={handleSubmit} className="space-y-3">
        {!isOwner && task && (
          <p className="rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
            Bu görevi {task.owner.name} oluşturdu. {canMove ? 'Yalnızca durumunu değiştirebilirsin.' : 'Yalnızca sahibi düzenleyebilir.'}
          </p>
        )}
        <Field label="Başlık">
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} disabled={!isOwner} placeholder="Ör. Market alışverişi" data-autofocus />
        </Field>
        <Field label="Açıklama">
          <Textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} disabled={!isOwner} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Durum">
            <Select value={form.status} onChange={(e) => set('status', e.target.value as TaskStatus)} disabled={!canMove}>
              {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Öncelik">
            <Select value={form.priority} onChange={(e) => set('priority', e.target.value as Priority)} disabled={!isOwner}>
              {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Son tarih">
            <Input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} disabled={!isOwner} />
          </Field>
          <Field label="Sorumlu">
            <Select value={form.assigneeId} onChange={(e) => set('assigneeId', e.target.value)} disabled={!isOwner}>
              <option value="">Atanmamış</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.id === user.id ? ' (ben)' : ''}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Görünürlük" plain>
          <VisibilityToggle value={form.visibility} onChange={(v) => set('visibility', v)} disabled={!isOwner} />
        </Field>
        {error && <ErrorBox message={error} />}
      </form>
    </Modal>
  );
}
