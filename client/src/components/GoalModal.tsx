import { useEffect, useState, type FormEvent } from 'react';
import { goalsApi, type Goal, type Period, type Visibility } from '../api';
import { useUser } from '../context/AuthContext';
import { parseDate, PERIOD_LABELS, periodLabel, periodStartOf, toDateStr } from '../lib/dates';
import { errorMessage } from '../lib/util';
import { Modal } from './Modal';
import { OwnerBadge } from './OwnerBadge';
import { Button, Checkbox, ErrorBox, Field, Input, Select, Textarea } from './ui';
import { VisibilityToggle } from './VisibilityToggle';

interface Props {
  open: boolean;
  onClose: () => void;
  goal?: Goal | null;
  defaultPeriod?: Period;
  defaultDate?: string;
  onSaved: () => void;
}

interface FormState {
  title: string;
  description: string;
  period: Period;
  date: string;
  progress: number;
  done: boolean;
  visibility: Visibility;
}

function initial(goal: Goal | null | undefined, period?: Period, date?: string): FormState {
  return {
    title: goal?.title ?? '',
    description: goal?.description ?? '',
    period: goal?.period ?? period ?? 'weekly',
    date: goal?.periodStart ?? date ?? toDateStr(new Date()),
    progress: goal?.progress ?? 0,
    done: goal?.done ?? false,
    visibility: goal?.visibility ?? 'shared',
  };
}

export function GoalModal({ open, onClose, goal, defaultPeriod, defaultDate, onSaved }: Props) {
  const user = useUser();
  const [form, setForm] = useState<FormState>(() => initial(goal, defaultPeriod, defaultDate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial(goal, defaultPeriod, defaultDate));
      setError(null);
      setConfirmDelete(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, goal?.id]);

  const isOwner = !goal || goal.owner.id === user.id;
  const canProgress = isOwner || goal?.visibility === 'shared';
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const periodStart = toDateStr(periodStartOf(form.period, parseDate(form.date)));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Başlık gerekli.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (goal && !isOwner) {
        await goalsApi.update(goal.id, { progress: form.progress, done: form.done });
      } else {
        const body = {
          title: form.title.trim(),
          description: form.description,
          period: form.period,
          periodStart,
          progress: form.progress,
          done: form.done,
          visibility: form.visibility,
        };
        if (goal) await goalsApi.update(goal.id, body);
        else await goalsApi.create(body);
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
    if (!goal) return;
    setSaving(true);
    try {
      await goalsApi.remove(goal.id);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          {goal && <OwnerBadge owner={goal.owner} size="md" />}
          {goal ? (isOwner ? 'Hedefi düzenle' : 'Hedef') : 'Yeni hedef'}
        </span>
      }
      footer={
        <>
          {goal && isOwner &&
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
                {canProgress ? 'İptal' : 'Kapat'}
              </Button>
              {canProgress && (
                <Button variant="primary" type="submit" form="goal-form" disabled={saving}>
                  {saving ? 'Kaydediliyor…' : 'Kaydet'}
                </Button>
              )}
            </>
          )}
        </>
      }
    >
      <form id="goal-form" onSubmit={handleSubmit} className="space-y-3">
        {!isOwner && goal && (
          <p className="rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
            Bu hedefi {goal.owner.name} oluşturdu. {canProgress ? 'Yalnızca ilerlemesini değiştirebilirsin.' : 'Yalnızca sahibi düzenleyebilir.'}
          </p>
        )}
        <Field label="Başlık">
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} disabled={!isOwner} placeholder="Ör. Haftada 3 gün yürüyüş" data-autofocus />
        </Field>
        <Field label="Açıklama">
          <Textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} disabled={!isOwner} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dönem">
            <Select value={form.period} onChange={(e) => set('period', e.target.value as Period)} disabled={!isOwner}>
              {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                <option key={p} value={p}>
                  {PERIOD_LABELS[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tarih" hint={periodLabel(form.period, periodStart)}>
            <Input type="date" value={form.date} onChange={(e) => e.target.value && set('date', e.target.value)} disabled={!isOwner} />
          </Field>
        </div>
        <Field label={`İlerleme: %${form.progress}`}>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={form.progress}
            disabled={!canProgress}
            onChange={(e) => {
              const v = Number(e.target.value);
              setForm((f) => ({ ...f, progress: v, done: v === 100 }));
            }}
            className="w-full accent-blue-600"
          />
        </Field>
        <div className="flex items-center gap-2">
          <Checkbox checked={form.done} onChange={(v) => setForm((f) => ({ ...f, done: v, progress: v ? 100 : f.progress === 100 ? 0 : f.progress }))} disabled={!canProgress} label="Tamamlandı" />
          <span className="text-sm text-neutral-700">Tamamlandı</span>
        </div>
        <Field label="Görünürlük" plain>
          <VisibilityToggle value={form.visibility} onChange={(v) => set('visibility', v)} disabled={!isOwner} />
        </Field>
        {error && <ErrorBox message={error} />}
      </form>
    </Modal>
  );
}
