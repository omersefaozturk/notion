import { Router } from 'express';
import { z, parse, parseId, scope, visibility, color, isoStr, tz } from '../lib/validate.js';
import { assertCanEdit, assertOwner, buildUpdate } from '../lib/access.js';
import { nowIso } from '../lib/dates.js';
import { listEvents, getEventRow, mapEvent, normalizeEventTimes } from '../services/events.js';

const text = (max) => z.preprocess((v) => (v === null ? '' : v), z.string().trim().max(max));

const listSchema = z.object({ scope, tz, from: isoStr.optional(), to: isoStr.optional() });

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: text(5000).default(''),
  start: isoStr,
  end: z.preprocess((v) => (v === '' ? null : v), isoStr.nullable().optional()),
  allDay: z.boolean().default(false),
  location: text(300).default(''),
  color: z.preprocess((v) => (v === '' ? null : v), color.nullable().optional()),
  visibility: visibility.default('shared'),
  tz,
});

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: text(5000).optional(),
  start: isoStr.optional(),
  end: z.preprocess((v) => (v === '' ? null : v), isoStr.nullable().optional()),
  allDay: z.boolean().optional(),
  location: text(300).optional(),
  color: z.preprocess((v) => (v === '' ? null : v), color.nullable().optional()),
  visibility: visibility.optional(),
  tz,
});

export default function eventRoutes(db) {
  const r = Router();

  r.get('/', (req, res) => {
    res.json(listEvents(db, req.user, parse(listSchema, req.query)));
  });

  r.post('/', (req, res) => {
    const d = parse(createSchema, req.body);
    const { start, end } = normalizeEventTimes({ start: d.start, end: d.end, allDay: d.allDay }, d.tz);
    const now = nowIso();
    const id = Number(
      db
        .prepare(
          `INSERT INTO events (household_id, owner_id, title, description, start, "end", all_day, location, color,
             visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(req.user.householdId, req.user.id, d.title, d.description, start, end, d.allDay ? 1 : 0, d.location,
          d.color ?? null, d.visibility, now, now).lastInsertRowid,
    );
    res.status(201).json(mapEvent(getEventRow(db, req.user, id)));
  });

  r.get('/:id', (req, res) => {
    res.json(mapEvent(getEventRow(db, req.user, parseId(req.params.id))));
  });

  r.patch('/:id', (req, res) => {
    const row = getEventRow(db, req.user, parseId(req.params.id));
    assertCanEdit(req.user, row);
    const d = parse(updateSchema, req.body);
    const allDay = d.allDay ?? !!row.all_day;
    const rawStart = d.start ?? row.start;
    let rawEnd = d.end === null ? rawStart : d.end ?? row.end;
    const tzName = d.tz;
    // moving the start past the old end (without sending a new end) collapses the event to its start
    if (d.start && d.end === undefined) {
      const probe = normalizeEventTimes({ start: rawStart, end: rawStart, allDay }, tzName);
      const oldEnd = normalizeEventTimes({ start: row.end, end: row.end, allDay }, tzName);
      if (oldEnd.start < probe.start) rawEnd = rawStart;
    }
    const { start, end } = normalizeEventTimes({ start: rawStart, end: rawEnd, allDay }, tzName);
    const upd = buildUpdate('events', row.id, {
      title: d.title,
      description: d.description,
      start: start !== row.start ? start : undefined,
      end: end !== row.end ? end : undefined,
      all_day: d.allDay === undefined ? undefined : d.allDay ? 1 : 0,
      location: d.location,
      color: d.color,
      visibility: d.visibility,
      updated_at: nowIso(),
    });
    db.prepare(upd.sql).run(...upd.params);
    res.json(mapEvent(getEventRow(db, req.user, row.id)));
  });

  r.delete('/:id', (req, res) => {
    const row = getEventRow(db, req.user, parseId(req.params.id));
    assertOwner(req.user, row);
    db.prepare('DELETE FROM events WHERE id = ?').run(row.id);
    res.json({ ok: true });
  });

  return r;
}
