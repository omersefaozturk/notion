import { useEffect, useState, type FormEvent } from 'react';
import { addHours, parseISO } from 'date-fns';
import { eventsApi, type CalendarEvent, type Visibility } from '../api';
import { useUser } from '../context/AuthContext';
import { combineDateTime, fmt, toDateStr } from '../lib/dates';
import { errorMessage } from '../lib/util';
import { Modal } from './Modal';
import { OwnerBadge } from './OwnerBadge';
import { Button, Checkbox, ErrorBox, Field, Input, Textarea } from './ui';
import { VisibilityToggle } from './VisibilityToggle';

export interface EventDefaults {
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  allDay?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  event?: CalendarEvent | null;
  defaults?: EventDefaults;
  onSaved: () => void;
}

interface FormState {
  title: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  location: string;
  description: string;
  visibility: Visibility;
}

function initialState(event: CalendarEvent | null | undefined, defaults?: EventDefaults): FormState {
  if (event) {
    const s = parseISO(event.start);
    const e = event.end ? parseISO(event.end) : s;
    return {
      title: event.title,
      allDay: event.allDay,
      startDate: toDateStr(s),
      startTime: fmt(s, 'HH:mm'),
      endDate: toDateStr(e),
      endTime: fmt(e, 'HH:mm'),
      location: event.location ?? '',
      description: event.description ?? '',
      visibility: event.visibility,
    };
  }
  const date = defaults?.date ?? toDateStr(new Date());
  const time = defaults?.time ?? '09:00';
  const end = addHours(combineDateTime(date, time), 1);
  return {
    title: '',
    allDay: defaults?.allDay ?? !defaults?.time,
    startDate: date,
    startTime: time,
    endDate: toDateStr(end),
    endTime: fmt(end, 'HH:mm'),
    location: '',
    description: '',
    visibility: 'shared',
  };
}

export function EventModal({ open, onClose, event, defaults, onSaved }: Props) {
  const user = useUser();
  const [form, setForm] = useState<FormState>(() => initialState(event, defaults));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initialState(event, defaults));
      setError(null);
      setConfirmDelete(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id]);

  const readOnly = !!event && event.owner.id !== user.id;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    if (!form.title.trim()) {
      setError('Başlık gerekli.');
      return;
    }
    // All-day events use plain dates (YYYY-MM-DD); timed events use UTC ISO timestamps.
    let start: string;
    let end: string;
    if (form.allDay) {
      start = form.startDate;
      end = form.endDate && form.endDate >= form.startDate ? form.endDate : form.startDate;
    } else {
      const s = combineDateTime(form.startDate, form.startTime);
      const e = combineDateTime(form.endDate || form.startDate, form.endTime || form.startTime);
      if (e < s) {
        setError('Bitiş, başlangıçtan önce olamaz.');
        return;
      }
      start = s.toISOString();
      end = e.toISOString();
    }
    const body = {
      title: form.title.trim(),
      description: form.description,
      start,
      end,
      allDay: form.allDay,
      location: form.location,
      visibility: form.visibility,
    };
    setSaving(true);
    setError(null);
    try {
      if (event) await eventsApi.update(event.id, body);
      else await eventsApi.create(body);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!event) return;
    setSaving(true);
    try {
      await eventsApi.remove(event.id);
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
          {event && <OwnerBadge owner={event.owner} size="md" />}
          {event ? (readOnly ? 'Etkinlik' : 'Etkinliği düzenle') : 'Yeni etkinlik'}
        </span>
      }
      footer={
        readOnly ? (
          <Button onClick={onClose}>Kapat</Button>
        ) : (
          <>
            {event &&
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
                  İptal
                </Button>
                <Button variant="primary" type="submit" form="event-form" disabled={saving}>
                  {saving ? 'Kaydediliyor…' : 'Kaydet'}
                </Button>
              </>
            )}
          </>
        )
      }
    >
      <form id="event-form" onSubmit={handleSubmit} className="space-y-3">
        {readOnly && event && (
          <p className="rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
            Bu etkinliği {event.owner.name} oluşturdu. Yalnızca sahibi düzenleyebilir.
          </p>
        )}
        <Field label="Başlık">
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} disabled={readOnly} placeholder="Ör. Akşam yemeği" data-autofocus />
        </Field>
        <div className="flex items-center gap-2">
          <Checkbox checked={form.allDay} onChange={(v) => set('allDay', v)} disabled={readOnly} label="Tüm gün" />
          <span className="text-sm text-neutral-700">Tüm gün</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Başlangıç tarihi">
            <Input
              type="date"
              value={form.startDate}
              disabled={readOnly}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({ ...f, startDate: v, endDate: f.endDate < v ? v : f.endDate }));
              }}
            />
          </Field>
          {!form.allDay && (
            <Field label="Başlangıç saati">
              <Input type="time" value={form.startTime} disabled={readOnly} onChange={(e) => set('startTime', e.target.value)} />
            </Field>
          )}
          <Field label="Bitiş tarihi">
            <Input type="date" value={form.endDate} min={form.startDate} disabled={readOnly} onChange={(e) => set('endDate', e.target.value)} />
          </Field>
          {!form.allDay && (
            <Field label="Bitiş saati">
              <Input type="time" value={form.endTime} disabled={readOnly} onChange={(e) => set('endTime', e.target.value)} />
            </Field>
          )}
        </div>
        <Field label="Konum">
          <Input value={form.location} onChange={(e) => set('location', e.target.value)} disabled={readOnly} placeholder="İsteğe bağlı" />
        </Field>
        <Field label="Açıklama">
          <Textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} disabled={readOnly} />
        </Field>
        <Field label="Görünürlük" plain>
          <VisibilityToggle value={form.visibility} onChange={(v) => set('visibility', v)} disabled={readOnly} />
        </Field>
        {error && <ErrorBox message={error} />}
      </form>
    </Modal>
  );
}
