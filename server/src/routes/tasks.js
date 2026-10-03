import { Router } from 'express';
import { z, parse, parseId, scope, visibility, taskStatus, priority, dateStr, nullableDate } from '../lib/validate.js';
import { badRequest } from '../lib/errors.js';
import { assertCanEdit, assertOwner, buildUpdate } from '../lib/access.js';
import { nowIso } from '../lib/dates.js';
import { listTasks, getTaskRow, mapTask, nextPosition } from '../services/tasks.js';

const text = (max) => z.preprocess((v) => (v === null ? '' : v), z.string().trim().max(max));
const assigneeId = z.preprocess((v) => (v === '' ? null : v), z.coerce.number().int().positive().nullable().optional());
const position = z.coerce.number().finite();

const listSchema = z.object({
  scope,
  status: taskStatus.optional(),
  dueFrom: dateStr.optional(),
  dueTo: dateStr.optional(),
});

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: text(5000).default(''),
  status: taskStatus.default('todo'),
  priority: priority.default('medium'),
  dueDate: nullableDate.optional(),
  assigneeId,
  visibility: visibility.default('shared'),
});

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: text(5000).optional(),
  status: taskStatus.optional(),
  priority: priority.optional(),
  dueDate: nullableDate.optional(),
  assigneeId,
  visibility: visibility.optional(),
  position: position.optional(),
});

const moveSchema = z.object({ status: taskStatus, position: position.optional() });

/** Fields a household member may change on someone else's shared task. */
const MEMBER_KEYS = ['status', 'position'];

async function checkAssignee(db, user, id) {
  if (id == null) return;
  const ok = await db.one('SELECT 1 FROM users WHERE id = ? AND household_id = ?', [id, user.householdId]);
  if (!ok) throw badRequest('Atanan kişi bu hanenin üyesi değil');
}

function completedAtFor(row, newStatus) {
  if (newStatus === undefined || newStatus === row.status) return undefined;
  return newStatus === 'done' ? nowIso() : null;
}

export default function taskRoutes(db) {
  const r = Router();

  r.get('/', async (req, res) => {
    res.json(await listTasks(db, req.user, parse(listSchema, req.query)));
  });

  r.post('/', async (req, res) => {
    const d = parse(createSchema, req.body);
    await checkAssignee(db, req.user, d.assigneeId);
    const now = nowIso();
    const { id } = await db.one(
      `INSERT INTO tasks (household_id, owner_id, assignee_id, title, description, status, priority, due_date,
         position, visibility, created_at, updated_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [req.user.householdId, req.user.id, d.assigneeId ?? null, d.title, d.description, d.status, d.priority,
        d.dueDate ?? null, await nextPosition(db, req.user.householdId, d.status), d.visibility, now, now,
        d.status === 'done' ? now : null],
    );
    res.status(201).json(mapTask(await getTaskRow(db, req.user, id)));
  });

  r.get('/:id', async (req, res) => {
    res.json(mapTask(await getTaskRow(db, req.user, parseId(req.params.id))));
  });

  r.patch('/:id', async (req, res) => {
    const row = await getTaskRow(db, req.user, parseId(req.params.id));
    const d = parse(updateSchema, req.body);
    assertCanEdit(req.user, row, d, MEMBER_KEYS, {
      title: row.title,
      description: row.description,
      priority: row.priority,
      dueDate: row.due_date,
      assigneeId: row.assignee_id,
      visibility: row.visibility,
    });
    if (d.assigneeId !== undefined) await checkAssignee(db, req.user, d.assigneeId);
    let pos = d.position;
    if (pos === undefined && d.status !== undefined && d.status !== row.status) {
      pos = await nextPosition(db, row.household_id, d.status);
    }
    const upd = buildUpdate('tasks', row.id, {
      title: d.title,
      description: d.description,
      status: d.status,
      priority: d.priority,
      due_date: d.dueDate,
      assignee_id: d.assigneeId,
      visibility: d.visibility,
      position: pos,
      completed_at: completedAtFor(row, d.status),
      updated_at: nowIso(),
    });
    await db.query(upd.sql, upd.params);
    res.json(mapTask(await getTaskRow(db, req.user, row.id)));
  });

  r.post('/:id/move', async (req, res) => {
    const row = await getTaskRow(db, req.user, parseId(req.params.id));
    const d = parse(moveSchema, req.body);
    assertCanEdit(req.user, row, d, MEMBER_KEYS);
    const pos = d.position ?? (d.status === row.status ? row.position : await nextPosition(db, row.household_id, d.status));
    const upd = buildUpdate('tasks', row.id, {
      status: d.status,
      position: pos,
      completed_at: completedAtFor(row, d.status),
      updated_at: nowIso(),
    });
    await db.query(upd.sql, upd.params);
    res.json(mapTask(await getTaskRow(db, req.user, row.id)));
  });

  r.delete('/:id', async (req, res) => {
    const row = await getTaskRow(db, req.user, parseId(req.params.id));
    assertOwner(req.user, row);
    await db.query('DELETE FROM tasks WHERE id = ?', [row.id]);
    res.json({ ok: true });
  });

  return r;
}
