import { Router } from 'express';
import { z, parse, parseId, scope, visibility, period, dateStr } from '../lib/validate.js';
import { badRequest } from '../lib/errors.js';
import { assertCanEdit, assertOwner, buildUpdate, visibleClause } from '../lib/access.js';
import { nowIso, today, normalizePeriodStart, periodEnd } from '../lib/dates.js';
import { listPages, getPageRow, mapPage, isSelfOrDescendant, nextPagePosition } from '../services/pages.js';

const text = (max) => z.preprocess((v) => (v === null ? '' : v), z.string().max(max));
const parentId = z.preprocess((v) => (v === '' ? null : v), z.coerce.number().int().positive().nullable().optional());
const content = z.array(z.any(), { error: 'İçerik bir blok listesi olmalıdır' });
const nullablePeriod = z.preprocess((v) => (v === '' ? null : v), period.nullable().optional());
const nullableStart = z.preprocess((v) => (v === '' ? null : v), dateStr.nullable().optional());

const listSchema = z.object({
  scope,
  parentId: z.union([z.literal('root'), z.coerce.number().int().positive()]).optional(),
  period: period.optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
});

const createSchema = z.object({
  title: text(300).default(''),
  icon: text(32).default(''),
  parentId,
  content: content.default([]),
  period: nullablePeriod,
  periodStart: nullableStart,
  visibility: visibility.default('shared'),
});

const updateSchema = z.object({
  title: text(300).optional(),
  icon: text(32).optional(),
  parentId,
  content: content.optional(),
  period: nullablePeriod,
  periodStart: nullableStart,
  visibility: visibility.optional(),
  position: z.coerce.number().finite().optional(),
});

export default function pageRoutes(db) {
  const r = Router();

  function checkParent(user, id) {
    if (id == null) return;
    const v = visibleClause(user);
    if (!db.prepare(`SELECT 1 FROM pages t WHERE t.id = ? AND ${v.sql}`).get(id, ...v.params)) {
      throw badRequest('Üst sayfa bulunamadı');
    }
  }

  r.get('/', (req, res) => {
    res.json(listPages(db, req.user, parse(listSchema, req.query)));
  });

  r.post('/', (req, res) => {
    const d = parse(createSchema, req.body);
    checkParent(req.user, d.parentId);
    if (!d.period && d.periodStart) throw badRequest('Dönem başlangıcı için dönem seçilmelidir');
    const start = d.period ? normalizePeriodStart(d.period, d.periodStart ?? today()) : null;
    const end = d.period ? periodEnd(d.period, start) : null;
    const now = nowIso();
    const parent = d.parentId ?? null;
    const id = Number(
      db
        .prepare(
          `INSERT INTO pages (household_id, owner_id, parent_id, title, icon, content, period, period_start, period_end,
             visibility, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(req.user.householdId, req.user.id, parent, d.title, d.icon, JSON.stringify(d.content), d.period ?? null,
          start, end, d.visibility, nextPagePosition(db, req.user.householdId, parent), now, now).lastInsertRowid,
    );
    res.status(201).json(mapPage(db, req.user, getPageRow(db, req.user, id)));
  });

  r.get('/:id', (req, res) => {
    res.json(mapPage(db, req.user, getPageRow(db, req.user, parseId(req.params.id))));
  });

  r.patch('/:id', (req, res) => {
    const row = getPageRow(db, req.user, parseId(req.params.id));
    assertCanEdit(req.user, row);
    const d = parse(updateSchema, req.body);
    let parent;
    if (d.parentId !== undefined && d.parentId !== row.parent_id) {
      if (d.parentId !== null) {
        checkParent(req.user, d.parentId);
        if (isSelfOrDescendant(db, row.id, d.parentId)) throw badRequest('Sayfa kendi alt sayfasının altına taşınamaz');
      }
      parent = d.parentId;
    }
    let p;
    let start;
    let end;
    if (d.period !== undefined || d.periodStart !== undefined) {
      p = d.period === undefined ? row.period : d.period;
      if (p) {
        start = normalizePeriodStart(p, d.periodStart ?? row.period_start ?? today());
        end = periodEnd(p, start);
      } else {
        if (d.periodStart) throw badRequest('Dönem başlangıcı için dönem seçilmelidir');
        p = null;
        start = null;
        end = null;
      }
    }
    const upd = buildUpdate('pages', row.id, {
      title: d.title,
      icon: d.icon,
      parent_id: parent,
      content: d.content === undefined ? undefined : JSON.stringify(d.content),
      period: p,
      period_start: start,
      period_end: end,
      visibility: d.visibility,
      position:
        d.position ?? (parent !== undefined ? nextPagePosition(db, row.household_id, parent) : undefined),
      updated_at: nowIso(),
    });
    db.prepare(upd.sql).run(...upd.params);
    res.json(mapPage(db, req.user, getPageRow(db, req.user, row.id)));
  });

  r.delete('/:id', (req, res) => {
    const row = getPageRow(db, req.user, parseId(req.params.id));
    assertOwner(req.user, row);
    db.prepare('DELETE FROM pages WHERE id = ?').run(row.id); // children cascade via FK
    res.json({ ok: true });
  });

  return r;
}
