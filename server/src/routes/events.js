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

  r.get('/', async (req, res) => {
    res.json(await listEvents(db, req.user, parse(listSchema, req.query)));
  });

  r.post('/', async (req, res) => {
    const d = parse(createSchema, req.body);
    const { start, end } = normalizeEventTimes({ start: d.start, end: d.end, allDay: d.allDay }, d.tz);
    const now = nowIso();
    const { id } = await db.one(
      `INSERT INTO events (household_id, owner_id, title, description, start, "end", all_day, location, color,
         visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [req.user.householdId, req.user.id, d.title, d.description, start, end, d.allDay, d.location,
        d.color ?? null, d.visibility, now, now],
    );
    res.status(201).json(mapEvent(await getEventRow(db, req.user, id)));
  });

  r.get('/:id', async (req, res) => {
    res.json(mapEvent(await getEventRow(db, req.user, parseId(req.params.id))));
  });

  r.patch('/:id', async (req, res) => {
    const row = await getEventRow(db, req.user, parseId(req.params.id));
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
      all_day: d.allDay,
      location: d.location,
      color: d.color,
      visibility: d.visibility,
      updated_at: nowIso(),
    });
    await db.query(upd.sql, upd.params);
    res.json(mapEvent(await getEventRow(db, req.user, row.id)));
  });

  r.delete('/:id', async (req, res) => {
    const row = await getEventRow(db, req.user, parseId(req.params.id));
    assertOwner(req.user, row);
    await db.query('DELETE FROM events WHERE id = ?', [row.id]);
    res.json({ ok: true });
  });

  return r;
}
